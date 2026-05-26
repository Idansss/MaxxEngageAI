from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared limiter instance — imported by routes that need rate limiting.
# Registered on the app in main.py.
limiter = Limiter(key_func=get_remote_address, default_limits=[])
