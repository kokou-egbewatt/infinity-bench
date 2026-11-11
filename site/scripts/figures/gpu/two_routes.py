from gen import *

# The two routes to a rationed GPU, and the catch on each.

def pod(id, x, y, title, line, w=112, h=58):
    return '\n'.join([box(id, x, y, w, h, title), text(None, x + 12, y + 40, line, 'sm'),
                      hl(f'{id}-w', x, y, w, h, kind='hlw'), hl(f'{id}-x', x, y, w, h, kind='hlb')])

svg = '\n'.join([
    region('rt', 14, 14, 262, 268, 'RUNTIME · k3s, minikube'),
    box('rn', 30, 46, 230, 52, 'NODE · NVIDIA RUNTIME'),
    text(None, 42, 84, 'injects everything', 'sm'),
    pod('ra', 30, 140, 'POD A', 'asks gpu: 1'),
    pod('rb', 148, 140, 'POD B', 'never asks'),
    text('ra-t', 30, 220, 'GPU, unprivileged', 'sm', fill=AC),
    text('rb-t', 148, 220, 'GPU anyway', 'sm', fill=WARN),
    text('rb-t2', 148, 236, 'counted as free', 'sm', fill=WARN),
    region('mt', 284, 14, 262, 268, 'MOUNTS · k3d, kind, Rancher, DD', right=False),
    box('mn', 300, 46, 230, 52, 'NODE · WSL FOLDERS MOUNTED'),
    text(None, 312, 84, 'hostPath into each pod', 'sm'),
    pod('ma', 300, 140, 'POD A', 'gpu: 1, mounts'),
    pod('mb', 418, 140, 'POD B', 'gpu: 1 only'),
    text('ma-t', 300, 220, 'GPU, privileged', 'sm', fill=WARN),
    text('mb-t', 418, 220, 'scheduled,', 'sm', fill=BAD),
    text('mb-t2', 418, 236, 'no GPU in it', 'sm', fill=BAD),
    text('sum', 280, 272, 'both reach level 50 with the GPU rationed', 'sm', 'middle', HI),
])

caps = [
    '<b>The runtime route.</b> The NVIDIA runtime on the node injects everything. A pod with <code>nvidia.com/gpu: 1</code> and the RuntimeClass gets the card, <b>unprivileged</b>.',
    'The catch: a pod that names the RuntimeClass but never asks for the GPU <b>gets it too</b>, and the scheduler thinks the card is free.',
    '<b>The mount route.</b> The WSL folders go into the node, then into each GPU pod as hostPath volumes, and the device plugin gets the same mounts so it can count the card.',
    'The catch: every GPU pod is <b>privileged</b>, and one that asks for the GPU but forgets the mounts is <b>scheduled with nothing in it</b>.',
    'Both routes reach level 50 with the GPU rationed. Only k3s and minikube keep GPU pods unprivileged.',
]

SPEC = dict(
    title='Two routes to a rationed GPU', where='section 6',
    aria='Runtime route: the NVIDIA runtime injects the GPU into unprivileged pods, but a pod that never asks still gets it. Mount route: privileged pods get the GPU through hostPath mounts, and a pod without the mounts gets nothing.',
    n=5, phase_s=4.0, vw=560, vh=296, svg=svg, caps=caps, freeze_phase=4,
    fades=[
        ('rn-hl', [0, 1]), ('ra-hl', [0]), ('ra-t', [0, 1, 4]),
        ('rb-w', [1, 4]), ('rb-t', [1, 4]), ('rb-t2', [1, 4]),
        ('mn-hl', [2, 3]), ('ma-hl', [2]), ('ma-w', [3]), ('ma-t', [2, 3, 4]),
        ('mb-x', [3, 4]), ('mb-t', [3, 4]), ('mb-t2', [3, 4]), ('sum', [4]),
    ],
    motions=[
        (0, [(145, 98), (86, 140)], dot_glyph()),
        (1, [(145, 98), (204, 140)], dot_glyph(WARN)),
        (2, [(415, 98), (356, 140)], dot_glyph()),
    ])
SPEC.update(pfx='routes', component='TwoRoutes')
