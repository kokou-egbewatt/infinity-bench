# k3s in WSL2 as a server: data

The numbers behind the k3s-wsl2-gpu post. Per [ADR-0003](../../docs/adr/0003-neuromesh-code-there-numbers-here.md),
the code that produced them lives in NeuroMesh: `tools/cluster`, at the commit in [`env.json`](env.json).

| File | What it is |
| --- | --- |
| `commands.csv` | Wall time and what changed for each `task cluster:*` command |
| `recovery.csv` | How long the cluster takes to come back after WSL stops it, with and without a looping keepalive |
| `2026-10-29/raw/` | The output each row comes from |

Times in `recovery.csv` come from the timestamps in the raw output. Two of the scripts also printed
their own elapsed time, which counted from when the WSL command returned rather than when it was
issued, so they read a few seconds lower; both are noted in the `timed_by` column.

The two `wsl --terminate` rows were measured during the cluster comparison, so their raw output is in
[`data/cluster-matrix/2026-10-29/10-rebuild/raw/`](../cluster-matrix/2026-10-29/10-rebuild/raw/).

My Windows user name in paths reads `<user>`, and the GPU's UUID reads `<gpu-uuid>`.
