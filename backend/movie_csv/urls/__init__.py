from django.urls import path, include

urlpatterns = [
    path("", include("movie_csv.urls.web")),
    path("api/", include("movie_csv.urls.api")),
]
