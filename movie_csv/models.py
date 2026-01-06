from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.conf import settings
# Create your models here.
class VideoEssay(models.Model):
    youtube_url = models.CharField(max_length=255,null=True, blank = True )
    youtube_id = models.CharField(max_length=20 , unique = True, null=True, blank = True)
    title = models.CharField(max_length=255)
    thumbnail = models.URLField(null=True, blank = True)
    views = models.IntegerField(null=True, blank = True)
    likes = models.IntegerField(null=True, blank = True)

    channel_name = models.CharField(max_length=255, null=True, blank = True)
    channel_url = models.URLField(null=True, blank = True)
    subscribers = models.IntegerField(null=True, blank = True)
   
    def __str__(self): 
        return self.title

class Log(models.Model): 
    date = models.DateField()
    essay = models.ForeignKey("VideoEssay", on_delete= models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete= models.CASCADE)
    review_text = models.CharField(max_length=200)
    rating = models.IntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)]
    )
    rewatch = models.BooleanField(default=False)

