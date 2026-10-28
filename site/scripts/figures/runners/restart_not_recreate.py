from gen import *

# One scene. build.py turns SPEC into an Astro component.

def package(id, x, y, label):
    """A half-installed package: a box with a crack through it."""
    return (f'<g id="{id}"><path d="M{x},{y+14} L{x+39},{y} L{x+78},{y+14} V{y+48} L{x+39},{y+62} L{x},{y+48} Z" fill="#141519" stroke="{WARN}" stroke-width="1.2"/>'
            f'<path d="M{x},{y+14} L{x+39},{y+28} L{x+78},{y+14} M{x+39},{y+28} V{y+62}" fill="none" stroke="{WARN}" stroke-width="1" opacity=".6"/>'
            f'<path d="M{x+52},{y+18} l-6,10 l7,4 l-8,12" fill="none" stroke="{BAD}" stroke-width="1.4"/>'
            f'<text x="{x+39}" y="{y+77}" class="sm" text-anchor="middle">{label}</text></g>'
            f'<path id="{id}-bad" d="M{x},{y+14} L{x+39},{y} L{x+78},{y+14} V{y+48} L{x+39},{y+62} L{x},{y+48} Z" class="hlb"/>')

A = '\n'.join([
    folder('f0', 34, 112, 'repo a'), folder('f1', 136, 112, 'repo b'),
    folder('f2', 238, 112, 'repo c'), folder('f3', 340, 112, '+ 4 more repos'),
    package('py', 450, 106, 'broken python'),
    text('err', 34, 224, 'later job: libpython3.12.so.1.0: cannot open shared object file', 'sm', fill=BAD),
])
B = '\n'.join([
    folder('g0', 34, 112, 'repo a'), folder('g1', 34, 112, 'repo b'), folder('g2', 34, 112, 'repo c'),
    text('clr', 140, 146, 'entrypoint: clearing _work from the previous job', 'sm', fill=AC),
    '<rect id="sw" x="30" y="104" width="2" height="84" rx="1" fill="#5eead4" opacity="0"/>',
])

svg = '\n'.join([
    text('h1', 14, 24, '1 · WITHOUT THE CLEAR', 'big'),
    text('h2', 14, 24, '2 · ENTRYPOINT CLEARS _work', 'big'),
    box('ct', 14, 40, 532, 236, 'RUNNER CONTAINER · restart: always'),
    restart_glyph('rg', 523, 58),
    text('k1', 504, 63, 'job 1', 'sm', 'end'), text('k2', 504, 63, 'job 2', 'sm', 'end'),
    text('k3', 504, 63, 'job 3', 'sm', 'end'), text('k21', 504, 63, 'job 21', 'sm', 'end'),
    text(None, 34, 94, '/home/runner/_work', 't'),
    f'<g id="A">{A}</g>', f'<g id="B">{B}</g>',
    '<path d="M34,240 H526" stroke="#222328" stroke-width="1"/>',
    text('vol', 34, 262, 'named volumes, shared on purpose: toolcache · cargo · go · pnpm · uv', 'sm'),
    hl('vol-hl', 26, 246, 508, 24, 5),
])

caps = [
    'Job 1 runs and leaves its <b>checkout</b> in <code>_work</code>.',
    '<code>restart: always</code> <b>restarts</b> the container for job 2. It does not recreate it, so job 1\'s checkout is still on disk.',
    'Job 3 lands on the same container. Three repositories\' checkouts now sit side by side, <b>each readable by the next job</b>.',
    'Twenty-one jobs later: checkouts from seven repositories, and a <b>half-installed Python</b> left by an earlier job.',
    'That leftover breaks a later job. The runner was ephemeral to GitHub, <b>never on disk</b>.',
    'Same container, with the fix. Job 1 runs and leaves its checkout, as before.',
    'On restart the <b>entrypoint runs first</b> and clears <code>_work</code> from an absolute path.',
    'Job 2 starts against an <b>empty</b> <code>_work</code>. Nothing from job 1 is left to read.',
    'Every restart repeats the clear, before any job code runs.',
    'The checkout is per job. <b>The caches stay</b> in named volumes, shared on purpose.',
]

SPEC = dict(
      title='Restart is not recreate', where='section 6, What is ephemeral, and what is not',
      aria='Without clearing _work, checkouts from earlier jobs pile up in a restarted container. With the entrypoint clear, each job starts empty.',
      n=10, phase_s=2.7, vw=560, vh=284, svg=svg, caps=caps, freeze_phase=3,
      fades=[
          ('h1', range(0, 5)), ('h2', range(5, 10)), ('A', range(0, 5)), ('B', range(5, 10)),
          ('k1', [0, 5]), ('k2', [1, 6, 7]), ('k3', [2, 8, 9]), ('k21', [3, 4]),
          ('f0', [0, 1, 2, 3, 4]), ('f0-new', [0]), ('f0-old', [1, 2, 3, 4]),
          ('f1', [1, 2, 3, 4]), ('f1-new', [1]), ('f1-old', [2, 3, 4]),
          ('f2', [2, 3, 4]), ('f2-new', [2]), ('f2-old', [3, 4]),
          ('f3', [3, 4]), ('f3-old', [3, 4]), ('py', [3, 4]), ('py-bad', [4]), ('err', [4]),
          ('g0', [5]), ('g0-new', [5]), ('g1', [7]), ('g1-new', [7]), ('g2', [9]), ('g2-new', [9]),
          ('clr', [6, 8]), ('vol-hl', [9]),
      ],
      spins=[('rg', [1, 2, 3, 6, 8])],
      sweeps=[('sw', [6, 8], 0, 480)])
SPEC.update(pfx='restart', component='RestartNotRecreate')
