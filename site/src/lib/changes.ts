// Every dated event on the site, for /changelog, /errata and each post's own log. Published
// posts only: a draft has no history a reader could have seen.
import { WIDGETS } from './widgets';

export type ChangeKind = 'published' | 'updated' | 'erratum' | 'lab';

export interface ChangeInput {
  id: string;
  data: {
    title: string;
    date: Date;
    draft: boolean;
    plan?: string;
    errata: { date: Date; text: string; credit?: string }[];
    changes: { date: Date; text: string }[];
  };
}

export interface ChangeEvent {
  date: Date;
  kind: ChangeKind;
  text: string;
  credit?: string;
  post: { id: string; title: string };
  /** A lab's own page, for lab events. */
  lab?: { id: string; name: string };
}

// On one day, an erratum reads first: it is the entry a returning reader most needs.
const ORDER: Record<ChangeKind, number> = { erratum: 0, updated: 1, lab: 2, published: 3 };

export function postEvents(p: ChangeInput): ChangeEvent[] {
  const post = { id: p.id, title: p.data.title };
  const events: ChangeEvent[] = [
    { date: p.data.date, kind: 'published', text: 'Published.', post },
    ...p.data.changes.map((c) => ({ date: c.date, kind: 'updated' as const, text: c.text, post })),
    ...p.data.errata.map((e) => ({ date: e.date, kind: 'erratum' as const, text: e.text, credit: e.credit, post })),
  ];
  for (const w of WIDGETS) {
    if (w.page && p.data.plan && w.plan === p.data.plan) {
      events.push({ date: p.data.date, kind: 'lab', text: w.blurb, post, lab: { id: w.id, name: w.name } });
    }
  }
  return sortEvents(events);
}

export function siteEvents(posts: ChangeInput[]): ChangeEvent[] {
  return sortEvents(posts.filter((p) => !p.data.draft).flatMap(postEvents));
}

export function sortEvents(events: ChangeEvent[]): ChangeEvent[] {
  return [...events].sort((a, b) => b.date.valueOf() - a.date.valueOf() || ORDER[a.kind] - ORDER[b.kind]);
}

export const KIND_LABEL: Record<ChangeKind, string> = {
  published: 'published',
  updated: 'updated',
  erratum: 'erratum',
  lab: 'new lab',
};
