import sys
import os
import io
import json
import traceback
import multiprocessing
import types
from interceptors import install, uninstall, get_written_files
from tracer import make_tracer, _serialize

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


def _isolated_execution(conn, snippet, injected_vars, sandbox_dir):
    os.makedirs(sandbox_dir, exist_ok=True)
    install(sandbox_dir)

    tracer_fn, captured_steps = make_tracer()
    namespace = dict(injected_vars)

    old_stdout = sys.stdout
    sys.stdout = PipeWriter(conn)

    try:
        code = compile(snippet, '<snippet>', 'exec')
        sys.settrace(tracer_fn)
        exec(code, namespace)
        sys.settrace(None)

        # Flush any remaining buffered output
        sys.stdout.flush()

        conn.send({
            'type': 'result',
            'success': True,
            'steps': captured_steps,
            'files_written': get_written_files(),
            'final_vars': {
                k: _serialize(v) for k, v in namespace.items()
                if not k.startswith('_')
                and not isinstance(v, types.ModuleType)
                and not isinstance(v, types.FunctionType)
            }
        })
    except Exception as e:
        sys.settrace(None)
        sys.stdout.flush()
        conn.send({
            'type': 'result',
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'steps': captured_steps
        })
    finally:
        sys.stdout = old_stdout
        uninstall()


def run(snippet: str, injected_vars: dict, sandbox_dir: str, on_print=None) -> dict:
    parent_conn, child_conn = multiprocessing.Pipe()
    p = multiprocessing.Process(
        target=_isolated_execution,
        args=(child_conn, snippet, injected_vars, sandbox_dir)
    )
    p.start()

    result = None
    import time
    start = time.time()

    while time.time() - start < 60:
        if parent_conn.poll(0.1):
            msg = parent_conn.recv()
            if msg['type'] == 'print':
                if on_print:
                    on_print(msg['line'])
            elif msg['type'] == 'result':
                result = msg
                break

    p.join(timeout=2)

    if result is None:
        p.terminate()
        return {
            'success': False,
            'error': 'Execution timed out (60s limit)',
            'steps': []
        }

    return result