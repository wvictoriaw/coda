import sys
import os
import io
import traceback
import multiprocessing
import types
from interceptors import install, uninstall, get_written_files
from tracer import make_tracer, _serialize

def _isolated_execution(conn, snippet, injected_vars, sandbox_dir):
    """Inner worker that runs the actual code."""
    os.makedirs(sandbox_dir, exist_ok=True)
    install(sandbox_dir)

    tracer_fn, captured_steps = make_tracer()
    namespace = dict(injected_vars)
    
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    
    

    try:
        code = compile(snippet, '<snippet>', 'exec')
        sys.settrace(tracer_fn)
        exec(code, namespace)
        sys.settrace(None)

        conn.send({
            'success': True,
            'steps': captured_steps,
            'prints': sys.stdout.getvalue().splitlines(),
            'files_written': get_written_files(),
            'final_vars': {k: _serialize(v) for k, v in namespace.items() \
                if not k.startswith('_') \
                and not isinstance(v, types.ModuleType) \
                and not isinstance(v, types.FunctionType)}
        })
    except Exception as e:
        sys.settrace(None)
        conn.send({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'prints': sys.stdout.getvalue().splitlines(),
            'steps': captured_steps
        })
    finally:
        sys.stdout = old_stdout
        uninstall()

def run(snippet: str, injected_vars: dict, sandbox_dir: str) -> dict:
    parent_conn, child_conn = multiprocessing.Pipe()
    p = multiprocessing.Process(target=_isolated_execution, args=(child_conn, snippet, injected_vars, sandbox_dir))
    p.start()
    
    # 60-second timeout safeguard
    if parent_conn.poll(60):
        result = parent_conn.recv()
    else:
        p.terminate()
        result = {'success': False, 'error': 'Execution timed out (60s limit)'}
    
    p.join()
    return result