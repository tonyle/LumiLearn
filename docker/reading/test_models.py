"""Startup downloads are mocked; cached starts must work without network."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch, create_autospec

spec=importlib.util.spec_from_file_location('reading_models_test',Path(__file__).with_name('models.py'))
models=importlib.util.module_from_spec(spec)
spec.loader.exec_module(models)

def download_signature(size_or_id, output_dir=None, local_files_only=False, cache_dir=None):
    pass

class Startup(unittest.TestCase):
    def test_cached_start_does_not_download_or_refresh_index(self):
        download=create_autospec(download_signature)
        package=types.SimpleNamespace(get_installed_packages=Mock(return_value=[types.SimpleNamespace(from_code='en',to_code='vi')]),update_package_index=Mock())
        with tempfile.TemporaryDirectory() as directory,patch.object(models,'WHISPER_PATH',Path(directory)/'whisper'),patch.dict(sys.modules,{'faster_whisper':types.ModuleType('faster_whisper'),'faster_whisper.utils':types.SimpleNamespace(download_model=download),'argostranslate':types.ModuleType('argostranslate'),'argostranslate.package':package}),patch.object(models,'whisper',return_value=object()),patch.object(models,'translator',return_value=types.SimpleNamespace(translate=Mock(return_value='Xin chào.'))):
            models.warmup()
        download.assert_not_called()
        package.update_package_index.assert_not_called()

    def test_missing_models_are_downloaded_and_verified_before_success(self):
        download=create_autospec(download_signature)
        candidate=types.SimpleNamespace(from_code='en',to_code='vi',download=Mock(return_value='model.argosmodel'))
        package=types.SimpleNamespace(get_installed_packages=Mock(return_value=[]),update_package_index=Mock(),get_available_packages=Mock(return_value=[candidate]),install_from_path=Mock())
        with tempfile.TemporaryDirectory() as directory,patch.object(models,'WHISPER_PATH',Path(directory)/'whisper'),patch.dict(sys.modules,{'faster_whisper':types.ModuleType('faster_whisper'),'faster_whisper.utils':types.SimpleNamespace(download_model=download),'argostranslate':types.ModuleType('argostranslate'),'argostranslate.package':package}),patch.object(models,'whisper',side_effect=[RuntimeError('missing'),object()]) as whisper,patch.object(models,'translator',side_effect=[RuntimeError('missing'),types.SimpleNamespace(translate=Mock(return_value='Xin chào.'))]) as translator:
            models.warmup()
        self.assertEqual(download.call_count,1)
        package.install_from_path.assert_called_once_with('model.argosmodel')
        self.assertEqual(whisper.call_count,2)
        self.assertEqual(translator.call_count,2)

if __name__=='__main__':unittest.main()
