from ..views.api import *
from django.urls import path, include
from rest_framework_simplejwt.views import(
    TokenObtainPairView,
    TokenRefreshView,
)
urlpatterns = [
    path("VideoEssays/", VideoEssays.as_view()), 
    path("VideoEssays/<int:pk>/", VideoEssayDetail.as_view()),
    path("logList", logList.as_view(), name = "log-list"), 
    path("logList/<int:pk>/", logDetail.as_view()),
    path("users/", UserList.as_view(), name = "user-list"),
    path("users/<int:pk>/", UserDetail.as_view()),
    path("api-root", api_root, name="api-root"),
    path("home", Home.as_view()),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]