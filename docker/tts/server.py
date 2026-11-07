"""Private CPU TTS: eager warmup, bounded single-flight synthesis and atomic WAV cache."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
import hashlib
import io
import json
import logging
import os
from pathlib import Path
import threading
import time
import unicodedata
import uuid
import wave

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
import numpy as np
from models import MODEL_DIR, MODEL_SHA, VOICES_SHA, digest

log = logging.getLogger('uvicorn.error')
VOICE = 'af_heart'
SPEEDS = (.65, .85, 1.0)
CACHE_VERSION = f'kokoro-82m-v1.0:{MODEL_SHA}:{VOICES_SHA}:onnx-0.6.1:pcm16-24000:en-us:v1'
MAX_AUDIO = 16 * 1024 * 1024
_ready = False
_engine = None
_gate = threading.Lock()
_executor = ThreadPoolExecutor(max_workers=1)


def normalize(value):
    if not isinstance(value, dict) or set(value) - {'text', 'voice', 'speed'}:
        raise HTTPException(422, 'Invalid speech fields.')
    text = value.get('text')
    voice = value.get('voice', VOICE)
    speed = value.get('speed', .65)
    if not isinstance(text, str) or len(text) > 1000 or not text.strip():
        raise HTTPException(422, 'Provide 1 to 1000 text characters.')
    if voice != VOICE or isinstance(speed, bool) or not isinstance(speed, (float, int)) or speed not in SPEEDS:
        raise HTTPException(422, 'Use af_heart and speed 0.65, 0.85 or 1.')
    text = ' '.join(unicodedata.normalize('NFC', text).split())
    if not text or not any(c.isalnum() for c in text):
        raise HTTPException(422, 'Provide readable text.')
    return text, voice, float(speed)


def cache_key(text, voice, speed):
    return hashlib.sha256(json.dumps([CACHE_VERSION, text, voice, speed], ensure_ascii=False).encode()).hexdigest()


def wav_bytes(samples, rate):
    samples = np.asarray(samples).reshape(-1)
    if rate != 24000 or not samples.size or samples.size * 2 + 44 > MAX_AUDIO or not np.isfinite(samples).all():
        raise RuntimeError('Invalid generated audio')
    output = io.BytesIO()
    with wave.open(output, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes((np.clip(samples, -1, 1) * 32767).astype('<i2').tobytes())
    return output.getvalue()


class AudioCache:
    def __init__(self, root, limit):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.limit = max(MAX_AUDIO, int(limit))

    def get(self, key):
        path = self.root / (key + '.wav')
        try:
            if not 44 <= path.stat().st_size <= MAX_AUDIO:
                path.unlink(missing_ok=True)
                return None
            audio = path.read_bytes()
            if audio[:4] != b'RIFF' or audio[8:12] != b'WAVE':
                path.unlink(missing_ok=True)
                return None
            path.touch()
            return audio
        except FileNotFoundError:
            return None

    def put(self, key, audio):
        path = self.root / (key + '.wav')
        temporary = self.root / (key + '.' + uuid.uuid4().hex + '.tmp')
        try:
            with temporary.open('wb') as target:
                target.write(audio)
            os.chmod(temporary, 0o600)
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)
        files = sorted(((p.stat().st_mtime, p.stat().st_size, p) for p in self.root.glob('*.wav')), key=lambda v: v[0])
        total = sum(size for _, size, _ in files)
        for _, size, old in files:
            if total <= self.limit:
                break
            if old != path:
                old.unlink(missing_ok=True)
                total -= size


_cache = None


def startup():
    global _engine, _cache
    import onnxruntime as ort
    from kokoro_onnx import Kokoro
    if digest(MODEL_DIR / 'kokoro-v1.0.onnx') != MODEL_SHA:
        raise RuntimeError('Kokoro model checksum mismatch. Rebuild the TTS image.')
    options = ort.SessionOptions()
    options.intra_op_num_threads = max(1, min(4, int(os.environ.get('TTS_THREADS', '2'))))
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(MODEL_DIR / 'kokoro-v1.0.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
    _engine = Kokoro.from_session(session, str(MODEL_DIR / 'af-heart.npz'))
    if VOICE not in _engine.get_voices():
        raise RuntimeError('af_heart is missing')
    _cache = AudioCache(os.environ.get('TTS_CACHE_DIR', '/cache'), int(os.environ.get('TTS_CACHE_MAX_MB', '512')) * 1024 * 1024)
    # Exercises tokenizer, loaded voice, graph and WAV conversion before readiness.
    wav_bytes(*_engine.create('Ready to read.', voice=VOICE, speed=.65, lang='en-us'))
    log.info(json.dumps({'event': 'tts_ready', 'model': 'Kokoro-82M-v1.0', 'voice': VOICE, 'provider': session.get_providers()}))


@asynccontextmanager
async def lifespan(_app):
    global _ready
    await asyncio.to_thread(startup)
    _ready = True
    try:
        yield
    finally:
        _ready = False
        _executor.shutdown(wait=False, cancel_futures=True)


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)


@app.get('/health')
def health():
    if not _ready:
        raise HTTPException(503, 'Kokoro is warming up.')
    return {'status': 'ready', 'model': 'Kokoro-82M-v1.0', 'voice': VOICE, 'provider': 'CPUExecutionProvider', 'busy': _gate.locked()}


def generate(text, voice, speed, key):
    started = time.monotonic()
    try:
        audio = _cache.get(key)
        if audio is not None:
            return audio, 'HIT'
        audio = wav_bytes(*_engine.create(text, voice=voice, speed=speed, lang='en-us'))
        _cache.put(key, audio)
        log.info(json.dumps({'event': 'tts_audio', 'cache': 'MISS', 'voice': voice, 'speed': speed, 'bytes': len(audio), 'ms': round((time.monotonic() - started) * 1000)}))
        return audio, 'MISS'
    finally:
        # A timed-out/cancelled caller cannot free a still-running CPU job.
        _gate.release()


@app.post('/synthesize')
async def synthesize(request: Request):
    if not _ready:
        raise HTTPException(503, 'Kokoro is warming up.')
    raw = bytearray()
    async for chunk in request.stream():
        if len(raw) + len(chunk) > 16000:
            raise HTTPException(413, 'Speech request is too large.')
        raw.extend(chunk)
    try:
        value = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(422, 'Provide a valid JSON request.') from None
    text, voice, speed = normalize(value)
    key = cache_key(text, voice, speed)
    audio = await asyncio.to_thread(_cache.get, key)
    if audio is not None:
        return Response(audio, media_type='audio/wav', headers={'X-TTS-Cache': 'HIT'})
    if not _gate.acquire(blocking=False):
        raise HTTPException(503, 'Kokoro is busy. Retry shortly.', headers={'Retry-After': '2'})
    future = asyncio.get_running_loop().run_in_executor(_executor, generate, text, voice, speed, key)
    # Retrieve worker failures even if timeout/disconnect detached the request.
    future.add_done_callback(lambda f: f.exception() if not f.cancelled() else None)
    try:
        audio, hit = await asyncio.wait_for(asyncio.shield(future), timeout=float(os.environ.get('TTS_SYNTHESIS_TIMEOUT_SECONDS', '90')))
        return Response(audio, media_type='audio/wav', headers={'X-TTS-Cache': hit})
    except asyncio.TimeoutError:
        log.warning(json.dumps({'event': 'tts_timeout', 'voice': voice}))
        raise HTTPException(504, 'Speech generation timed out.') from None
    except Exception:
        log.error(json.dumps({'event': 'tts_failed', 'voice': voice}))
        raise HTTPException(503, 'Speech generation failed. Retry shortly.') from None
