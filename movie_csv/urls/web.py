from ..views.web import *
from django.urls import path, include
from django.contrib import admin
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('', home, name = 'home'),
    path('ratings/', include('star_ratings.urls', namespace='ratings')),
    path( "log_movie/<int:videoEssay_id>/", log_movie, name="log_movie"), 
    path('search/', search, name = 'search/' ),
    path('fetch/', fetch_video, name = "fetch"), 
    path("select/<str:youtube_id>/", fetch_video, name="select_video"),

]