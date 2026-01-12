from rest_framework import serializers 
from .models import VideoEssay, Log
from django.contrib.auth.models import User
class VideoEssaySerializer(serializers.ModelSerializer): 
    class Meta: 
        model = VideoEssay
        fields = (
            "id", 
            "youtube_url",
            "youtube_id", 
            "title", 
            "thumbnail", 
            "views", 
            "likes", 
            "channel_name", 
            "channel_url", 
            "subscribers", 
        )

class LogSerializer(serializers.HyperlinkedModelSerializer): 
    owner = serializers.ReadOnlyField(source="owner.username")
    class Meta: 
        model = Log
        fields = (
            "id",
            "date",
            "essay",
            "review_text",
            "rating",
            "rewatch",
            "owner",
        )

class UserSerializer(serializers.ModelSerializer):
    logs = serializers.PrimaryKeyRelatedField(
        many=True,
        read_only=True
    )

    class Meta:
        model = User
        fields = ("id", "username", "logs")
