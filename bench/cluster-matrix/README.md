# cluster-matrix

The probe and scripts behind which local Kubernetes can run GPU work on WSL2
([#22](https://github.com/kokou-egbewatt/infinity-bench/issues/22)). The results are in
[`data/cluster-matrix/`](../../data/cluster-matrix/README.md), and each step's write-up, with every
command and its output, is in [`docs/notebook/cluster-matrix.ipynb`](../../docs/notebook/cluster-matrix.ipynb).

These are lab scripts, not a one-command harness: each step was run by hand, in order, with the
machine cleaned back to a blank slate in between. They assume Windows 11, Git Bash, Docker
Desktop, and an `Ubuntu` WSL distro with nvidia-container-toolkit and no Linux NVIDIA driver.

## The probe

`probe/gpu_probe.cu` climbs five levels and exits with the highest one it reached, printing JSON:

| Level | Meaning |
| --- | --- |
| 10 | nothing |
| 20 | NVML initialised |
| 30 | CUDA context created |
| 40 | the allocation succeeded |
| 50 | a GEMM ran and every element of the result was checked |

`gpu_probe [alloc_mib=2048] [hold_s=0]`. `hold_s` keeps the allocation live so a sampler can see it.

A passing pod exits 50, so Kubernetes shows it as `Failed`. Read the level from the exit code
(`status.containerStatuses[0].state.terminated.exitCode`) or the JSON, and never wait on a Job's
`complete` condition.

Build it once, then hand the same image to every candidate:

```sh
cd bench/cluster-matrix/probe
docker build -t cluster-matrix-probe:01 .
docker save cluster-matrix-probe:01 -o probe-01.tar           # for k3s and Rancher Desktop
cid=$(docker create cluster-matrix-probe:01)
mkdir -p bin && docker cp "$cid":/usr/local/bin/gpu_probe bin/gpu_probe && docker rm "$cid"
```

The run stage is `nvidia/cuda:*-base`, not `-devel`, so the probe relies only on the driver
libraries the host injects, which is what is under test. `probe-01.tar` and `bin/` are not
committed.

| File | What it does |
| --- | --- |
| `probe/floor.sh` | The VRAM noise floor: 30 whole-card samples, median, IQR, spread |
| `probe/lib.sh` | Shared helpers: sampling, CSV, GPU conditions |

## The scripts

| Script | Step | Runs in |
| --- | --- | --- |
| `tools/slate-check.sh`, `tools/slate-wsl.sh` | every step: is the machine back to blank? | Git Bash, WSL as root |
| `tools/instrument.sh`, `tools/l0-once.sh` | 01: can `memory.used` see a known allocation; the probe on the bare host | WSL |
| `tools/ladder.sh`, `tools/inner.sh` | 02: the nesting ladder in plain Docker; `inner.sh` is the check every probe container runs | Git Bash |
| `tools/k3s.sh`, `tools/k3s-plugin.sh`, `tools/k3s-cycle.sh` | 03: k3s phases, the device plugin, timed cold cycles | WSL as root |
| `tools/k3s-restarts.sh`, `tools/wsl-boots.sh` | 03: why pods restarted, and when WSL last booted | WSL as root |
| `tools/k3d-cycle.sh` | 04 | Git Bash |
| `tools/kind-cycle.sh` | 05 | Git Bash |
| `tools/minikube-cycle.sh` | 06 | Git Bash |
| `tools/rd-cycle.sh` | 07 | Git Bash |
| `tools/dd-cycle.sh` | 08 | Git Bash |
| `tools/kpod.sh` | 04 onwards: one probe pod on whatever cluster `KUBECONFIG` points at | Git Bash |
| `tools/k3s-rebuild.sh`, `tools/k3s-manifests.sh`, `gpu-admission-policy.yaml` | 10: the rebuild, the device plugin and the admission policy through k3s's manifests folder | WSL as root |
| `tools/vram.sh` | median `memory.used` and WSL memory, for before/after readings | WSL |

From Git Bash, set `MSYS_NO_PATHCONV=1`, and run anything longer than one command inside WSL as a
script (`wsl -d Ubuntu -u root -- bash <script>`): Git Bash rewrites Linux paths and expands
`$vars` before WSL sees them.

Two folders here are gitignored: `slate/` holds the before and after listings of everything installed on the machine, and `bin/` holds a candidate's binary (k3d, kind, minikube) for the length of its step.

The step 10 scripts are how I first rebuilt the cluster. Today NeuroMesh's `tools/cluster` builds and runs it; see
[dev-machine.md](../../docs/dev-machine.md#the-cluster).
