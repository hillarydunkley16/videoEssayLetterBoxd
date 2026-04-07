from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("movie_csv.urls")),       # main app
    path("", include("users.urls")),  # login, logout, register, profile
    path("api-auth/", include("rest_framework.urls")),
]
