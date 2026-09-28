import { describe, expect, it } from 'vitest';
import { computeStats, type StatsInput } from './stats';

const post = (date: string, extra: Partial<StatsInput['data']> = {}): StatsInput => ({
  data: { date: new Date(date), draft: false, corrections: [], ...extra },
});

describe('computeStats', () => {
  it('excludes drafts from every figure', () => {
    const s = computeStats([
      post('2026-10-01', { corrections: [1] }),
      post('2026-12-01', { draft: true, corrections: [1, 2] }),
    ]);
    expect(s.postCount).toBe(1);
    expect(s.correctionCount).toBe(1);
    expect(s.lastMeasured).toEqual(new Date('2026-10-01'));
  });

  it('prefers updated over date for lastMeasured', () => {
    const s = computeStats([post('2026-10-01', { updated: new Date('2026-11-15') }), post('2026-11-01')]);
    expect(s.lastMeasured).toEqual(new Date('2026-11-15'));
  });

  it('returns null lastMeasured with no published posts', () => {
    expect(computeStats([]).lastMeasured).toBeNull();
  });
});
