import subprocess
import tempfile
import shutil
import os


def clone_repo(repo_url: str):
    tmp_dir = tempfile.mkdtemp()
    
    try:
        result = subprocess.run(
            ["git", "clone", "--depth=1", repo_url, tmp_dir],
            check=True,
            capture_output=True,
            text=True
        )
        
        return tmp_dir
        
    except subprocess.CalledProcessError as e:
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)
        raise Exception(f"Failed to clone repository: {e.stderr}")


def cleanup_repo(repo_path: str):
    if os.path.exists(repo_path):
        shutil.rmtree(repo_path)
