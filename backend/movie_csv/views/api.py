import re
import uuid
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle
# from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.generics import DestroyAPIView
from ..models import VideoEssay, Log, Like, Comment, Collection, Report
from ..serializers import display_username, VideoEssaySerializer, LogSerializer, UserSerializer, CommentSerializer, ProfileSerializer, LikeSerializer, CollectionSerializer, FollowListUserSerializer, BlockedUserSerializer
from rest_framework import generics, permissions, filters
from ..permissions import IsOwnerOrReadOnly
from django.contrib.auth.models import User
from ..services.youtube_search import youtube_search
from ..services.youtube_oembed import fetch_oembed_metadata, OEmbedLookupError
from ..tasks import run_youtube_search, SearchProviderError
from celery.exceptions import TimeoutError as CeleryTimeoutError
from django.core.cache import cache
from django.contrib.auth import authenticate, login
from rest_framework.authtoken.models import Token
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from urllib.parse import urlparse, parse_qs
from django.shortcuts import redirect, render, get_object_or_404
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
from django.db.models import Case, Count, Exists, F, IntegerField, OuterRef, Prefetch, Q, Value, When
from django.utils import timezone
from datetime import timedelta
from users.models import Block, Follow, Profile, blocked_user_ids, exclude_blocked
import logging
from django.db import transaction

logger = logging.getLogger(__name__)

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
    # Search runs server-side across the whole table (?search=<query>)
    # rather than the frontend paging through results and filtering only
    # the first page client-side, which is why already-logged essays past
    # page 1 never showed up in search.
    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "channel_name"]
    @csrf_exempt
    def  post(self, request, *args, **kwargs): 
        data = request.data
        
        # youtube_url = request.POST.get("youtube_url")
        # data = fetch_youtube_data(youtube_url)
        # data = json.loads(request.body)
        # data = request.session["youtube_results"][youtube_id]
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

def with_log_relations(queryset, viewer=None):
    """Everything LogSerializer touches per row (essay, owner name, comment authors'
    names, likes), fetched up front so list endpoints run a constant number of queries.

    With a `viewer`, logs, comments and likes from users blocked either way are left out, so
    the counts a client derives (comments, likes) match what it can see. Anonymous or missing
    viewers get everything."""
    comments = exclude_blocked(Comment.objects.select_related("user__profile"), viewer, "user")
    likes = exclude_blocked(Like.objects.all(), viewer, "user")
    return exclude_blocked(queryset, viewer, "owner").select_related("essay", "owner__profile").prefetch_related(
        Prefetch("likes", queryset=likes), Prefetch("comments", queryset=comments)
    )


