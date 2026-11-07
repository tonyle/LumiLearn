"""Standard-library tests: no models or paid providers used."""
import asyncio
import json
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import numpy as np
from fastapi import HTTPException
import server


class Request:
    def __init__(self, value):
        self.raw = json.dumps(value).encode()

    async def stream(self):
        yield self.raw


class CacheTests(unittest.TestCase):
    def test_normalization_and_configuration_key(self):
        a = server.normalize({'text': '  The cat\n sleeps. ', 'voice': 'af_heart', 'speed': .65})
        self.assertEqual(a, ('The cat sleeps.', 'af_heart', .65))
        self.assertNotEqual(server.cache_key(*a), server.cache_key(a[0], a[1], 1.0))
        for value in [{'text': ''}, {'text': 'x' * 1001}, {'text': 'Hello', 'voice': 'other'}, {'text': 'Hello', 'speed': True}, {'text': 'Hello', 'speed': 2}, {'text': 'Hello', 'extra': 1}]:
            with self.assertRaises(HTTPException):
                server.normalize(value)

    def test_wav_cache_hit_corruption_and_budget_eviction(self):
        with tempfile.TemporaryDirectory() as root:
            cache = server.AudioCache(root, server.MAX_AUDIO)
            audio = server.wav_bytes(np.ones(2400, dtype=np.float32) * .2, 24000)
            cache.put('a', audio)
            self.assertEqual(cache.get('a'), audio)
            self.assertEqual(list(cache.root.glob('*.tmp')), [])
            (cache.root / 'a.wav').write_bytes(b'corrupt')
            self.assertIsNone(cache.get('a'))
            cache.limit = len(audio) + 1
            cache.put('a', audio)
            cache.put('b', audio)
            self.assertIsNone(cache.get('a'))
            self.assertEqual(cache.get('b'), audio)

    def test_nonfinite_audio_is_never_cached(self):
        with self.assertRaises(RuntimeError):
            server.wav_bytes([float('nan')], 24000)


class ServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_cache_and_timeout_retains_cpu_gate_until_actual_completion(self):
        class Engine:
            calls = 0
            def create(self, *args, **kwargs):
                self.calls += 1
                time.sleep(.08)
                return np.ones(2400) * .2, 24000
        engine = Engine()
        with tempfile.TemporaryDirectory() as root, patch.object(server, '_engine', engine), patch.object(server, '_cache', server.AudioCache(root, server.MAX_AUDIO)), patch.object(server, '_ready', True), patch.object(server, '_gate', threading.Lock()), patch.dict('os.environ', {'TTS_SYNTHESIS_TIMEOUT_SECONDS': '.01'}):
            with self.assertRaises(HTTPException) as timed_out:
                await server.synthesize(Request({'text': 'Hello'}))
            self.assertEqual(timed_out.exception.status_code, 504)
            self.assertTrue(server._gate.locked())
            with self.assertRaises(HTTPException) as busy:
                await server.synthesize(Request({'text': 'Other text'}))
            self.assertEqual(busy.exception.status_code, 503)
            await asyncio.sleep(.15)
            response = await server.synthesize(Request({'text': 'Hello'}))
            self.assertEqual(response.headers['x-tts-cache'], 'HIT')
            self.assertEqual(engine.calls, 1)
            self.assertFalse(server._gate.locked())

    async def test_unready_service_does_not_synthesize(self):
        with patch.object(server, '_ready', False):
            with self.assertRaises(HTTPException) as missing:
                await server.synthesize(Request({'text': 'Hello'}))
            self.assertEqual(missing.exception.status_code, 503)


if __name__ == '__main__':
    unittest.main()
