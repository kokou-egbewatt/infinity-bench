"""Builds a looping, CSS-only animated SVG figure from a phase table.

Every animated thing is driven by one shared clock: n phases of equal length.
Elements fade in/out per phase (opacity), packets travel along waypoints
(translate), and glyphs can spin. Captions under the figure are synced the
same way. No JavaScript is needed to play; JS only adds pause and replay.
"""
import math

AC, AC2, WARN, BAD, LINE2, TX, TX2, TX3, HI = '#5eead4', '#0f2f2b', '#e5b567', '#f87171', '#2c2d33', '#d6d6da', '#9c9ca4', '#67676f', '#f4f4f5'

# ---------------------------------------------------------------- shapes

def box(id, x, y, w, h, title, tone=None, rx=7):
    """A container: base rect, a title, and a highlight overlay (id-hl)."""
    tcol = {'warn': WARN, 'bad': BAD, 'ac': AC}.get(tone, TX3)
    return (f'<g id="{id}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" class="b"/>'
            f'<text x="{x+12}" y="{y+19}" class="t" style="fill:{tcol}">{title}</text></g>'
            f'<rect id="{id}-hl" x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" class="hl"/>')

def hl(id, x, y, w, h, rx=7, kind='hl'):
    return f'<rect id="{id}" x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" class="{kind}"/>'

def region(id, x, y, w, h, title, right=False):
    """A dashed region: a network namespace or a boundary."""
    tx, anc = (x + w - 12, 'end') if right else (x + 12, 'start')
    return (f'<g id="{id}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" class="ns"/>'
            f'<text x="{tx}" y="{y+18}" class="t" text-anchor="{anc}">{title}</text></g>')

def text(id, x, y, s, cls='tx', anchor='start', fill=None):
    f = f' style="fill:{fill}"' if fill else ''
    i = f' id="{id}"' if id else ''
    return f'<text{i} x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}"{f}>{s}</text>'

def cylinder(id, cx, y, w=40, h=42, label='', tone=AC):
    """A database: postgres, redis."""
    rx, ry = w / 2, 6
    l, r = cx - rx, cx + rx
    return (f'<g id="{id}">'
            f'<path d="M{l},{y+ry} L{l},{y+h-ry} A{rx},{ry} 0 0 0 {r},{y+h-ry} L{r},{y+ry}" fill="{AC2}" stroke="{tone}" stroke-width="1.3"/>'
            f'<ellipse cx="{cx}" cy="{y+ry}" rx="{rx}" ry="{ry}" fill="#123b36" stroke="{tone}" stroke-width="1.3"/>'
            f'<text x="{cx}" y="{y+h+14}" class="sm" text-anchor="middle">{label}</text></g>')

def cloud(id, cx, cy, label):
    """GitHub: an external service, so a cloud."""
    d = (f'M{cx-50},{cy+30} h100 a24,24 0 0 0 4,-46 a30,30 0 0 0 -54,-15 '
         f'a22,22 0 0 0 -38,12 a22,22 0 0 0 -12,49 z')
    return (f'<g id="{id}"><path d="{d}" class="b"/>'
            f'<text x="{cx}" y="{cy-2}" class="t" text-anchor="middle" style="fill:{TX2}">{label}</text></g>'
            f'<path id="{id}-hl" d="{d}" class="hl"/>')

def key_glyph(x, y, s=1.0, col=WARN):
    return (f'<g transform="translate({x},{y}) scale({s})" fill="none" stroke="{col}" stroke-width="1.6">'
            f'<circle cx="0" cy="0" r="5"/><path d="M5,0 H17 M13,0 V4 M16,0 V3"/></g>')

def doc_glyph(col=WARN):
    """A single-use config: a small document."""
    return (f'<path d="M-7,-9 H3 L7,-5 V9 H-7 Z" fill="#2a2210" stroke="{col}" stroke-width="1.3"/>'
            f'<path d="M3,-9 V-5 H7" fill="none" stroke="{col}" stroke-width="1.1"/>'
            f'<path d="M-4,-1 H4 M-4,3 H2" stroke="{col}" stroke-width="1"/>')

