"""How much VRAM the desktop takes before a model loads, one app at a time.

Nothing on WSL2 can size a single process's VRAM, so every app is measured by difference: read
whole-card memory.used with it open, close it, read again. The noise floor is measured first, and
a difference that doesn't clear it is reported as not measurable rather than as a number.

Runs in the harness pod, through bench/run.sh, and asks the operator to close and reopen apps.
"""

import statistics
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import typer
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _lib import capture_env, io  # noqa: E402

MIB = 1024 * 1024
FIELDS = ["consumer_id", "label", "vram_mib", "stddev_mib", "trials", "samples", "note"]


@dataclass
class Reading:
    state: str
    samples: list[int]

    @property
    def median(self) -> float:
        return statistics.median(self.samples)

    @property
    def spread(self) -> int:
        return max(self.samples) - min(self.samples)


class Nvml:
    """memory.used through NVML, the same figure nvidia-smi prints."""

    def __init__(self):
        import pynvml

        self.n = pynvml
        pynvml.nvmlInit()
        self.h = pynvml.nvmlDeviceGetHandleByIndex(0)
        try:
            pynvml.nvmlDeviceGetMemoryInfo(self.h, version=pynvml.nvmlMemory_v2)
            self.v2 = True
        except Exception:
            self.v2 = False

    def used_mib(self) -> int:
        if self.v2:
            info = self.n.nvmlDeviceGetMemoryInfo(self.h, version=self.n.nvmlMemory_v2)
        else:
            info = self.n.nvmlDeviceGetMemoryInfo(self.h)
        return info.used // MIB


def sample(
    read: Callable[[], int], state: str, n: int, interval: float, sleep=time.sleep
) -> Reading:
    values = []
    for i in range(n):
        values.append(read())
        if i < n - 1:
            sleep(interval)
    return Reading(state, values)


def consumer_row(cid: str, label: str, trials: list[dict], floor: int, cfg: dict) -> dict:
    """One results row from a consumer's trials. Each trial has open, closed, reopened medians."""
    deltas = [t["open"] - t["closed"] for t in trials]
    vram = statistics.median(deltas)
    sd = statistics.stdev(deltas) if len(deltas) > 1 else None
    drift, spread = cfg["drift_flag_mib"], cfg["spread_flag_mib"]
    notes = []
    if vram <= floor:
        notes.append(f"below the noise floor of {floor} MiB")
    if sd is not None and sd > spread:
        notes.append(f"trials disagree by more than {spread} MiB")
    drifted = [i + 1 for i, t in enumerate(trials) if abs(t["reopened"] - t["open"]) > drift]
    if drifted:
        which = ", ".join(map(str, drifted))
        notes.append(f"trial {which} did not come back within {drift} MiB")
    return {
        "consumer_id": cid,
        "label": label,
        "vram_mib": float(vram),
        "stddev_mib": sd,
        "trials": len(trials),
        "samples": cfg["samples"],
        "note": "; ".join(notes),
    }


