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
                python = os.path.join(env_path, 'Scripts', 'python.exe')  # windows
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


if __name__ == '__main__':
    raw = sys.stdin.read()
    payload = json.loads(raw)
    result = detect_all(payload.get('workspace_root', ''))
    print(json.dumps(result))