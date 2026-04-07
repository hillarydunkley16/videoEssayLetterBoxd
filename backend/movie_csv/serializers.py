from rest_framework import serializers 
from .models import VideoEssay, Log, Like, Comment
from django.contrib.auth.models import User
from users.models import Profile
#a serializer defines the columns/data that will be used in the views. 
class VideoEssaySerializer(serializers.ModelSerializer): 
    # id = serializers.CharField(source = 'public_id', read_only=True)
    class Meta: 
        model = VideoEssay
        fields = (
            "id",
            "public_id",
            "title", 
            "youtube_url",
            "thumbnail", 
            "views", 
            "channel_name", 
            "channel_url", 
        )
class LikeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Like
        fields = ['user', 'post']
class CommentSerializer(serializers.ModelSerializer): 
    user = serializers.ReadOnlyField(source = "user.username")
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
    owner = serializers.ReadOnlyField(source="owner.username")
    owner_id = serializers.ReadOnlyField(source = "owner.id")
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

    class Meta:
        model = User
        fields = ("id", "username", "logs")
class ProfileSerializer(serializers.ModelSerializer): 
    # profile = serializers.PrimaryKeyRelatedField(
    #     many = True, 
    #     read_only = True
    # )
    
    
    
    user_logs = serializers.SerializerMethodField()
    followers = serializers.SerializerMethodField()
    following = serializers.SerializerMethodField()
    def get_user_logs(self, obj): 
       
        logs = Log.objects.filter(owner = obj.user)
        return LogSerializer(logs, many = True, context = self.context).data
    def get_followers(self, obj):
        followers = obj.followers.all()
        return UserSerializer(followers, many=True, context=self.context).data
    def get_following(self, obj):
        following = obj.following.all()
        return UserSerializer(following, many=True, context=self.context).data

    class Meta: 
        model = Profile
        fields = ("user", "imageUrl", "user_logs", "followers", "following")