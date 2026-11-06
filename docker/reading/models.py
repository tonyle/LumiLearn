"""Only model assets may be persisted. Never pass user content to downloads."""
from pathlib import Path

WHISPER_PATH = Path('/models/whisper-tiny.en')
_whisper = None
_translator = None


def whisper():
    global _whisper
    if _whisper is None:
        if not (WHISPER_PATH / 'model.bin').exists():
            raise RuntimeError('Models unavailable. Run bash scripts/warmup-reading.sh on the Mac, then retry.')
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
            raise RuntimeError('Models unavailable. Run bash scripts/warmup-reading.sh on the Mac, then retry.')
        _translator = english.get_translation(vietnamese)
    return _translator


def warmup():
    from faster_whisper.utils import download_model
    import argostranslate.package as package
    WHISPER_PATH.mkdir(parents=True, exist_ok=True)
    download_model('tiny.en', output_dir=str(WHISPER_PATH))
    if not any(p.from_code == 'en' and p.to_code == 'vi' for p in package.get_installed_packages()):
        package.update_package_index()
        candidate = next((p for p in package.get_available_packages() if p.from_code == 'en' and p.to_code == 'vi'), None)
        if candidate is None:
            raise RuntimeError('Argos model index has no English to Vietnamese package. Retry later or install an en-to-vi Argos package in the model cache.')
        archive = candidate.download()
        package.install_from_path(archive)
    whisper()
    translator()

if __name__ == '__main__':
    warmup()
    print('Local English speech and English-to-Vietnamese models are ready.')
