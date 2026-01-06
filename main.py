import serpapi
from dotenv import load_dotenv
import os
from urllib.parse import urlparse, parse_qs

def main():
    url_data = urlparse('https://www.youtube.com/watch?v=wP-EAMWVUpg')
    query_params = parse_qs(url_data.query)
    video = query_params["v"][0]
    print(video)
    load_dotenv()
    api_key = os.getenv('SERPAPI_KEY')
    client = serpapi.Client(api_key= api_key)
    search = client.search(
        engine = "youtube_video", 
        v = video
    )
    print(search)
    title = search["title"]
    #title is a string
    creator = search["channel"]["name"]
    #creator is a string
    date = search["published_date"]
    #date is a string
    print(title)
    print(creator)
    print(date)
    related_videos = search.related
main()