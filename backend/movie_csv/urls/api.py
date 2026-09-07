from ..views.api import *
from django.urls import path, include
from rest_framework_simplejwt.views import(
    TokenObtainPairView,
    TokenRefreshView,
)
from django.conf import settings
from django.conf.urls.static import static
urlpatterns = [
    path("VideoEssays/", VideoEssays.as_view()), 
    path("VideoEssays/<uuid:public_id>/", VideoInfo.as_view()),
    path("logList/", logList.as_view(), name = "log-list"), 
    path("logList/<uuid:public_id>/", logDetail.as_view()),
    path("users/", UserList.as_view(), name = "user-list"),
    path("users/<int:pk>/", UserDetail.as_view()),
    path("api-root", api_root, name="api-root"),
    path("home", Home.as_view()),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('search/', youtube_search, name = "youtube_search"),
    path('fetch/', VideoEssays.as_view(),name = "fetch" ), 
    path("video-essays/", VideoEssayCreateView.as_view(), name="video-essays"),
    path("userLogs/", userLogs.as_view()),
    path("logList/<uuid:public_id>/like/", LikePost.as_view() ),
    path("logList/<uuid:public_id>/like/delete/<int:pk>/", UnLikePost.as_view()),
    path("logList/<uuid:public_id>/comment/", CommentOnPost.as_view()),
    path("users/updatePic", updateProfileImage.as_view()), 
    path("users/profile", ProfileDetail.as_view()), 
    path("logList/<uuid:public_id>/delete", DeleteLog.as_view()),
    path("users/profile/<int:user_id>/", ProfileDetailById.as_view()), 
    path("collections/", CollectionList.as_view(), name="collection-list"),
    path("collections/<uuid:public_id>/", CollectionDetail.as_view(), name="collection-detail"),
    path("collections/<uuid:collection_public_id>/add/<uuid:videoessay_public_id>/", AddVideoEssayToCollection.as_view(), name="update-collection"),
    path("collections/user/", CollectionByUser.as_view(), name="collections-by-user"),
    # path("collections/<uuid:public_id>/", CollectionDetail.as_view(), name="collection-detail"),
    path("collections/<uuid:collection_public_id>/remove/<uuid:videoessay_public_id>/", RemoveEssayFromCollection.as_view(), name="remove-from-collection"),
    path("collections/<uuid:collection_public_id>/remove/", RemoveCollection.as_view(), name="delete-collection"),
    # path("collections/")
    # path("lists/", ListCreateView.as_view(), name="lists"),
    # path("lists/<uuid:public_id>/", ListDetailView.as_view(), name="list-detail"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)