// Logic for the GPU cluster lab. Pure functions, tested in gpu.test.ts; the widgets in
// src/components/widgets/ only read inputs and print these results. The rows come from
// data/cluster-matrix/ at build time.

export type Row = Record<string, string>;

// ---------------------------------------------------------------- error decoder

/** What the probe's exit level means (bench/cluster-matrix/probe/gpu_probe.cu). */
export const LEVELS: Record<number, string> = {
  10: 'nothing: NVML did not initialise, so the driver never reached the container',
  20: 'NVML works, so the driver is reachable, but no CUDA context',
  30: 'a CUDA context, but the allocation failed',
  40: 'the allocation worked, but the GEMM failed or gave a wrong answer',
  50: 'a GEMM ran and every element of the result checked out: the GPU works',
};

export interface Rule {
  /** The `error` column of errors.csv, verbatim, so each rule joins to its row. */
  error: string;
  match: RegExp;
  layer: string;
  fix: string;
}

/** One rule per row of errors.csv; gpu.test.ts fails when the two drift apart. */
export const RULES: Rule[] = [
  {
    error:
      'error while loading shared libraries: libnvidia-ml.so.1: cannot open shared object file (exit 127)',
    match: /libnvidia-ml\.so\.1: cannot open shared object file|exit(ed)? (code )?127/i,
    layer: 'what reaches the container',
    fix: 'On k3s, set runtimeClassName: nvidia on the pod. On a cluster whose nodes are containers, mount /usr/lib/wsl/lib and /usr/lib/wsl/drivers into the node, then into the pod with hostPath.',
  },
  {
    error: 'nvml_init: Unable to load the NVML library (level 10)',
    match: /Unable to load the NVML library/i,
    layer: 'what reaches the container',
    fix: 'Mount /usr/lib/wsl/drivers as well as /usr/lib/wsl/lib. The libraries in lib load their code from the driver store.',
  },
  {
    error: 'nvml_init: Not Supported (level 10); plugin: Failed to initialize NVML: Not Supported',
    match: /(NVML|nvml_init)[^\n]*Not Supported|"error": "Not Supported"/i,
    layer: 'the node',
    fix: 'Give the node all of /usr/lib/wsl, not only what --gpus passed it. On minikube: --mount --mount-string=/usr/lib/wsl:/usr/lib/wsl on top of --gpus=all.',
  },
  {
    error: 'could not select device driver "" with capabilities: [[gpu]]',
    match: /could not select device driver/i,
    layer: 'the Docker runtime',
    fix: '--gpus does not nest: the inner Docker daemon has no NVIDIA runtime. Pass --device /dev/dxg and mount /usr/lib/wsl/lib and /usr/lib/wsl/drivers at every level instead.',
  },
  {
    error: 'no runtime for "nvidia" is configured',
    match: /no runtime for "?nvidia"? is configured/i,
    layer: 'the RuntimeClass',
    fix: "The node's containerd has no nvidia runtime, so drop runtimeClassName and use the hostPath route: the WSL folders on the node, hostPath in the pod.",
  },
  {
    error: 'RuntimeHandler "nvidia" not supported',
    match: /RuntimeHandler "?nvidia"? not supported/i,
    layer: 'the RuntimeClass',
    fix: 'cri-dockerd does not pass RuntimeClass handlers through. Drop runtimeClassName and use hostPath pods; the node already has the WSL folders.',
  },
  {
    error: 'RuntimeClass "nvidia" not found',
    match: /RuntimeClass "?nvidia"? not found/i,
    layer: 'the RuntimeClass',
    fix: 'No nvidia RuntimeClass exists. k3s creates one when nvidia-container-toolkit is in the distro; elsewhere, use the hostPath route.',
  },
  {
    error: 'Insufficient nvidia.com/gpu',
    match: /Insufficient nvidia\.com\/gpu/i,
    layer: 'the device plugin',
    fix: 'Check allocatable nvidia.com/gpu on the node. 0 means no device plugin registered the card (or it is still starting: about 20 s after a restart). 1 means another pod holds it.',
  },
  {
    error: 'hostPath type check failed: /usr/lib/wsl/lib is not a directory',
    match: /hostPath type check failed/i,
    layer: 'the node',
    fix: 'The node container has no WSL folders. Mount them into the node: k3d -v, kind extraMounts, minikube --mount-string.',
  },
  {
    error: 'Incompatible strategy detected auto ... invalid device discovery strategy',
    match: /Incompatible strategy detected|invalid device discovery strategy/i,
    layer: 'the device plugin',
    fix: 'The plugin pod cannot see the GPU itself. Add runtimeClassName: nvidia to its DaemonSet (or the same mounts as your GPU pods).',
  },
  {
    error: "Detected platform: wsl ... Registered device plugin for 'nvidia.com/gpu'",
    match: /Registered device plugin for '?nvidia\.com\/gpu'?|Detected platform: wsl/i,
    layer: 'the device plugin',
    fix: 'Nothing: this is a healthy plugin. If pods still pend, read allocatable nvidia.com/gpu on the node.',
  },
];

