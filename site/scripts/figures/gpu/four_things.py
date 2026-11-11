from gen import *

# What a container needs on WSL2: the three paths arrive one at a time and the probe climbs.

ITEMS = [('/dev/dxg', 'dxg'), ('/usr/lib/wsl/lib', 'lib'), ('/usr/lib/wsl/drivers', 'drv')]
SY = [86, 128, 170]

def slot(id, x, y, label, w=260, h=30):
    return (f'<g id="{id}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="#0b0b0d" stroke="#3a3b42" stroke-width="1.2" stroke-dasharray="4 4"/>'
            f'<text x="{x+12}" y="{y+20}" class="sm" text-anchor="start">{label}</text></g>'
            + hl(f'{id}-ok', x, y, w, h, 5))

svg = '\n'.join([
    box('win', 14, 56, 180, 160, 'WINDOWS DRIVER'),
    *[text(None, 26, y + 20, lab, 'sm') for (lab, _), y in zip(ITEMS, SY)],
    region('ctr', 250, 40, 296, 196, 'CONTAINER ON WSL2'),
    *[slot(f's-{k}', 268, y, lab) for (lab, k), y in zip(ITEMS, SY)],
    text('inj', 268, 224, 'put there by the runtime, or by hand', 'sm', fill=TX3),
    text('inj-on', 268, 224, 'put there by the runtime, or by hand', 'sm', fill=AC),
    text(None, 14, 266, 'PROBE', 't'),
    text('r0', 74, 266, 'exit 127 · libnvidia-ml.so.1: cannot open shared object file', 'sm', fill=BAD),
    text('r1', 74, 266, 'level 10 · nvml_init: Unable to load the NVML library', 'sm', fill=WARN),
    text('r2', 74, 266, 'level 50 · a GEMM ran and every element checked out', 'sm', fill=AC),
])

caps = [
    'A container on WSL2 with nothing passed in. The probe can\'t even start: <code>libnvidia-ml.so.1</code> is missing, <b>exit 127</b>.',
    '<b>/dev/dxg</b>, the paravirtual GPU device, arrives. Still exit 127: there is no library to talk to it.',
    '<b>/usr/lib/wsl/lib</b> arrives, on the loader path. NVML loads and then fails with <code>Unable to load the NVML library</code>: <b>level 10</b>.',
    '<b>/usr/lib/wsl/drivers</b>, the driver store the libraries load their code from. <b>Level 50</b>: a verified GEMM.',
    'The fourth thing is whatever puts the three there: the NVIDIA runtime, or mounts by hand. Miss one and the error points somewhere else.',
]

SPEC = dict(
    title='What a container needs on WSL2', where='section 4',
    aria='Three paths from the Windows driver reach a container one at a time; the probe goes from exit 127 to level 10 to level 50.',
    n=5, phase_s=3.5, vw=560, vh=280, svg=svg, caps=caps, freeze_phase=4,
    fades=[
        ('s-dxg-ok', [1, 2, 3, 4]), ('s-lib-ok', [2, 3, 4]), ('s-drv-ok', [3, 4]),
        ('r0', [0, 1]), ('r1', [2]), ('r2', [3, 4]),
        ('inj', [0, 1, 2, 3]), ('inj-on', [4])
    ],
    motions=[
        (1, [(194, SY[0] + 15), (268, SY[0] + 15)], dot_glyph()),
        (2, [(194, SY[1] + 15), (268, SY[1] + 15)], dot_glyph()),
        (3, [(194, SY[2] + 15), (268, SY[2] + 15)], dot_glyph()),
    ])
SPEC.update(pfx='need', component='FourThings')
