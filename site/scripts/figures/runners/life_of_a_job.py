from gen import *

# One scene. build.py turns SPEC into an Astro component.

svg = '\n'.join([
    # wires first, so boxes sit on top of them
    '<path d="M100,100 V196" class="wire"/>',
    '<path d="M200,60 H384" class="wire"/>',
    '<path d="M160,196 V132 H460 V102" class="wire d"/>',
    '<path d="M190,246 H210" class="wire"/>',
    socket_glyph(100, 148),
    '<path id="sock-hl" d="M100,100 V196" stroke="#5eead4" stroke-width="1.6" fill="none" opacity="0"/>',
    text(None, 112, 152, 'socket', 'sm'),
    text(None, 222, 52, 'generate-jitconfig', 'sm'),
    text(None, 300, 124, 'HTTPS · long poll', 'sm', 'middle'),

    # registrar: holds the key, runs no job
    box('reg', 20, 20, 182, 80, 'REGISTRAR', 'warn'),
    key_glyph(36, 64, 1.0),
    text(None, 60, 68, 'holds the App key', 'tx'),
    text(None, 60, 86, 'runs no job', 'sm'),

    # GitHub, an external service
    cloud('gh', 460, 70, 'GitHub'),
    text('g0', 460, 86, 'idle', 'sm', 'middle'),
    text('g1', 460, 86, 'minting config', 'sm', 'middle', WARN),
    text('g2', 460, 86, 'job queued', 'sm', 'middle', AC),
    text('g3', 460, 86, 'runner deleted', 'sm', 'middle', AC),

    # one network namespace: runner + its own daemon
    region('nsr', 14, 166, 372, 144, 'ONE NETWORK NAMESPACE', right=True),
    '<g id="runner">' + box('rbox', 30, 196, 160, 100, 'RUNNER') + '</g>',
    text('r0', 42, 240, 'clean container', 'tx'),
    text('r1', 42, 240, 'asking registrar', 'tx'),
    text('r2', 42, 240, 'has a config', 'tx', fill=WARN),
    text('r3', 42, 240, 'long polling', 'tx'),
    text('r4', 42, 240, 'running the job', 'tx', fill=AC),
    text('r5', 42, 240, 'exited', 'tx', fill=TX3),
    text('rk', 42, 262, 'no credential', 'sm'),
    box('dind', 210, 196, 160, 100, 'DIND · PRIVILEGED', 'warn'),
    text('d0', 222, 240, 'idle', 'tx', fill=TX3),
    cylinder('c1', 252, 226, 38, 36, 'postgres'),
    cylinder('c2', 322, 226, 38, 36, 'redis'),

    # legend
    text(None, 404, 186, 'LEGEND', 't'),
    '<g transform="translate(414,210)">' + key_glyph(-4, 0, 0.8) + '</g>', text(None, 434, 214, 'App key', 'sm'),
    '<g transform="translate(414,236)">' + doc_glyph() + '</g>', text(None, 434, 240, 'single-use config', 'sm'),
    '<g transform="translate(414,262)">' + job_glyph() + '</g>', text(None, 434, 266, 'a job', 'sm'),
    '<g transform="translate(414,288)">' + dot_glyph() + '</g>', text(None, 434, 292, 'a request', 'sm'),
    socket_glyph(414, 312), text(None, 434, 316, 'read-only socket', 'sm'),
])

caps = [
    '<code>restart: always</code> brings up a <b>clean runner container</b>. It holds no credential, only the path to its registrar socket.',
    'The runner sends its hostname over a <b>read-only unix socket</b>. The socket is the only way it can ask for anything.',
    'The registrar signs a short-lived App token and calls <code>generate-jitconfig</code>. GitHub returns a <b>single-use config</b>.',
    'The config comes back down the socket. <b>The key never leaves the registrar.</b>',
    'The runner long-polls GitHub, and one job matching its class label is queued for it.',
    'GitHub hands over the job. The runner starts executing its steps.',
    'The job\'s <code>services:</code> start on the <b>runner\'s own dind</b>, reachable on <code>localhost</code> inside the shared namespace.',
    'The job finishes and the runner exits. <b>GitHub deletes the JIT runner</b>: nothing to deregister, no token left to expire.',
]

SPEC = dict(
      title='Life of a job', where='section 5, replacing the sequence diagram',
      aria='A runner asks the registrar for a single-use config, runs one job with its own Docker daemon, exits, and is replaced.',
      n=8, phase_s=3.0, vw=560, vh=328, svg=svg, caps=caps, freeze_phase=6,
      fades=[
          ('rbox-hl', [0, 1, 3, 4, 5, 6]), ('reg-hl', [1, 2, 3]), ('gh-hl', [2, 4, 5, 7]),
          ('dind-hl', [6]), ('sock-hl', [1, 3]),
          ('runner', [0, 1, 2, 3, 4, 5, 6], 1, 0.3),
          ('r0', [0]), ('r1', [1, 2]), ('r2', [3]), ('r3', [4]), ('r4', [5, 6]), ('r5', [7]),
          ('rk', [0, 1, 2, 3, 4, 5, 6]),
          ('g0', [0, 1, 6]), ('g1', [2, 3]), ('g2', [4, 5]), ('g3', [7]),
          ('d0', [0, 1, 2, 3, 4, 5, 7]), ('c1', [6]), ('c2', [6]),
      ],
      motions=[
          (1, [(100, 196), (100, 100)], dot_glyph()),
          (2, [(202, 60), (384, 60)], dot_glyph(), 0.06, 0.40),
          (2, [(384, 68), (202, 68)], doc_glyph(), 0.52, 0.90),
          (3, [(100, 100), (100, 196)], doc_glyph()),
          (4, [(160, 196), (160, 132), (460, 132), (460, 102)], dot_glyph()),
          (5, [(460, 102), (460, 132), (160, 132), (160, 196)], job_glyph()),
          (6, [(190, 246), (232, 246)], dot_glyph(), 0.06, 0.35),
      ])
SPEC.update(pfx='life', component='LifeOfAJob')
