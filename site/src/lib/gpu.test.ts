import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import {
  aboveFloor,
  chooseCluster,
  coldLabel,
  decodeError,
  floorOf,
  LAYERS,
  parseSamples,
  ramLabel,
  readProbe,
  RULES,
  triage,
  type Needs,
  type Row,
} from './gpu';
import { DATA_DIR } from './paths';

const csv = (file: string) =>
  parse(readFileSync(join(DATA_DIR, 'cluster-matrix', file), 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];
const errors = csv('errors.csv');
const matrix = csv('matrix.csv');
const costs = csv('costs.csv');

describe('decodeError', () => {
  it('has one rule per row of errors.csv, and no rule without a row', () => {
    expect(RULES.map((r) => r.error).sort()).toEqual(errors.map((e) => e.error).sort());
  });

  it("matches each row's own error text", () => {
    for (const row of errors) {
      const hit = decodeError(row.error, errors).matches.map((m) => m.rule.error);
      expect(hit, row.error).toContain(row.error);
    }
  });

  it('reads a failed probe and the error inside it', () => {
    const out = `{
  "nvml_device_count": 0,
  "level": 10,
  "failed_stage": "nvml_init",
  "error": "Not Supported"
}`;
    const d = decodeError(out, errors);
    expect(d.probe).toMatchObject({ level: 10, stage: 'nvml_init', error: 'Not Supported' });
    expect(d.matches.map((m) => m.rule.layer)).toEqual(['the node']);
  });

  it('reads a passing probe as working', () => {
    const p = readProbe('{\n  "level": 50,\n  "failed_stage": "",\n  "error": ""\n}');
    expect(p?.level).toBe(50);
    expect(p?.meaning).toMatch(/the GPU works/);
  });

  it('finds the errors in a real kubectl describe line and a plugin log', () => {
    const pending =
      'Warning  FailedScheduling  0/1 nodes are available: 1 Insufficient nvidia.com/gpu.';
    expect(decodeError(pending, errors).matches[0].rule.layer).toBe('the device plugin');
    const plugin =
      'E1029 1 main.go] Incompatible strategy detected auto\nerror: invalid device discovery strategy';
    expect(decodeError(plugin, errors).matches[0].rule.fix).toMatch(/runtimeClassName: nvidia/);
  });

  it('finds nothing in text it does not know', () => {
    expect(decodeError('ImagePullBackOff', errors)).toEqual({ probe: undefined, matches: [] });
  });
});

describe('triage', () => {
  it('stops at the first no', () => {
    const t = triage(['yes', 'yes', 'no', 'no']);
    expect(t.broken?.id).toBe('toolkit');
    expect(t.unchecked).toEqual([]);
    expect(t.healthy).toBe(false);
  });

  it('names the unanswered layers below the first no', () => {
    const t = triage(['yes', undefined, undefined, undefined, 'no']);
    expect(t.broken?.id).toBe('runtimeclass');
    expect(t.unchecked.map((l) => l.id)).toEqual(['wsl', 'toolkit', 'containerd']);
  });

  it('is healthy only when every layer is a yes', () => {
    expect(triage(LAYERS.map(() => 'yes')).healthy).toBe(true);
    expect(triage(['yes']).healthy).toBe(false);
  });
});

describe('chooseCluster', () => {
  const none: Needs = {
    rationed: false,
    unprivileged: false,
    stock: false,
    noDockerDesktop: false,
  };
  const fit = (n: Partial<Needs>) =>
    chooseCluster(matrix, costs, { ...none, ...n }).fit.map((c) => c.id);

  it('keeps the seven Kubernetes candidates, fastest first, and drops plain Docker', () => {
    const ids = fit({});
    expect(ids).toHaveLength(7);
    expect(ids[0]).toBe('k3s');
    expect(ids.at(-1)).toBe('docker-desktop-kubeadm');
    expect(ids).not.toContain('docker-plain');
  });

  it('leaves k3s and minikube when GPU pods must be rationed and unprivileged', () => {
    expect(fit({ rationed: true, unprivileged: true })).toEqual(['k3s', 'minikube']);
  });

  it('leaves k3s and Rancher Desktop without Docker Desktop', () => {
    expect(fit({ noDockerDesktop: true })).toEqual(['k3s', 'rancher-desktop']);
  });

  it('leaves the three that reach level 50 stock', () => {
    expect(fit({ stock: true })).toEqual(['k3s', 'rancher-desktop', 'docker-desktop-kubeadm']);
  });

  it('says why each one is out under a RAM budget', () => {
    const r = chooseCluster(matrix, costs, { ...none, ramMib: 400 });
    expect(r.fit.map((c) => c.id)).toEqual(['k3s']);
    const why = (id: string) => r.out.find((o) => o.candidate.id === id)?.why;
    expect(why('kind')).toEqual(['adds about 599 MiB of WSL RAM']);
    expect(why('docker-desktop-kind')).toEqual(['its RAM was not measured cleanly']);
  });

  it('shows the stock route unless rationing needs the tuned one', () => {
    const k3s = (n: Partial<Needs>) =>
      chooseCluster(matrix, costs, { ...none, ...n }).fit.find((c) => c.id === 'k3s')!;
    expect(k3s({}).route).toMatch(/^runtimeClassName nvidia/);
    expect(k3s({ rationed: true }).route).toMatch(/device plugin/);
  });
});

describe('labels for costs.csv cells', () => {
  it('reads every cold_to_level50_s cell', () => {
    const labels = costs.map((c) => coldLabel(c.cold_to_level50_s));
    expect(labels).toEqual([
      '16.7-19.2 s cold',
      '54.3-63.6 s cold',
      '71.2-80.1 s cold',
      '107.2-116.4 s cold',
      '65.9 s cold',
      '80.9 s warm',
      'not timed',
    ]);
  });

  it('reads every wsl_ram_added_mib cell', () => {
    expect(costs.map((c) => ramLabel(c.wsl_ram_added_mib))).toEqual([
      '364-382 MiB',
      '641-667 MiB',
      '599-628 MiB',
      '617-633 MiB',
      'about 590 MiB',
      'an amount not measured cleanly',
      'about 700 MiB',
    ]);
  });
});

describe('noise floor', () => {
  it('matches floor.sh: nearest-rank IQR and max minus min', () => {
    const f = floorOf([2265, 2266, 2265, 2265, 2265, 2266, 2265, 2265])!;
    expect(f).toEqual({ n: 8, median: 2265, iqr: 1, min: 2265, max: 2266, spread: 1 });
  });

  it('takes the median of an even count as the mean of the middle two', () => {
    expect(floorOf([1, 2, 3, 4])?.median).toBe(2.5);
  });

  it('needs two samples', () => {
    expect(floorOf([2265])).toBeUndefined();
  });

  it('pulls samples out of pasted nvidia-smi output', () => {
    expect(parseSamples('2265 MiB\n2266 MiB, 2290')).toEqual([2265, 2266, 2290]);
  });

  it('only says yes above the spread', () => {
    expect(aboveFloor(39, 39)).toBe(false);
    expect(aboveFloor(40, 39)).toBe(true);
    expect(aboveFloor(-113, 10)).toBe(true);
  });
});
