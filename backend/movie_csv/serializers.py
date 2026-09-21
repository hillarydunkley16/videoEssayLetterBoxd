from rest_framework import serializers 
from .models import VideoEssay, Log, Like, Comment, Collection
from django.contrib.auth.models import User
from users.models import Follow, Profile
#a serializer defines the columns/data that will be used in the views. 

ANONYMOUS = "Anonymous"


def display_username(user):
    """The name to show for a user: their Clerk username, never the raw Clerk id
    that Django stores as `User.username`. Touches `user.profile`, so list views
    should `select_related("profile")`."""
    profile = getattr(user, "profile", None)
    return (profile.display_username if profile else None) or ANONYMOUS


class VideoEssaySerializer(serializers.ModelSerializer):
    # id = serializers.CharField(source = 'public_id', read_only=True)
    # Only present when the queryset annotates `log_count` (see PopularVideoEssays);
    # null otherwise rather than issuing a query per row.
    log_count = serializers.SerializerMethodField()

    def get_log_count(self, obj):
        return getattr(obj, "log_count", None)

    class Meta:
        model = VideoEssay
        fields = (
            "id",
            "public_id",
            "title",
            "youtube_url",
            "thumbnail",
            "duration",
            "views",
            "channel_name",
            "channel_url",
            "log_count",
        )
class LikeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Like
        fields = ['user', 'post']
class CommentSerializer(serializers.ModelSerializer): 
    user = serializers.SerializerMethodField()
    def get_user(self, obj):
        return display_username(obj.user)
    log = serializers.SlugRelatedField(
        slug_field = "public_id", 
        queryset = Log.objects.all()
    )
    # log_id = serializers.ReadOnlyField(source = 'log.public_id')
    class Meta: 
        model = Comment
        fields = (
            "user", 
            "id",
            # "date", 
            "log",
            "text"
        )
class LogSerializer(serializers.HyperlinkedModelSerializer): 
    owner = serializers.SerializerMethodField()
    owner_id = serializers.ReadOnlyField(source = "owner.id")
    is_mine = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    def get_is_liked(self, obj):
        # Relative to whoever is viewing. Scans `likes` in Python so a prefetch (see
        # with_log_relations) covers it; False when no request is in the context.
        request = self.context.get("request")
        viewer = getattr(request, "user", None)
        if viewer is None or not viewer.is_authenticated:
            return False
        return any(like.user_id == viewer.id for like in obj.likes.all())
    def get_owner(self, obj):
        return display_username(obj.owner)
    def get_is_mine(self, obj):
        # Relative to whoever is viewing; False when no request is in the context.
        request = self.context.get("request")
        viewer = getattr(request, "user", None)
        return bool(viewer is not None and viewer.is_authenticated and viewer.id == obj.owner_id)
    essay = serializers.SlugRelatedField(
        slug_field='public_id',
        queryset=VideoEssay.objects.all()
    )
    # likes_count = serializers.SerializerMethodField()

    # like_count = serializers.IntegerField(source="likes.count", read_only=True)
    # Optional: return full essay details when reading
    essay_details = VideoEssaySerializer(source='essay', read_only=True)
    comments = CommentSerializer(many = True, read_only = True)
    likes = LikeSerializer(many = True, read_only = True)
    owner_image = serializers.SerializerMethodField()
    def get_owner_image(self, obj):
        try:
            print(obj.owner.profile.imageUrl)
            return obj.owner.profile.imageUrl
        except Profile.DoesNotExist:
            return None
    class Meta: 
        model = Log
        fields = (
            "id",
            "public_id",
            "date",
            "essay",
            "essay_details",  # Optional
            "review_text",
            "rating",
            "rewatch",
            "owner",
            "owner_id",
            "is_mine",
            "is_liked",
            "owner_image",
            "likes",
            "comments"
        )
    def get_likes_count(self, obj):
        return obj.likes.count()

class UserSerializer(serializers.ModelSerializer):
    logs = serializers.PrimaryKeyRelatedField(
        many=True,
        read_only=True
    )
    username = serializers.SerializerMethodField()

    def get_username(self, obj):
        return display_username(obj)

    class Meta:
        model = User
        fields = ("id", "username", "logs")
class ProfileSerializer(serializers.ModelSerializer): 
    # profile = serializers.PrimaryKeyRelatedField(
    #     many = True, 
    #     read_only = True
    # )
    
    
    
    user = serializers.SerializerMethodField()
    user_logs = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    watchList = serializers.SerializerMethodField()
    def get_watchList(self, obj): 
        # Found by flag, not by name: the name used to embed the Clerk id (see migration 0011).
        watchList, created = Collection.objects.get_or_create(
            owner=obj.user, is_watchlist=True, defaults={"name": "Watchlist"}
        )
        return CollectionSerializer(watchList, context=self.context).data
    def get_user(self, obj):
        # The frontend's Profile type expects the user as an object, not a bare pk.
        return {"id": obj.user_id, "username": obj.display_username or ANONYMOUS, "imageUrl": obj.imageUrl}
    def get_user_logs(self, obj): 
       
        logs = Log.objects.filter(owner = obj.user)
        return LogSerializer(logs, many = True, context = self.context).data
    def get_followers_count(self, obj):
        return Follow.objects.filter(followee=obj.user).count()
    def get_following_count(self, obj):
        return Follow.objects.filter(follower=obj.user).count()
    def get_is_following(self, obj):
        # Relative to whoever is viewing; never true for your own profile.
        request = self.context.get("request")
        viewer = getattr(request, "user", None)
        if viewer is None or not viewer.is_authenticated or viewer.id == obj.user_id:
            return False
        return Follow.objects.filter(follower=viewer, followee=obj.user).exists()
    
    class Meta: 
        model = Profile
        fields = ("user", "imageUrl", "user_logs", "followers_count", "following_count", "is_following", "watchList")

class FollowListUserSerializer(serializers.ModelSerializer):
    """Row for followers/following lists. `is_following` is an annotation set by the view."""
    imageUrl = serializers.CharField(source="profile.imageUrl", read_only=True, allow_null=True, default=None)
    is_following = serializers.BooleanField(read_only=True)
    username = serializers.SerializerMethodField()

    def get_username(self, obj):
        return display_username(obj)

    class Meta:
        model = User
        fields = ("id", "username", "imageUrl", "is_following")


class CollectionSerializer(serializers.ModelSerializer):
    owner = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    def get_owner(self, obj):
        return display_username(obj.owner)
    def get_is_owner(self, obj):
        # Relative to whoever is viewing; False when no request is in the context.
        # The frontend can't compare `owner` to the Clerk id any more, so we say it here.
        request = self.context.get("request")
        viewer = getattr(request, "user", None)
        return bool(viewer is not None and viewer.is_authenticated and viewer.id == obj.owner_id)
    essays = VideoEssaySerializer(many=True, read_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_watchlist:
            # Stored names may be the legacy "<clerk id>'s Watchlist"; never show them.
            profile = getattr(instance.owner, "profile", None)
            username = profile.display_username if profile else None
            data["name"] = f"{username}'s Watchlist" if username else "Watchlist"
        return data

    class Meta:
        model = Collection
        fields = (
            "id",
            "public_id",
            "name",
            "description",
            "owner",
            "is_owner",
            "essays",
            "is_watchlist",
        )
        read_only_fields = ("is_watchlist",)

