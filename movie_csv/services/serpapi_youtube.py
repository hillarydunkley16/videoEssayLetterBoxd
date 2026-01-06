import serpapi
from dotenv import load_dotenv
import os
from urllib.parse import urlparse, parse_qs
load_dotenv()
def fetch_youtube_data(url):
    url_data = urlparse(url)
    query_params = parse_qs(url_data.query)
    video_id = query_params["v"][0]
    print(video_id)
    
    api_key = os.getenv('SERPAPI_KEY')
    client = serpapi.Client(api_key= api_key)
    result = client.search(
        engine = "youtube_video", 
        v = video_id
    )

    return{
        "youtube_id": video_id, 
        "title": result["title"], #string
        "thumbnail": result["thumbnail"], #string
        "views": result["extracted_views"], #integer
        "likes": result["extracted_likes"], #integer
        "channel_name": result["channel"]["name"], #string
        "channel_url": result["channel"]["link"], #string
        "subscribers": result["channel"]["extracted_subscribers"] #integer
    }
