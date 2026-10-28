from gen import *

# One scene. build.py turns SPEC into an Astro component.

def slot(id, x, y, label, w=104, h=34):
    """A host port: a socket on the machine's edge."""
    return (f'<g id="{id}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="#0b0b0d" stroke="#3a3b42" stroke-width="1.2"/>'
            f'<text x="{x+w/2}" y="{y+22}" class="tx" text-anchor="middle">{label}</text></g>'
            + hl(f'{id}-ok', x, y, w, h, 5) + hl(f'{id}-bad', x, y, w, h, 5, 'hlb'))

host = '\n'.join([
    region('hostr', 14, 40, 532, 270, 'THE HOST · ONE DOCKER DAEMON, SHARED'),
    box('ja', 36, 70, 196, 56, 'JOB A · CONTRACT'),
    text(None, 48, 112, 'postgres on :5432', 'tx'),
    box('jb', 328, 70, 196, 56, 'JOB B · INTEGRATION'),
    text(None, 340, 112, 'postgres on :5432', 'tx'),
    '<path d="M134,186 C134,206 210,206 226,226" class="wire"/>',
    '<path id="wb" d="M426,186 C426,206 252,206 236,226" class="wire"/>',
    cylinder('ca', 134, 140, 40, 40, ''),
    cylinder('cb', 426, 140, 40, 40, ''),
    text(None, 36, 252, 'HOST PORTS', 't'),
    slot('s5', 180, 228, ':5432'),
    slot('s6', 300, 228, ':6379'),
    text('own', 232, 278, 'held by job A', 'sm', 'middle', AC),
    '<g id="x"><path d="M325,196 l12,12 M337,196 l-12,12" stroke="#f87171" stroke-width="2"/></g>',
    text('err', 280, 298, 'Bind for 0.0.0.0:5432 failed: port is already allocated', 'sm', 'middle', BAD),
])

pairs = '\n'.join([
    region('n1', 14, 40, 262, 270, 'PAIR 1 · OWN NAMESPACE'),
    region('n2', 284, 40, 262, 270, 'PAIR 2 · OWN NAMESPACE'),
    box('r1', 30, 70, 230, 56, 'RUNNER + DIND-1'),
    text(None, 42, 112, 'job A', 'tx'),
    box('r2', 300, 70, 230, 56, 'RUNNER + DIND-2'),
    text(None, 312, 112, 'job B', 'tx'),
    '<path d="M145,186 V228" class="wire"/>', '<path d="M415,186 V228" class="wire"/>',
    cylinder('pa', 145, 140, 40, 40, ''),
    cylinder('pb', 415, 140, 40, 40, ''),
    slot('q1', 93, 228, ':5432'),
    slot('q2', 363, 228, ':5432'),
    text('ok', 280, 298, 'both publish :5432 · neither notices the other', 'sm', 'middle', AC),
])

svg = '\n'.join([
    text('mh', 14, 24, '1 · MOUNT THE HOST SOCKET', 'big'),
    text('mp', 14, 24, '2 · A DAEMON PER RUNNER', 'big'),
    f'<g id="H">{host}</g>',
    f'<g id="P">{pairs}</g>',
])

caps = [
    'Two jobs run in parallel. Each has a <code>services:</code> block that publishes Postgres on <b>:5432</b>.',
    'With the host socket, both jobs talk to <b>one daemon</b>. Job A gets there first and takes <b>:5432 on the host</b>.',
    'Job B asks the same daemon for the same port and <b>fails</b>. One host, one :5432.',
    'This is the failure that started the move. Mounting the socket shares one daemon, and one set of ports, with every job.',
    'Now each runner gets its <b>own dind sidecar</b> and joins its network namespace.',
    'Pair 1 publishes <b>:5432</b> inside its own namespace, not on the host.',
    'Pair 2 publishes <b>:5432</b> too, in a different namespace.',
    '<code>localhost:5432</code> means the same thing to each job and its containers. <b>The collision is gone.</b>',
]

SPEC = dict(
      title='Port collision, before and after', where='section 4, beside the options table',
      aria='Two jobs publishing port 5432 collide on a shared host daemon, then run side by side in separate network namespaces.',
      n=8, phase_s=3.0, vw=560, vh=316, svg=svg, caps=caps, freeze_phase=7,
      fades=[
          ('mh', [0, 1, 2, 3]), ('mp', [4, 5, 6, 7]),
          ('H', [0, 1, 2, 3]), ('P', [4, 5, 6, 7]),
          ('ca', [1, 2, 3]), ('cb', [2, 3]), ('wb', [2, 3]),
          ('ja-hl', [0, 1]), ('jb-hl', [0]), 
          ('s5-ok', [1]), ('s5-bad', [2, 3]), ('own', [1, 2, 3]),
          ('x', [2, 3]), ('err', [2, 3]),
          ('r1-hl', [4, 5]), ('r2-hl', [4, 6]),
          ('pa', [5, 6, 7]), ('pb', [6, 7]),
          ('q1-ok', [5, 6, 7]), ('q2-ok', [6, 7]), ('ok', [7]),
      ],
      motions=[
          (1, [(134, 186), (180, 210), (226, 226)], dot_glyph()),
          (2, [(426, 186), (331, 202)], dot_glyph(BAD), 0.08, 0.45),
          (5, [(145, 186), (145, 228)], dot_glyph()),
          (6, [(415, 186), (415, 228)], dot_glyph()),
      ])
SPEC.update(pfx='ports', component='PortCollision')
