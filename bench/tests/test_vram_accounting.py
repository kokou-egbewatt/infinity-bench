import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "harness", Path(__file__).resolve().parent.parent / "vram-accounting" / "harness.py"
)
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)

CFG = {
    "samples": 5,
    "sample_interval_s": 1,
    "settle_s": 10,
    "trials": 3,
    "drift_flag_mib": 50,
    "spread_flag_mib": 40,
    "consumers": [{"id": "chrome", "label": "Chrome"}, {"id": "tiny", "label": "Tiny"}],
}


class FakeDesktop:
    """A GPU whose memory.used is the sum of what's open, plus a little jitter."""

    def __init__(self, apps, jitter=(0, 3, 1, 2, 0)):
        self.apps = dict(apps)
        self.open = set(self.apps)
        self.jitter = list(jitter)
        self.i = 0

    def read(self):
        j = self.jitter[self.i % len(self.jitter)]
        self.i += 1
        return 1000 + sum(self.apps[a] for a in self.open) + j

    def ask(self, msg):
        if msg.startswith("[") and "Close " in msg:
            self.open.discard(msg.split("]")[0][1:].split()[0])
        elif msg.startswith("[") and "Reopen " in msg:
            self.open.add(msg.split("]")[0][1:].split()[0])
        elif msg.startswith("Close everything"):
            self.open.clear()


def test_sample_takes_n_readings_with_n_minus_one_waits():
    waits = []
    r = harness.sample(iter([5, 7, 6]).__next__, "open", 3, 1, waits.append)
    assert r.samples == [5, 7, 6] and waits == [1, 1]
    assert r.median == 6 and r.spread == 2


def test_run_recovers_each_app_and_flags_the_one_below_the_floor():
    d = FakeDesktop({"chrome": 600, "tiny": 2})
    rows, raw, floor, tax = harness.run(
        CFG, d.read, d.ask, sleep=lambda s: None, log=lambda m: None
    )
    by = {r["consumer_id"]: r for r in rows}
    assert floor == 3
    assert tax == 1000 + 602 + 1
    assert by["chrome"]["vram_mib"] == pytest.approx(600, abs=3)
    assert by["chrome"]["note"] == ""
    assert "below the noise floor of 3 MiB" in by["tiny"]["note"]
    assert by["dwm"]["vram_mib"] == pytest.approx(1001, abs=3)
    # one open reading per app, then closed and reopened per trial; the reopened one is reused
    assert sum(1 for c, r in raw if c == "chrome") == 1 + 2 * CFG["trials"]


def test_consumer_row_flags_drift_and_disagreement():
    trials = [
        {"open": 900, "closed": 300, "reopened": 980},
        {"open": 980, "closed": 300, "reopened": 980},
        {"open": 980, "closed": 400, "reopened": 980},
    ]
    row = harness.consumer_row("chrome", "Chrome", trials, 10, CFG)
    assert row["vram_mib"] == 600
    assert "trial 1 did not come back within 50 MiB" in row["note"]
    assert "trials disagree" in row["note"]


def test_go_files_wait_for_each_step_in_turn(tmp_path):
    waits = []

    def sleep(s):
        waits.append(s)
        (tmp_path / "go" / f"go-{len(seen) + 1}").touch()

    seen = []
    ask = harness.go_files(tmp_path / "go", sleep=sleep)
    ask("first")
    seen.append(1)
    ask("second")
    assert waits == [0.5, 0.5]
    assert list((tmp_path / "go").iterdir()) == []


def test_keep_open_names_what_stayed_open():
    d = FakeDesktop({"chrome": 600, "tiny": 2})
    cfg = {**CFG, "keep_open": "VS Code"}
    rows, *_ = harness.run(cfg, d.read, d.ask, sleep=lambda s: None, log=lambda m: None)
    last = rows[-1]
    assert last["label"] == "The desktop and VS Code, one monitor"
    assert "VS Code left open" in last["note"]
