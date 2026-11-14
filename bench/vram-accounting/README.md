# vram-accounting

How much VRAM the desktop holds before a model loads, one app at a time
([#10](https://github.com/kokou-egbewatt/infinity-bench/issues/10)). The results go into
[`data/vram-accounting/`](../../data/vram-accounting/).

```sh
make vram-accounting
```

It needs gpu-lab up (`task cluster:start` in NeuroMesh), Docker Desktop running, a clean tree, and
no other pod holding `nvidia.com/gpu`. It takes about 15 minutes, and asks you to close and reopen
each app in [`config.yaml`](config.yaml), pressing Enter after each.

To have someone else prompt you, `bench/run.sh vram-accounting --go-dir /out/go` waits for files
`go-1`, `go-2`, ... in `data/vram-accounting/go/` instead of Enter, and prints `WAITING go-N:` with
the instruction each time.

## How it measures

Nothing on WSL2 can say how much VRAM one process uses: Windows lists 43 processes and every one
reads `[N/A]`, and WSL2 and pods list none ([dev-machine.md](../../docs/dev-machine.md#can-i-see-vram-from-everywhere)).
So every app is measured by difference, from whole-card `memory.used` read through NVML in the pod:

1. With everything open, it takes 30 one-second samples. Their median is the desktop tax
   (`desktop_tax_mb` in `env.json`), and their range is the noise floor.
2. For each app, three times: read, close it, wait 10 s, read, reopen it, wait 10 s, read. The
   app's figure is the median of open minus closed. The reading after reopening is the next
   trial's open reading.
3. Last, with every app closed but VS Code (`keep_open`) and one monitor, a reading of what's left.

VS Code is never closed, because the run is driven from it, so it has no row of its own and it is in
the last reading.

A reading is always the median of 30 samples.

## What the notes mean

| Note | Why |
| --- | --- |
| below the noise floor | the difference is no bigger than the desktop moving on its own, so it isn't a measurement |
| trials disagree | the three differences have a standard deviation above 40 MiB |
| did not come back | the reading after reopening was more than 50 MiB away from the one before closing; Windows sometimes keeps memory cached after an app exits |

## Limits

- Every reading includes the harness pod's own NVML handle. It's the same in every reading, so it
  cancels out of the differences, but it is in the desktop tax and in the last reading.
- An idle CUDA context isn't measured here, because gpu-lab has one GPU slot and the harness holds
  it. The cluster-matrix work measured it at 113 MiB.
- The second monitor's figure depends on its resolution and refresh rate.
- Chrome's GPU process can take 20 to 30 s to let go of its memory. If its trials disagree, raise
  `settle_s` and say so.
