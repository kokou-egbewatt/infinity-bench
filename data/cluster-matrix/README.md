# Cluster matrix data

The numbers behind which local Kubernetes can run GPU work on WSL2
([#22](https://github.com/kokou-egbewatt/infinity-bench/issues/22)). The scripts that produced them
are in [`bench/cluster-matrix/`](../../bench/cluster-matrix/README.md), and the write-up of each
step, with every command run, is in [`docs/notebook/cluster-matrix.ipynb`](../../docs/notebook/cluster-matrix.ipynb).

The files at this level are the tables the post and the lab read. `2026-10-29/` holds the raw
output of each step, in folders named after the step. Steps 00 and 09 have no folder: 00 only produced the slate listing, which is private, and 09 measured nothing new; its tables are `matrix.csv` and `costs.csv` above.

| File | What it is | From |
| --- | --- | --- |
| `matrix.csv` | What each candidate reaches, stock and tuned, and how | steps 02 to 08b |
| `costs.csv` | Cold to Ready, cold to level 50, RAM, disk, teardown, what stays behind | steps 03 to 08b |
| `ladder.csv` | The plain Docker nesting ladder: ten rungs, what reached each container, the level | step 02 |
| `errors.csv` | Every distinct error seen, where, and what it means | all steps |
| `floor.csv` | The VRAM noise floor, re-measured at the start of each step | steps 01 to 08 |

## 2026-10-29

Every step ran on one day, on one machine (see [`env.json`](env.json)), from a blank slate:
no cluster, no leftover images, the CI runner fleet stopped. Each candidate was installed, measured,
removed, and the machine checked back to the slate before the next one.

- `NN-name/raw/` is the command output each step's notebook section quotes: probe JSON, pod specs,
  timelines (`timeline.csv`, `cycles.csv`), install logs.
- `NN-name/errors/` is verbatim error output, kept whole.
- Kubeconfigs (they carry client keys), installer logs and the slate checks (a listing of the
  machine's distros, images and contexts) are not published, and [`.gitignore`](.gitignore) keeps kubeconfigs and installer logs out if the steps are run again. My Windows user name in paths reads
  `<user>`.

`03-k3s/raw/cycles.csv` has four cycles. The first is not in `costs.csv`: my harness applied the
probe pod before the `default` service account existed, which is a harness race, not k3s. Cycle 4
ran in its place.