export interface ProbeResult {
  level: number;
  stage: string;
  error: string;
  meaning: string;
}

/** The probe's JSON, if the text holds it. */
export function readProbe(text: string): ProbeResult | undefined {
  const level = text.match(/"level":\s*(\d+)/);
  if (!level) return undefined;
  const n = Number(level[1]);
  const str = (k: string) =>
    text.match(new RegExp(`"${k}":\\s*"((?:[^"\\\\]|\\\\.)*)"`))?.[1] ?? '';
  return {
    level: n,
    stage: str('failed_stage'),
    error: str('error'),
    meaning: LEVELS[n] ?? `level ${n}`,
  };
}

export interface Match {
  rule: Rule;
  seenIn: string;
  means: string;
}

export interface Decoded {
  probe?: ProbeResult;
  matches: Match[];
}

/** Every known error in the pasted text, in the order of errors.csv, plus the probe level if present. */
export function decodeError(text: string, rows: Row[]): Decoded {
  const probe = readProbe(text);
  const matches: Match[] = [];
  for (const row of rows) {
    const rule = RULES.find((r) => r.error === row.error);
    if (rule && rule.match.test(text))
      matches.push({ rule, seenIn: row.seen_in, means: row.means });
  }
  return { probe, matches };
}

// ---------------------------------------------------------------- layer triage

export interface Layer {
  id: string;
  name: string;
  /** One command whose answer proves the layer, from docs/gpu-debug.md. */
  check: string;
  /** What a working answer looks like. */
  ok: string;
  fix: string;
}

/** The k3s stack from the bottom up, as docs/gpu-debug.md walks it. */
export const LAYERS: Layer[] = [
  {
    id: 'driver',
    name: 'Windows driver',
    check: 'nvidia-smi.exe --query-gpu=name,driver_version --format=csv,noheader',
    ok: 'the card and a driver version',
    fix: 'The Windows driver is the only NVIDIA driver here. Install or repair it on Windows; nothing in WSL can stand in for it.',
  },
  {
    id: 'wsl',
    name: 'WSL2 passthrough',
    check: 'wsl -d Ubuntu -- nvidia-smi --query-gpu=name --format=csv,noheader',
    ok: 'the same card',
    fix: "This is still the Windows driver's side. Update WSL, and make sure no Linux NVIDIA driver is installed in the distro: libcuda comes from Windows, in /usr/lib/wsl/lib.",
  },
  {
    id: 'toolkit',
    name: 'Container toolkit',
    check: 'dpkg -l nvidia-container-toolkit   # inside WSL',
    ok: 'a version, installed',
    fix: 'Install nvidia-container-toolkit in the distro. It is what gives k3s an nvidia runtime to find.',
  },
  {
    id: 'containerd',
    name: 'containerd runtime',
    check: 'grep -c nvidia /var/lib/rancher/k3s/agent/etc/containerd/config.toml',
    ok: 'more than 0',
    fix: 'k3s writes this file when it starts. Restart k3s with the toolkit installed and it adds the nvidia runtime by itself.',
  },
  {
    id: 'runtimeclass',
    name: 'RuntimeClass',
    check: 'kubectl get runtimeclass nvidia',
    ok: 'nvidia, handler nvidia',
    fix: 'k3s creates the nvidia RuntimeClass once its containerd has the runtime. Without it, pods get no driver at all.',
  },
  {
    id: 'plugin',
    name: 'Device plugin',
    check: "kubectl get node -o jsonpath='{.items[0].status.allocatable.nvidia\\.com/gpu}'",
    ok: '1 or more',
    fix: 'Install the NVIDIA device plugin with runtimeClassName: nvidia on its DaemonSet. Without it the plugin runs and registers nothing. After a restart, give it about 20 s.',
  },
];

export type Answer = 'yes' | 'no' | undefined;

export interface Triage {
  /** The first layer answered no, which is the one to fix. */
  broken?: Layer;
  /** Layers below it not answered yet, which might be the real cause. */
  unchecked: Layer[];
  /** Every layer answered yes. */
  healthy: boolean;
}

export function triage(answers: Answer[]): Triage {
  const i = answers.findIndex((a) => a === 'no');
  const below = i === -1 ? LAYERS : LAYERS.slice(0, i);
  const unchecked = below.filter((_, j) => answers[j] === undefined);
  return {
    broken: i === -1 ? undefined : LAYERS[i],
    unchecked,
    healthy: LAYERS.every((_, j) => answers[j] === 'yes'),
  };
}

// ---------------------------------------------------------------- which cluster

export interface Needs {
  /** The scheduler must ration the GPU (nvidia.com/gpu allocatable). */
  rationed: boolean;
  /** GPU pods must run without privileged: true. */
  unprivileged: boolean;
  /** Must work with no tuning at all. */
  stock: boolean;
  /** Docker Desktop is not an option. */
  noDockerDesktop: boolean;
  /** Most WSL RAM the cluster may add, in MiB; undefined for no limit. */
  ramMib?: number;
}

