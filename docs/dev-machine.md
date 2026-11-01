# The dev machine

Unless a post says otherwise, everything on this site was measured on this machine. I first wrote
this down on 2026-09-30 and updated it on 2026-10-30 after the cluster comparison. This page is
how the machine is now; each post's `env.json` records what it was when that post was measured.

## Host

| What | Value | How I checked |
| --- | --- | --- |
| Windows | 11, build 10.0.26200.9711 | `cmd.exe /c ver` |
| GPU | NVIDIA GeForce RTX 5060, 8151 MiB GDDR7 | `nvidia-smi --query-gpu=name,memory.total` |
| Compute capability | 12.0 (Blackwell, `sm_120`) | `nvidia-smi --query-gpu=compute_cap` |
| Driver | 621.01, CUDA 13.5 | `nvidia-smi --query-gpu=driver_version` and the banner |
| Power limit | 145 W | `nvidia-smi --query-gpu=power.limit` |
| CPU | AMD Ryzen 5 8400F, 6 cores, 12 threads | |
| RAM | 63.6 GB | `Get-CimInstance Win32_ComputerSystem` |

The card has **8151 MiB, not 8192**. Widgets and harnesses read the number from `env.json`.

## WSL2

| What | Value | How I checked |
| --- | --- | --- |
| WSL | 2.7.3.0, `Ubuntu` on version 2 | `wsl --version`, `wsl -l -v` |
| Kernel | 6.6.114.1-microsoft-standard-WSL2 | `uname -r` |
| Distro | Ubuntu 24.04.1 LTS | `lsb_release -ds` |
| Linux NVIDIA driver | **none**, on purpose | `dpkg -l \| grep -i nvidia-driver` returns nothing |
| `libcuda.so` | comes from Windows, in `/usr/lib/wsl/lib/` | `ls /usr/lib/wsl/lib/libcuda.so*` |
| `.wslconfig` | memory=30GB, processors=10, swap=4GB, networkingMode=nat | `%USERPROFILE%\.wslconfig` |

`.wslconfig` lives outside this repo and I don't change it from here. 30 GB is plenty for anything
I plan to run on the CPU side.

Inside WSL, `nvidia-smi` shows the user-mode driver as 620.67.01, while Windows shows the kernel
driver as 621.01. Both report CUDA 13.5 and the same card.

All the plain WSL2 distros on this machine share one network namespace. So I can't run two k3s
clusters in two distros side by side: the second one finds ports 6443 and 10250 already taken.

## CUDA toolkit

I don't have `nvcc` installed, and that's deliberate. vram-accounting only needs NVML, vLLM wheels
bring their own CUDA runtime, and the cluster-matrix probe is compiled inside its Docker build.

## The cluster

I run harnesses as pods, not as plain processes in WSL. The cluster is `gpu-lab`: k3s in the
`Ubuntu` distro, which I chose after the comparison in the
[cluster-matrix notebook](notebook/cluster-matrix.ipynb). NeuroMesh's `tools/cluster` runs it,
from the NeuroMesh repo root:

```sh
task cluster:start     # set up or fix the cluster, wait for Ready and the GPU; running it twice changes nothing
task cluster:status    # check every layer from the Windows driver up; add -- -probe to also run a GPU pod
task cluster:pause     # stop k3s and every pod, keep the node, volumes and images
task cluster:resume
task cluster:stop      # pause, then let the distro shut down
task cluster:delete -- -yes
```

What `start` sets up, and why:

