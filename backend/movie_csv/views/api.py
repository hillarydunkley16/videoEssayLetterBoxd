from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
# from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.generics import DestroyAPIView
from ..models import VideoEssay, Log, Like, Comment, Collection
from ..serializers import VideoEssaySerializer, LogSerializer, UserSerializer, CommentSerializer, ProfileSerializer, LikeSerializer, CollectionSerializer
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
from django.db.models import Count
from users.models import Profile

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
    # @csrf_exempt
    queryset = VideoEssay.objects.all()
    serializer_class = VideoEssaySerializer
    permission_classes = [AllowAny]
    @csrf_exempt
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

class logList(generics.ListCreateAPIView): 
    # authentication_classes = [JWTAuthentication]
    # permission_classes = [AllowAny]
    queryset = Log.objects.all()
    serializer_class = LogSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    print(permission_classes)
    # permission_classes = (permissions.IsAuthenticatedOrReadOnly,)
    
    def create(self, request, *args, **kwargs):
        print("Request data:", request.data)
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print("Serializer errors:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        print("User:", self.request.user)
        serializer.save(owner=self.request.user)

# class logList(generics.ListCreateAPIView): 
#     queryset = Log.objects.all()
#     serializer_class = LogSerializer
#     authentication_classes = [ClerkAuthentication]
#     permission_classes = [IsAuthenticated]

#     def get_queryset(self):
#         return Log.objects.filter(owner=self.request.user)

#     def create(self, request, *args, **kwargs):
#         print("REQUEST DATA: ", request.data)  # add this
#         serializer = self.get_serializer(data=request.data)
#         if not serializer.is_valid():
#             print("SERIALIZER ERRORS: ", serializer.errors)  # add this
#             return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
#         self.perform_create(serializer)
#         return Response(serializer.data, status=status.HTTP_201_CREATED)

#     def perform_create(self, serializer):
#         serializer.save(owner=self.request.user)
class userLogs(generics.ListCreateAPIView): 
    serializer_class = LogSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        print("USER ID: ", self.request.user.id)
       

        print("USER LOGS: ", Log.objects.filter(owner_id =self.request.user.id))
        return Log.objects.filter(owner=self.request.user)
class logDetail(generics.RetrieveUpdateDestroyAPIView): 
    # authentication_classes = [JWTAuthentication]
    queryset = Log.objects.all()
    profile_queryset = Profile.objects.all()
    serializer_class = LogSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    # permission_classes = [AllowAny]
    lookup_field = "public_id"
    def get(self, request, public_id):
        # print("Headers:", request.headers)
        # print("Auth user:", request.user)
        # print("Is authenticated:", request.user.is_authenticated)
        print(public_id)
        print(request.data)
        log = self.get_object()
        print(log)
        # userInfo = Profile.objects.get(user_id = request.user.id)
        # print("USERINFO IMAGEURL: ", userInfo.imageUrl)
        # print("USERINFO USERID: ", userInfo.user_id)
        print(log.owner_id)
        print(log.likes)
        
        return Response({
            "log": LogSerializer(log).data,
        })

class logFormView():
    serializerClass = LogSerializer
    def post(self, request, *args, **kwargs):
        data = request.data
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception = True)

        return
class UserList(generics.ListAPIView): 
    permission_classes = [IsAuthenticated]
    # authentication_classes = [JWTAuthentication]
    queryset = User.objects.all()
    serializer_class = UserSerializer
#combine user detail with profile so you just get the user info once, comes with user model class, user logs, profile details (imageurl etc)
class UserDetail(generics.RetrieveAPIView): 
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all()
    serializer_class = UserSerializer
    def get(self,request): 
        print(request.user)
        print(request.user.id)
        userLogs = Log.objects.get(owner_id = request.user.id)
        return userLogs
    
class ProfileDetail(generics.RetrieveAPIView): 
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request): 
        try:
            print("THE REQUEST USER: ", request.user)
            profile = Profile.objects.get(user=request.user)
            # print(profile.__dict__)
            
            serializer = ProfileSerializer(profile)
            print("SERIALIZER!!: ", ProfileSerializer(profile))
            print("PROFILE DATA: ", serializer.data)
            print("FOLLOWERS: ", profile.followers.count())
            print("FOLLOWING: ", profile.following.count())
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Profile.DoesNotExist:
            return Response({"message": "Profile not found"}, status=404)

class ProfileDetailById(generics.RetrieveAPIView):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    lookup_field = "user_id"
    def get(self, request, user_id):
        try:
            print("USER ID FROM URL: ", user_id)
            profile = Profile.objects.get(user_id=user_id)
            serializer = ProfileSerializer(profile)
            print("SERIALIZER!!: ", ProfileSerializer(profile))
            print("FOLLOWERS: ", profile.followers.count())
            print("FOLLOWING: ", profile.following.count())
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Profile.DoesNotExist:
            return Response({"message": "Profile not found"}, status=404)
class Home(APIView):
    # authentication_classes = [JWTAuthentication]
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
        print(logs)
        return Response({
            "video": VideoEssaySerializer(video).data,
            "logs": LogSerializer(logs, many=True).data,
            "log_count": logs.count(),
        })
