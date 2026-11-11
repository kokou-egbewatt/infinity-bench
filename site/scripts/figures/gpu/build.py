"""Regenerate the animated figures for the cluster-matrix post.

    python3 site/scripts/figures/gpu/build.py

Writes one Astro component per scene into src/components/figures/gpu/, using the
runner post's engine in ../runners (gen.py for the scenes, results.py for the
race, which is drawn from data/cluster-matrix/costs.csv).
"""
import importlib, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(1, os.path.join(HERE, '..', 'runners'))
from gen import fragment
from race import race

OUT = os.path.join(HERE, '..', '..', '..', 'src', 'components', 'figures', 'gpu')
SCENES = ['four_things', 'ladder', 'two_routes']

def stamp(path):
    """The shared engine names the runner build in its header; point it here."""
    with open(path) as f:
        s = f.read()
    s = s.replace('site/scripts/figures/runners/build.py', 'site/scripts/figures/gpu/build.py', 1)
    s = s.replace('from data/gha-runners', 'from data/cluster-matrix', 1).replace('Edit results.py', 'Edit race.py', 1)
    with open(path, 'w', newline='\n') as f:
        f.write(s)

os.makedirs(OUT, exist_ok=True)
for name in SCENES:
    spec = dict(importlib.import_module(name).SPEC)
    comp = spec.pop('component')
    path = os.path.join(OUT, f'{comp}.astro')
    fragment(path, **spec)
    stamp(path)
    print(f'wrote {comp}.astro')
path = os.path.join(OUT, 'ColdRace.astro')
race(path)
stamp(path)
print('wrote ColdRace.astro')
