from django.urls import path, include
from . import views
from django.contrib import admin
from django.contrib.auth import views as auth_views
# from users import user_views

urlpatterns = [
    path('', views.home, name = 'home'),
    path('submit_movie/', views.generate_csv, name = 'submit_movie'),
    path('ratings/', include('star_ratings.urls', namespace='ratings')),
    path( "log_movie/<int:videoEssay_id>/", views.log_movie, name="log_movie"), 
    path('search/', views.search, name = 'search/' ),
    path('fetch/', views.fetch_video, name = "fetch"), 
    path( "select/<str:youtube_id>/", views.fetch_video, name="select_video"),
    path("video_info/<int:video_id>/", views.video_info, name = "video_info")
]