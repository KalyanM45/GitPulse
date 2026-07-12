FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Requirements first so a code edit doesn't invalidate the pip layer.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts

EXPOSE 8000

# Render (and most PaaS) inject the port to listen on as $PORT and will fail the
# health check if the app binds anything else. Shell form so ${PORT} expands;
# falls back to 8000 for local docker-compose, which sets no PORT.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
