"""Regenerate the animated figures for the runner fleet post.

    python3 site/scripts/figures/runners/build.py

Writes one Astro component per scene into src/components/figures/runners/.
Each figure is CSS keyframes on one shared clock; see gen.py. The result
figures for section 11 come from results.py and the CSVs in data/gha-runners.
"""
import importlib, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gen import fragment
from results import RESULTS

OUT = os.path.join(HERE, '..', '..', '..', 'src', 'components', 'figures', 'runners')
SCENES = ['life_of_a_job', 'port_collision', 'restart_not_recreate', 'where_the_key_lives']

os.makedirs(OUT, exist_ok=True)
for name in SCENES:
    spec = dict(importlib.import_module(name).SPEC)
    comp = spec.pop('component')
    fragment(os.path.join(OUT, f'{comp}.astro'), **spec)
    print(f'wrote {comp}.astro')
# the three result figures, drawn from data/gha-runners
for comp, draw in RESULTS.items():
    draw(os.path.join(OUT, f'{comp}.astro'))
    print(f'wrote {comp}.astro')
