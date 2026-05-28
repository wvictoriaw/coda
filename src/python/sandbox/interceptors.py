import builtins
import os

BLOCKED_MODULES = set()

_original_open = builtins.open
_original_import = builtins.__import__

_written_files: list[str] = []


def get_written_files() -> list[str]:
    return list(_written_files)


def reset_written_files():
    global _written_files
    _written_files = []


def make_sandboxed_open(sandbox_dir: str):
    def _sandboxed_open(path, mode="r", **kwargs):
        if any(m in mode for m in ("w", "a", "x")):
            filename = os.path.basename(path)
            redirected = os.path.join(sandbox_dir, filename)
            _written_files.append(redirected)
            return _original_open(redirected, mode, **kwargs)
        return _original_open(path, mode, **kwargs)
    return _sandboxed_open


def safe_import(name, *args, **kwargs):
    root = name.split('.')[0]
    if root in BLOCKED_MODULES:
        import traceback
        import sys
        traceback.print_stack(file=sys.stderr)
        raise ImportError(f"Module '{name}' is blocked in the Coda sandbox")
    return _original_import(name, *args, **kwargs)


def install(sandbox_dir: str):
    reset_written_files()
    builtins.open = make_sandboxed_open(sandbox_dir)
    builtins.__import__ = safe_import


def uninstall():
    builtins.open = _original_open
    builtins.__import__ = _original_import