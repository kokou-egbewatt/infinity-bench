import { describe, expect, it } from 'vitest';
import { postEvents, siteEvents, type ChangeInput } from './changes';

const post = (id: string, date: string, extra: Partial<ChangeInput['data']> = {}): ChangeInput => ({
  id,
  data: { title: id, date: new Date(date), draft: false, errata: [], changes: [], ...extra },
});

describe('changes', () => {
  it('leaves drafts out of the site log', () => {
    const e = siteEvents([post('a', '2026-10-01'), post('b', '2026-10-02', { draft: true })]);
    expect(e.map((x) => x.post.id)).toEqual(['a']);
  });

  it('puts the newest first and, on one day, an erratum before anything else', () => {
    const e = postEvents(
      post('a', '2026-10-01', {
        changes: [{ date: new Date('2026-10-05'), text: 'Added round 2 of the cache runs.' }],
        errata: [
          {
            date: new Date('2026-10-05'),
            text: 'The browser cache is 278 MB, not 115 MB.',
            credit: 'R',
          },
        ],
      }),
    );
    expect(e.map((x) => x.kind)).toEqual(['erratum', 'updated', 'published']);
    expect(e[0].credit).toBe('R');
  });

  it('adds a lab event for a post whose plan has a lab page', () => {
    const e = postEvents(post('fleet', '2026-10-15', { plan: 'desktop-runner-fleet' }));
    expect(e.some((x) => x.kind === 'lab' && x.lab?.id === 'runner-fleet')).toBe(true);
  });
});
