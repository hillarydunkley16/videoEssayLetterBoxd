# movie_csv/admin.py (or your app name)
from django.contrib import admin
from .models import VideoEssay, Log

admin.site.register(VideoEssay)
admin.site.register(Log)