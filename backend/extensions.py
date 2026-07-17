"""Shared Flask extension instances.

Kept in their own module so blueprints can import them without importing `app`
(which imports the blueprints — that would be a circular import).
"""
import os

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Behind Render's proxy the real client IP arrives in X-Forwarded-For; Limiter
# reads it via get_remote_address once ProxyFix (set in app.py) is trusting it.
# No default_limits: only the expensive clone endpoints are decorated, so the
# cheap poll endpoints the frontend hits every 5s stay unthrottled.
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.environ.get('RATELIMIT_STORAGE_URI', 'memory://'),
)
