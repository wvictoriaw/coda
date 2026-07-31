import json
import subprocess
import os
import sys


def detect_conda_envs() -> list[dict]:
    """
    Shell out to conda and get all available environments.
    Returns list of {name, path} dicts.
    """
    try:
        result = subprocess.run(
            ['conda', 'env', 'list', '--json'],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode != 0:
            return []

        data = json.loads(result.stdout)
        envs = []
        for env_path in data.get('envs', []):
            name = os.path.basename(env_path)
            python = os.path.join(env_path, 'bin', 'python')
            if not os.path.exists(python):
                python = os.path.join(env_path, 'python.exe')  # windows
            if os.path.exists(python):
                envs.append({'name': name, 'path': python, 'type': 'conda'})
        return envs
    except Exception:
        return []


def detect_venv_envs(workspace_root: str) -> list[dict]:
    """
    Scan workspace root for common venv folder names.
    Returns list of {name, path} dicts.
    """
    common_names = ['.venv', 'venv', 'env', '.env']
    envs = []

    for name in common_names:
        env_dir = os.path.join(workspace_root, name)
        python = os.path.join(env_dir, 'bin', 'python')
        if not os.path.exists(python):
            python = os.path.join(env_dir, 'Scripts', 'python.exe')  # windows
        if os.path.exists(python):
            envs.append({'name': name, 'path': python, 'type': 'venv'})

    return envs


def detect_pyenv_envs() -> list[dict]:
    """
    Scan pyenv versions directory if pyenv is installed.
    """
    try:
        result = subprocess.run(
            ['pyenv', 'root'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            return []

        pyenv_root = result.stdout.strip()
        versions_dir = os.path.join(pyenv_root, 'versions')
        if not os.path.exists(versions_dir):
            return []

        envs = []
        for version in os.listdir(versions_dir):
            python = os.path.join(versions_dir, version, 'bin', 'python')
            if os.path.exists(python):
                envs.append({'name': f'pyenv: {version}', 'path': python, 'type': 'pyenv'})
        return envs
    except Exception:
        return []


def detect_all(workspace_root: str) -> list[dict]:
    envs = []
    envs.extend(detect_conda_envs())
    envs.extend(detect_venv_envs(workspace_root))
    envs.extend(detect_pyenv_envs())
    return envs

def detect_from_folder(folder_path: str) -> dict | None:
    """
    Given a folder path, determine if it's a conda base or a venv
    and return the appropriate environment dict.
    """
    if not os.path.exists(folder_path):
        return None

    # Check if it's a direct venv — has bin/python or Scripts/python.exe
    python_unix = os.path.join(folder_path, 'bin', 'python')
    python_win = os.path.join(folder_path, 'Scripts', 'python.exe')

    if os.path.exists(python_unix):
        return {'name': os.path.basename(folder_path), 'path': python_unix, 'type': 'venv'}
    if os.path.exists(python_win):
        return {'name': os.path.basename(folder_path), 'path': python_win, 'type': 'venv'}

    # Check if it's a conda base — has envs/ subfolder
    envs_dir = os.path.join(folder_path, 'envs')
    if os.path.exists(envs_dir):
        # Also check base itself has python
        base_python_unix = os.path.join(folder_path, 'bin', 'python')
        base_python_win = os.path.join(folder_path, 'python.exe')
        envs = []
        if os.path.exists(base_python_unix):
            envs.append({'name': 'base', 'path': base_python_unix, 'type': 'conda'})
        if os.path.exists(base_python_win):
            envs.append({'name': 'base', 'path': base_python_win, 'type': 'conda'})
        for name in os.listdir(envs_dir):
            env_dir = os.path.join(envs_dir, name)
            p_unix = os.path.join(env_dir, 'bin', 'python')
            p_win = os.path.join(env_dir, 'Scripts', 'python.exe')
            if os.path.exists(p_unix):
                envs.append({'name': name, 'path': p_unix, 'type': 'conda'})
            elif os.path.exists(p_win):
                envs.append({'name': name, 'path': p_win, 'type': 'conda'})
        return {'type': 'conda_base', 'envs': envs} if envs else None

    return None


if __name__ == '__main__':
    raw = sys.stdin.read()
    if not raw.strip():
        sys.exit(1)
    payload = json.loads(raw)
    mode = payload.get('mode', 'detect_all')

    if mode == 'detect_folder':
        result = detect_from_folder(payload['folder_path'])
        print(json.dumps(result))
    else:
        result = detect_all(payload.get('workspace_root', ''))
        print(json.dumps(result))