import sys
import types


def _serialize(value):
    if isinstance(value, (str, int, float, bool, type(None))):
        return value
    if isinstance(value, types.ModuleType):
        return f"<module '{value.__name__}'>"

    # DataFrame
    if hasattr(value, 'to_dict') and hasattr(value, 'shape') and hasattr(value, 'columns'):
        try:
            rows, cols = value.shape
            return {
                '__type': 'dataframe',
                'rows': rows,
                'cols': cols,
                'columns': list(str(c) for c in value.columns),
                'preview': value.head(10).to_dict(orient='records') if rows > 0 else [],
                'too_wide': cols > 20,
            }
        except Exception:
            return str(value)

    # Series
    if hasattr(value, 'to_list') and hasattr(value, 'dtype') and hasattr(value, 'name') and not hasattr(value, 'columns'):
        try:
            return {
                '__type': 'series',
                'name': str(value.name) if value.name is not None else None,
                'length': len(value),
                'dtype': str(value.dtype),
                'preview': value.head(10).tolist(),
            }
        except Exception:
            return str(value)

    # ndarray
    if hasattr(value, 'shape') and hasattr(value, 'dtype') and hasattr(value, 'tolist') and not hasattr(value, 'columns'):
        try:
            shape = list(value.shape)
            ndim = len(shape)
            too_wide = ndim == 2 and shape[1] > 20
            if ndim == 1:
                preview = value.tolist()
            else:
                preview = value[:10].tolist()
            return {
                '__type': 'ndarray',
                'shape': shape,
                'dtype': str(value.dtype),
                'preview': preview,
                'too_wide': too_wide,
            }
        except Exception:
            return str(value)

    # numpy scalar
    if hasattr(value, 'item') and callable(getattr(value, 'item', None)) and not isinstance(value, type):
        try:
            return value.item()
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