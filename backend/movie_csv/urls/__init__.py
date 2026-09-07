from django.urls import path, include

urlpatterns = [
    # Legacy template web UI (movie_csv.urls.web) is no longer mounted — the
    # deployed backend is the DRF API + admin only; Expo is the frontend.
    path("api/", include("movie_csv.urls.api")),
]
