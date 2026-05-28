import sys
import types

def _serialize(value):
    if isinstance(value, (str, int, float, bool, type(None))):
        return value
    if isinstance(value, types.ModuleType):
        return f"<module '{value.__name__}'>"
    # Check for numpy scalar first (has item() method and is an instance not a class)
    if hasattr(value, 'item') and callable(getattr(value, 'item', None)) and not isinstance(value, type):
        try:
            return value.item()
        except Exception:
            pass
    # Check for numpy array or anything with tolist that's an instance not a class
    if hasattr(value, 'tolist') and callable(getattr(value, 'tolist', None)) and not isinstance(value, type):
        try:
            return value.tolist()
        except Exception:
            pass
    
    if isinstance(value, (list, tuple)):
        return [_serialize(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _serialize(v) for k, v in value.items()}
    if isinstance(value, set):
        return list(value)
    return str(value)


def _get_changed(current_locals: dict, prev: dict) -> dict:
    changed = {}
    for k, v in current_locals.items():
        if k.startswith('_'):
            continue
        try:
            prev_val = prev.get(k, '__undefined__')
            serialized = _serialize(v)
            if prev_val == '__undefined__':
                changed[k] = {'from': None, 'to': serialized, 'new': True}
            elif _serialize(prev_val) != serialized:
                changed[k] = {'from': _serialize(prev_val), 'to': serialized, 'new': False}
        except Exception:
            pass
    return changed


def _get_all_vars(current_locals: dict) -> dict:
    all_vars = {}
    for k, v in current_locals.items():
        if k.startswith('_'):
            continue
        try:
            all_vars[k] = _serialize(v)
        except Exception:
            all_vars[k] = '<unserializable>'
    return all_vars


def make_tracer():
    captured_steps = []
    prev = {}
    snippet_frame = None

    def _tracer(frame, event, arg):
        nonlocal prev, snippet_frame

        # Only trace the snippet's own frame, not imports or internal frames
        if snippet_frame is None:
            if frame.f_code.co_filename == '<snippet>':
                snippet_frame = frame
            else:
                return None

        if frame is not snippet_frame:
            return None

        if event not in ('line', 'return', 'exception'):
            return _tracer

        current_locals = dict(frame.f_locals)
        lineno = frame.f_lineno
        changed = _get_changed(current_locals, prev)
        all_vars = _get_all_vars(current_locals)

        if event == 'exception':
            exc_type, exc_value, _ = arg
            captured_steps.append({
                'line': lineno,
                'event': 'exception',
                'exception': f"{exc_type.__name__}: {exc_value}",
                'changed': changed,
                'all_vars': all_vars
            })
        elif event == 'return':
            captured_steps.append({
                'line': lineno,
                'event': 'return',
                'return_value': _serialize(arg),
                'changed': changed,
                'all_vars': all_vars
            })
        else:
            captured_steps.append({
                'line': lineno,
                'event': 'line',
                'changed': changed,
                'all_vars': all_vars
            })

        prev = dict(current_locals)
        return _tracer

    return _tracer, captured_steps