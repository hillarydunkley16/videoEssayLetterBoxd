# movie_csv/authentication.py
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from jose import jwt
from django.contrib.auth import get_user_model
import requests
from users.models import Profile

User = get_user_model()

CLERK_ISSUER = "https://splendid-sunbird-55.clerk.accounts.dev"
CLERK_JWKS_URL = f"{CLERK_ISSUER}/.well-known/jwks.json"

# JWKS = requests.get(CLERK_JWKS_URL).json()["keys"]
_jwks_cache = None
def get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        response = requests.get(CLERK_JWKS_URL, timeout=10)
        _jwks_cache = response.json()["keys"]
    return _jwks_cache

def refresh_jwks():
    global _jwks_cache
    _jwks_cache = None
    return get_jwks()
class ClerkAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth = request.headers.get("Authorization")
        if not auth or not auth.startswith("Bearer "):
            return None

        token = auth.split(" ")[1]

        try:
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")
            if not kid:
                raise AuthenticationFailed("Missing kid in token header")

            # fetch fresh keys each time instead of caching
            jwks = get_jwks()
            jwk = next((k for k in jwks if k["kid"] == kid), None)

            if not jwk:
                jwks = refresh_jwks()  # retry with fresh keys
                jwk = next((k for k in jwks if k["kid"] == kid), None)

            payload = jwt.decode(
                token,
                jwk,
                algorithms=["RS256"],
                issuer=CLERK_ISSUER,
                options={"verify_aud": False},
            )

            clerk_id = payload["sub"]
            print("CLERK PAYLOAD KEYS:", payload.keys())
            user, _ = User.objects.get_or_create(
                username=clerk_id,
                defaults={"email": payload.get("email", "")},
            )
            imageUrl = payload.get("imageUrl", "")
            if imageUrl: 
                Profile.objects.update_or_create(
                    user = user,
                    defaults = {"imageUrl": imageUrl}
                )
            return (user, None)

        except Exception as e:
            print("JWT DECODE ERROR:", type(e), e)
            raise AuthenticationFailed("Invalid Clerk token")