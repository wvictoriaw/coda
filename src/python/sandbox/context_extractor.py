import ast


def extract_context(file_content: str, snippet_start_line: int) -> str:
    """
    Given the full file content and the line number where the snippet starts,
    extract all imports and top-level definitions that appear before that line.
    Returns them as a runnable string to prepend to the snippet.
    """
    try:
        tree = ast.parse(file_content)
    except SyntaxError:
        return ''

    lines = file_content.splitlines()
    context_nodes = []

    for node in ast.iter_child_nodes(tree):
        # Only take nodes that end before the snippet starts
        if node.end_lineno > snippet_start_line:
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

    # Extract source lines for each node
    chunks = []
    for node in context_nodes:
        # lineno is 1-indexed
        node_lines = lines[node.lineno - 1:node.end_lineno]
        chunks.append('\n'.join(node_lines))

    return '\n\n'.join(chunks)