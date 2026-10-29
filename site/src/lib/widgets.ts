// Every widget, for the Labs page (#6). `plan` is the series.ts entry of the post it comes from;
// `section` is the heading anchor there, filled in once the post is written. `page` labs live at
// /labs/<id> instead of inside the post.
export interface LabSection {
  id: string;
  name: string;
}

export const WIDGETS = [
  {
    id: 'vram',
    name: 'What is stealing my VRAM',
    blurb:
      'Toggle what is running on the desktop and see how much of the 8 GB a model can actually have.',
    plan: 'vram-accounting',
    section: undefined as string | undefined,
    page: false as boolean,
    sections: [] as LabSection[],
  },
  {
    id: 'kv',
    name: 'KV-cache arithmetic at 8 GB',
    blurb: 'Concurrency, context and KV dtype against the memory left after weights on a 5060.',
    plan: 'vllm-8gb',
    section: undefined as string | undefined,
    page: false as boolean,
    sections: [] as LabSection[],
  },
  {
    id: 'runner-fleet',
    name: 'Runner fleet lab',
    blurb:
      'Four tools from the runner fleet post: break-even against GitHub-hosted runners, which runner class each job needs, what a shared cache saves, and how many runners one machine holds.',
    plan: 'desktop-runner-fleet',
    section: undefined as string | undefined,
    page: true as boolean,
    /** Tools on the lab page: the anchor LabLink and the Labs page link to, and its short name. */
    sections: [
      { id: 'break-even', name: 'break-even' },
      { id: 'runner-class', name: 'runner class' },
      { id: 'cache-payoff', name: 'cache savings' },
      { id: 'fleet-size', name: 'fleet sizing' },
    ] as LabSection[],
  },
] as const;

export const WIDGET_IDS: ReadonlySet<string> = new Set(WIDGETS.map((w) => w.id));
