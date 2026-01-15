from django.shortcuts import redirect, render
from django.http import HttpResponse
from ..models import VideoEssay, Log
from ..forms import LogForm, VideoEssayForm, VideoSearchForm, VideoURLForm
from django.contrib.auth.decorators import login_required
from django.template import loader
from ..services.youtube_search import youtube_search
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from django.contrib.auth.models import User
from django.http import JsonResponse
from rest_framework.decorators import api_view


# Create your views here.
def home(request): 
    videoessays = VideoEssay.objects.all()
    logs = Log.objects.all()
    top_rated = logs.filter(rating__range=[8,10])
    last_10_records = videoessays.order_by('-pk')[:10]
    # print(thumbnails)
    print(logs)
    context = {
        'videoessays': videoessays, 
        'top_rated': top_rated, 
        'last_10_records': last_10_records
    }
    
    return render(request, 'movie_csv/home.html', context)

@login_required
def fetch_video(request, youtube_id): 

        # youtube_url = request.POST.get("youtube_url")
        # data = fetch_youtube_data(youtube_url)
        data = request.session["youtube_results"][youtube_id]
        print(data)
        videoEssay, created = VideoEssay.objects.get_or_create(
        youtube_id=youtube_id,
        defaults = {
                "title": data["title"], 
                "youtube_url" : data["link"],
                "thumbnail": data["thumbnail"]["static"], 
                "views": data["views"], 
                "channel_name": data["channel"]["name"], 
                "channel_url": data["channel"]["link"],    
        }
        )
        return redirect('log_movie', videoEssay_id = videoEssay.id)
        
    # return render(request, 'movie_csv/fetch.html', {'form': form})
@login_required
def log_movie(request, videoEssay_id): 
    video_essay = VideoEssay.objects.get(id=videoEssay_id)
    # form = LogForm()
    if request.method == 'POST': 
        form = LogForm(request.POST)
        if form.is_valid(): 
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

@login_required       
def search(request):
    form = VideoSearchForm(request.GET or None)
    results = None
    query = None
    indatabase = None
    if form.is_valid():
        query = form.cleaned_data["query"]
        indatabase = VideoEssay.objects.filter(title__icontains=query)
        if indatabase.exists(): 
            print("exists")
            
        else: 
            print("DOES NOT EXIST")
            results = youtube_search(query)
            youtube_results = {}
            for video in results: 
                url_data = urlparse(video["link"])
                query_params = parse_qs(url_data.query)
                video_id = query_params["v"][0]
                if not video_id: 
                    continue
                youtube_results[video_id] = video
            # print(video_id)
            request.session["youtube_results"] = youtube_results
        # print(request.session["youtube_results"])
    return render(
        request,
        "movie_csv/search.html",
        {
            "form": form,
            "results": results,
            "indatabase": indatabase,
            "search": query,
        }
    )

def video_info(request, video_id): 
    print("video info function")
    logs = Log.objects.filter(essay_id = video_id)
    video = VideoEssay.objects.get(id = video_id)
    context = {
        'logs': logs,
        'video': video
    }
    response = render(request, 'movie_csv/video_info.html', context)
    
    return response