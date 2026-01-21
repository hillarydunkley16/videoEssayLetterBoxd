# from django.urls import path, include
# from users import views as user_views

# urlpatterns = [
#     path("register/", user_views.register, name="register"),  # signup
#     path("profile/", user_views.profile, name="profile"),    # profile page
#     path("", include("django.contrib.auth.urls")),           # login, logout, password management
# ]


from django.urls import path, include
from users import views as user_views

urlpatterns = [
    path("register/", user_views.register, name="register"),  # signup
    path("profile/", user_views.profile, name="profile"),    # profile page
    path("", include("django.contrib.auth.urls")),           # login, logout, password management
]
