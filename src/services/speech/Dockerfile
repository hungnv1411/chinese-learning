# Build context = src/services/speech
FROM python:3.12-slim
RUN pip install --no-cache-dir uv
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PATH=/srv/.venv/bin:$PATH
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --no-install-project
COPY app ./app
RUN useradd --system --uid 1001 app
USER app
EXPOSE 8000
# Một tiến trình: hàng đợi chấm nằm trong bộ nhớ (D15, 2 vCPU).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
