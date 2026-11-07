"""Pinned public model download happens automatically in the Docker build layer."""
import hashlib
import os
from pathlib import Path
import time
import urllib.request

RELEASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0'
MODEL_SHA = '7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5'
VOICES_SHA = 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d'
MODEL_DIR = Path('/opt/kokoro')


def digest(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def download(name, expected):
    target = MODEL_DIR / name
    if target.exists() and digest(target) == expected:
        return target
    temporary = target.with_suffix('.download')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(f'{RELEASE}/{name}', timeout=120) as source, temporary.open('wb') as output:
                while chunk := source.read(1024 * 1024):
                    output.write(chunk)
            if digest(temporary) != expected:
                raise RuntimeError(f'Checksum mismatch: {name}')
            os.replace(temporary, target)
            return target
        except Exception:
            temporary.unlink(missing_ok=True)
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))


if __name__ == '__main__':
    import numpy as np
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    download('kokoro-v1.0.onnx', MODEL_SHA)
    voices = download('voices-v1.0.bin', VOICES_SHA)
    # Distribute only the requested American voice; exclude unrelated voice packs.
    with np.load(voices, allow_pickle=False) as bundle:
        np.savez_compressed(MODEL_DIR / 'af-heart.npz', af_heart=bundle['af_heart'])
    voices.unlink()
    print('Kokoro-82M v1.0 and af_heart downloaded and verified.', flush=True)
