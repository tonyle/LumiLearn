"""Dependency-free guard tests; no model downloads or user data."""
import asyncio
import importlib.util
from pathlib import Path
import sys
import threading
import types
import unittest
from unittest.mock import Mock, patch

class HTTPException(Exception):
    def __init__(self, status_code, detail, headers=None):
        self.status_code = status_code
        self.detail = detail
        self.headers = headers

class FastAPI:
    def __init__(self, **kwargs):
        pass
    def get(self, *args):
        return lambda f: f
    post = get

spec = importlib.util.spec_from_file_location('reading_server_test', Path(__file__).with_name('server.py'))
server = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {'fastapi': types.SimpleNamespace(FastAPI=FastAPI, HTTPException=HTTPException, Request=object), 'models': types.SimpleNamespace()}):
    spec.loader.exec_module(server)

class Request:
    def __init__(self, *chunks):
        self.chunks = chunks
    async def stream(self):
        for chunk in self.chunks:
            yield chunk

class Guards(unittest.IsolatedAsyncioTestCase):
    async def test_models_load_before_health_is_ready(self):
        with self.assertRaises(HTTPException):
            server.health()
        load = Mock()
        with patch.object(server, 'models', types.SimpleNamespace(load_cached_models=load)):
            async with server.lifespan(None):
                load.assert_called_once()
                self.assertEqual(server.health()['status'], 'ready')
        with self.assertRaises(HTTPException):
            server.health()

    async def test_model_load_failure_never_reports_ready(self):
        with patch.object(server, 'models', types.SimpleNamespace(load_cached_models=Mock(side_effect=RuntimeError('not ready')))):
            with self.assertRaises(RuntimeError):
                async with server.lifespan(None):
                    self.fail('Startup must not finish before models load')
        with self.assertRaises(HTTPException):
            server.health()

    async def test_stream_size_rejected_without_content_length(self):
        with self.assertRaises(HTTPException) as raised:
            await server.body(Request(b'ab', b'cd'), 3)
        self.assertEqual(raised.exception.status_code, 413)

    async def test_translate_validation(self):
        for raw in (b'{}', b'null', b'{"text":1}', b'{"text":""}', b'not json'):
            with self.assertRaises(HTTPException) as raised:
                await server.translate(Request(raw))
            self.assertEqual(raised.exception.status_code, 400)

    async def test_busy_rejects_without_queue(self):
        server._gate.acquire()
        try:
            with self.assertRaises(HTTPException) as raised:
                await server.run_exclusive(lambda: None)
            self.assertEqual(raised.exception.status_code, 503)
        finally:
            server._gate.release()

    async def test_worker_retains_gate_after_client_cancel(self):
        entered = threading.Event()
        finish = threading.Event()
        def work():
            entered.set()
            finish.wait(2)
        task = asyncio.create_task(server.run_exclusive(work))
        await asyncio.to_thread(entered.wait, 1)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(server._gate.locked())
        finish.set()
        await asyncio.get_running_loop().run_in_executor(server._executor, lambda: None)
        self.assertFalse(server._gate.locked())

    async def test_failures_are_sanitized_and_release_gate(self):
        def fail():
            raise ValueError('private content must not escape')
        with self.assertRaises(HTTPException) as raised:
            await server.run_exclusive(fail)
        self.assertEqual(raised.exception.status_code, 503)
        self.assertNotIn('private content', raised.exception.detail)
        self.assertFalse(server._gate.locked())

if __name__ == '__main__':
    unittest.main()
