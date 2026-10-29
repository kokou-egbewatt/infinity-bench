// Logic for the runner fleet post's labs. Pure functions, tested in runners.test.ts;
// the widgets in src/components/widgets/ only read inputs and print these results.

// ---------------------------------------------------------------- runner class checker

export type RunnerClass = 'light' | 'dind' | 'neither';

export interface JobReport {
  id: string;
  cls: RunnerClass;
  /** Why the job landed in its class. */
  reasons: string[];
  /** The runs-on value as written. */
  runsOn: string;
  /** Problems worth fixing whatever the class. */
  flags: string[];
  /** A runs-on line to use instead, or advice when no fleet class fits. */
  suggest: string;
  /** Fixed host ports its services publish, as in "5432:5432". */
  ports: number[];
  needs: string[];
}

export interface Collision {
  port: number;
  jobs: [string, string];
}

export interface WorkflowReport {
  jobs: JobReport[];
  collisions: Collision[];
  error?: string;
}

/** Actions known to run in their own container (runs.using: docker), so they need a daemon that can mount the workspace. */
const DOCKER_ACTIONS = ['hadolint/hadolint-action', 'bridgecrewio/checkov-action'];
/** Actions that drive a Docker daemon from the job. */
const DAEMON_ACTIONS = ['docker/build-push-action', 'docker/setup-buildx-action', 'docker/login-action', 'helm/kind-action'];
const DOCKER_CMD = /\b(docker\s+(build|buildx|compose|run|push|pull|login|exec)|docker-compose|kind\s+create|podman\s+(build|run))\b/;

export const SUGGEST = {
  light: "${{ vars.CI_RUNNER || 'ubuntu-latest' }}",
  dind: "${{ vars.CI_RUNNER_DIND || 'ubuntu-latest' }}",
};

const indentOf = (l: string) => l.length - l.trimStart().length;
const unquote = (v: string) => v.trim().replace(/^['"]|['"]$/g, '');

function stripComment(l: string): string {
  if (l.trimStart().startsWith('#')) return '';
  // drop " # comment" outside quotes; good enough for workflow files
  let q: string | null = null;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) {
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") q = ch;
    else if (ch === '#' && (i === 0 || /\s/.test(l[i - 1]))) return l.slice(0, i).trimEnd();
  }
  return l.trimEnd();
}

/** A scalar, a flow list "[a, b]", or a block list on the following lines. */
function readList(lines: string[], i: number, keyIndent: number, value: string): string[] {
  const v = value.trim();
  if (v.startsWith('[')) return v.replace(/^\[|\]$/g, '').split(',').map(unquote).filter(Boolean);
  if (v) return [unquote(v)];
  const out: string[] = [];
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    if (!l.trim()) continue;
    if (indentOf(l) <= keyIndent) break;
    const m = l.trim().match(/^-\s*(.+)$/);
    if (m) out.push(unquote(m[1]));
  }
  return out;
}

/** The lines belonging to the key on line i: everything indented deeper than it. */
function block(lines: string[], i: number): string[] {
  const base = indentOf(lines[i]);
  const out: string[] = [];
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    if (!l.trim()) continue;
    if (indentOf(l) <= base) break;
    out.push(l);
  }
  return out;
}

/** Host ports fixed by "host:container" entries under any ports: key in a services block. */
function servicePorts(svc: string[]): number[] {
  const ports: number[] = [];
  for (let k = 0; k < svc.length; k++) {
    if (!/^\s*ports:\s*(\[.*\])?\s*$/.test(svc[k])) continue;
    const inline = svc[k].match(/\[(.*)\]/);
    const items = inline ? inline[1].split(',') : block(svc, k).map((l) => l.trim().replace(/^-\s*/, ''));
    for (const raw of items) {
      const m = unquote(raw).match(/^(?:\d+\.\d+\.\d+\.\d+:)?(\d+):(\d+)(?:\/\w+)?$/);
      if (m) ports.push(Number(m[1]));
    }
  }
  return ports;
}

