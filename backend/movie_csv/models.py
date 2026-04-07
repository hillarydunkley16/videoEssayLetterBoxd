from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.conf import settings
import uuid
from django.contrib.auth.models import User
from users.models import Profile

# Create your models here.
class VideoEssay(models.Model):
    id = models.BigAutoField(primary_key=True)
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True,)
    youtube_url = models.CharField(max_length=255, null=True, blank=True)
    youtube_id = models.CharField(max_length=32 , unique = True, null=True, blank = True)
    title = models.CharField(max_length=255)
    thumbnail = models.URLField(null=True, blank = True)
    views = models.IntegerField(null=True, blank = True)
    # likes = models.IntegerField(null=True, blank = True)
    channel_name = models.CharField(max_length=255, null=True, blank = True)
    channel_url = models.URLField(null=True, blank = True)
    # subscribers = models.IntegerField(null=True, blank = True)
    created_at = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name = "VideoEssays", on_delete = models.CASCADE
    )
    class Meta: 
        ordering = ("-created_at",)
    def __str__(self): 
        return self.title
    def get_by_public_id(self, public_id):
        return self.get(public_id=public_id)

class Log(models.Model): 
    id = models.BigAutoField(primary_key=True)
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True,)
    date = models.DateField()
    essay = models.ForeignKey("VideoEssay", on_delete= models.CASCADE)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name = "logs", on_delete= models.CASCADE)
    review_text = models.CharField(max_length=200)
    rating = models.IntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)]
    )
    rewatch = models.BooleanField(default=False)
   


class Like(models.Model): 
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="likes", on_delete=  models.CASCADE)
    date = models.DateField(auto_now_add=True)
    post = models.ForeignKey ("Log", related_name="likes",on_delete= models.CASCADE)
    class Meta:
        unique_together = ('user', 'post') 
    # def save(self, *args, **kwargs):
    #     super().save(*args, **kwargs)
    #     # Update the post's like_count when a like is saved
    #     self.post.update_like_count()
    
class Comment(models.Model): 
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="comment", on_delete= models.CASCADE)
    date = models.DateField(auto_now_add=True)
    log = models.ForeignKey("Log", related_name= "comments", on_delete= models.CASCADE)
    text = models.CharField(max_length = 200, blank = True, unique = False, editable=True, null = True)
    
