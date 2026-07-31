from ast import expr
import sys
import textwrap
print(f"Python: {sys.version}", file=sys.stderr)
print(f"Args: {sys.argv}", file=sys.stderr)

import sys
import os
import json
from enum import Enum

from context_extractor import extract_context

if sys.platform == 'win32':
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# --- 1. Bootstrap the Vendor Environment ---
# We calculate the path to the 'vendor' folder relative to this file
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
VENDOR_PATH = os.path.join(CURRENT_DIR, "vendor")

if VENDOR_PATH not in sys.path:
    sys.path.insert(0, VENDOR_PATH)

# --- 2. Import Sandbox Modules ---
from detector import detect_external_vars
from runner import run

class EnhancedEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Enum):
            return obj.value
        if hasattr(obj, "tolist"):
            return obj.tolist()
        return super().default(obj)

def main():
    raw = sys.stdin.read()
    if not raw.strip():
        return
        
    payload = json.loads(raw)
    mode = payload.get('mode', 'run')

    if mode == 'detect':
        try:
            result = detect_external_vars(
                payload['snippet'],
                payload.get('context', '')
            )
            print(json.dumps(result))
        except SyntaxError as e:
            print(json.dumps({'__coda_syntax_error': f"{e.msg} (line {e.lineno})"}))

    elif mode == 'run':
        def stream_print(line):
            print(json.dumps({'type': 'print', 'line': line}), flush=True)

        result = run(
            payload['snippet'],
            payload.get('vars', {}),
            payload['sandbox_dir'],
            on_print=stream_print,
            workspace_root=payload.get('workspace_root'),
            context=payload.get('context', '')
        )
        print("run returned", file=sys.stderr)
        result['type'] = 'result'
        print("about to json dumps", file=sys.stderr)
        encoded = json.dumps(result, cls=EnhancedEncoder)
        print(f"json dumps complete, length: {len(encoded)}", file=sys.stderr)
        print(encoded, flush=True)
        print("print complete", file=sys.stderr)
        # print(json.dumps(result, cls=EnhancedEncoder), flush=True)
    
    elif mode == 'context':
        try:
            result = extract_context(
                payload['file_content'],
                payload['snippet_start_line']
            )
            print(json.dumps(result))
        except (UnicodeEncodeError, UnicodeDecodeError):
            print(json.dumps(''))
            
    elif mode == 'probe':
        def stream_print(line):
            pass  # discard prints during probe

        
        # Run the full snippet to restore state
        probe_result = run(
            payload['snippet'],
            payload.get('vars', {}),
            payload['sandbox_dir'],
            on_print=stream_print,
            workspace_root=payload.get('workspace_root'),
            context=payload.get('context', '')
        )

        if not probe_result.get('success'):
            print(json.dumps({'__coda_probe_error': probe_result.get('error', 'snippet failed')}))
        else:
            # Evaluate the expression against the final namespace
            namespace = probe_result.get('final_vars', {})
            # Re-run context and snippet to get live objects
            expr = payload.get('expression', '')
            snippet = payload['snippet']
            lines = [l for l in snippet.splitlines() if l.strip()]
            clean_snippet = textwrap.dedent('\n'.join(lines))
            try:
                probe_run = run(
                    clean_snippet + f"\n__coda_probe_result__ = {expr}",
                    payload.get('vars', {}),
                    payload['sandbox_dir'],
                    on_print=stream_print,
                    workspace_root=payload.get('workspace_root'),
                    context=payload.get('context', '')
                )
                if probe_run.get('success'):
                    val = probe_run.get('final_vars', {}).get('__coda_probe_result__')
                    print(f"probe value: {val}", file=sys.stderr)
                    print(json.dumps({'__coda_probe_value': val}))
                else:
                    print(json.dumps({'__coda_probe_error': probe_run.get('error', 'eval failed')}))
            except Exception as e:
                print(json.dumps({'__coda_probe_error': str(e)}))

    else:
        print(json.dumps({'error': f"Unknown mode: {mode}"}))

if __name__ == '__main__':
    main()