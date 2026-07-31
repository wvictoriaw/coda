import sys
import os
import io
import json
import traceback
import multiprocessing
import types
import tempfile
import pickle
from interceptors import install, uninstall, get_written_files
from tracer import make_tracer, _serialize
import textwrap

class PipeWriter(io.TextIOBase):
    """
    Replacement for sys.stdout that sends each line
    to the parent process immediately via the pipe.
    """
    def __init__(self, conn):
        self.conn = conn
        self.buf = ''

    def write(self, text):
        self.buf += text
        while '\n' in self.buf:
            line, self.buf = self.buf.split('\n', 1)
            if line:
                self.conn.send({'type': 'print', 'line': line})
        return len(text)

    def flush(self):
        if self.buf:
            self.conn.send({'type': 'print', 'line': self.buf})
            self.buf = ''


def resolve_vars(injected_vars: dict, namespace: dict) -> dict:
    """
    Try to evaluate string values as Python expressions.
    Falls back to the raw string if evaluation fails.
    """
    resolved = {}
    for k, v in injected_vars.items():
        if isinstance(v, str):
            try:
                resolved[k] = eval(v, namespace)
            except Exception:
                resolved[k] = v
        else:
            resolved[k] = v
    return resolved


def _isolated_execution(result_path, conn, snippet, injected_vars, sandbox_dir, workspace_root=None, context=''):
    # Dedent and clean snippet
    lines = [l for l in snippet.splitlines() if l.strip()]
    snippet = textwrap.dedent('\n'.join(lines))

    os.makedirs(sandbox_dir, exist_ok=True)
    install(sandbox_dir)

    if workspace_root and workspace_root not in sys.path:
        sys.path.insert(0, workspace_root)

    tracer_fn, captured_steps = make_tracer()
    namespace = dict(injected_vars)

    old_stdout = sys.stdout
    sys.stdout = PipeWriter(conn)

    # Run context first without tracing
    if context:
        try:
            exec(compile(context, '<context>', 'exec'), namespace)
        except Exception:
            pass  # context errors are non-fatal

    namespace.update(resolve_vars(injected_vars, namespace))

    # Snapshot after context, before snippet
    pre_exec_snapshot = set(namespace.keys())

    result = None

    try:
        code = compile(snippet, '<snippet>', 'exec')
        sys.settrace(tracer_fn)
        exec(code, namespace)
        sys.settrace(None)

        sys.stdout.flush()
        print("exec complete", file=sys.__stderr__)
        
        # Test serialize individually
        for k, v in namespace.items():
            if not k.startswith('_'):
                print(f"serializing {k}: {type(v)}", file=sys.__stderr__)
                try:
                    _serialize(v)
                    print(f"done {k}", file=sys.__stderr__)
                except Exception as e:
                    print(f"failed {k}: {e}", file=sys.__stderr__)

        print(f"captured steps: {len(captured_steps)}", file=sys.__stderr__)
        result = {
            'type': 'result',
            'success': True,
            'steps': captured_steps,
            'files_written': get_written_files(),
            'final_vars': {
                k: _serialize(v) for k, v in namespace.items()
                if (k == '__coda_probe_result__')
                or not k.startswith('_')
                and not isinstance(v, types.ModuleType)
                and not isinstance(v, types.FunctionType)
                and (
                    k in injected_vars
                    or k not in pre_exec_snapshot
                )
            }
        }
        
    except Exception as e:
        sys.settrace(None)
        sys.stdout.flush()
        result = {
            'type': 'result',
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'steps': captured_steps
        }
    finally:
        sys.stdout = old_stdout
        uninstall()

    # Write result to temp file — avoids pipe buffer overflow for large DataFrames
    try:
        with open(result_path, 'wb') as f:
            pickle.dump(result, f)
    except Exception as e:
        # If pickle fails, write a minimal error result
        with open(result_path, 'wb') as f:
            pickle.dump({
                'type': 'result',
                'success': False,
                'error': f'Failed to serialize result: {e}',
                'steps': []
            }, f)

    print(f"about to write result", file=sys.__stderr__)
    print(f"steps count: {len(captured_steps)}", file=sys.__stderr__)

    with open(result_path, 'wb') as f:
        pickle.dump(result, f)
        
    print(f"write complete", file=sys.__stderr__)
    conn.send({'type': 'done'})
    print(f"done sent", file=sys.__stderr__)


def run(snippet: str, injected_vars: dict, sandbox_dir: str, workspace_root=None, on_print=None, context='') -> dict:
    # Create temp file for result
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pkl') as f:
        result_path = f.name

    parent_conn, child_conn = multiprocessing.Pipe(duplex=False)

    p = multiprocessing.Process(
        target=_isolated_execution,
        args=(result_path, child_conn, snippet, injected_vars, sandbox_dir, workspace_root, context)
    )
    p.start()

    import time
    start = time.time()

    while time.time() - start < 60:
        if parent_conn.poll(0.1):
            msg = parent_conn.recv()
            print(f"parent received: {msg.get('type')}", file=sys.stderr)
            if msg['type'] == 'print':
                if on_print:
                    on_print(msg['line'])
            elif msg['type'] == 'done':
                print("parent got done, breaking", file=sys.stderr)
                break

    p.join(timeout=2)

    # Read result from temp file
    print(f"reading result from {result_path}", file=sys.stderr)
    try:
        with open(result_path, 'rb') as f:   
            result = pickle.load(f)
        print(f"result read successfully", file=sys.stderr)   
    except Exception as e:
        result = {
            'success': False,
            'error': f'Failed to read result: {e}',
            'steps': []
        }
    finally:
        try:
            os.unlink(result_path)
        except Exception:
            pass

    if result is None:
        p.terminate()
        return {
            'success': False,
            'error': 'Execution timed out (60s limit)',
            'steps': []
        }

    return result