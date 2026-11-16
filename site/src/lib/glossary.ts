// The glossary: which posts use each term, and checks that keep the entries linked up.
// <Term> fails the build on an unknown id; the page calls checkGlossary for the `see` lists.

export interface Entry {
  id: string;
  term: string;
  aka: string[];
  def: string;
  source?: string;
  see: string[];
}

/** The ids a post links with <Term id="...">, in order of first use, each once. */
export function termIds(body: string): string[] {
  const ids = [...body.matchAll(/<Term\s+[^>]*?\bid=["']([^"']+)["']/g)].map((m) => m[1]);
  return [...new Set(ids)];
}

/** term id -> the posts that use it, in the order given */
export function usedIn<P extends { body?: string }>(posts: P[]): Map<string, P[]> {
  const out = new Map<string, P[]>();
  for (const p of posts)
    for (const id of termIds(p.body ?? '')) out.set(id, [...(out.get(id) ?? []), p]);
  return out;
}

/** Throws when a `see` names an entry that doesn't exist, or an entry sees itself. */
export function checkGlossary(entries: Entry[]): void {
  const ids = new Set(entries.map((e) => e.id));
  for (const e of entries)
    for (const s of e.see) {
      if (s === e.id) throw new Error(`glossary: ${e.id} lists itself under see`);
      if (!ids.has(s)) throw new Error(`glossary: ${e.id} sees "${s}", which is not an entry`);
    }
}

/** Entries A to Z by term, ignoring case, grouped by first letter. */
export function byLetter(entries: Entry[]): [string, Entry[]][] {
  const sorted = [...entries].sort((a, b) =>
    a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }),
  );
  const groups = new Map<string, Entry[]>();
  for (const e of sorted) {
    const k = /[a-z]/i.test(e.term[0]) ? e.term[0].toUpperCase() : '#';
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups];
}
