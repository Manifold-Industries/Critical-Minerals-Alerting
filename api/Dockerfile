FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install dependencies first so this layer is cached across code changes
COPY pyproject.toml ./
RUN uv pip install --system --no-cache -r pyproject.toml

# scripts/ ships too: src/dependencies.py builds the graph through
# scripts.validate_data.build at startup, so it is a runtime import.
COPY src ./src
COPY scripts ./scripts

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
