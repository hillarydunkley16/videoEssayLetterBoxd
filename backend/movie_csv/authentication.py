# movie_csv/authentication.py
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from jose import jwt
from django.contrib.auth import get_user_model
import requests

User = get_user_model()

CLERK_ISSUER = "https://splendid-sunbird-55.clerk.accounts.dev"
CLERK_JWKS_URL = f"{CLERK_ISSUER}/.well-known/jwks.json"

JWKS = requests.get(CLERK_JWKS_URL).json()["keys"]


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
            jwks = requests.get(CLERK_JWKS_URL).json()["keys"]
            jwk = next((k for k in jwks if k["kid"] == kid), None)

            if not jwk:
                raise AuthenticationFailed("Public key not found")

            payload = jwt.decode(
                token,
                jwk,
                algorithms=["RS256"],
                issuer=CLERK_ISSUER,
                options={"verify_aud": False},
            )

            clerk_id = payload["sub"]
            user, _ = User.objects.get_or_create(
                username=clerk_id,
                defaults={"email": payload.get("email", "")},
            )
            return (user, None)

        except Exception as e:
            print("JWT DECODE ERROR:", type(e), e)
            raise AuthenticationFailed("Invalid Clerk token")