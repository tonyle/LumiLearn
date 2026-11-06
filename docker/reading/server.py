"""Private local inference. Request content exists only in memory, never logs/files."""
import io
import threading
from concurrent.futures import ThreadPoolExecutor
import asyncio
from fastapi import FastAPI, HTTPException, Request
import models

MAX_BYTES = 6 * 1024 * 1024
MAX_SECONDS = 30
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
_gate = threading.Lock()
_executor = ThreadPoolExecutor(max_workers=1)


def decode_audio(raw):
    import av
    import numpy as np
    try:
        with av.open(io.BytesIO(raw)) as container:
            stream = next((s for s in container.streams if s.type == 'audio'), None)
            if stream is None:
                raise ValueError('Audio track required.')
            if stream.duration is not None and float(stream.duration * stream.time_base) > MAX_SECONDS:
                raise HTTPException(413, 'Audio must be 30 seconds or shorter.')
            resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)
            chunks = []
            samples = 0
            for frame in container.decode(stream):
                for converted in resampler.resample(frame):
                    samples += converted.samples
                    if samples > 16000 * MAX_SECONDS:
                        raise HTTPException(413, 'Audio must be 30 seconds or shorter.')
                    chunks.append(converted.to_ndarray().reshape(-1))
            for converted in resampler.resample(None):
                samples += converted.samples
                if samples > 16000 * MAX_SECONDS:
                    raise HTTPException(413, 'Audio must be 30 seconds or shorter.')
                chunks.append(converted.to_ndarray().reshape(-1))
            if not samples:
                raise ValueError('Empty audio.')
            return np.concatenate(chunks).astype(np.float32) / 32768.0
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, 'Audio could not be decoded. Record a new clip.') from None


async def body(request, limit):
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > limit:
            raise HTTPException(413, 'Request is too large.')
        data.extend(chunk)
    return bytes(data)


async def run_exclusive(work):
    if not _gate.acquire(blocking=False):
        raise HTTPException(503, 'Local reading service is busy. Retry shortly.', headers={'Retry-After': '3'})
    def execute():
        try:
            return work()
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(503, 'Local models unavailable. Run bash scripts/warmup-reading.sh on the Mac; check available memory and model cache, then retry.') from None
        finally:
            _gate.release()
    # Worker owns the gate until actual completion, even if the client disconnects.
    return await asyncio.shield(asyncio.get_running_loop().run_in_executor(_executor, execute))


@app.get('/health')
def health():
    return {'status': 'ok', 'busy': _gate.locked()}


@app.post('/translate')
async def translate(request: Request):
    import json
    raw = await body(request, 16000)
    try:
        value = json.loads(raw)
        text = value['text']
        if not isinstance(text, str) or not text.strip() or len(text) > 4000:
            raise ValueError()
    except (ValueError, KeyError, TypeError):
        raise HTTPException(400, 'Provide text between 1 and 4000 characters.') from None
    return await run_exclusive(lambda: {'translation': models.translator().translate(text)})


@app.post('/transcribe')
async def transcribe(request: Request):
    raw = await body(request, MAX_BYTES)
    def work():
        waveform = decode_audio(raw)
        segments, _ = models.whisper().transcribe(waveform, language='en', beam_size=1, vad_filter=False, condition_on_previous_text=False)
        return {'text': ' '.join(segment.text.strip() for segment in segments).strip()}
    return await run_exclusive(work)


@app.post('/render')
async def render_pdf(request: Request):
    raw = await body(request, 20 * 1024 * 1024)
    def work():
        import base64
        import pymupdf
        try:
            with pymupdf.open(stream=raw, filetype='pdf') as document:
                if document.needs_pass or not 1 <= len(document) <= 50:
                    raise HTTPException(400, 'PDF must be unlocked and contain 1 to 50 pages.')
                pages = []
                total_pixels = 0
                total_bytes = 0
                for page in document:
                    bounds = page.rect
                    if bounds.width <= 0 or bounds.height <= 0:
                        raise HTTPException(400, 'PDF page has invalid dimensions.')
                    scale = min(1599 / bounds.width, 2199 / bounds.height, 2)
                    width, height = int(bounds.width * scale) + 1, int(bounds.height * scale) + 1
                    total_pixels += width * height
                    if total_pixels > 100_000_000:
                        raise HTTPException(413, 'PDF has too many image pixels. Split it into smaller books.')
                    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), colorspace=pymupdf.csRGB, alpha=False)
                    encoded = base64.b64encode(pixmap.tobytes('jpeg', jpg_quality=80)).decode('ascii')
                    total_bytes += len(encoded) + 128
                    if total_bytes > 30 * 1024 * 1024:
                        raise HTTPException(413, 'Rendered PDF is too large. Split it into smaller books.')
                    pages.append({'image': encoded, 'width': pixmap.width, 'height': pixmap.height})
                return {'pages': pages}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(400, 'PDF could not be rendered. Export a new unlocked PDF and retry.') from None
    return await run_exclusive(work)
