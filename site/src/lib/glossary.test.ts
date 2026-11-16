import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { byLetter, checkGlossary, termIds, usedIn, type Entry } from './glossary';

const entry = (id: string, term = id, see: string[] = []): Entry => ({
  id,
  term,
  aka: [],
  def: 'x',
  see,
});

describe('termIds', () => {
  it('finds each id once, in order of first use', () => {
    const body =
      'A <Term id="kv-cache">KV</Term> and <Term id=\'vram\'>VRAM</Term>, <Term id="kv-cache">again</Term>';
    expect(termIds(body)).toEqual(['kv-cache', 'vram']);
  });
  it('ignores ids on other components', () => {
    expect(termIds('<LabLink id="gpu-cluster">x</LabLink>')).toEqual([]);
  });
});

describe('usedIn', () => {
  it('maps each term to the posts that use it', () => {
    const a = { id: 'a', body: '<Term id="vram">v</Term>' };
    const b = { id: 'b', body: '<Term id="vram">v</Term> <Term id="mib">m</Term>' };
    const m = usedIn([a, b]);
    expect(m.get('vram')).toEqual([a, b]);
    expect(m.get('mib')).toEqual([b]);
  });
});

describe('checkGlossary', () => {
  it('accepts see lists that resolve', () => {
    expect(() => checkGlossary([entry('a', 'a', ['b']), entry('b')])).not.toThrow();
  });
  it('rejects an unknown see', () => {
    expect(() => checkGlossary([entry('a', 'a', ['nope'])])).toThrow(/nope/);
  });
  it('rejects an entry that sees itself', () => {
    expect(() => checkGlossary([entry('a', 'a', ['a'])])).toThrow(/itself/);
  });
});

describe('byLetter', () => {
  it('sorts by term ignoring case and groups by first letter', () => {
    const g = byLetter([entry('k3s'), entry('kv', 'KV cache'), entry('a', 'admission policy')]);
    expect(g.map(([k, es]) => [k, es.map((e) => e.id)])).toEqual([
      ['A', ['a']],
      ['K', ['k3s', 'kv']],
    ]);
  });
});

describe('glossary.yaml', () => {
  // the build validates each entry's shape; these catch what the file loader would let through
  const text = readFileSync(new URL('../data/glossary.yaml', import.meta.url), 'utf8');
  const ids = [...text.matchAll(/^- id: (\S+)$/gm)].map((m) => m[1]);
  it('has entries, each with a unique id', () => {
    expect(ids.length).toBeGreaterThan(10);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
  it('sees only entries that exist', () => {
    const sees = [...text.matchAll(/^ {2}see: \[([^\]]*)\]$/gm)].flatMap((m) => m[1].split(/,\s*/));
    expect(sees.filter((s) => !ids.includes(s))).toEqual([]);
  });
  it('has no em dashes', () => {
    expect(text.includes('—')).toBe(false);
  });
});
