# VRAM accounting: data

The numbers behind the vram-accounting post, measured on 2026-11-14 and 2026-11-16 by
[`bench/vram-accounting/`](../../bench/vram-accounting/README.md). Every figure is whole-card
`memory.used` in MiB, read through NVML from a pod on gpu-lab; nothing on WSL2 can size one process,
so each app is the difference between a reading with it open and one with it closed.

| File | What it is |
| --- | --- |
| `results.csv`, `env.json` | The main run (`config.yaml`): Chrome and Discord, three trials each |
| `medal/` | One pass with Medal (`medal.yaml`), then every app but VS Code closed |
| `docker/` | Docker Desktop, three trials (`docker.yaml`) |
| `discord-stream/` | Leaving a Discord stream with Discord kept open, three trials (`discord-stream.yaml`), 2026-11-16 |
| `desktop.csv` | The three combined into rows that add up, for the post's table and widget, by `combine.py` |
| `*/2026-11-14/raw/samples.csv` | Every sample each reading's median comes from |

Each run's `env.json` names the commit it ran from. The top-level one is the main run's, and its
`desktop_tax_mb` is that run's everything-open reading, 2662 MiB.

Three things to know before using these:

- **The everything-open reading moved by about 1 GB in one afternoon** with the same apps open:
  2662 MiB in the main run, 2461 in the Medal pass, 1683 in the Docker pass, and it was 3638 at the
  start of the Discord stream pass two days later. That pass rules out the stream: leaving it freed
  nothing, and its difference is negative and below the noise floor. Open during that pass, from a
  process list taken right after it: Chrome, Discord, Docker Desktop, Medal, Slack, Spotify, Steam,
  WhatsApp, the NVIDIA overlay, Notepad and VS Code. That's why
  `desktop.csv` has a "Not attributed" row, which is the main run's 2662 minus everything that was
  measured.
- **In the main run's last reading, Medal and Docker Desktop were still open** besides VS Code, so its
  2310 MiB is not a floor. The floor in `desktop.csv` is the Medal pass's last reading, 1392 MiB, with
  those two closed as well.
- **VS Code was never closed**, because the runs were driven from it, so it's inside the floor.

`vram_mb` in `desktop.csv` is MiB, like `size_mb` in the site's `models.yaml`.