class VideoEssayList(generics.ListAPIView):
    queryset = VideoEssay.objects.all()
    serializer_class = VideoEssaySerializer
    permission_classes = [AllowAny]

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
class LikePost(generics.ListCreateAPIView): 
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    serializer = LogSerializer
    def post(self, request, public_id, *args, **kwargs): 
        try: 
           post = Log.objects.get(public_id=public_id) 
        except Log.DoesNotExist:
            return Response({"message": "404"})
        new_like, created = Like.objects.get_or_create(user=request.user, post=post)
        if created:
            print(post.likes.count()) 
            return Response({"liked": True, "likes_count": post.likes.count() })
        else: 
            new_like.delete()
            print("ALREADY LIKED THE POST")
            return Response({"liked": False, "likes_count": post.likes.count()})

class UnLikePost(DestroyAPIView):
    queryset = Like.objects.all(); 
    serializer_class = LikeSerializer
    def delete(self, request, public_id, pk): 
        try: 
            log = Log.objects.get(public_id = public_id)

        except Log.DoesNotExist: 
            return Response(status=status.HTTP_404_NOT_FOUND)

class DeleteLog(DestroyAPIView): 
    queryset = Log.objects.all(); 
    serializer_class = LogSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    lookup_field = 'public_id'

class CommentOnPost(generics.CreateAPIView):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request, public_id, *args, **kwargs):
        try: 
            log = Log.objects.get(public_id = public_id)
        except Log.DoesNotExist: 
            return Response({"message": "Log not found"}, status=404)
        print(self.request.user)
        comment = Comment.objects.create(
            user = self.request.user, 
            # date = data["date"],
            log = log,
            text = request.data.get("text", "")
        )
        serializer = CommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
#  @login_required

    # return render(request, 'movie_csv/fetch.html', {'form': form})
class updateProfileImage(generics.UpdateAPIView):
    query_set = Profile.objects.all()
    serializer_class = ProfileSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        try: 
            profile = Profile.objects.get(user=request.user)
        except Profile.DoesNotExist:
            return Response({"message": "Profile does not exist!"}, status=404) 
        
        print("BEFORE SAVE: ", profile.imageUrl)
        profile.imageUrl = request.data.get('imageUrl', profile.imageUrl)
        print("AFTER ASSIGNMENT: ", profile.imageUrl)
        profile.save()
        
        # re-fetch from DB to confirm it was actually saved
        profile.refresh_from_db()
        print("AFTER REFRESH FROM DB: ", profile.imageUrl)
        
        serializer = ProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)
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
class VideoEssaySearch(APIView): 
    serializer_class = VideoEssaySerializer
    def get_queryset(self, request, query):
        VideoEssay.objects.filter(title__icontains = query)

class CollectionList(generics.ListCreateAPIView):
    serializer_class = CollectionSerializer
    # authentication_classes = [ClerkAuthentication]
    # permission_classes = [IsAuthenticated]
    queryset = Collection.objects.all()
    permission_classes = [AllowAny]
    def get_queryset(self):
        return Collection.objects.all()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

class CollectionDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CollectionSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    lookup_field = "public_id"

    def get_queryset(self):
        return Collection.objects.all()
    
class CollectionByUser(generics.ListAPIView):
    serializer_class = CollectionSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Collection.objects.filter(owner=self.request.user)

    
class AddVideoEssayToCollection(APIView): 
    serializer_class = CollectionSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    lookup_field = "public_id"
    # need publicID for collection and separate publicID for videoEssay 
    
    def post(self, request, collection_public_id, videoessay_public_id, *args, **kwargs):
        try: 
            collection = Collection.objects.get(owner=self.request.user, public_id=collection_public_id)
        except: 
            return Response({"message": "Collection not found"}, status=404)
        try: 
            videoEssay = VideoEssay.objects.get(public_id = videoessay_public_id)
        except: 
            return Response({"message": "VideoEssay not found"}, status=404)
        print("COLLECTION ESSAYS BEFORE ADDING: ", collection.essays.all())
        print("ADDING VIDEO ESSAY: ", videoEssay)
        collection.essays.add(videoEssay)  
        print("COLLECTION ESSAYS AFTER ADDING: ", collection.essays.all())
        return Response({"message": "VideoEssay added to collection"}, status=200) 

class RemoveEssayFromCollection(APIView): 
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request,  collection_public_id, videoessay_public_id, *args, **kwargs): 
        try: 
            collection = Collection.objects.get(owner=self.request.user, public_id=collection_public_id)
        except: 
            return Response({"message": "Collection not found"}, status=404)
        try: 
            videoEssay = VideoEssay.objects.get(public_id = videoessay_public_id)
        except: 
            return Response({"message": "VideoEssay not found"}, status=404)
        print("COLLECTION ESSAYS BEFORE REMOVING: ", collection.essays.all())
        print("REMOVING VIDEO ESSAY: ", videoEssay)
        collection.essays.remove(videoEssay)  
        print("COLLECTION ESSAYS AFTER REMOVING: ", collection.essays.all())
        return Response({"message": "VideoEssay removed from collection"}, status=200)

class RemoveCollection(APIView): 
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, collection_public_id): 
        try: 
            collection = Collection.objects.get(owner = self.request.user, public_id = collection_public_id)
        except: 
            return Response({"message": "Collection not found"}, status = 404)
        if "Watchlist" in collection.name: 
            return Response({"message": "Watchlist Collection cannot be Deleted"}, status = 403)
        else: 
            collection.delete()
            return Response({"message": "Collection deleted"}, status=200)