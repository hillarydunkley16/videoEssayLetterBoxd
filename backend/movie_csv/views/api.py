from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from ..models import VideoEssay, Log
from ..serializers import VideoEssaySerializer, LogSerializer, UserSerializer
from rest_framework import generics, permissions
from ..permissions import IsOwnerOrReadOnly
from django.contrib.auth.models import User
from ..services.youtube_search import youtube_search
from django.contrib.auth import authenticate, login
from rest_framework.authtoken.models import Token
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from urllib.parse import urlparse, parse_qs
from django.shortcuts import redirect, render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import requests
import json
from dotenv import load_dotenv
import os
import serpapi
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from movie_csv.authentication import ClerkAuthentication

def get_anonymous_user():
    user, created = User.objects.get_or_create(
        username='anonymous',
        defaults={'email': 'anonymous@example.com'}
    )
    return user
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
    permission_classes = [AllowAny]
    
    def  post(self, request, *args, **kwargs): 
        data = request.data
        
        # youtube_url = request.POST.get("youtube_url")
        # data = fetch_youtube_data(youtube_url)
        # data = json.loads(request.body)
        # data = request.session["youtube_results"][youtube_id]
        print(data)
        print(request.user)
        videoEssay = VideoEssay.objects.create(
            title =data["title"],
            youtube_url=data["youtube_url"],
            thumbnail=data["thumbnail"],
            views=data["views"],
            channel_name=data["channel_name"],
            channel_url=data["channel_url"],
            owner = request.user 
        )


        serializer = VideoEssaySerializer(videoEssay)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class logList (generics.ListCreateAPIView): 
    # authentication_classes = [JWTAuthentication]
    # permission_classes = [AllowAny]
    queryset = Log.objects.all()
    serializer_class = LogSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    # permission_classes = (permissions.IsAuthenticatedOrReadOnly,)
    def perform_create(self, serializer):
        print("Request data:", self.request.data)
        print("User:", self.request.user)
        serializer.save(owner=self.request.user)
   

class logDetail(generics.RetrieveUpdateDestroyAPIView): 
    # authentication_classes = [JWTAuthentication]
    queryset = Log.objects.all()
    serializer_class = LogSerializer
    permission_classes = (
        permissions.IsAuthenticatedOrReadOnly,
        IsOwnerOrReadOnly,
         )
class logFormView():
    serializerClass = LogSerializer
    def post(self, request, *args, **kwargs):
        #  videoEssay = VideoEssay.objects.create(
        #     title =data["title"],
        #     youtube_url=data["youtube_url"],
        #     thumbnail=data["thumbnail"],
        #     views=data["views"],
        #     channel_name=data["channel_name"],
        #     channel_url=data["channel_url"],
        #     owner = request.user 
        # )

        data = request.data
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception = True)

        return
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
    permission_classes = [AllowAny]

    def get(self, request):
        print(request.user)
        content = {'message': 'Hello, World!'}
        return Response(content)
    
class VideoInfo(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    queryset = VideoEssay.objects.all()
    serializer_class = VideoEssaySerializer
    lookup_field = "public_id"

    def get(self, request, public_id):
        video = self.get_object()
        logs = Log.objects.filter(essay=video)

        return Response({
            "video": VideoEssaySerializer(video).data,
            "logs": LogSerializer(logs, many=True).data,
            "log_count": logs.count(),
        })


class LoginView(GenericAPIView):
    serializer_class = UserSerializer
    authentication__classes = []
    permission_classes = []

    def post(self, request, *args, **kwargs):
        data = request.data
        serializer = self.get_serializer(data=data)
        authenticated_user = authenticate(
            email=data['email'],
            password=data['password'],
        )
        if not authenticated_user:
            return Response(status=401)
        login(request, authenticated_user)
        token, _ = Token.objects.get_or_create(user=authenticated_user) 
        return Response(
            status=200,
            data={
                **serializer.data,
                'token': token.key,
            },
        )

# @login_required

    # return render(request, 'movie_csv/fetch.html', {'form': form})

@login_required
def log_movie(request, videoEssay_id): 
    video_essay = VideoEssay.objects.get(id=videoEssay_id)
    
def search(request):
    # form = VideoSearchForm(request.GET or None)
    results = None
    query = None
    indatabase = None
    print(request.user)
    results = youtube_search(query)
    youtube_results = {}
    for video in results: 
        url_data = urlparse(video["link"])
        query_params = parse_qs(url_data.query)
        video_id = query_params["v"][0]
        if not video_id: 
            continue
        youtube_results[video_id] = video
    # print(video_id)
    request.session["youtube_results"] = youtube_results
    # print(request.session["youtube_results"])
    return render(
    request,
    "movie_csv/search.html",
    {
        "results": results,
        "indatabase": indatabase,
        "search": query,
    }
)

@csrf_exempt
@require_http_methods(["POST"])
def youtube_search(request):
    print(request.user)
    
    data = json.loads(request.body)

    search_query = data.get("q")
    if not search_query:
        return JsonResponse({"error": "q is required"}, status=400)

    params = {
        "engine": "youtube",
        "search_query": search_query,  # ← IMPORTANT
        "location": data.get("location", "us"),
        "hl": data.get("language", "en"),
        "api_key": os.getenv("SERPAPI_KEY"),
    }

    response = requests.get("https://serpapi.com/search", params=params)
    return JsonResponse(response.json())

class VideoEssayCreateView(generics.CreateAPIView):
    serializer_class = VideoEssaySerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    
    def perform_create(self, serializer):
        print("AUTH HEADER:", self.request.headers.get("Authorization"))
        print("USER:", self.request.user)
        print("CREATING VIDEO ESSAY WITH DATA:", serializer.validated_data)
        
        instance = serializer.save(owner=self.request.user)
        
        print("CREATED VIDEO ESSAY ID:", instance.id)
        print("CREATED VIDEO ESSAY PUBLIC_ID:", instance.public_id)
        print("CREATED VIDEO ESSAY OWNER:", instance.owner)
        
        # Verify it's in the database
        exists = VideoEssay.objects.filter(public_id=instance.public_id).exists()
        print("EXISTS IN DATABASE:", exists)