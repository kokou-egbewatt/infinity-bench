# The image every harness runs in. No CUDA base: the nvidia RuntimeClass injects the driver
# libraries and nvidia-smi, and NVML is all the harnesses here need.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.12.17 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv PATH=/opt/venv/bin:$PATH
WORKDIR /bench

COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

COPY _lib ./_lib
COPY vram-accounting ./vram-accounting

RUN useradd --uid 1000 --create-home bench
USER bench
ENTRYPOINT []
CMD ["sleep", "infinity"]
