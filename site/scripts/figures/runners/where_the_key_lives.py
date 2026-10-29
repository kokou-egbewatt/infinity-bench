from gen import *

# One scene. build.py turns SPEC into an Astro component.

grid = ''.join(
    f'<rect x="{312 + c*57}" y="{72 + r*46}" width="46" height="34" rx="4" fill="#141519" stroke="#3a3b42" stroke-width="1.1"/>'
    f'<text x="{335 + c*57}" y="{93 + r*46}" class="sm" text-anchor="middle">repo</text>'
    for r in range(2) for c in range(4))
grid_bad = ''.join(
    f'<rect x="{312 + c*57}" y="{72 + r*46}" width="46" height="34" rx="4" fill="rgba(248,113,113,.07)" stroke="#f87171" stroke-width="1.3"/>'
    for r in range(2) for c in range(4))

A = '\n'.join([
    box('rn', 14, 44, 250, 150, 'RUNNER CONTAINER'),
    hl('rw', 14, 44, 250, 150, 7, 'hlw'),
    key_glyph(40, 88, 1.3),
    text(None, 72, 93, 'App key', 'tx'),
    text(None, 72, 111, "in the runner's environment", 'sm'),
    '<g id="jb">' + box('jx', 30, 128, 218, 50, 'A JOB ON THIS RUNNER') + text(None, 42, 168, 'inherits the environment', 'sm') + '</g>',
    hl('jx-bad', 30, 128, 218, 50, 7, 'hlb'),
    '<path id="ln1" d="M46,128 V100" stroke="#f87171" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/>',
    box('org', 296, 44, 250, 150, 'THE ORGANISATION'),
    grid, f'<g id="gb">{grid_bad}</g>',
    '<path id="ln2" d="M40,96 V121 H296" stroke="#f87171" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/>',
    text('t2', 421, 210, 'registers runners anywhere, any label', 'sm', 'middle', BAD),
    '<g id="gh"><rect x="296" y="222" width="156" height="54" rx="7" fill="none" stroke="#f87171" stroke-width="1.3" stroke-dasharray="5 4"/>'
    + text(None, 308, 241, 'LOOK-ALIKE RUNNER', 't', fill=BAD) + text(None, 308, 262, 'waits for a job', 'sm') + '</g>',
    text('t3', 14, 222, "another repo's job lands on it,", 'sm', fill=BAD),
    text('t3b', 14, 240, 'and the key outlives the fleet', 'sm', fill=BAD),
])

B = '\n'.join([
    '<path d="M114,134 V190" class="wire"/>', socket_glyph(114, 162),
    text(None, 128, 166, 'read-only socket', 'sm'),
    box('rg', 14, 44, 200, 90, 'REGISTRAR · RUNS NO JOB', 'warn'),
    key_glyph(36, 86, 1.1), text(None, 62, 90, 'holds the App key', 'tx'),
    text(None, 62, 112, 'never runs a workflow', 'sm'),
    box('r2', 14, 190, 200, 90, 'RUNNER CONTAINER'),
    text(None, 26, 232, 'no credential', 'tx'),
    text('r2c', 26, 254, 'has a single-use config', 'sm', fill=WARN),
    '<g id="j2" transform="translate(194,238)">' + job_glyph() + '</g>',
    text(None, 262, 66, 'WHAT A JOB CAN REACH NOW', 't'),
    text('k1', 262, 100, '✓ no key in its environment', 'tx', fill=AC),
    text('k2', 262, 128, '✓ no socket for the other class', 'tx', fill=AC),
    text('k3', 262, 156, '✓ its config is already spent', 'tx', fill=AC),
    text('k4', 262, 196, '· still open: minting a config for its own', 'sm', fill=WARN),
    text('k5', 262, 212, '  class, only while the fleet is up', 'sm', fill=WARN),
])

svg = '\n'.join([
    text('h1', 14, 24, '1 · KEY IN THE RUNNER', 'big'),
    text('h2', 14, 24, '2 · KEY IN THE REGISTRAR', 'big'),
    f'<g id="A">{A}</g>', f'<g id="B">{B}</g>',
])

caps = [
    'The first design put the <b>GitHub App key</b> in every runner\'s environment, which is what most guides do.',
    'A job runs in that same environment, so <b>the key is in reach</b>. Unsetting the variable would not have helped.',
    'That key can <b>register a runner anywhere in the organisation</b>, with any label.',
    'So a job could stand up a look-alike runner and wait for <b>another repository\'s job</b>. The key is long-lived, so this outlives the fleet.',
    'The fix: one container, the <b>registrar</b>, holds the key and never runs a workflow.',
    'A runner asks over a <b>read-only unix socket</b> and gets back a <b>single-use config</b>. The key stays put.',
    'A job on that runner finds <b>no key</b> to read, and <b>no socket</b> for the other runner class.',
    'Its config is spent before the job starts. One path is left open, and the post names it: <b>minting for its own class while the fleet is up</b>.',
]

SPEC = dict(
      title='Where the key lives', where='section 5, Where the credential lives',
      aria='The App key first sat in the runner where any job could reach it; it now sits in a registrar that runs no job.',
      n=8, phase_s=3.2, vw=560, vh=290, svg=svg, caps=caps, freeze_phase=7,
      fades=[
          ('h1', [0, 1, 2, 3]), ('h2', [4, 5, 6, 7]), ('A', [0, 1, 2, 3]), ('B', [4, 5, 6, 7]),
          ('rw', [0, 1, 2]), ('jb', [1, 2, 3]), ('jx-bad', [1]), ('ln1', [1, 2, 3]),
          ('gb', [2, 3]), ('ln2', [2, 3]), ('t2', [2, 3]), ('gh', [3]), ('t3', [3]), ('t3b', [3]),
          ('rg-hl', [4, 5]), ('r2-hl', [5, 6]), ('r2c', [5, 6, 7]), ('j2', [6, 7]),
          ('k1', [6, 7]), ('k2', [6, 7]), ('k3', [7]), ('k4', [7]), ('k5', [7]),
      ],
      motions=[
          (3, [(483, 135), (452, 200), (430, 258)], job_glyph(BAD), 0.15, 0.7),
          (5, [(114, 134), (114, 190)], doc_glyph()),
      ])
SPEC.update(pfx='key', component='WhereTheKeyLives')
