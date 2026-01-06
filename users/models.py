from django.db import models
from django.contrib.auth.models import User


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE) # Delete profile when user is deleted
    

    def __str__(self):
        return f'{self.user.username} Profile' #show how we want it to be displayed
     # Override the save method of the model
    def save(self):
        super().save()

