"""Cold to level 50, per candidate, drawn from data/cluster-matrix/costs.csv.

Plays at one eighth speed: one second on the clock is eight seconds from nothing
installed to a verified GEMM. Uses the runner post's component() and timing helpers.
"""
import csv, hashlib, os, re
from results import component, show, grow, key, SW_FILL, SW_DASH, P

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'data', 'cluster-matrix'))
AC, WARN, TX, TX2, TX3, HI, LINE, LINE2 = '#5eead4', '#e5b567', '#d6d6da', '#9c9ca4', '#67676f', '#f4f4f5', '#222328', '#2c2d33'
SPEED, START = 8.0, 0.6

def first(cell):
    m = re.match(r'(\d+(?:\.\d+)?)', cell)
    return float(m.group(1)) if m else None

def race(path):
    pfx, dur = 'race', 18.0
    src = os.path.join(DATA, 'costs.csv')
    rows = list(csv.DictReader(open(src)))
    timed = sorted((r for r in rows if first(r['cold_to_level50_s'])), key=lambda r: first(r['cold_to_level50_s']))
    untimed = [r for r in rows if not first(r['cold_to_level50_s'])]
    X0, W, FULL = 170, 270, 120.0
    sc = W / FULL
    css, svg = [], []
    head = ['<text class="t" x="16" y="22">FROM NOTHING INSTALLED TO A VERIFIED GEMM, SECONDS</text>']
    y = 38
    for i, r in enumerate(timed):
        v = first(r['cold_to_level50_s'])
        cell = r['cold_to_level50_s']
        warm = 'warm' in cell
        label = (f'{cell.replace("-", " to ")} s' if re.fullmatch(r'[\d.]+-[\d.]+', cell) else f'{v:g} s') + (', warm' if warm else '')
        col = AC if r['candidate'] == 'k3s' else (WARN if warm else TX2)
        a, b = START, START + v / SPEED
        css.append(grow(f'{pfx}-b{i}', a, b, dur, 17.4, X0) + show(f'{pfx}-n{i}', b, 17.6, dur, 0.2))
        svg.append(f'<text class="sm" x="{X0-10}" y="{y+10}" text-anchor="end" style="fill:{HI if col == AC else TX2}">{r["candidate"]}</text>')
        svg.append(f'<rect x="{X0}" y="{y}" width="{v*sc:.1f}" height="13" fill="{col}" style="transform-origin:{X0}px 0;animation:{pfx}-b{i} var(--dur) linear infinite"/>')
        svg.append(f'<text class="sm" x="{X0+v*sc+6:.0f}" y="{y+10}" style="fill:{TX};animation:{pfx}-n{i} var(--dur) linear infinite;opacity:0">{label}</text>')
        y += 24
    for r in untimed:
        css.append(show(f'{pfx}-u', 14.0, 17.6, dur, 0.3))
        svg.append(f'<text class="sm" x="{X0-10}" y="{y+10}" text-anchor="end" style="fill:{TX3}">{r["candidate"]}</text>')
        svg.append(f'<rect x="{X0}" y="{y}" width="{W}" height="13" fill="none" stroke="{LINE2}" stroke-dasharray="3 3" style="animation:{pfx}-u var(--dur) linear infinite;opacity:0"/>')
        svg.append(f'<text class="sm" x="{X0+8}" y="{y+10}" style="animation:{pfx}-u var(--dur) linear infinite;opacity:0">not timed as a cycle</text>')
        y += 24
    grid = []  # drawn first, so the bars and their labels sit on top
    for g in range(0, 121, 30):
        x = X0 + g * sc
        grid.append(f'<line x1="{x:.0f}" y1="30" x2="{x:.0f}" y2="{y}" stroke="{LINE}"/><text class="sm" x="{x:.0f}" y="{y+16}" text-anchor="middle">{g}{" s" if g == 120 else ""}</text>')
    vh = y + 26
    k3s = next(r for r in timed if r['candidate'] == 'k3s')
    caps = [(0, 3.2, f'<b>From nothing installed to a verified GEMM</b>, at one eighth speed. k3s gets there in {k3s["cold_to_level50_s"].replace("-", " to ")} s.'),
            (3.2, 10.0, 'The clusters whose nodes are containers pull an image and start a node first: k3d about a minute, kind 71 to 80 s. Rancher Desktop took 66 s, on Kubernetes 1.25.'),
            (10.0, 14.2, 'minikube takes nearly two minutes. Docker Desktop in kind mode was timed warm, because it would not let me remove its images.'),
            (14.2, 18.0, 'Docker Desktop in kubeadm mode was never timed as a cycle. <b>k3s is about three times faster than anything else.</b>')]
    legend = key([(SW_FILL(AC), 'k3s'), (SW_FILL(TX2), 'the others, fastest cycle'), (SW_FILL(WARN), 'timed warm'), (SW_DASH(TX3), 'not timed')])
    digest = hashlib.sha256(open(src, 'rb').read()).hexdigest()[:12]
    component(path, pfx=pfx, aria='Cold start to a verified GEMM per candidate: k3s about 17 s, k3d about 54 s, Rancher Desktop 66 s, kind 71 s, Docker Desktop kind mode 81 s warm, minikube 107 s; Docker Desktop kubeadm mode not timed.',
              dur=dur, freeze=17, vw=560, vh=vh, svg='\n'.join(head + grid + svg), caps=caps, css=css, legend=legend, source=f'costs.csv {digest}')
