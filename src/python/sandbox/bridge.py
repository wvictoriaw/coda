import sys
print(f"Python: {sys.version}", file=sys.stderr)
print(f"Args: {sys.argv}", file=sys.stderr)

import sys
import os
import json
from enum import Enum

from context_extractor import extract_context

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
        result = detect_external_vars(
            payload['snippet'],
            payload.get('context', '')
        )
        print(json.dumps(result))

    elif mode == 'run':
        # Ensure we have a valid sandbox directory
        result = run(
            payload['snippet'],
            payload.get('vars', {}),
            payload['sandbox_dir']
        )
        print(json.dumps(result, cls=EnhancedEncoder))
    
    elif mode == 'context':
        result = extract_context(
            payload['file_content'],
            payload['snippet_start_line']
        )
        print(json.dumps(result))

    else:
        print(json.dumps({'error': f"Unknown mode: {mode}"}))

if __name__ == '__main__':
    main()