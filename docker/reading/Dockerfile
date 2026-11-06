FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/models XDG_DATA_HOME=/models/share XDG_CACHE_HOME=/models/cache HF_HOME=/models/huggingface ARGOS_DEVICE_TYPE=cpu OMP_NUM_THREADS=2
WORKDIR /service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log", "--log-level", "critical"]
