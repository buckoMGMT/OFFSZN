import sys
from pathlib import Path

# Tests import `packages.*` directly; no install step, no editable package, no
# PYTHONPATH juggling in CI.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
