import ast
import builtins


def detect_external_vars(snippet: str, context: str = '') -> list[str]:
    try:
        tree = ast.parse(snippet)
    except SyntaxError:
        return []

    # Parse context and add all its definitions to assigned
    context_assigned = set()
    if context:
        try:
            context_tree = ast.parse(context)
            for node in ast.walk(context_tree):
                if isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            context_assigned.add(target.id)
                elif isinstance(node, ast.Import):
                    for alias in node.names:
                        context_assigned.add(alias.asname if alias.asname else alias.name)
                elif isinstance(node, ast.ImportFrom):
                    for alias in node.names:
                        context_assigned.add(alias.asname if alias.asname else alias.name)
                elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    context_assigned.add(node.name)
                elif isinstance(node, ast.ClassDef):
                    context_assigned.add(node.name)
        except SyntaxError:
            pass

    import sys
    print(f"context received: {repr(context[:50]) if context else 'EMPTY'}", file=sys.stderr)
    print(f"context_assigned: {context_assigned}", file=sys.stderr)
    assigned = set()
    used = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    assigned.add(target.id)
        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name):
                assigned.add(node.target.id)
        elif isinstance(node, ast.AugAssign):
            if isinstance(node.target, ast.Name):
                assigned.add(node.target.id)
                used.add(node.target.id)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                assigned.add(alias.asname if alias.asname else alias.name)
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                assigned.add(alias.asname if alias.asname else alias.name)
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            used.add(node.id)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            assigned.add(node.name)
            for arg in node.args.args:
                assigned.add(arg.arg)

    builtins_set = set(dir(builtins))
    external = used - assigned - builtins_set - context_assigned
    return [v for v in external if not v.startswith('__')]