class logList(generics.ListCreateAPIView): 
    # authentication_classes = [JWTAuthentication]
    # permission_classes = [AllowAny]
    serializer_class = LogSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    # permission_classes = (permissions.IsAuthenticatedOrReadOnly,)

    def get_queryset(self):
        return with_log_relations(Log.objects.all(), self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.warning("Log create validation failed: %s", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Idempotency guard: a double-tapped "Save Log" posts the same payload
        # more than once. If this user already has an identical log, return it
        # instead of inserting a duplicate row.
        v = serializer.validated_data
        existing = Log.objects.filter(
            owner=request.user,
            essay=v["essay"],
            date=v["date"],
            rating=v["rating"],
            review_text=v.get("review_text", ""),
            rewatch=v.get("rewatch", False),
        ).first()
        if existing is not None:
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
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
        return with_log_relations(Log.objects.filter(owner=self.request.user), self.request.user)
class logDetail(generics.RetrieveUpdateDestroyAPIView): 
    # authentication_classes = [JWTAuthentication]
    profile_queryset = Profile.objects.all()
    serializer_class = LogSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    lookup_field = "public_id"

    def get_queryset(self):
        # A blocked user's log is a 404, not a 403, so its existence isn't confirmed.
        return with_log_relations(Log.objects.all(), self.request.user)

    def get(self, request, public_id):
        # print("Headers:", request.headers)
        # print("Auth user:", request.user)
        # print("Is authenticated:", request.user.is_authenticated)
        log = self.get_object()
        # userInfo = Profile.objects.get(user_id = request.user.id)
        # print("USERINFO IMAGEURL: ", userInfo.imageUrl)
        # print("USERINFO USERID: ", userInfo.user_id)
        
        return Response({
            "log": LogSerializer(log, context={"request": request}).data,
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
    serializer_class = UserSerializer

    def get_queryset(self):
        users = User.objects.select_related("profile").prefetch_related("logs").order_by("id")
        return exclude_blocked(users, self.request.user, "id")
#combine user detail with profile so you just get the user info once, comes with user model class, user logs, profile details (imageurl etc)
class UserDetail(generics.RetrieveAPIView): 
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all()
    serializer_class = UserSerializer
    def get(self,request): 
        userLogs = Log.objects.get(owner_id = request.user.id)
        return userLogs
    
class ProfileDetail(generics.RetrieveAPIView): 
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request): 
        try:
            profile = Profile.objects.get(user=request.user)
            serializer = ProfileSerializer(profile, context={"request": request})
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
        if user_id in blocked_user_ids(request.user):
            return Response({"message": "Profile not found"}, status=404)
        try:
            profile = Profile.objects.get(user_id=user_id)
            serializer = ProfileSerializer(profile, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Profile.DoesNotExist:
            return Response({"message": "Profile not found"}, status=404)
class Home(APIView):
    # authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        content = {'message': 'Hello, World!'}
        return Response(content)

class VideoInfo(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    queryset = VideoEssay.objects.all()
    serializer_class = VideoEssaySerializer
    lookup_field = "public_id"

    def get(self, request, public_id):
        video = self.get_object()
        logs = with_log_relations(Log.objects.filter(essay=video), request.user)
        return Response({
            "video": VideoEssaySerializer(video).data,
            "logs": LogSerializer(logs, many=True, context={"request": request}).data,
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
        if not created:
            new_like.delete()
        # Counted for this viewer: likes from users blocked either way don't count.
        likes_count = exclude_blocked(post.likes.all(), request.user, "user").count()
        return Response({"liked": created, "likes_count": likes_count})

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
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
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
        # Deliberately says nothing about a block: the blocked user must not learn of it.
        if log.owner_id in blocked_user_ids(request.user):
            return Response({"message": "You can't do that"}, status=403)
        comment = Comment.objects.create(
            user = self.request.user, 
            # date = data["date"],
            log = log,
            text = request.data.get("text", "")
        )
        serializer = CommentSerializer(comment, context={"request": request})
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
        
        profile.imageUrl = request.data.get('imageUrl', profile.imageUrl)
        profile.save()
        
        # re-fetch from DB to confirm it was actually saved
        profile.refresh_from_db()
        
        serializer = ProfileSerializer(profile, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)
@login_required
def log_movie(request, videoEssay_id): 
    video_essay = VideoEssay.objects.get(id=videoEssay_id)
    
def search(request):
    # form = VideoSearchForm(request.GET or None)
    results = None
    query = None
    indatabase = None
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

YOUTUBE_SEARCH_CACHE_TTL = 300  # seconds
YOUTUBE_SEARCH_RATE_LIMIT = 30  # requests per client IP per window
YOUTUBE_SEARCH_RATE_WINDOW = 60  # seconds


def _client_ip(request):
    # Take the LAST X-Forwarded-For entry: that's the one appended by the
    # proxy in front of us. Earlier entries are client-supplied and spoofable.
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    return forwarded.split(",")[-1].strip() if forwarded else request.META.get("REMOTE_ADDR", "")


def _rate_limited(ip):
    """Fixed-window counter. add() is a no-op if the key exists, and incr() is
    atomic on Redis, so concurrent requests can't slip past the limit. On the
    in-process LocMemCache each gunicorn worker keeps its own counter, so the
    effective limit there is per-worker; Redis makes it global."""
    key = f"youtube_search:throttle:{ip}"
    cache.add(key, 0, YOUTUBE_SEARCH_RATE_WINDOW)
    try:
        count = cache.incr(key)
    except ValueError:  # window expired between add() and incr()
        cache.set(key, 1, YOUTUBE_SEARCH_RATE_WINDOW)
        count = 1
    return count > YOUTUBE_SEARCH_RATE_LIMIT


@csrf_exempt
@require_http_methods(["POST"])
def youtube_search(request):
    # Rate limited by hand: this is a plain Django view, not a DRF one, so
    # DRF's throttle classes don't apply here.
    if _rate_limited(_client_ip(request)):
        return JsonResponse({"error": "rate limit exceeded"}, status=429)

    try:
        data = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "invalid JSON body"}, status=400)

    search_query = data.get("q")
    if not search_query:
        return JsonResponse({"error": "q is required"}, status=400)

    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return JsonResponse(
            {"error": "YouTube search is not configured on the server"}, status=503
        )

    location = data.get("location", "us")
    language = data.get("language", "en")
    params = {
        "engine": "youtube",
        "search_query": search_query,
        "location": location,
        "hl": language,
        "api_key": api_key,
    }

    # Cache key omits api_key (a secret, and constant per deployment).
    cache_key = f"youtube_search:{search_query}:{location}:{language}"
    cached = cache.get(cache_key)
    if cached is not None:
        return JsonResponse(cached)

    # Runs inline today (CELERY_TASK_ALWAYS_EAGER, no REDIS_URL). With a broker
    # configured the task runs on a worker and retries transient failures, but
    # this request still waits on the result, so it doesn't free the web process.
    # disable_sync_subtasks=False: that guard stops a task from waiting on another task
    # (a worker deadlock). This is a web request, not a task. In eager mode Celery's own
    # "a task is running" flag is process-wide, so overlapping requests on a threaded
    # server can leave it stuck on, and the guard then rejects every later search.
    try:
        results = run_youtube_search.delay(params).get(timeout=30, disable_sync_subtasks=False)
    except (requests.exceptions.Timeout, CeleryTimeoutError):
        logger.warning("SerpAPI request timed out")
        return JsonResponse({"error": "search provider timed out"}, status=504)
    except (requests.exceptions.ConnectionError, SearchProviderError) as exc:
        logger.warning("SerpAPI search failed: %s", exc)
        return JsonResponse({"error": "search provider error"}, status=502)

    cache.set(cache_key, results, YOUTUBE_SEARCH_CACHE_TTL)
    return JsonResponse(results)

class VideoEssayCreateView(generics.CreateAPIView):
    serializer_class = VideoEssaySerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
class VideoEssayFromYoutubeId(generics.GenericAPIView):
    """Get-or-create a VideoEssay by youtube_id, fetching metadata via oEmbed on a miss.

    Backs the share-to-app flow: a shared YouTube URL is resolved to a
    VideoEssay's public_id without going through the SerpAPI search flow.
    """
    serializer_class = VideoEssaySerializer

    def post(self, request, *args, **kwargs):
        youtube_id = request.data.get("youtube_id")
        if not youtube_id:
            return Response({"error": "youtube_id is required"}, status=400)

        existing = VideoEssay.objects.filter(youtube_id=youtube_id).first()
        if existing:
            return Response(VideoEssaySerializer(existing).data, status=200)

        try:
            metadata = fetch_oembed_metadata(youtube_id)
        except OEmbedLookupError:
            return Response({"error": "could not resolve youtube_id"}, status=422)

        essay = VideoEssay.objects.create(
            youtube_id=youtube_id,
            youtube_url=f"https://www.youtube.com/watch?v={youtube_id}",
            owner=request.user,
            **metadata,
        )
        return Response(VideoEssaySerializer(essay).data, status=201)


class VideoEssaySearch(APIView):
    serializer_class = VideoEssaySerializer
    def get_queryset(self, request, query):
        VideoEssay.objects.filter(title__icontains = query)

def public_collections():
    """Every collection that may be shown to someone other than its owner: all but watchlists,
    which are private. The one place that rule lives; list and search views build on it."""
    return Collection.objects.filter(is_watchlist=False)


def with_collection_relations(queryset):
    """Owner name and essays fetched up front so list endpoints run a constant number of queries."""
    return queryset.select_related("owner__profile").prefetch_related("essays")


class CollectionList(generics.ListCreateAPIView):
    serializer_class = CollectionSerializer
    # authentication_classes = [ClerkAuthentication]
    # permission_classes = [IsAuthenticated]
    queryset = Collection.objects.all()
    permission_classes = [AllowAny]
    def get_queryset(self):
        return with_collection_relations(
            exclude_blocked(public_collections(), self.request.user, "owner")
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

class CollectionDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CollectionSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    lookup_field = "public_id"

    def get_queryset(self):
        # Another user's watchlist is a 404, not a 403, so its existence isn't confirmed.
        visible = Q(is_watchlist=False) | Q(owner=self.request.user)
        lists = exclude_blocked(Collection.objects.filter(visible), self.request.user, "owner")
        return with_collection_relations(lists)
    
class CollectionSearch(generics.ListAPIView):
    """Lists whose name contains ?q (name only). Watchlists are never results, for any viewer,
    because the queryset starts from public_collections(). Exact matches first, then prefix
    matches, then lists with the most essays; `id` breaks ties so pages are stable. A missing
    or under-2-character ?q is an empty page. Signed-in only, unlike CollectionList."""
    serializer_class = CollectionSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    MIN_QUERY_LENGTH = 2

    def get_queryset(self):
        q = self.request.query_params.get("q", "").strip()
        if len(q) < self.MIN_QUERY_LENGTH:
            return Collection.objects.none()
        return (
            with_collection_relations(exclude_blocked(public_collections(), self.request.user, "owner"))
            .filter(name__icontains=q)
            .annotate(
                essay_total=Count("essays"),
                match_rank=Case(
                    When(name__iexact=q, then=Value(0)),
                    When(name__istartswith=q, then=Value(1)),
                    default=Value(2),
                    output_field=IntegerField(),
                ),
            )
            .order_by("match_rank", "-essay_total", "id")
        )


class CollectionByUser(generics.ListAPIView):
    serializer_class = CollectionSerializer
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return with_collection_relations(Collection.objects.filter(owner=self.request.user))

    
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
        collection.essays.add(videoEssay)  
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
        collection.essays.remove(videoEssay)  
        return Response({"message": "VideoEssay removed from collection"}, status=200)

class RemoveCollection(APIView): 
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, collection_public_id): 
        try: 
            collection = Collection.objects.get(owner = self.request.user, public_id = collection_public_id)
        except: 
            return Response({"message": "Collection not found"}, status = 404)
        if collection.is_watchlist:
            return Response({"message": "Watchlist Collection cannot be Deleted"}, status = 403)
        else:
            collection.delete()
            return Response({"message": "Collection deleted"}, status=200)


class PopularVideoEssays(generics.ListAPIView):
    """Most-logged video essays in the trailing 7 days, ranked by log count."""
    serializer_class = VideoEssaySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        since = timezone.now().date() - timedelta(days=7)
        return (
            VideoEssay.objects.filter(log__date__gte=since)
            .annotate(log_count=Count("log", filter=Q(log__date__gte=since)))
            # Ordering by a related field (e.g. log__date) here would pull it
            # into the GROUP BY and split one essay's count across rows —
            # order only by the essay's own fields.
            .order_by("-log_count", "-created_at")
            .distinct()[:10]
        )


class FollowUser(APIView):
    """Toggles the request user following the given user by creating or deleting
    their users.Follow row."""
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if request.user.id == user_id:
            return Response({"message": "Cannot follow yourself"}, status=400)
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"message": "User not found"}, status=404)
        # Deliberately says nothing about a block: the blocked user must not learn of it.
        if target_user.id in blocked_user_ids(request.user):
            return Response({"message": "You can't do that"}, status=403)

        follow, following = Follow.objects.get_or_create(follower=request.user, followee=target_user)
        if not following:
            follow.delete()

        return Response(
            {
                "following": following,
                "followers_count": exclude_blocked(
                    Follow.objects.filter(followee=target_user), request.user, "follower"
                ).count(),
            },
            status=200,
        )


class BlockUser(APIView):
    """POST blocks <user_id>, DELETE unblocks. Both are idempotent. Blocking also removes
    follows in both directions; unblocking does not restore them. The effect on what each
    side sees is mutual (see users.models.blocked_user_ids)."""
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if request.user.id == user_id:
            return Response({"message": "Cannot block yourself"}, status=400)
        target = get_object_or_404(User, id=user_id)
        with transaction.atomic():
            Block.objects.get_or_create(blocker=request.user, blocked=target)
            Follow.objects.filter(
                Q(follower=request.user, followee=target) | Q(follower=target, followee=request.user)
            ).delete()
        return Response({"blocked": True}, status=200)

    def delete(self, request, user_id):
        get_object_or_404(User, id=user_id)
        Block.objects.filter(blocker=request.user, blocked_id=user_id).delete()
        return Response(status=204)


class BlockedUsersList(generics.ListAPIView):
    """The users the caller has blocked, newest block first. Only the caller's own blocks:
    who has blocked the caller is never exposed."""
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = BlockedUserSerializer

    def get_queryset(self):
        return (
            User.objects.filter(blocks_received__blocker=self.request.user)
            .select_related("profile")
            .annotate(blocked_at=F("blocks_received__created_at"))
            .order_by("-blocked_at", "-id")
        )


REPORT_DAILY_LIMIT = 20  # reports per signed-in user per day, duplicates included


class ReportThrottle(UserRateThrottle):
    """Caps reports per user per day. Counted in the Django cache (per process with LocMemCache,
    like the search limiter), so it resets on a restart or deploy."""
    scope = "report"
    rate = f"{REPORT_DAILY_LIMIT}/day"


class ReportCreate(APIView):
    """POST /api/reports/ {target_type, target_id, reason, details?}

    target_type is log, comment, user or list; target_id is the public_id for a log or list and
    the numeric id for a comment or user. Reporting your own content is a 400. Content the
    reporter can't see (hidden by a block, or someone else's watchlist) is a 404. A second report
    of the same target while the first is open returns the first (200). Each new report is
    stored with a snapshot of the reported text, so it stays useful if the content is deleted."""
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [ReportThrottle]

    def post(self, request):
        target_type = request.data.get("target_type")
        target_id = request.data.get("target_id")
        reason = request.data.get("reason")
        details = request.data.get("details") or ""

        if target_type not in {t for t, _ in Report.TARGET_TYPES}:
            return Response({"message": "Unknown target_type"}, status=400)
        if reason not in {r for r, _ in Report.REASONS}:
            return Response({"message": "Unknown reason"}, status=400)
        if not isinstance(details, str) or len(details) > Report._meta.get_field("details").max_length:
            return Response({"message": "details must be at most 500 characters"}, status=400)
        try:
            key = uuid.UUID(str(target_id)) if target_type in ("log", "list") else int(str(target_id))
        except (ValueError, TypeError):
            return Response({"message": "Invalid target_id"}, status=400)

        viewer = request.user
        if target_type == "log":
            field = "log"
            target = exclude_blocked(
                Log.objects.select_related("owner__profile", "essay"), viewer, "owner"
            ).filter(public_id=key).first()
            owner_id = target and target.owner_id
            snapshot = target and (
                f'Log by {display_username(target.owner)} on "{target.essay.title}" '
                f"({target.rating}/5): {target.review_text}"
            )
        elif target_type == "comment":
            field = "comment"
            target = exclude_blocked(
                exclude_blocked(Comment.objects.select_related("user__profile"), viewer, "user"),
                viewer,
                "log__owner",
            ).filter(id=key).first()
            owner_id = target and target.user_id
            snapshot = target and f"Comment by {display_username(target.user)}: {target.text}"
        elif target_type == "user":
            field = "reported_user"
            target = exclude_blocked(User.objects.select_related("profile"), viewer, "id").filter(id=key).first()
            owner_id = target and target.id
            snapshot = target and f"User {display_username(target)} (id {target.id})"
        else:
            field = "collection"
            target = exclude_blocked(
                public_collections().select_related("owner__profile"), viewer, "owner"
            ).filter(public_id=key).first()
            owner_id = target and target.owner_id
            snapshot = target and (
                f'List "{target.name}" by {display_username(target.owner)}: {target.description}'
            )

        if target is None:
            return Response({"message": "Not found"}, status=404)
        if owner_id == viewer.id:
            return Response({"message": "You can't report your own content"}, status=400)

        existing = Report.objects.filter(reporter=viewer, status=Report.OPEN, **{field: target}).first()
        if existing is not None:
            return Response({"id": existing.id, "status": existing.status}, status=200)

        report = Report.objects.create(
            reporter=viewer,
            reason=reason,
            details=details,
            target_type=target_type,
            snapshot=snapshot,
            **{field: target},
        )
        return Response({"id": report.id, "status": report.status}, status=201)


class FollowListBase(generics.ListAPIView):
    """Newest-follow-first list of users on one side of <user_id>'s follows.
    `is_following` is relative to the viewer. Subclasses set `relation`: the Follow
    reverse name reaching the listed users, and `target_field`: the Follow column
    that must equal <user_id>."""
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = FollowListUserSerializer
    relation = None
    target_field = None

    def get_queryset(self):
        target_id = self.kwargs["user_id"]
        # One lookup for "exists and not blocked either way": a blocked user is a 404.
        get_object_or_404(exclude_blocked(User.objects.all(), self.request.user, "id"), id=target_id)
        viewer_follows = Follow.objects.filter(follower=self.request.user, followee=OuterRef("pk"))
        return (
            exclude_blocked(
                User.objects.filter(**{f"{self.relation}__{self.target_field}_id": target_id}),
                self.request.user,
                "id",
            )
            .select_related("profile")
            .annotate(is_following=Exists(viewer_follows), followed_at=F(f"{self.relation}__created_at"))
            .order_by("-followed_at", "-id")
        )


class FollowersList(FollowListBase):
    """Users who follow <user_id>."""
    relation = "following_set"  # Follow rows where the listed user is the follower
    target_field = "followee"


class FollowingList(FollowListBase):
    """Users <user_id> follows."""
    relation = "follower_set"  # Follow rows where the listed user is the followee
    target_field = "follower"


class RemoveFollower(APIView):
    """Lets a user remove someone from their own followers. Not a block: the removed
    user can follow again."""
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id, follower_id):
        if request.user.id != user_id:
            return Response({"message": "You can only remove your own followers"}, status=403)
        deleted, _ = Follow.objects.filter(follower_id=follower_id, followee_id=user_id).delete()
        if not deleted:
            return Response({"message": "Follower not found"}, status=404)
        return Response(status=204)


class FollowingFeed(generics.ListAPIView):
    """Logs by the people the viewer follows (own logs excluded), newest first.
    Log has no timestamp, so ordering is day-granular with id as the tie-break."""
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = LogSerializer

    def get_queryset(self):
        followees = Follow.objects.filter(follower=self.request.user).values("followee_id")
        return with_log_relations(
            Log.objects.filter(owner_id__in=followees), self.request.user
        ).order_by("-date", "-id")


class SuggestedUsers(generics.ListAPIView):
    """Up to 5 users the viewer doesn't follow yet (never themself), most-followed first.
    A plain list, not paginated — it feeds a small home-screen card."""
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = FollowListUserSerializer
    pagination_class = None

    def get_queryset(self):
        me = self.request.user
        already_following = Follow.objects.filter(follower=me, followee=OuterRef("pk"))
        return (
            exclude_blocked(User.objects.exclude(id=me.id), me, "id")
            .annotate(followed=Exists(already_following), follower_total=Count("follower_set"))
            .filter(followed=False)
            .annotate(is_following=Exists(already_following))
            .select_related("profile")
            .order_by("-follower_total", "id")[:5]
        )


class UserSearch(generics.ListAPIView):
    """Users whose Clerk username (`Profile.display_username`) contains ?q, never the viewer.
    Exact matches first, then prefix matches, then most-followed; `id` breaks ties so pages
    are stable. A missing or under-2-character ?q is an empty page, so this can't be used
    to list everyone. Users with no display_username are not searchable. `is_following`
    is relative to the viewer."""
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = FollowListUserSerializer
    MIN_QUERY_LENGTH = 2

    def get_queryset(self):
        me = self.request.user
        q = self.request.query_params.get("q", "").strip()
        if len(q) < self.MIN_QUERY_LENGTH:
            return User.objects.none()
        already_following = Follow.objects.filter(follower=me, followee=OuterRef("pk"))
        name = "profile__display_username"
        return (
            exclude_blocked(User.objects.exclude(id=me.id), me, "id")
            .filter(**{f"{name}__icontains": q})
            .annotate(
                is_following=Exists(already_following),
                follower_total=Count("follower_set"),
                match_rank=Case(
                    When(**{f"{name}__iexact": q}, then=Value(0)),
                    When(**{f"{name}__istartswith": q}, then=Value(1)),
                    default=Value(2),
                    output_field=IntegerField(),
                ),
            )
            .select_related("profile")
            .order_by("match_rank", "-follower_total", "id")
        )


USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]+$")
USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 30
# Tried in order against a single set of already-taken names (one query), so this never
# issues a query per candidate. Mixes numeric and underscore suffixes per SPEC-username-onboarding.md.
USERNAME_SUFFIXES = ["1", "2", "3", "4", "5", "_", "01", "02", "99", "_1", "_2"]


def suggest_usernames(base, count=3):
    """Up to `count` available usernames derived from `base`, each independently free.

    Fetches every display_username starting with `base` in one query, then tries a fixed
    suffix list against that in-memory set until `count` free ones are found.
    """
    taken = {
        name.lower()
        for name in Profile.objects.filter(display_username__istartswith=base).values_list(
            "display_username", flat=True
        )
        if name
    }
    suggestions = []
    for suffix in USERNAME_SUFFIXES:
        candidate = f"{base}{suffix}"
        if len(candidate) > USERNAME_MAX_LENGTH:
            continue
        if candidate.lower() in taken:
            continue
        suggestions.append(candidate)
        taken.add(candidate.lower())
        if len(suggestions) >= count:
            break
    return suggestions


class AgeConfirmation(APIView):
    """POST /api/users/age-confirmation/

    Records that the signed-in user confirmed they are 16 or older. The tick happens on the
    sign-up form, before the account exists, so the app reports it right after sign-in. The
    stored value is the server's own receive time, kept from the first report: a repeat is
    accepted and changes nothing, so a retry or a second device can't move the date."""

    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        if profile.age_confirmed_at is None:
            profile.age_confirmed_at = timezone.now()
            profile.save(update_fields=["age_confirmed_at"])
        return Response({"age_confirmed_at": profile.age_confirmed_at}, status=status.HTTP_200_OK)


class UsernameAvailability(APIView):
    """GET /api/users/username-available/?u=<candidate>

    Public: there's no Clerk session yet at this point in sign-up. Checks
    Profile.display_username only — a UX layer in front of Clerk, which remains the final
    authority on uniqueness/format at signUp.create() time (SPEC-username-onboarding.md)."""

    permission_classes = [AllowAny]

    def get(self, request):
        candidate = request.query_params.get("u", "").strip()
        if not candidate or not USERNAME_PATTERN.match(candidate) or not (
            USERNAME_MIN_LENGTH <= len(candidate) <= USERNAME_MAX_LENGTH
        ):
            return Response(
                {
                    "error": (
                        f"Usernames must be {USERNAME_MIN_LENGTH}-{USERNAME_MAX_LENGTH} "
                        "characters: letters, numbers, and underscores only."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        taken = Profile.objects.filter(display_username__iexact=candidate).exists()
        if not taken:
            return Response({"available": True, "suggestions": []})
        return Response({"available": False, "suggestions": suggest_usernames(candidate)})


class DeleteAccount(APIView):
    """Delete the caller's Django user and everything that cascades from it.

    VideoEssay.owner cascades, so essays the caller added would take other users'
    logs with them. Before deleting, hand each such essay to another user who logged
    it (or listed it) so their data survives. The client deletes the Clerk user
    afterwards; if that fails, ClerkAuthentication lazily recreates the Django user.
    """
    authentication_classes = [ClerkAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user
        with transaction.atomic():
            for essay in VideoEssay.objects.filter(owner=user):
                heir = (
                    User.objects.filter(logs__essay=essay).exclude(pk=user.pk).order_by("logs__id").first()
                    or User.objects.filter(lists__essays=essay).exclude(pk=user.pk).order_by("id").first()
                )
                if heir:
                    essay.owner = heir
                    essay.save(update_fields=["owner"])
            user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