export function checkWorkflow(src: string): WorkflowReport {
  const lines = src.replace(/\t/g, '  ').split(/\r?\n/).map(stripComment);
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start < 0) return { jobs: [], collisions: [], error: 'No top-level jobs: key found. Paste a whole workflow file.' };

  const first = lines.slice(start + 1).find((l) => l.trim());
  if (!first || indentOf(first) === 0) return { jobs: [], collisions: [], error: 'The jobs: key has no jobs under it.' };
  const jobIndent = indentOf(first);

  const jobs: JobReport[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    if (indentOf(l) === 0) break;
    if (indentOf(l) !== jobIndent) continue;
    const head = l.trim().match(/^([\w-]+):\s*$/);
    if (!head) continue;

    const body = block(lines, i);
    const keyIndent = body.length ? indentOf(body[0]) : jobIndent + 2;
    let runsOnList: string[] = [];
    let runsOnRaw = '';
    let needs: string[] = [];
    const reasons: string[] = [];
    const flags: string[] = [];
    let neither = false;
    let ports: number[] = [];

    body.forEach((bl, k) => {
      const key = indentOf(bl) === keyIndent ? bl.trim().match(/^([\w-]+):\s*(.*)$/) : null;
      if (key) {
        const [, name, value] = key;
        if (name === 'runs-on') {
          runsOnRaw = value.trim();
          runsOnList = readList(body, k, keyIndent, value);
          if (!runsOnRaw) runsOnRaw = runsOnList.length ? `[${runsOnList.join(', ')}]` : '(group or labels block)';
        } else if (name === 'needs') {
          needs = readList(body, k, keyIndent, value);
        } else if (name === 'services') {
          const svc = block(body, k);
          const names = svc.filter((s) => indentOf(s) === indentOf(svc[0] ?? '')).map((s) => s.trim().replace(/:.*$/, ''));
          reasons.push(`services: ${names.join(', ') || 'yes'}`);
          ports = servicePorts(svc);
        } else if (name === 'container') {
          reasons.push('job container');
        }
      }
      const uses = bl.match(/uses:\s*['"]?([^'"\s]+)/);
      if (uses) {
        const action = uses[1];
        const repo = action.replace(/@.*$/, '');
        if (action.startsWith('docker://')) {
          neither = true;
          reasons.push(`container action ${action}`);
        } else if (DOCKER_ACTIONS.some((a) => repo === a)) {
          neither = true;
          reasons.push(`${repo} is a container action`);
        } else if (DAEMON_ACTIONS.some((a) => repo === a)) {
          reasons.push(`${repo} needs a daemon`);
        }
      }
      if (DOCKER_CMD.test(bl) && !reasons.includes('docker commands')) reasons.push('docker commands');
    });

    const target = runsOnList.join(' ').toLowerCase();
    const otherOs = /\b(windows|macos)/.test(target);
    if (otherOs) {
      neither = true;
      reasons.unshift('needs Windows or macOS');
    }
    if (otherOs) {
      // staying on a GitHub-hosted label is the right answer here, not a flag
    } else if (runsOnList.length === 1 && runsOnList[0] === 'self-hosted') {
      flags.push('bare self-hosted: name the runner class');
    } else if (runsOnList.some((r) => /^(ubuntu|windows|macos)-/.test(r)) && !/vars\./.test(runsOnRaw)) {
      flags.push('pinned to GitHub-hosted: read it from a variable');
    } else if (/matrix\./.test(runsOnRaw)) {
      flags.push('set by a matrix; check each value');
    } else if (!runsOnRaw) {
      flags.push('no runs-on found');
    }

    const cls: RunnerClass = neither ? 'neither' : reasons.length ? 'dind' : 'light';
    if (cls === 'light') reasons.push('no Docker needed');
    const suggest =
      cls === 'neither'
        ? /\b(windows|macos)/.test(target)
          ? 'stay on GitHub-hosted'
          : 'replace the container action, then use light'
        : SUGGEST[cls];
    jobs.push({ id: head[1], cls, reasons, runsOn: runsOnRaw, flags, suggest, ports, needs });
  }

  if (!jobs.length) return { jobs, collisions: [], error: 'No jobs found under jobs:.' };

  // Two jobs collide on a shared host daemon when they publish the same host port and
  // neither waits for the other.
  const deps = new Map(jobs.map((j) => [j.id, j.needs]));
  const reaches = (a: string, b: string, seen = new Set<string>()): boolean => {
    if (seen.has(a)) return false;
    seen.add(a);
    return (deps.get(a) ?? []).some((n) => n === b || reaches(n, b, seen));
  };
  const collisions: Collision[] = [];
  for (let x = 0; x < jobs.length; x++) {
    for (let y = x + 1; y < jobs.length; y++) {
      const a = jobs[x];
      const b = jobs[y];
      if (reaches(a.id, b.id) || reaches(b.id, a.id)) continue;
      for (const port of a.ports.filter((p) => b.ports.includes(p))) collisions.push({ port, jobs: [a.id, b.id] });
    }
  }
  return { jobs, collisions };
}

// ---------------------------------------------------------------- fleet sizing

/** Erlang C: the probability a job waits, with c runners and an offered load of a erlangs. */
export function erlangC(c: number, a: number): number {
  if (a <= 0) return 0;
  if (c <= a) return 1;
  let b = 1; // Erlang B, built up one runner at a time
  for (let k = 1; k <= c; k++) b = (a * b) / (k + a * b);
  return (c * b) / (c - a * (1 - b));
}

/** Mean time a job waits for a runner, in minutes. Infinite when the runners cannot keep up. */
export function meanWait(c: number, a: number, jobMinutes: number): number {
  if (a <= 0) return 0;
  if (c <= a) return Infinity;
  return (erlangC(c, a) * jobMinutes) / (c - a);
}

/** The fewest runners that keep the mean wait at or under the target. */
export function runnersFor(a: number, jobMinutes: number, targetMinutes: number, max = 64): number {
  if (a <= 0) return 0;
  for (let c = Math.max(1, Math.floor(a) + 1); c <= max; c++) {
    if (meanWait(c, a, jobMinutes) <= targetMinutes) return c;
  }
  return max;
}

export interface FleetInput {
  jobsPerHour: number;
  jobMinutes: number;
  /** 0 to 1: the share of jobs that need a Docker daemon. */
  dockerShare: number;
  cores: number;
  ramGb: number;
  /** Memory kept for everything else on the machine. */
  reservedGb: number;
  light: { ramGb: number; cpus: number };
  dind: { ramGb: number; cpus: number };
  targetWaitSec: number;
}

export interface ClassPlan {
  load: number;
  runners: number;
  waitSec: number;
}

export interface FleetPlan {
  light: ClassPlan;
  dind: ClassPlan;
  ramNeeded: number;
  ramAvailable: number;
  cpuAsked: number;
  status: 'ok' | 'tight' | 'over';
}

export function fleetSize(i: FleetInput): FleetPlan {
  const perMinute = i.jobsPerHour / 60;
  const plan = (share: number): ClassPlan => {
    const load = perMinute * share * i.jobMinutes;
    const runners = runnersFor(load, i.jobMinutes, i.targetWaitSec / 60);
    return { load, runners, waitSec: meanWait(runners, load, i.jobMinutes) * 60 };
  };
  const light = plan(1 - i.dockerShare);
  const dind = plan(i.dockerShare);
  const ramNeeded = light.runners * i.light.ramGb + dind.runners * i.dind.ramGb;
  const ramAvailable = Math.max(0, i.ramGb - i.reservedGb);
  const cpuAsked = light.runners * i.light.cpus + dind.runners * i.dind.cpus;
  const status = ramNeeded > ramAvailable ? 'over' : ramNeeded > ramAvailable * 0.85 ? 'tight' : 'ok';
  return { light, dind, ramNeeded, ramAvailable, cpuAsked, status };
}

// ---------------------------------------------------------------- break-even

export interface BreakEvenInput {
  minutes: number;
  /** USD per minute for the GitHub-hosted runner being replaced. */
  rate: number;
  included: number;
  includedApplies: boolean;
  machineCost: number;
  months: number;
  /** Extra watts drawn while jobs run. */
  watts: number;
  kwhPrice: number;
  hoursPerMonth: number;
  hourly: number;
  /** Per-minute charge on self-hosted minutes, 0 when none applies. */
  selfCharge: number;
}

export interface BreakEven {
  hosted: number;
  self: number;
  /** Monthly minutes above which self-hosting is cheaper; null if it never is. */
  breakEvenMinutes: number | null;
}

export function breakEven(i: BreakEvenInput): BreakEven {
  const included = i.includedApplies ? i.included : 0;
  const fixed = (i.months > 0 ? i.machineCost / i.months : 0) + i.hoursPerMonth * i.hourly;
  const perMinute = (i.watts / 1000 / 60) * i.kwhPrice + i.selfCharge;
  const hosted = Math.max(0, i.minutes - included) * i.rate;
  const self = fixed + i.minutes * perMinute;
  // past the included minutes: (m - included) * rate = fixed + m * perMinute
  const breakEvenMinutes = i.rate > perMinute ? (fixed + included * i.rate) / (i.rate - perMinute) : null;
  return { hosted, self, breakEvenMinutes };
}

// ---------------------------------------------------------------- cache payoff

export interface CacheRow {
  sizeMb: number;
  jobsPerDay: number;
}

export interface CachePayoff {
  gbPerMonth: number;
  minutesPerMonth: number;
}

/** What a job-per-download world costs, which a shared cache turns into one download per version. */
export function cachePayoff(rows: CacheRow[], mbps: number, daysPerMonth: number): CachePayoff {
  const mbPerDay = rows.reduce((s, r) => s + r.sizeMb * r.jobsPerDay, 0);
  const secondsPerDay = mbps > 0 ? (mbPerDay * 8) / mbps : 0;
  return { gbPerMonth: (mbPerDay * daysPerMonth) / 1024, minutesPerMonth: (secondsPerDay * daysPerMonth) / 60 };
}
