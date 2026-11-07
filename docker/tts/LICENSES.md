# Kokoro TTS third-party components

No account, API key or paid inference provider is used. Downloads are public artifacts.

| Component | License | Primary source |
| --- | --- | --- |
| Kokoro-82M v1.0 weights and af_heart voice | Apache-2.0 | https://huggingface.co/hexgrad/Kokoro-82M and https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md |
| Pinned ONNX conversion/voice bundle | Underlying Kokoro Apache-2.0 | https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0 |
| kokoro-onnx 0.6.1 | MIT | https://github.com/thewh1teagle/kokoro-onnx/blob/main/LICENSE |
| ONNX Runtime 1.23.2 | MIT | https://github.com/microsoft/onnxruntime/blob/v1.23.2/LICENSE |
| NumPy 2.2.6 | BSD-3-Clause, bundled dependency notices | https://github.com/numpy/numpy/blob/v2.2.6/LICENSE.txt |
| phonemizer 3.4.0 | GPL-3.0-or-later | https://github.com/bootphon/phonemizer/blob/master/COPYING |
| espeakng-loader 0.2.4 loader | MIT | https://github.com/thewh1teagle/espeakng-loader/blob/main/LICENSE |
| Bundled eSpeak NG | GPL-3.0-or-later | https://github.com/espeak-ng/espeak-ng/blob/master/COPYING |
| FastAPI 0.115.12 | MIT | https://github.com/fastapi/fastapi/blob/0.115.12/LICENSE |
| Uvicorn 0.34.2 | BSD-3-Clause | https://github.com/encode/uvicorn/blob/0.34.2/LICENSE.md |
| Python/Debian image and transitive packages | Respective PSF/Debian/package licenses | https://hub.docker.com/_/python |

The image preserves installed package license files. The bundled eSpeak library is part of espeakng-loader; its GPL terms still apply even though the loader itself is MIT. Preserve license notices and source obligations if distributing container images; this is not an all-permissive dependency stack. No separate voice-specific attribution is listed for af_heart in the upstream voice table. Only af_heart is retained from the downloaded voice bundle; other voices are not shipped by this image.

Model provenance/checksums are pinned in models.py; inference is unmodified, using CPUExecutionProvider. WAV encoding, HTTP API, caching and application integration are LumiLearn code. Model weights are fetched automatically at image build, not committed to the repository.
