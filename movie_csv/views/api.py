from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from ..models import VideoEssay, Log
from ..serializers import VideoEssaySerializer, LogSerializer, UserSerializer
from rest_framework import generics, permissions
from ..permissions import IsOwnerOrReadOnly
from django.contrib.auth.models import User


@api_view(["GET"])
def api_root(request, format=None): 
    return Response(
        {
            "users": reverse("user-list", request=request, format=format),
            "logs": reverse("log-list", request=request, format=format)
        }
    )

class  VideoEssays(generics.ListCreateAPIView):
    queryset = VideoEssay.objects.all()
    serializer_class = VideoEssaySerializer
    permission_classes = [IsAuthenticated]

class VideoEssayDetail(generics.RetrieveUpdateDestroyAPIView): 
    queryset = VideoEssay.objects.all()
    serializer_class = VideoEssaySerializer
    permission_classes = [IsAuthenticated]

class logList (generics.ListCreateAPIView): 
    # authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    queryset = Log.objects.all()
    serializer_class = LogSerializer
    # permission_classes = (permissions.IsAuthenticatedOrReadOnly,)
    def perform_create(self, serializer): 
        serializer.save(owner=self.request.user)

class logDetail(generics.RetrieveUpdateDestroyAPIView): 
    # authentication_classes = [JWTAuthentication]
    queryset = Log.objects.all()
    serializer_class = LogSerializer
    permission_classes = (
        permissions.IsAuthenticatedOrReadOnly,
        IsOwnerOrReadOnly,
         )
class UserList(generics.ListAPIView): 
    permission_classes = [IsAuthenticated]
    # authentication_classes = [JWTAuthentication]
    queryset = User.objects.all()
    serializer_class = UserSerializer

class UserDetail(generics.RetrieveAPIView): 
    queryset = User.objects.all()
    serializer_class = UserSerializer

class Home(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        content = {'message': 'Hello, World!'}
        return Response(content)