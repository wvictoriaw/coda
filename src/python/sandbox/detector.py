import ast
import builtins
import sys
import textwrap


def detect_external_vars(snippet: str, context: str = '') -> list[str]:
    try:
        lines = [l for l in snippet.splitlines() if l.strip()]
        snippet = textwrap.dedent('\n'.join(lines))
        tree = ast.parse(snippet)
    except SyntaxError as e:
        print(f"syntax error: {e}", file=sys.stderr)
        raise

    # Build context_assigned — everything defined in the context block
    context_assigned = set()
    if context:
        try:
            context_tree = ast.parse(context)
            for node in ast.iter_child_nodes(context_tree):
                if isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            context_assigned.add(target.id)
                elif isinstance(node, ast.AnnAssign):
                    if isinstance(node.target, ast.Name):
                        context_assigned.add(node.target.id)
                elif isinstance(node, ast.AugAssign):
                    if isinstance(node.target, ast.Name):
                        context_assigned.add(node.target.id)
                elif isinstance(node, ast.Import):
                    for alias in node.names:
                        context_assigned.add(alias.asname if alias.asname else alias.name)
                elif isinstance(node, ast.ImportFrom):
                    for alias in node.names:
                        context_assigned.add(alias.asname if alias.asname else alias.name)
                elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    context_assigned.add(node.name)
                    # for arg in node.args.args:
                    #     context_assigned.add(arg.arg)
                elif isinstance(node, ast.ClassDef):
                    context_assigned.add(node.name)
        except SyntaxError:
            raise SyntaxError(f"syntax error in context: {e.msg} (line {e.lineno})")

    builtins_set = set(dir(builtins))
    assigned_so_far = set()
    external = set()

    def is_known(name: str) -> bool:
        return (
            name in assigned_so_far
            or name in context_assigned
            or name in builtins_set
            or name.startswith('__')
        )

    def collect_used(node) -> set[str]:
        """Collect all Name loads in an expression node."""
        used = set()
        for n in ast.walk(node):
            if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load):
                used.add(n.id)
        return used

    def check_used(node):
        """Flag any unknown names used in an expression as external."""
        for name in collect_used(node):
            if not is_known(name):
                external.add(name)

    def process_statements(stmts):
        """Walk a list of statements in order, tracking assignments."""
        for node in stmts:

            if isinstance(node, ast.Assign):
                # Right side is evaluated before assignment — check it first
                check_used(node.value)
                # Handle tuple unpacking: a, b = ...
                for target in node.targets:
                    for n in ast.walk(target):
                        if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store):
                            assigned_so_far.add(n.id)

            elif isinstance(node, ast.AnnAssign):
                if node.value:
                    check_used(node.value)
                if isinstance(node.target, ast.Name):
                    assigned_so_far.add(node.target.id)

            elif isinstance(node, ast.AugAssign):
                # x += 1 — x must already exist
                if isinstance(node.target, ast.Name):
                    if not is_known(node.target.id):
                        external.add(node.target.id)
                    assigned_so_far.add(node.target.id)
                check_used(node.value)

            elif isinstance(node, ast.Import):
                for alias in node.names:
                    assigned_so_far.add(alias.asname if alias.asname else alias.name)

            elif isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    assigned_so_far.add(alias.asname if alias.asname else alias.name)

            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # Function name is assigned immediately
                assigned_so_far.add(node.name)
                # Don't recurse into the body — it has its own scope
                # But check default argument values
                for default in node.args.defaults + node.args.kw_defaults:
                    if default:
                        check_used(default)

            elif isinstance(node, ast.ClassDef):
                assigned_so_far.add(node.name)
                # Check base classes
                for base in node.bases:
                    check_used(base)

            elif isinstance(node, ast.For):
                # Iterator is evaluated before loop var is assigned
                check_used(node.iter)
                for n in ast.walk(node.target):
                    if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store):
                        assigned_so_far.add(n.id)
                process_statements(node.body)
                process_statements(node.orelse)

            elif isinstance(node, ast.With):
                for item in node.items:
                    check_used(item.context_expr)
                    if item.optional_vars:
                        for n in ast.walk(item.optional_vars):
                            if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store):
                                assigned_so_far.add(n.id)
                process_statements(node.body)

            elif isinstance(node, ast.If):
                check_used(node.test)
                process_statements(node.body)
                process_statements(node.orelse)

            elif isinstance(node, ast.While):
                check_used(node.test)
                process_statements(node.body)
                process_statements(node.orelse)

            elif isinstance(node, ast.Try):
                process_statements(node.body)
                for handler in node.handlers:
                    if handler.name:
                        assigned_so_far.add(handler.name)
                    if handler.type:
                        check_used(handler.type)
                    process_statements(handler.body)
                process_statements(node.orelse)
                if hasattr(node, 'finalbody'):
                    process_statements(node.finalbody)
            
            elif isinstance(node, ast.Return):
                if node.value:
                    check_used(node.value)

            elif isinstance(node, ast.Expr):
                check_used(node.value)

            elif isinstance(node, ast.Delete):
                check_used(node)

            else:
                # Catch-all for any other statement types
                for child in ast.walk(node):
                    if isinstance(child, ast.Name) and isinstance(child.ctx, ast.Load):
                        if not is_known(child.id):
                            external.add(child.id)

    process_statements(tree.body)
    
    print(f"snippet: {repr(snippet)}", file=sys.stderr)
    print(f"assigned_so_far: {assigned_so_far}", file=sys.stderr)
    print(f"context_assigned: {context_assigned}", file=sys.stderr)
    print(f"external: {external}", file=sys.stderr)
        
    return list(external)