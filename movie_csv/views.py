from django.shortcuts import redirect, render
import csv
from django.http import HttpResponse
from .models import VideoEssay, Log
from .forms import LogForm, VideoEssayForm, VideoSearchForm, VideoURLForm
from django.contrib.auth.decorators import login_required
from django.template import loader
import os
from .services.serpapi_youtube import fetch_youtube_data
from datetime import datetime
# Create your views here.
def home(request): 
    videoessays = VideoEssay.objects.all()
    # print(thumbnails)
    context = {
        'videoessays': videoessays
    }
    
    return render(request, 'movie_csv/home.html', context)


def generate_csv(request): 
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename = "movie_catalog.csv"'

    writer = csv.writer(response)

    writer.writerow(['Title', 'Creator', 'Creator Country', 'Release Date'])

    movies = VideoEssay.objects.all()

    for movie in movies: 
        writer.writerow([movie.title, movie.director, movie.country, movie.budget])
    return response 
@login_required
def fetchMovie(request): 
    form = VideoEssayForm()
    if request.method == "POST": 
       form = VideoEssayForm(request.POST)
       if form.is_valid():
            youtube_url = request.POST.get("youtube_url")
            data = fetch_youtube_data(youtube_url)
            
            videoEssay, created = VideoEssay.objects.get_or_create(
            youtube_id = data["youtube_id"],
            defaults = {
                    "title": data["title"], 
                    "thumbnail": data["thumbnail"], 
                    "views": data["views"], 
                    "likes": data["likes"], 
                    "channel_name": data["channel_name"], 
                    "channel_url": data["channel_url"], 
                    "subscribers": data["subscribers"],
            }
            )
            return redirect('log_movie', videoEssay_id = videoEssay.id)
            
    return render(request, 'movie_csv/fetch.html', {'form': form})
@login_required
def log_movie(request, videoEssay_id): 
    video_essay = VideoEssay.objects.get(id=videoEssay_id)
    print("BEGINNING OF FUNCTION")
    # form = LogForm()
    if request.method == 'POST': 
        form = LogForm(request.POST)
        print("request is POST")
        if form.is_valid(): 
            print("form is VALID")
            post = form.save(commit=False)
            post.essay_id = videoEssay_id
            post.user = request.user
            post.video_essay = video_essay
            post.save()
            
            return redirect('profile')
    else: 
        form = LogForm()
    return render(request,
        "movie_csv/log_movie.html",
        {"form": form, "video_essay": video_essay})
@login_required
def diary(request): 
    logs = Log.objects.filter(user=request.user)
    template = loader.get_template('movie_csv/testing.html')
    context = {
        'logs' : logs
    }
    return HttpResponse(template.render(context, request))

def testing(request):
    form = VideoSearchForm(request.GET or None)
    results = None
    query = None
    
    if form.is_valid():
        query = form.cleaned_data["query"]
        results = VideoEssay.objects.filter(title__icontains=query)
        if results.exists(): 
            print("exists! yay")
        else: 
            print("does not exist")
       
    return render(
        request,
        "movie_csv/testing.html",
        {
            "form": form,
            "results": results,
            "search": query,
        }
        
    )

def search(request):
    form = VideoSearchForm(request.GET or None)
    results = None
    query = None
    
    if form.is_valid():
        query = form.cleaned_data["query"]
        results = VideoEssay.objects.filter(title__icontains=query)
        if results.exists(): 
            print("exists! yay!!!!!!!!!")
        else: 
            print("does not exist!!!!!")
       
    return render(
        request,
        "movie_csv/search.html",
        {
            "form": form,
            "results": results,
            "search": query,
        }
        
    )
    

        
           

   

