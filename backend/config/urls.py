from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("movie_csv.urls")),       # DRF API under /api/
    # users.urls (template login/logout/register/profile) unmounted — the Expo
    # app + Clerk handle auth; admin has its own login.
    path("api-auth/", include("rest_framework.urls")),
]
