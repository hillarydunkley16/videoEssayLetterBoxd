from ..views.api import *
from django.urls import path, include

urlpatterns = [
    path("VideoEssays/", VideoEssays.as_view()), 
    path("VideoEssays/<int:pk>/", VideoEssayDetail.as_view()),
    path("logList", logList.as_view(), name = "log-list"), 
    path("logList/<int:pk>/", logDetail.as_view()),
    path("users/", UserList.as_view(), name = "user-list"),
    path("users/<int:pk>/", UserDetail.as_view()),
    path("api-root", api_root, name="api-root"),
    path("home", Home.as_view())
]

