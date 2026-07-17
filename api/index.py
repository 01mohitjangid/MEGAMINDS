"""Vercel serverless entry point for the whole app's backend.

Vercel serves the ASGI ``app`` exported here as a serverless function reachable
at ``/api/*`` (see the root ``vercel.json`` rewrite). The real FastAPI code lives
unchanged in ``backend/app`` — we just put its folder on the import path and
re-export ``app`` so one Vercel project can host both the site and the API.
"""

import os
import sys

# Put the ``backend`` folder on the import path so ``import app`` resolves to
# backend/app, exactly like it does when running the API locally.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

from app.main import app  # noqa: E402,F401  (re-exported for Vercel to serve)
