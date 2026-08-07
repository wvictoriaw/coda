import ast


def find_enclosing_function(tree, snippet_start_line: int):
    """Find the top-level function that contains the snippet line."""
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.lineno <= snippet_start_line <= node.end_lineno:
                return node
    return None


def extract_context(file_content: str, snippet_start_line: int) -> str:
    try:
        tree = ast.parse(file_content)
    except SyntaxError:
        return ''

    lines = file_content.splitlines()

    # Find the enclosing function
    enclosing = find_enclosing_function(tree, snippet_start_line)

    if enclosing:
        # Include everything above the enclosing function — no filtering
        cutoff_line = enclosing.lineno - 1
        global_context = '\n'.join(lines[:cutoff_line])

        # Include function-level context (existing logic)
        context_nodes = []
        for node in ast.iter_child_nodes(tree):
            if not isinstance(node, (
                ast.Import,
                ast.ImportFrom,
                ast.FunctionDef,
                ast.AsyncFunctionDef,
                ast.ClassDef,
            )):
                continue
            if node.end_lineno >= snippet_start_line:
                continue
            if node.lineno >= enclosing.lineno:
                continue
            context_nodes.append(node)

        function_chunks = []
        for node in context_nodes:
            node_lines = lines[node.lineno - 1:node.end_lineno]
            function_chunks.append('\n'.join(node_lines))

        parts = []
        if global_context.strip():
            parts.append(global_context)
        if function_chunks:
            parts.append('\n\n'.join(function_chunks))

        return '\n\n'.join(parts)

    else:
        # No enclosing function — original behaviour
        context_nodes = []
        for node in ast.iter_child_nodes(tree):
            if node.end_lineno >= snippet_start_line:
                continue
            if isinstance(node, (
                ast.Import,
                ast.ImportFrom,
                ast.FunctionDef,
                ast.AsyncFunctionDef,
                ast.ClassDef,
            )):
                context_nodes.append(node)

        if not context_nodes:
            return ''

        chunks = []
        for node in context_nodes:
            node_lines = lines[node.lineno - 1:node.end_lineno]
            chunks.append('\n'.join(node_lines))

        return '\n\n'.join(chunks)