"""The env.json written next to every result.

The GPU block comes from NVML inside the pod. The pod can't see Windows, WSL or the API server,
so git, host and cluster come from environment variables that bench/run.sh sets. Every field can
be null: one NVML call that WSL2 doesn't support records null instead of failing the run.

    python -m _lib.capture_env     # print it
"""

import json
import os
import platform
import re
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from importlib import metadata

MIB = 1024 * 1024


def now() -> datetime:
    """Local time with its offset. The distro runs on UTC, so run.sh passes Windows' UTC_OFFSET."""
    m = re.fullmatch(r"([+-])(\d\d):?(\d\d)", os.environ.get("UTC_OFFSET", ""))
    if not m:
        return datetime.now().astimezone()
    delta = timedelta(hours=int(m[2]), minutes=int(m[3]))
    return datetime.now(timezone(-delta if m[1] == "-" else delta))


def _try(fn):
    try:
        return fn()
    except Exception:
        return None


def _text(v):
    return v.decode() if isinstance(v, bytes) else v


def gpu_nvml() -> dict | None:
    import pynvml as n

    try:
        n.nvmlInit()
    except Exception:
        return None
    try:
        h = n.nvmlDeviceGetHandleByIndex(0)
        cc = _try(lambda: n.nvmlDeviceGetCudaComputeCapability(h))
        cuda = _try(n.nvmlSystemGetCudaDriverVersion_v2)
        power = _try(lambda: n.nvmlDeviceGetPowerManagementLimit(h))
        return {
            "name": _try(lambda: _text(n.nvmlDeviceGetName(h))),
            "vram_total_mb": _try(lambda: n.nvmlDeviceGetMemoryInfo(h).total // MIB),
            "compute_capability": f"{cc[0]}.{cc[1]}" if cc else None,
            "driver": _try(lambda: _text(n.nvmlSystemGetDriverVersion())),
            "cuda": f"{cuda // 1000}.{cuda % 1000 // 10}" if cuda else None,
            "power_limit_w": round(power / 1000) if power else None,
        }
    finally:
        _try(n.nvmlShutdown)


def gpu_smi() -> dict | None:
    """Fallback when NVML won't initialise: parse nvidia-smi."""
    if not shutil.which("nvidia-smi"):
        return None
    q = "name,memory.total,compute_cap,driver_version,power.limit"
    out = _try(
        lambda: (
            subprocess.run(
                ["nvidia-smi", f"--query-gpu={q}", "--format=csv,noheader,nounits"],
                capture_output=True,
                text=True,
                check=True,
                timeout=20,
            ).stdout
        )
    )
    if not out:
        return None
    name, total, cc, driver, power = (c.strip() for c in out.splitlines()[0].split(","))
    return {
        "name": name,
        "vram_total_mb": _try(lambda: int(float(total))),
        "compute_capability": cc,
        "driver": driver,
        "cuda": None,
        "power_limit_w": _try(lambda: round(float(power))),
    }


def _env(name, cast=str):
    v = os.environ.get(name)
    if v in (None, ""):
        return None
    return _try(lambda: cast(v))


def _bool(v: str) -> bool:
    return v.strip().lower() in ("1", "true", "yes")


def _list(v: str) -> list[str]:
    return [p for p in (s.strip() for s in v.split(",")) if p]


def _version(pkg):
    return _try(lambda: metadata.version(pkg))


def capture(harness: str | None = None, config: str | None = None, args=None) -> dict:
    return {
        "schema": 1,
        "captured_at": now().isoformat(timespec="seconds"),
        "git": {
            "repo": _env("GIT_REPO") or "infinity-bench",
            "sha": _env("GIT_SHA"),
            "dirty": _env("GIT_DIRTY", _bool),
            "branch": _env("GIT_BRANCH"),
        },
        "gpu": gpu_nvml() or gpu_smi(),
        "host": {
            "os": _env("HOST_OS"),
            "wsl": _env("HOST_WSL"),
            "kernel": _env("HOST_KERNEL") or _try(lambda: os.uname().release),
            "distro": _env("HOST_DISTRO"),
            "cpu": _env("HOST_CPU"),
            "ram_gb": _env("HOST_RAM_GB", float),
            "wsl_memory_gb": _env("HOST_WSL_MEMORY_GB", float),
        },
        "cluster": {
            "context": _env("CLUSTER_CONTEXT"),
            "node": _env("CLUSTER_NODE"),
            "k3s": _env("CLUSTER_K3S"),
            "container_toolkit": _env("CLUSTER_TOOLKIT"),
            "device_plugin": _env("CLUSTER_DEVICE_PLUGIN"),
            "time_slicing_replicas": _env("CLUSTER_TIME_SLICING", int),
            "runtime_class": "nvidia",
            "namespace": _env("CLUSTER_NAMESPACE"),
            "image": _env("CLUSTER_IMAGE"),
            "other_gpu_pods": _env("CLUSTER_OTHER_GPU_PODS", _list) or [],
        },
        "desktop_tax_mb": None,
        "packages": {
            "python": platform.python_version(),
            "nvidia-ml-py": _version("nvidia-ml-py"),
            "pyyaml": _version("pyyaml"),
            "typer": _version("typer"),
        },
        "harness": {"name": harness, "config": config, "args": list(args or [])},
    }


if __name__ == "__main__":
    print(json.dumps(capture(), indent=2))
