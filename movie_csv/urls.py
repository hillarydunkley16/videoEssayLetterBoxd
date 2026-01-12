from django.urls import path, include
from . import views
from django.contrib import admin
from django.contrib.auth import views as auth_views
from rest_framework.urlpatterns import format_suffix_patterns
# from users import user_views

urlpatterns = [
    path('', views.home, name = 'home'),
    path('ratings/', include('star_ratings.urls', namespace='ratings')),
    path( "log_movie/<int:videoEssay_id>/", views.log_movie, name="log_movie"), 
    path('search/', views.search, name = 'search/' ),
    path('fetch/', views.fetch_video, name = "fetch"), 
    path("select/<str:youtube_id>/", views.fetch_video, name="select_video"),
    path("video_info/<int:video_id>/", views.video_info, name = "video_info"), 
    path("testing/", views.testing.as_view()), 
    path("testing/<int:pk>/", views.testingdetail.as_view()),
    path("logList", views.logList.as_view(), name = "log-list"), 
    path("logList/<int:pk>/", views.logDetail.as_view()),
    path("users/", views.UserList.as_view(), name = "user-list"),
    path("users/<int:pk>/", views.UserDetail.as_view()),
    path("api-root", views.api_root, name="api-root"),
]

urlpatterns = format_suffix_patterns(urlpatterns)