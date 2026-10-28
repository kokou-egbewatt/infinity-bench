import { describe, expect, it } from 'vitest';
import { breakEven, cachePayoff, checkWorkflow, erlangC, fleetSize, meanWait, runnersFor, SUGGEST } from './runners';
import { SAMPLE_WORKFLOW } from './runnersSample';

describe('checkWorkflow', () => {
  const r = checkWorkflow(SAMPLE_WORKFLOW);
  const job = (id: string) => r.jobs.find((j) => j.id === id)!;

  it('finds every job in the sample', () => {
    expect(r.error).toBeUndefined();
    expect(r.jobs.map((j) => j.id)).toEqual(['lint', 'unit', 'contract', 'integration', 'dockerfile', 'image', 'desktop']);
  });

  it('puts a job with no Docker use on the light class', () => {
    expect(job('lint').cls).toBe('light');
    expect(job('lint').suggest).toBe(SUGGEST.light);
  });

  it('flags a pinned GitHub-hosted label and a bare self-hosted', () => {
    expect(job('lint').flags.join()).toMatch(/pinned to GitHub-hosted/);
    expect(job('unit').flags.join()).toMatch(/bare self-hosted/);
  });

  it('sends services, docker commands and daemon actions to dind', () => {
    expect(job('contract').cls).toBe('dind');
    expect(job('contract').reasons.join()).toMatch(/postgres, redis/);
    expect(job('image').cls).toBe('dind');
    expect(job('image').reasons.join()).toMatch(/docker\/build-push-action/);
  });

  it('marks a container action as working on neither class', () => {
    expect(job('dockerfile').cls).toBe('neither');
    expect(job('dockerfile').reasons.join()).toMatch(/hadolint/);
  });

  it('keeps Windows jobs on GitHub-hosted runners', () => {
    expect(job('desktop').cls).toBe('neither');
    expect(job('desktop').suggest).toMatch(/GitHub-hosted/);
    expect(job('desktop').flags).toEqual([]);
  });

  it('reads fixed host ports and ignores random ones', () => {
    expect(job('contract').ports).toEqual([5432, 6379]);
    expect(job('integration').ports).toEqual([5432]);
  });

  it('reports parallel jobs on the same host port, and not ordered ones', () => {
    expect(r.collisions).toEqual([{ port: 5432, jobs: ['contract', 'integration'] }]);
    const ordered = SAMPLE_WORKFLOW.replace('  integration:\n', '  integration:\n    needs: [contract]\n');
    expect(checkWorkflow(ordered).collisions).toEqual([]);
  });

  it('accepts a variable fallback without a flag', () => {
    const w = `jobs:\n  a:\n    runs-on: \${{ vars.CI_RUNNER || 'ubuntu-latest' }}\n    steps:\n      - run: make test\n`;
    expect(checkWorkflow(w).jobs[0].flags).toEqual([]);
  });

  it('reads block-list runs-on and ignores comments', () => {
    const w = 'jobs:\n  a:  # first\n    runs-on:\n      - self-hosted\n      - light\n    steps:\n      - run: echo "# not a comment"\n';
    const j = checkWorkflow(w).jobs[0];
    expect(j.id).toBe('a');
    expect(j.runsOn).toBe('[self-hosted, light]');
    expect(j.flags).toEqual([]);
  });

  it('explains what is missing', () => {
    expect(checkWorkflow('name: x\non: push\n').error).toMatch(/No top-level jobs/);
    expect(checkWorkflow('jobs:\n').error).toMatch(/no jobs under it/);
  });
});

describe('queue model', () => {
  it('matches a textbook Erlang C value', () => {
    // 2 servers, 1 erlang: P(wait) = 1/3
    expect(erlangC(2, 1)).toBeCloseTo(1 / 3, 10);
  });

  it('never waits with no load, and never keeps up at or past capacity', () => {
    expect(meanWait(1, 0, 5)).toBe(0);
    expect(meanWait(2, 2, 5)).toBe(Infinity);
  });

  it('picks the fewest runners that meet the target', () => {
    const c = runnersFor(2, 6, 0.5);
    expect(meanWait(c, 2, 6)).toBeLessThanOrEqual(0.5);
    expect(meanWait(c - 1, 2, 6)).toBeGreaterThan(0.5);
  });
});

describe('fleetSize', () => {
  const base = {
    jobsPerHour: 30, jobMinutes: 6, dockerShare: 0.1, cores: 12, ramGb: 32, reservedGb: 12,
    light: { ramGb: 2, cpus: 1.5 }, dind: { ramGb: 6, cpus: 3 }, targetWaitSec: 30,
  };

  it('splits the load by Docker share', () => {
    const p = fleetSize(base);
    expect(p.light.load).toBeCloseTo(2.7, 10);
    expect(p.dind.load).toBeCloseTo(0.3, 10);
    expect(p.ramNeeded).toBe(p.light.runners * 2 + p.dind.runners * 6);
    expect(p.ramAvailable).toBe(20);
  });

  it('says over when the runners need more memory than is left', () => {
    expect(fleetSize({ ...base, jobsPerHour: 300 }).status).toBe('over');
  });
});

describe('breakEven', () => {
  const base = {
    minutes: 6000, rate: 0.006, included: 3000, includedApplies: true, machineCost: 0, months: 36,
    watts: 120, kwhPrice: 0.15, hoursPerMonth: 0, hourly: 0, selfCharge: 0,
  };

  it('bills only minutes past the included ones', () => {
    expect(breakEven(base).hosted).toBeCloseTo(18, 10);
  });

  it('ignores included minutes on larger runners', () => {
    expect(breakEven({ ...base, rate: 0.012, includedApplies: false }).hosted).toBeCloseTo(72, 10);
  });

  it('solves for the minutes where both cost the same', () => {
    const b = breakEven({ ...base, machineCost: 720 });
    const at = breakEven({ ...base, machineCost: 720, minutes: b.breakEvenMinutes! });
    expect(at.hosted).toBeCloseTo(at.self, 6);
  });

  it('has no break-even when self-hosted minutes cost more than hosted ones', () => {
    expect(breakEven({ ...base, rate: 0.002, selfCharge: 0.002 }).breakEvenMinutes).toBeNull();
  });
});

describe('cachePayoff', () => {
  it('turns sizes and jobs into data and minutes a month', () => {
    const p = cachePayoff([{ sizeMb: 100, jobsPerDay: 10 }], 100, 30);
    expect(p.gbPerMonth).toBeCloseTo(30000 / 1024, 10);
    expect(p.minutesPerMonth).toBeCloseTo(40, 10); // 1000 MB a day at 100 Mbps is 80 s
  });
});
