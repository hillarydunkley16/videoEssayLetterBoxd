from rest_framework import serializers 
from .models import VideoEssay, Log
from django.contrib.auth.models import User
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

class LogSerializer(serializers.HyperlinkedModelSerializer): 
    owner = serializers.ReadOnlyField(source="owner.username")
    essay = serializers.SlugRelatedField(
        slug_field='public_id',
        queryset=VideoEssay.objects.all()
    )
    # Optional: return full essay details when reading
    essay_details = VideoEssaySerializer(source='essay', read_only=True)
    
    class Meta: 
        model = Log
        fields = (
            "id",
            "date",
            "essay",
            "essay_details",  # Optional
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
