# movie_csv/authentication.py
import logging
import time

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from jose import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from users.models import Profile

logger = logging.getLogger(__name__)
User = get_user_model()

# Clerk JWKS are rotated rarely; cache them and refetch on a TTL or a cache miss.
JWKS_CACHE_TTL = getattr(settings, "CLERK_JWKS_CACHE_TTL", 600)

_jwks_cache = {"keys": None, "fetched_at": 0.0}


def reset_jwks_cache():
    _jwks_cache["keys"] = None
    _jwks_cache["fetched_at"] = 0.0


def get_jwks(force_refresh=False):
    fresh = time.monotonic() - _jwks_cache["fetched_at"] < JWKS_CACHE_TTL
    if _jwks_cache["keys"] is None or force_refresh or not fresh:
        response = requests.get(settings.CLERK_JWKS_URL, timeout=10)
        _jwks_cache["keys"] = response.json()["keys"]
        _jwks_cache["fetched_at"] = time.monotonic()
    return _jwks_cache["keys"]


def _accepted_issuers():
    issuers = [settings.CLERK_ISSUER]
    legacy = getattr(settings, "CLERK_ISSUER_LEGACY", "")
    if legacy:
        issuers.append(legacy)
    return tuple(issuers)


class ClerkAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth = request.headers.get("Authorization")
        if not auth or not auth.startswith("Bearer "):
            return None

        token = auth.split(" ")[1]

        try:
            kid = jwt.get_unverified_header(token).get("kid")
            if not kid:
                raise AuthenticationFailed("Missing kid in token header")

            jwks = get_jwks()
            jwk = next((k for k in jwks if k["kid"] == kid), None)
            if jwk is None:
                jwks = get_jwks(force_refresh=True)
                jwk = next((k for k in jwks if k["kid"] == kid), None)
            if jwk is None:
                raise AuthenticationFailed("Signing key not found for token")

            payload = jwt.decode(
                token,
                jwk,
                algorithms=["RS256"],
                issuer=_accepted_issuers(),
                options={"verify_aud": False},
            )
        except AuthenticationFailed:
            raise
        except Exception as exc:
            logger.warning("Clerk token verification failed: %s: %s", type(exc).__name__, exc)
            raise AuthenticationFailed("Invalid Clerk token")

        clerk_id = payload["sub"]
        user, _ = User.objects.get_or_create(
            username=clerk_id,
            defaults={"email": payload.get("email", "")},
        )
        image_url = payload.get("imageUrl", "")
        if image_url:
            Profile.objects.update_or_create(user=user, defaults={"imageUrl": image_url})
        return (user, None)