def job_glyph(col=AC):
    """A job: a card with a play mark."""
    return (f'<rect x="-11" y="-8" width="22" height="16" rx="3" fill="{AC2}" stroke="{col}" stroke-width="1.3"/>'
            f'<path d="M-3,-4 L4,0 L-3,4 Z" fill="{col}"/>')

def dot_glyph(col=AC):
    return f'<circle r="5" fill="{col}"/><circle r="9" fill="{col}" opacity=".18"/>'

def folder(id, x, y, label, w=78, h=52, col=TX2):
    d = f'M{x},{y+8} V{y+h} H{x+w} V{y+12} H{x+34} L{x+28},{y+4} H{x+4} Q{x},{y+4} {x},{y+8} Z'
    return (f'<g id="{id}"><path d="{d}" fill="#141519" stroke="{LINE2}" stroke-width="1.2"/>'
            f'<text x="{x+w/2}" y="{y+h+15}" class="sm" text-anchor="middle">{label}</text></g>'
            f'<path id="{id}-old" d="{d}" fill="rgba(229,181,103,.08)" stroke="{WARN}" stroke-width="1.3" opacity="0"/>'
            f'<path id="{id}-new" d="{d}" fill="rgba(94,234,212,.07)" stroke="{AC}" stroke-width="1.3" opacity="0"/>')

def socket_glyph(x, y):
    return (f'<circle cx="{x}" cy="{y}" r="7" fill="#0b0b0d" stroke="{TX3}" stroke-width="1.2"/>'
            f'<circle cx="{x}" cy="{y}" r="2.5" fill="{TX3}"/>')

def restart_glyph(id, cx, cy, r=9, col=TX2):
    return (f'<g id="{id}" class="spin" style="transform-origin:{cx}px {cy}px">'
            f'<path d="M{cx+r},{cy} A{r},{r} 0 1 1 {cx+r*0.7},{cy-r*0.7}" fill="none" stroke="{col}" stroke-width="1.6"/>'
            f'<path d="M{cx+r*0.7-4},{cy-r*0.7-3} L{cx+r*0.7+1},{cy-r*0.7} L{cx+r*0.7-2},{cy-r*0.7+5}" fill="none" stroke="{col}" stroke-width="1.6"/></g>')

# ---------------------------------------------------------------- timeline

def _pct(v):
    return f'{max(0.0, min(100.0, v)):.3f}%'

def fade_kf(name, on_phases, n, on=1.0, off=0.0, fade=0.10):
    """Opacity per phase: holds through a phase, crossfades at its start."""
    w = 100 / n
    st = [on if p in on_phases else off for p in range(n)]
    pts = [(0.0, st[-1])]
    for p in range(n):
        pts.append((p * w + w * fade, st[p]))
        pts.append(((p + 1) * w, st[p]))
    out, last = [], None
    for t, v in pts:
        if last and abs(last[0] - t) < 1e-6:
            continue
        out.append(f'{_pct(t)}{{opacity:{v}}}')
        last = (t, v)
    return f'@keyframes {name}{{{"".join(out)}}}'

def motion_kf(name, phase, n, pts, t0=0.12, t1=0.72):
    """A packet along waypoints during one phase; invisible otherwise."""
    w = 100 / n
    a, b, fi = phase * w + t0 * w, phase * w + t1 * w, w * 0.05
    segs = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    L = sum(segs) or 1
    frames = [(0, pts[0], 0), (max(0, a - fi), pts[0], 0), (a, pts[0], 1)]
    acc = 0
    for i, s in enumerate(segs):
        acc += s
        frames.append((a + (b - a) * acc / L, pts[i + 1], 1))
    frames += [(b + fi, pts[-1], 0), (100, pts[-1], 0)]
    body = ''.join(f'{_pct(t)}{{transform:translate({x}px,{y}px);opacity:{o}}}' for t, (x, y), o in frames)
    return f'@keyframes {name}{{{body}}}'

def spin_kf(name, phases, n, t0=0.08, t1=0.55):
    w = 100 / n
    frames, k = [(0, 0)], 0
    for p in sorted(phases):
        frames += [(p * w + t0 * w, k * 360), (p * w + t1 * w, (k + 1) * 360)]
        k += 1
    frames.append((100, k * 360))
    body = ''.join(f'{_pct(t)}{{transform:rotate({d}deg)}}' for t, d in frames)
    return f'@keyframes {name}{{{body}}}'

