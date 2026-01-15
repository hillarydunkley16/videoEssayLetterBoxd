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
    path('', home, name = 'home'),
    path('ratings/', include('star_ratings.urls', namespace='ratings')),
    path( "log_movie/<int:videoEssay_id>/", log_movie, name="log_movie"), 
    path('search/', search, name = 'search/' ),
    path('fetch/', fetch_video, name = "fetch"), 
    path("select/<str:youtube_id>/", fetch_video, name="select_video"),
    path("video_info/<int:video_id>/", video_info, name = "video_info"), 
    path("VideoEssays/", VideoEssays.as_view()), 
    path("VideoEssays/<int:pk>/", VideoEssayDetail.as_view()),
    path("logList", logList.as_view(), name = "log-list"), 
    path("logList/<int:pk>/", logDetail.as_view()),
    path("users/", UserList.as_view(), name = "user-list"),
    path("users/<int:pk>/", UserDetail.as_view()),
    path("api-root", api_root, name="api-root"),
    path("home", Home.as_view())
    
]

urlpatterns = format_suffix_patterns(urlpatterns)