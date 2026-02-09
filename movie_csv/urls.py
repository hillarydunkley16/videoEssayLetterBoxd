from django.urls import path, include
from . import views
from django.contrib import admin
from django.contrib.auth import views as auth_views
from rest_framework.urlpatterns import format_suffix_patterns
# from .views import Home

from .views.web import *
from .views.api import *
# from users import user_views

urlpatterns = [
    path("", include("movie_csv.urls.web")), 
    path("api/", include("movie_csv.urls.api")),
]

urlpatterns = format_suffix_patterns(urlpatterns)