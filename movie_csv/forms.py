from django import forms 
from .models import Log, VideoEssay
# from django.forms import ModelForm

class VideoEssayForm(forms.ModelForm):
    class Meta: 
        model = VideoEssay
        fields = ["youtube_url"]     

class VideoURLForm(forms.Form):
    youtube_url = forms.URLField(label="YouTube URL")

class VideoSearchForm(forms.Form): 
    query = forms.CharField(label="Search video")

class DateInput(forms.DateInput):
    input_type = 'date'

class LogForm(forms.ModelForm): 
    class Meta: 
        model = Log
        exclude = ['user', "essay"]
        widgets = {
            "date": DateInput()
        }