export interface Candidate {
  id: string;
  version: string;
  nodeIs: string;
  /** How it reaches level 50 for these needs: stock when that is enough, otherwise tuned. */
  route: string;
  coldToLevel50: string;
  ramMib: string;
  catch: string;
  /** For sorting: the low end of cold to level 50, Infinity when it was not timed. */
  coldS: number;
}

export interface Choice {
  fit: Candidate[];
  out: { candidate: Candidate; why: string[] }[];
}

/** The first number in a cell like "16.7-19.2", "about 590" or "82 (restart to node Ready)". */
export const firstNumber = (s: string | undefined) => {
  const m = (s ?? '').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
};

/** costs.csv's cold_to_level50_s as a short label: "16.7-19.2 s cold", "80.9 s warm", "not timed". */
export function coldLabel(cell: string): string {
  if (/^[\d.]+(-[\d.]+)?$/.test(cell)) return `${cell} s cold`;
  const n = /^\d/.test(cell) ? firstNumber(cell) : undefined;
  if (n === undefined) return 'not timed';
  return /warm/.test(cell) ? `${n} s warm` : `${n} s cold`;
}

/** costs.csv's wsl_ram_added_mib as a phrase: "364-382 MiB", "about 700 MiB", or why there is none. */
export function ramLabel(cell: string): string {
  const m = cell.match(/^(about )?[\d.]+(-[\d.]+)?/);
  return m ? `${m[0]} MiB` : 'an amount not measured cleanly';
}

/** Candidates whose node runs on Docker Desktop's engine or VM. */
const ON_DOCKER_DESKTOP = new Set([
  'k3d',
  'kind',
  'minikube',
  'docker-desktop-kind',
  'docker-desktop-kubeadm',
]);

/** matrix.csv joined to costs.csv, the Kubernetes candidates only. */
export function candidates(matrix: Row[], costs: Row[]): (Candidate & { row: Row })[] {
  return matrix
    .filter((m) => m.k8s_version)
    .map((m) => {
      const c = costs.find((x) => x.candidate === m.candidate) ?? {};
      return {
        id: m.candidate,
        version: m.tool_version,
        nodeIs: m.node_is,
        route: m.tuned_route,
        coldToLevel50: c.cold_to_level50_s ?? '',
        ramMib: c.wsl_ram_added_mib ?? '',
        catch: c.notes ?? '',
        coldS: /^\d/.test(c.cold_to_level50_s ?? '')
          ? (firstNumber(c.cold_to_level50_s) ?? Infinity)
          : Infinity,
        row: m,
      };
    });
}

export function chooseCluster(matrix: Row[], costs: Row[], needs: Needs): Choice {
  const fit: Candidate[] = [];
  const out: Choice['out'] = [];
  for (const { row, ...c } of candidates(matrix, costs)) {
    const why: string[] = [];
    if (needs.rationed && row.tuned_schedulable !== 'yes') why.push('cannot ration the GPU');
    if (needs.unprivileged && row.gpu_pods_privileged !== 'no')
      why.push('GPU pods have to be privileged');
    if (needs.stock && row.stock_best_level !== '50') why.push('needs tuning to reach level 50');
    if (needs.noDockerDesktop && ON_DOCKER_DESKTOP.has(c.id)) why.push('runs on Docker Desktop');
    if (needs.ramMib !== undefined) {
      // "not clean (...)" has no number to compare
      const ram = /^(about )?\d/.test(c.ramMib) ? firstNumber(c.ramMib) : undefined;
      if (ram === undefined) why.push('its RAM was not measured cleanly');
      else if (ram > needs.ramMib) why.push(`adds about ${ram} MiB of WSL RAM`);
    }
    // stock is enough unless the GPU has to be rationed, which takes the tuned route everywhere
    const route =
      row.stock_best_level === '50' && row.stock_how && !needs.rationed
        ? row.stock_how
        : row.tuned_route;
    if (why.length) out.push({ candidate: { ...c, route }, why });
    else fit.push({ ...c, route });
  }
  fit.sort((a, b) => a.coldS - b.coldS);
  return { fit, out };
}

// ---------------------------------------------------------------- noise floor

export interface Floor {
  n: number;
  median: number;
  iqr: number;
  min: number;
  max: number;
  /** max - min: the smallest difference these samples can tell apart. */
  spread: number;
}

/** Whole numbers out of pasted text: one sample per number, any separator. */
export const parseSamples = (text: string) =>
  (text.match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((v) => Number.isFinite(v));

/** The same arithmetic as bench/cluster-matrix/probe/floor.sh: nearest-rank IQR, max - min spread. */
export function floorOf(samples: number[]): Floor | undefined {
  const s = [...samples].sort((a, b) => a - b);
  const n = s.length;
  if (n < 2) return undefined;
  const median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  const q1 = s[Math.floor(n * 0.25)];
  const q3 = s[Math.floor(n * 0.75)];
  return { n, median, iqr: q3 - q1, min: s[0], max: s[n - 1], spread: s[n - 1] - s[0] };
}

/** A whole-card difference is only a yes when it is bigger than the floor's spread. */
export const aboveFloor = (deltaMib: number, spreadMib: number) => Math.abs(deltaMib) > spreadMib;
