"""Only model assets may be persisted. Never pass user content to downloads."""
from pathlib import Path

WHISPER_PATH = Path('/models/whisper-tiny.en')
_whisper = None
_translator = None


def whisper():
    global _whisper
    if _whisper is None:
        if not (WHISPER_PATH / 'model.bin').exists():
            raise RuntimeError('Models unavailable. Restart with npm run docker:start on the Mac to prepare them automatically.')
        from faster_whisper import WhisperModel
        _whisper = WhisperModel(str(WHISPER_PATH), device='cpu', compute_type='int8', cpu_threads=2, local_files_only=True)
    return _whisper


def translator():
    global _translator
    if _translator is None:
        import argostranslate.translate as translate
        languages = translate.get_installed_languages()
        english = next((x for x in languages if x.code == 'en'), None)
        vietnamese = next((x for x in languages if x.code == 'vi'), None)
        if english is None or vietnamese is None:
            raise RuntimeError('Models unavailable. Restart with npm run docker:start on the Mac to prepare them automatically.')
        _translator = english.get_translation(vietnamese)
    return _translator


def load_cached_models():
    """Load and exercise cached models before accepting any reading requests."""
    whisper()
    translator().translate('Hello.')


def warmup():
    global _translator
    # A cached start must work offline: do not contact either model registry.
    try:
        whisper()
    except (RuntimeError, OSError, ValueError):
        from faster_whisper.utils import download_model
        WHISPER_PATH.mkdir(parents=True, exist_ok=True)
        print('Preparing the free English speech model...', flush=True)
        download_model('tiny.en', output_dir=str(WHISPER_PATH))
        whisper()
    try:
        translator().translate('Hello.')
    except (RuntimeError, OSError, ValueError):
        import argostranslate.package as package
        print('Preparing the free English-to-Vietnamese model...', flush=True)
        package.update_package_index()
        candidate = next((p for p in package.get_available_packages() if p.from_code == 'en' and p.to_code == 'vi'), None)
        if candidate is None:
            raise RuntimeError('The English-to-Vietnamese model is unavailable. Check internet access and restart the app.')
        package.install_from_path(candidate.download())
        _translator = None
        translator().translate('Hello.')

if __name__ == '__main__':
    warmup()
    print('Local English speech and English-to-Vietnamese models are ready.')
