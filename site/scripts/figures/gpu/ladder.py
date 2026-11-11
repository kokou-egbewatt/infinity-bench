from gen import *

# The Docker ladder: --gpus works one level deep and stops; the device and two folders, passed down by hand, work at every level.

def column(p, x, l1, l2):
    """An outer container (L1) holding a dind daemon's container (L2)."""
    return '\n'.join([
        box(f'{p}1', x, 56, 250, 196, l1),
        box(f'{p}2', x + 16, 128, 218, 112, l2),
    ])

svg = '\n'.join([
    text(None, 14, 26, '--GPUS ALL', 'big'),
    text(None, 296, 26, 'DEVICE + 2 FOLDERS', 'big'),
    column('g', 14, 'L1 · docker run --gpus all', 'L2 · dind, then --gpus all'),
    column('m', 296, 'L1 · --device, two -v', 'L2 · dind, same flags again'),
    # readouts
    text('g1ok', 26, 100, 'level 50', 'tx', fill=AC),
    text('g2err', 44, 170, 'could not select device', 'sm', fill=BAD),
    text('g2err2', 44, 186, 'driver "" with [[gpu]]', 'sm', fill=BAD),
    text('g2ex', 44, 170, 'mounts inside: exit 127', 'sm', fill=BAD),
    text('g2ex2', 44, 186, 'outer got files, not folders', 'sm', fill=BAD),
    text('m1ok', 308, 100, 'level 50, no toolkit', 'tx', fill=AC),
    text('m2ok', 326, 178, 'level 50', 'tx', fill=AC),
    text('sum', 280, 276, 'the GPU survives nesting · --gpus does not', 'sm', 'middle', HI),
])

caps = [
    'One level deep, <code>docker run --gpus all</code> works: <b>level 50</b>.',
    'Inside a Docker-in-Docker daemon, <code>--gpus</code> fails: the inner daemon has no NVIDIA runtime of its own.',
    'Passing the mounts to the inner container doesn\'t help. <code>--gpus</code> gave the outer one individual files, not the folders, so there is nothing to pass down: <b>exit 127</b>.',
    'By hand instead: <code>/dev/dxg</code>, <code>/usr/lib/wsl/lib</code> and <code>/usr/lib/wsl/drivers</code>, with the loader path set. <b>Level 50</b>, with no NVIDIA toolkit anywhere.',
    'Passed down again, the same three work one level deeper. <b>Level 50</b> at every depth I tried.',
    '<b>The GPU survives nesting; <code>--gpus</code> doesn\'t.</b> So every cluster whose nodes are containers fails stock, and can be fixed with mounts.',
]

SPEC = dict(
    title='The Docker ladder', where='section 5',
    aria='docker run --gpus all reaches level 50 one level deep but fails inside a dind daemon; the device and two folders passed by hand reach level 50 at both levels.',
    n=6, phase_s=3.5, vw=560, vh=290, svg=svg, caps=caps, freeze_phase=5,
    fades=[
        ('g1-hl', [0]), ('g1ok', [0, 1, 2, 5]),
        ('g2err', [1]), ('g2err2', [1]), ('g2ex', [2, 5]), ('g2ex2', [2, 5]),
        ('m1-hl', [3]), ('m1ok', [3, 4, 5]), ('m2-hl', [4]), ('m2ok', [4, 5]),
        ('sum', [5]),
    ],
    motions=[
        (3, [(421, 40), (421, 70)], dot_glyph()),
        (4, [(421, 112), (421, 150)], dot_glyph()),
    ])
SPEC.update(pfx='ladder', component='DockerLadder')