def sweep_kf(name, phases, n, x0, x1, t0=0.10, t1=0.65):
    """A vertical scan line crossing left to right in given phases."""
    w = 100 / n
    frames = [(0, x0, 0)]
    for p in sorted(phases):
        a, b = p * w + t0 * w, p * w + t1 * w
        frames += [(a - 0.5, x0, 0), (a, x0, 1), (b, x1, 1), (b + 0.6, x1, 0), (b + 0.7, x0, 0)]
    frames.append((100, x0, 0))
    body = ''.join(f'{_pct(t)}{{transform:translateX({x}px);opacity:{o}}}' for t, x, o in frames)
    return f'@keyframes {name}{{{body}}}'

# ---------------------------------------------------------------- page

PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=IBM+Plex+Mono:wght@400;500&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet">
<style>
  :root {{ --bg:#0b0b0d; --bg2:#101114; --line:#222328; --line2:#2c2d33; --tx:#d6d6da; --tx2:#9c9ca4; --tx3:#67676f; --hi:#f4f4f5; --ac:#5eead4; --ac2:#0f2f2b; --warn:#e5b567; --bad:#f87171; --mono:'IBM Plex Mono',ui-monospace,monospace; --serif:'Newsreader',Georgia,serif; --sans:Inter,system-ui,sans-serif; --dur:{dur}s; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--tx); font-family:var(--sans); line-height:1.6; }}
  .wrap {{ max-width:720px; margin:0 auto; padding:40px 24px 80px; }}
  h2 {{ font-family:var(--serif); font-weight:500; font-size:23px; color:var(--hi); margin:0 0 6px; }}
  .where {{ font-family:var(--mono); font-size:11px; color:var(--tx3); margin:0 0 18px; }}

  figure.fig {{ margin:0; border:1px solid var(--line); border-radius:8px; background:var(--bg2); overflow:hidden; }}
  .fig svg {{ display:block; width:100%; height:auto; }}
  .fig .b {{ fill:#0e0f12; stroke:var(--line2); stroke-width:1.2; }}
  .fig .ns {{ fill:none; stroke:#3a3b42; stroke-width:1.2; stroke-dasharray:5 5; }}
  .fig .hl {{ fill:rgba(94,234,212,.06); stroke:var(--ac); stroke-width:1.5; opacity:0; }}
  .fig .hlw {{ fill:rgba(229,181,103,.07); stroke:var(--warn); stroke-width:1.5; opacity:0; }}
  .fig .hlb {{ fill:rgba(248,113,113,.08); stroke:var(--bad); stroke-width:1.5; opacity:0; }}
  .fig .wire {{ fill:none; stroke:#34353c; stroke-width:1.3; }}
  .fig .wire.d {{ stroke-dasharray:4 4; }}
  .fig .t {{ font-family:var(--mono); font-size:11px; letter-spacing:.05em; fill:var(--tx3); }}
  .fig .tx {{ font-family:var(--mono); font-size:13px; fill:var(--tx); }}
  .fig .sm {{ font-family:var(--mono); font-size:11px; fill:var(--tx3); }}
  .fig .big {{ font-family:var(--mono); font-size:15px; fill:var(--hi); }}
  .fig .pkt {{ opacity:0; }}
  .fig .spin {{ transform-box:view-box; }}

  .fig figcaption {{ border-top:1px solid var(--line); background:var(--bg); padding:12px 16px 14px; }}
  .caps {{ display:grid; }}
  .caps p {{ grid-area:1 / 1; margin:0; font-size:14px; line-height:1.5; color:var(--tx); opacity:0; }}
  .caps p b {{ color:var(--hi); font-weight:500; }}
  .caps p code {{ font-family:var(--mono); font-size:.85em; background:#1a1b1f; padding:.08em .3em; border-radius:3px; }}
  .bar {{ display:flex; align-items:center; gap:12px; margin-top:12px; }}
  .track {{ flex:1; height:3px; background:var(--line2); border-radius:2px; overflow:hidden; position:relative; }}
  .track i {{ position:absolute; inset:0; background:var(--ac); transform-origin:left; transform:scaleX(0); animation:prog var(--dur) linear infinite; }}
  @keyframes prog {{ to {{ transform:scaleX(1); }} }}
  .ticks {{ position:absolute; inset:0; display:flex; }}
  .ticks span {{ flex:1; border-right:2px solid var(--bg); }}
  .ticks span:last-child {{ border:0; }}
  .ctl button {{ font-family:var(--mono); font-size:11px; color:var(--tx2); background:var(--bg2); border:1px solid var(--line2); border-radius:4px; padding:3px 10px; cursor:pointer; }}
  .ctl button:hover {{ color:var(--hi); }}

  /* phones: run the diagram edge to edge so its labels stay readable */
  @media (max-width:600px) {{ .wrap {{ padding-left:16px; padding-right:16px; }} figure.fig {{ margin:0 -16px; border-radius:0; border-left:0; border-right:0; }} .caps p {{ font-size:13.5px; }} }}
  .fig.paused *, .fig.off * {{ animation-play-state:paused !important; }}
  .fig.reset * {{ animation:none !important; }}
  /* reduced motion: hold one representative frame, list every caption */
  @media (prefers-reduced-motion: reduce) {{
    .fig * {{ animation-play-state:paused !important; animation-delay:{freeze}s !important; }}
    .caps {{ display:block; }}
    .caps p {{ opacity:1 !important; margin-bottom:6px; }}
    .bar {{ display:none; }}
  }}
{css}
</style>
</head>
<body>
<div class="wrap">
  <h2>{title}</h2>
  <p class="where">{where}</p>
  <figure class="fig" id="fig">
    <svg viewBox="0 0 {vw} {vh}" role="img" aria-label="{aria}">
{svg}
    </svg>
    <figcaption>
      <div class="caps">{caps}</div>
      <div class="bar">
        <div class="track"><i></i><div class="ticks">{ticks}</div></div>
        <span class="ctl"><button id="pp" type="button">pause</button> <button id="rp" type="button">replay</button></span>
      </div>
    </figcaption>
  </figure>
</div>
<script>
  const fig = document.getElementById('fig'), pp = document.getElementById('pp');
  pp.onclick = () => {{ const p = fig.classList.toggle('paused'); pp.textContent = p ? 'play' : 'pause'; }};
  document.getElementById('rp').onclick = () => {{ fig.classList.add('reset'); void fig.offsetWidth; fig.classList.remove('reset', 'paused'); pp.textContent = 'pause'; }};
  // hold while scrolled out of view, so it plays when the reader arrives
  new IntersectionObserver(([e]) => fig.classList.toggle('off', !e.isIntersecting), {{ threshold: .25 }}).observe(fig);
</script>
</body>
</html>
"""

def build(path, *, title, where, aria, n, phase_s, vw, vh, svg, caps,
          fades=(), motions=(), spins=(), sweeps=(), freeze_phase=None):
    dur = n * phase_s
    css = []
    for i, (el, phases, *rest) in enumerate(fades):
        on, off = (rest + [1, 0])[:2] if rest else (1, 0)
        nm = f'f{i}'
        css.append(fade_kf(nm, set(phases), n, on, off))
        css.append(f'#{el}{{animation:{nm} var(--dur) ease-in-out infinite}}')
    pkt_svg = []
    for i, (phase, pts, glyph, *rest) in enumerate(motions):
        t0, t1 = (rest + [0.12, 0.72])[:2] if rest else (0.12, 0.72)
        nm = f'm{i}'
        css.append(motion_kf(nm, phase, n, pts, t0, t1))
        css.append(f'#p{i}{{animation:{nm} var(--dur) ease-in-out infinite}}')
        pkt_svg.append(f'<g id="p{i}" class="pkt">{glyph}</g>')
    for i, (el, phases) in enumerate(spins):
        nm = f's{i}'
        css.append(spin_kf(nm, phases, n))
        css.append(f'#{el}{{animation:{nm} var(--dur) ease-in-out infinite}}')
    for i, (el, phases, x0, x1) in enumerate(sweeps):
        nm = f'w{i}'
        css.append(sweep_kf(nm, phases, n, x0, x1))
        css.append(f'#{el}{{animation:{nm} var(--dur) linear infinite}}')
    cap_html = []
    for p, c in enumerate(caps):
        nm = f'c{p}'
        css.append(fade_kf(nm, {p}, n, 1, 0, fade=0.06))
        cap_html.append(f'<p style="animation:{nm} var(--dur) linear infinite">{c}</p>')
    fp = (n - 1) if freeze_phase is None else freeze_phase
    freeze = -round((fp + 0.6) * phase_s, 2)
    html = PAGE.format(title=title, where=where, aria=aria, dur=dur, vw=vw, vh=vh,
                       svg=svg + '\n' + '\n'.join(pkt_svg), caps=''.join(cap_html),
                       ticks='<span></span>' * n, css='\n'.join('  ' + c for c in css),
                       freeze=freeze)
    with open(path, 'w') as f:
        f.write(html)
    return dur


# ---------------------------------------------------------------- astro

import re

def fragment(path, *, pfx, aria, n, phase_s, vw, vh, svg, caps,
             fades=(), motions=(), spins=(), sweeps=(), freeze_phase=None, **_):
    """The same figure as an Astro component. Ids and keyframes are prefixed so
    several figures can share a page; the shared .fig styles live in post.css."""
    P = lambda s: f'{pfx}-{s}'
    svg = re.sub(r'id="([^"]+)"', lambda m: f'id="{P(m.group(1))}"', svg)
    css, pk = [], []
    for i, (el, phases, *rest) in enumerate(fades):
        on, off = (rest + [1, 0])[:2] if rest else (1, 0)
        css += [fade_kf(P(f'f{i}'), set(phases), n, on, off), f'#{P(el)}{{animation:{P(f"f{i}")} var(--dur) ease-in-out infinite}}']
    for i, (phase, pts, glyph, *rest) in enumerate(motions):
        t0, t1 = (rest + [0.12, 0.72])[:2] if rest else (0.12, 0.72)
        css += [motion_kf(P(f'm{i}'), phase, n, pts, t0, t1), f'#{P(f"p{i}")}{{animation:{P(f"m{i}")} var(--dur) ease-in-out infinite}}']
        pk.append(f'<g id="{P(f"p{i}")}" class="pkt">{glyph}</g>')
    for i, (el, phases) in enumerate(spins):
        css += [spin_kf(P(f's{i}'), phases, n), f'#{P(el)}{{animation:{P(f"s{i}")} var(--dur) ease-in-out infinite}}']
    for i, (el, phases, x0, x1) in enumerate(sweeps):
        css += [sweep_kf(P(f'w{i}'), phases, n, x0, x1), f'#{P(el)}{{animation:{P(f"w{i}")} var(--dur) linear infinite}}']
    cap_html = []
    for p, c in enumerate(caps):
        css.append(fade_kf(P(f'c{p}'), {p}, n, 1, 0, fade=0.06))
        cap_html.append(f'<p style="animation:{P(f"c{p}")} var(--dur) linear infinite" set:html={{{c!r}}} />')
    dur = round(n * phase_s, 2)
    fp = (n - 1) if freeze_phase is None else freeze_phase
    freeze = -round((fp + 0.6) * phase_s, 2)
    out = f"""---
// Generated by site/scripts/figures/runners/build.py. Edit the scene there, not here.
---

<figure class="fig" data-fig style="--dur:{dur}s; --freeze:{freeze}s">
  <svg viewBox="0 0 {vw} {vh}" role="img" aria-label={{{aria!r}}}>
{svg}
{chr(10).join(pk)}
  </svg>
  <figcaption>
    <div class="caps">{''.join(cap_html)}</div>
    <div class="figbar">
      <div class="track"><i></i><div class="ticks">{'<span></span>' * n}</div></div>
      <span class="ctl"><button type="button" data-pp>pause</button> <button type="button" data-rp>replay</button></span>
    </div>
  </figcaption>
</figure>

<style is:global>
{chr(10).join(css)}
</style>
"""
    with open(path, 'w') as f:
        f.write(out)