def run(
    cfg: dict, read: Callable[[], int], ask: Callable[[str], None], sleep=time.sleep, log=print
):
    """The whole measurement. Returns (rows, raw readings, floor, desktop tax)."""
    n, every, settle = cfg["samples"], cfg["sample_interval_s"], cfg["settle_s"]
    raw: list[tuple[str, Reading]] = []

    def reading(cid, state):
        r = sample(read, state, n, every, sleep)
        raw.append((cid, r))
        log(f"  {cid:<16} {state:<9} median {r.median:7.1f} MiB  spread {r.spread} MiB")
        return r

    log("Everything open. Measuring the noise floor.")
    base = reading("desktop", "open")
    floor = base.spread
    log(f"Noise floor {floor} MiB: a difference at or below it is not measurable.")

    rows = [
        {
            "consumer_id": "desktop",
            "label": "Everything open",
            "vram_mib": float(base.median),
            "stddev_mib": None,
            "trials": 1,
            "samples": n,
            "note": f"noise floor {floor} MiB",
        }
    ]
    for c in cfg["consumers"]:
        trials, before = [], None
        for t in range(cfg["trials"]):
            opened = before or reading(c["id"], "open")
            ask(f"[{c['id']} {t + 1}/{cfg['trials']}] Close {c['label']}.")
            sleep(settle)
            closed = reading(c["id"], "closed")
            ask(f"[{c['id']} {t + 1}/{cfg['trials']}] Reopen {c['label']}.")
            sleep(settle)
            before = reading(c["id"], "reopened")
            trials.append(
                {"open": opened.median, "closed": closed.median, "reopened": before.median}
            )
        rows.append(consumer_row(c["id"], c["label"], trials, floor, cfg))

    keep = cfg.get("keep_open")
    ask(f"Close every app but {keep}." if keep else "Close every app.")
    sleep(settle)
    bare = reading("dwm", "closed")
    rows.append(
        {
            "consumer_id": "dwm",
            "label": f"The desktop and {keep}" if keep else "The desktop alone",
            "vram_mib": float(bare.median),
            "stddev_mib": None,
            "trials": 1,
            "samples": n,
            "note": f"everything else closed{f', {keep} left open' if keep else ''}; "
            "includes the harness pod's NVML handle",
        }
    )
    ask("Done measuring. Reopen whatever you like.")
    return rows, raw, floor, float(base.median)


def _rmdir(p: Path) -> None:
    try:
        p.rmdir()
    except OSError:
        pass


def keyboard(msg: str) -> None:
    input(f"\n{msg} Press Enter when done. ")


def go_files(where: Path, poll=0.5, sleep=time.sleep) -> Callable[[str], None]:
    """Wait for go-1, go-2, ... in `where` instead of Enter, so someone else can prompt."""
    where.mkdir(parents=True, exist_ok=True)
    step = 0

    def ask(msg: str) -> None:
        nonlocal step
        step += 1
        go = where / f"go-{step}"
        print(f"\nWAITING {go.name}: {msg}", flush=True)
        while not go.exists():
            sleep(poll)
        go.unlink()

    return ask


app = typer.Typer(add_completion=False)


@app.command()
def main(config: Path | None = None, go_dir: Path | None = None):
    """--go-dir: wait for go-N files there instead of Enter at each prompt."""
    config = config or Path(__file__).with_name("config.yaml")
    cfg = yaml.safe_load(config.read_text())
    env = capture_env.capture("vram-accounting", config.name)
    if env["cluster"]["other_gpu_pods"]:
        typer.echo("Another pod holds nvidia.com/gpu, so it would be in every reading:", err=True)
        for p in env["cluster"]["other_gpu_pods"]:
            typer.echo(f"  {p}", err=True)
        typer.echo("Scale it to 0 (kubectl -n <ns> scale deploy/<name> --replicas=0).", err=True)
        raise typer.Exit(2)

    nvml = Nvml()
    ask = go_files(go_dir) if go_dir else keyboard
    rows, raw, floor, tax = run(cfg, nvml.used_mib, ask, log=lambda m: print(m, flush=True))
    if go_dir:
        _rmdir(go_dir)

    day = capture_env.now().date().isoformat()
    sub = cfg.get("subdir", "")  # a second run with another config goes beside the first
    base = io.out_dir() / sub
    io.write_results("results.csv", rows, FIELDS, base=base)
    io.write_results(
        f"{day}/raw/samples.csv",
        [
            {"consumer_id": c, "state": r.state, "i": i, "used_mib": v}
            for c, r in raw
            for i, v in enumerate(r.samples)
        ],
        ["consumer_id", "state", "i", "used_mib"],
        base=base,
    )
    env["desktop_tax_mb"] = tax
    env["vram_accounting"] = {
        "floor_mib": floor,
        "memory_info": "v2" if nvml.v2 else "v1",
        **{k: cfg[k] for k in ("samples", "sample_interval_s", "settle_s", "trials")},
    }
    io.write_env(env, base=base)
    where = f"{sub}/" if sub else ""
    typer.echo(f"\nWrote {where}results.csv, raw samples and env.json. Tax {tax:.0f} MiB.")


if __name__ == "__main__":
    app()
