from django.db import models
from django.contrib.auth.models import User


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, null = True, blank = True) 
    imageUrl = models.URLField(blank = True, null = True)
    followers = models.ManyToManyField(User, related_name='followers', blank=True)
    following = models.ManyToManyField(User, related_name='following', blank=True)
    # watchlist = models.OneToOneField('WatchList', on_delete=models.CASCADE, null=True, blank=True)
    # Delete profile when user is deleted
    # photo = models.ImageField(upload_to='profile_pics/', null=True, blank=True, default='profile_pics/default.jpg')
    # display_username = models.CharField(max_length=50, blank = True, null = True, default = None)
    def __str__(self):
        return f'{self.user.username} Profile' #show how we want it to be displayed
     # Override the save method of the model
    def save(self, *args, **kwargs):
        super(Profile, self).save(*args, **kwargs)
    # class Meta:
    #     constraints = [
    #         models.UniqueConstraint(
    #             fields=["display_username"]
    #             condition=models.Q(display_username__isnull=False),
    #             name="unique_display_username_when_set"
    #         )
    #     ]

# class WatchList(models.Model): 
#     user = models.OneToOneField(User, on_delete=models.CASCADE, null = True, blank = True) 
#     essays = models.ManyToManyField(VideoEssay, blank=True)
#     name = models.CharField(max_length=100, default="My Watchlist")
#     def __str__(self):
#         return f"{self.user.username}'s Watchlist"