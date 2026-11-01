# Debugging the GPU

I started this page while setting up the baseline in [dev-machine.md](dev-machine.md), and added
to it during the [cluster comparison](notebook/cluster-matrix.ipynb). Everything here is a failure
I actually hit. The problem is always some version of "the GPU isn't where I expected it": missing
from a pod, missing from Kubernetes, or showing numbers that don't match another window.

## What a container needs on WSL2

WSL2 has no NVIDIA kernel driver. Everything goes through the Windows driver, reached through a
paravirtual device, and a container only gets the GPU when four things arrive together:

| # | What | What you see without it |
| --- | --- | --- |
| 1 | `/dev/dxg` | `nvml_init` fails, or CUDA finds no device |
| 2 | `/usr/lib/wsl/lib` on the loader path | `libnvidia-ml.so.1: cannot open shared object file` (exit 127) |
| 3 | `/usr/lib/wsl/drivers`, the Windows driver store that the files in `lib` load their code from | `nvml_init: Unable to load the NVML library` |
| 4 | Something to put them there: the NVIDIA runtime, or mounts by hand | any of the above |

In plain Docker, `--gpus all` handles all four, but only one level deep. It mounts single files,
not the directories, so a container inside that container gets nothing. Mounting the three paths
by hand works at any depth. The Docker ladder in the [notebook](notebook/cluster-matrix.ipynb)
shows this, and every error the comparison ran into is in
[`data/cluster-matrix/errors.csv`](../data/cluster-matrix/errors.csv).

## The layers, on k3s

There are six layers between the card and a harness reading it. A failure at any of them looks
the same from the top, so I walk down from the bottom:

| # | Layer | One command that proves it |
| --- | --- | --- |
| 1 | Windows driver | `nvidia-smi.exe --query-gpu=name,driver_version --format=csv,noheader` |
| 2 | WSL2 passthrough | `wsl -d Ubuntu -- nvidia-smi --query-gpu=name --format=csv,noheader` |
| 3 | Container toolkit | `dpkg -l nvidia-container-toolkit` (inside WSL) |
| 4 | containerd runtime | `grep -c nvidia /var/lib/rancher/k3s/agent/etc/containerd/config.toml` |
| 5 | RuntimeClass | `kubectl get runtimeclass nvidia` |
| 6 | Device plugin | `kubectl get node -o jsonpath='{.items[0].status.allocatable.nvidia\.com/gpu}'` |

Layers 1 and 2 are the Windows driver's job; there's nothing for me to fix there. Layers 3 to 6
are what I install when I build the cluster.

## The one that confuses everyone: RuntimeClass and device plugin

Layers 5 and 6 do different jobs, and either can be there without the other.

- **The `nvidia` RuntimeClass makes the driver reachable.** It injects `/usr/lib/wsl/lib` and
  `nvidia-smi` into the container. Without it, a plain image has no GPU at all, whatever it
  requests.
- **The device plugin makes the GPU schedulable.** It advertises `nvidia.com/gpu`, so a pod can
  request one and the scheduler can hand them out.

That gives four combinations:

| RuntimeClass | Device plugin | What happens |
| --- | --- | --- |
| yes | yes | the normal case: request `nvidia.com/gpu: 1`, get a working GPU the scheduler accounts for |
| yes | no | the GPU works through `NVIDIA_VISIBLE_DEVICES=all`, but nothing rations it |
| no | yes | the pod schedules and holds a slot, but has no `nvidia-smi` |
| no | no | no GPU |

Rows two and three are the ones that hurt:

- Row three wastes the most time. By every Kubernetes measure the pod is running with a GPU, and
  it can't use it.
- Row two quietly breaks measurements. A pod that names the RuntimeClass without requesting the
  GPU uses the card while the scheduler thinks it's free.