| Piece | Setting | Why |
| --- | --- | --- |
| k3s | v1.36.5+k3s1, node `gpu-lab`, traefik off | pinned in NeuroMesh's `tools/cluster/cluster.yaml` |
| Kubeconfig | `write-kubeconfig-mode: "0644"`; a `gpu-lab` context merged into `~/.kube/config`, pointing at `localhost:6443` | it stays readable after a restart, and kubectl on Windows doesn't depend on the node's IP |
| nvidia-container-toolkit | 1.20.1-1, in the distro | gives k3s's containerd an `nvidia` runtime, and k3s then creates the `nvidia` RuntimeClass |
| Device plugin | `k8s-device-plugin:v0.18.2` **with `runtimeClassName: nvidia`** | without it the plugin runs and registers nothing ([gpu-debug.md](gpu-debug.md#the-device-plugin-was-running-and-registered-nothing)) |
| Time-slicing | 1, so no sharing | a measurement needs the whole card |
| Admission policy | `gpu-request-and-runtimeclass-together` | a pod has to ask for the GPU and use the RuntimeClass together, or it's rejected |
| Keepalive | a Scheduled Task, `gpu-lab keepalive`, that keeps a hidden `wsl.exe` session open in a loop | WSL stops the distro about a minute after the last session closes |

What that means day to day:

- **The RuntimeClass and the device plugin are two different things.** The RuntimeClass makes the
  driver reachable; the device plugin advertises `nvidia.com/gpu` so the scheduler can hand it
  out. Every GPU pod here sets both, `runtimeClassName: nvidia` and a `nvidia.com/gpu: 1` limit,
  and the admission policy rejects a pod that sets only one. So the `nvidia.com/gpu` allocations
  are a complete list of who has the card, and that's the list #10 checks before it starts.
- **Before I measure VRAM**, `task cluster:status` has to show no GPU allocations, and NeuroMesh's
  GPU workloads have to be scaled to 0. The cluster is shared, and time-slicing would only share
  compute, not memory: every slot sees the full 8151 MiB.
- **After a WSL restart**, the device plugin takes about 20 s to register again, and allocatable
  `nvidia.com/gpu` reads 0 until it does. `start` and `resume` wait for it.

To check a pod can really use the GPU, `task cluster:status -- -probe` runs a plain `ubuntu:24.04`
pod with no driver and no binaries of its own. It runs `nvidia-smi -L` and has to list the card.
It also checks that a pod with only the GPU request, and one with only the RuntimeClass, both get
rejected.

## Windows toolchain

I run `make` from Git Bash, and the repo lives at `C:\PROJECTS\infinity-bench`.

| Tool | Version |
| --- | --- |
| GNU make | 4.4.1 |
| uv | 0.12.17 |
| node | 24.16.0 |
| pnpm | 11.3.0 |
| docker | 29.7.2 (Docker Desktop 4.88.1) |
| kubectl | v1.36.1 (client) |

Two Git Bash gotchas I hit while setting this up. It rewrites Linux paths passed to `wsl.exe`, so
set `MSYS_NO_PATHCONV=1`. And `wsl.exe -- <cmd>` expands `$vars` before Linux sees them, so put
anything longer than one command in a script file, or pipe it into `bash -s`.

Docker Desktop's Resource Saver restarts the engine when it wakes up, and any container with
`restart: always` comes back with it, even if I stopped it by hand. To keep something stopped,
set its restart policy to `no` first.

## Can I see VRAM from everywhere?

On 2026-10-01 I sampled `memory.used` from Windows, WSL2 and a pod, all from one script so the
readings interleave instead of arriving as separate commands. The desktop was in normal use
(Chrome, VS Code, Slack, Discord, Steam, Spotify and the usual Windows processes), and the probe
was the only GPU pod.

Five rounds, two seconds apart, in MiB:

| Round | Windows | WSL2 | Pod |
| --- | --- | --- | --- |
| 1 | 3100 | 3100 | 3099 |
| 2 | 3131 | 3131 | 3131 |
| 3 | 3115 | 3115 | 3104 |
| 4 | 3122 | 3122 | 3105 |
| 5 | 3103 | 3103 | 3103 |

All three report `memory.total` as 8151 MiB.

And the per-process rows from `--query-compute-apps`:

| Where | Rows | `used_memory` |
| --- | --- | --- |
| Windows | 43 | `[N/A]` for every single row |
| WSL2 | 0 | none |
| Pod | 0 | none |

**What that tells me.** All three see the same whole card, and none of them can say how much VRAM
a given process is using. Windows and WSL2 matched exactly every round, because WSL2 isn't
measuring anything itself; it's reading the same driver through the passthrough. The pod trails
by up to 18 MiB, which is just the desktop moving during the extra half second a `kubectl exec`
takes, not a different view of the card. Windows does list 43 processes, but every one says
`[N/A]`, so I can see who is using the GPU but not how much.

I measured how small a difference I can actually detect later, in the
[cluster-matrix notebook](notebook/cluster-matrix.ipynb) (step 01). The noise ran from 1 to 39 MiB
depending on the session, a known 2048 MiB allocation read as 2048 to 2050 MiB, and a CUDA
context costs 113 MiB.

**How #10 measures.** It reads whole-card `memory.used` through NVML from inside its own pod,
since that's where it runs anyway and it costs nothing in accuracy. Because nothing can size a
single process, it measures each app by closing and reopening it: read with the app open, close
it, let things settle, read again, reopen, read again. It never uses the per-process columns. The
harness pod's own NVML handle is in every reading and doesn't change between them, so it cancels
out. `desktop_tax_mb` is recorded with it included, and the post says so.

How I got here, and what to do when the GPU goes missing from one of these layers, is in
[gpu-debug.md](gpu-debug.md).
