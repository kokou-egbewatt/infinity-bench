// Every widget, for the Labs page (#6). `plan` is the series.ts entry of the post it lives in;
// `section` is the heading anchor there, filled in once the post is written.
export const WIDGETS = [
  {
    id: 'vram',
    name: 'What is stealing my VRAM',
    blurb: 'Toggle what is running on the desktop and see how much of the 8 GB a model can actually have.',
    plan: 'vram-accounting',
    section: undefined as string | undefined,
  },
  {
    id: 'kv',
    name: 'KV-cache arithmetic at 8 GB',
    blurb: 'Concurrency, context and KV dtype against the memory left after weights on a 5060.',
    plan: 'vllm-8gb',
    section: undefined as string | undefined,
  },
] as const;

export const WIDGET_IDS: ReadonlySet<string> = new Set(WIDGETS.map((w) => w.id));