On `gpu-lab`, an admission policy rejects both, so only row one gets through (see
[The cluster](dev-machine.md#the-cluster)).

If only the plugin is missing, this pod still gets a working GPU without installing anything:

```yaml
spec:
  runtimeClassName: nvidia
  containers:
    - name: smoke
      image: ubuntu:24.04
      command: ["sleep", "infinity"]
      env:
        - { name: NVIDIA_VISIBLE_DEVICES, value: all }
        - { name: NVIDIA_DRIVER_CAPABILITIES, value: utility }
```

`utility` is enough for `nvidia-smi` and NVML, which is all a measuring harness needs. Anything
that runs CUDA kernels needs `compute,utility`.

## Things that went wrong

### kubectl inside WSL lost permission after a restart

```text
error loading config file "/etc/rancher/k3s/k3s.yaml": permission denied
```

k3s rewrites that file as root-only every time it starts, so whatever I did to make it readable
was undone by the next restart. For scripted checks I just run as root
(`wsl -d Ubuntu -u root`). The real fix is `write-kubeconfig-mode: "0644"` in k3s's config, which
`gpu-lab` now has.

### kubectl from Windows flapped for a few minutes

Right after a WSL restart, kubectl on Windows kept cycling between timeouts and
`connection refused` against `172.18.59.76:6443`, while kubectl inside WSL worked the whole time.
It settled by itself. So a cluster check should retry and say the API server is still starting,
not fail on the first refusal and send someone off debugging a healthy cluster.

### The device plugin lags behind the node

For about twenty seconds after a restart, the node says `Ready` while allocatable
`nvidia.com/gpu` is still `0`. Before deciding the GPU is gone, wait for that number. Loop until
it's at least 1 rather than sleeping for a fixed time.

### The device plugin was Running and registered nothing

The NVIDIA device plugin as published (v0.18.2) sat at `Running` on k3s with no restarts, and
`nvidia.com/gpu` never showed up. The log said why:

```text
Incompatible strategy detected auto
invalid device discovery strategy
```

The plugin needs the driver itself to count the card, and on k3s that means the RuntimeClass.
Adding `runtimeClassName: nvidia` to its DaemonSet fixed it. The log then read
`Detected platform: wsl` and `Registered device plugin for 'nvidia.com/gpu'`. `Running` doesn't
prove anything; the allocatable count does.

## Reading VRAM

You can read the same card from three places:

```sh
# Windows
nvidia-smi.exe --query-gpu=memory.used --format=csv,noheader
# WSL2
nvidia-smi --query-gpu=memory.used --format=csv,noheader
# pod
kubectl -n infinity-bench exec smoke -- nvidia-smi --query-gpu=memory.used --format=csv,noheader
```

Sample all three from one script so the readings interleave. From WSL, Windows is reachable at
`/mnt/c/Windows/System32/nvidia-smi.exe`. If you take them as separate commands on a live desktop,
they drift apart by tens of MiB just from the time in between, and it's easy to read that as the
layers disagreeing.

When I did it this way on 2026-10-01, Windows and WSL2 matched exactly in all five rounds, and the
pod trailed by up to 18 MiB, which is just the `kubectl exec` round trip. WSL2 isn't measuring
anything itself. It's reading the same driver through the passthrough.

### There is no per-process memory

| Where | Rows from `--query-compute-apps` | `used_memory` |
| --- | --- | --- |
| Windows | 43 | `[N/A]` for every row |
| WSL2 | 0 | none |
| Pod | 0 | none |

This matters more than anything else on this page for the harnesses. Windows lists 43 processes
using the GPU and sizes none of them; WSL2 and the pod don't list them at all. It's a documented
WSL limitation, not something I misconfigured, and no flag changes it.

So VRAM per app has to be measured as a close/reopen difference, not read off a table. That's
why #10 is a harness that asks me to close an app, rather than a script that queries process
memory. If a future driver starts filling in `used_memory`, it's one command to check and the
harness gets much simpler. I'll recheck whenever the driver's major version changes.

## Quick triage

```sh
# 1. Is the card there at all?
nvidia-smi.exe --query-gpu=name,memory.used --format=csv,noheader

# 2. Does WSL see it?
wsl -d Ubuntu -- nvidia-smi --query-gpu=name --format=csv,noheader

# 3. Is this the cluster I think it is?
wsl -d Ubuntu -u root -- kubectl get node -o jsonpath='{.items[0].metadata.name} {.items[0].metadata.creationTimestamp}'

# 4. Can a pod reach the driver?
wsl -d Ubuntu -u root -- kubectl get runtimeclass nvidia

# 5. Can a pod reserve one?
wsl -d Ubuntu -u root -- kubectl get node -o jsonpath='{.items[0].status.allocatable.nvidia\.com/gpu}'
```

The first one that gives the wrong answer is the layer to fix. If 4 and 5 both fail, it's the
cluster setup. If only 5 fails, it's the device plugin, and the `NVIDIA_VISIBLE_DEVICES` pod above
will still get you a measurement in the meantime.

NeuroMesh's `task cluster:status` runs this same walk in one command, along with the keepalive,
the k3s service and the admission policy.

## Git Bash gotchas

These two caused some baffling errors:

- Git Bash rewrites anything that looks like a Unix path before passing it to `wsl.exe`, so
  `/mnt/c/...` arrives as `C:/Program Files/Git/mnt/c/...`. Prefix the command with
  `MSYS_NO_PATHCONV=1`.
- `wsl.exe -- <command>` expands `$variables` on the Windows side before Linux sees them, which
  quietly empties loop variables. Put anything longer than one command in a script file and run
  that.
