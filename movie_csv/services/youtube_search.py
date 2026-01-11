from serpapi import GoogleSearch
from dotenv import load_dotenv
import os
# from urllib.parse import urlparse, parse_qs
load_dotenv()

def youtube_search(term): 
    api_key = os.getenv('SERPAPI_KEY')
    # client = serpapi.Client(api_key= api_key)
    params = {
    "engine": "youtube",
    "search_query": term,
    "api_key": api_key
    }
    search = GoogleSearch(params)
    results = search.get_dict()
    video_results = results["video_results"]
    # print(video_results)
    return video_results

# youtube_search("contrapoints jk rowling")