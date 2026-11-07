FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OMP_NUM_THREADS=2 TTS_THREADS=2 TTS_CACHE_DIR=/cache
WORKDIR /service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY models.py .
# Cached Docker layer: no API key, runtime download, GPU or manual setup needed.
RUN python models.py
COPY . .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log"]
