Bootleg Letterboxd Based off of CSV movie downloader from GFG 
Letterboxd but for video essays
Profile 
- fetch profile details 
Sign up account 
- form 
- database for details 
Log a movie 
- form 
Write a review

Models: 
Users database

Movies database (canonical objects)

User-Movie interactions

Profiles aggregate user data and movie data 
- movie watching diary 
- stats 
- recent activity

Users authenticate and have profiles

Movies are canonical objects (there is only one of each and user activity points to the movie)

Users log interactions with movies

Reviews are attached to logs 

Profiles: 
- aggregate log data 
- Basic user info
    - how long ago you made the account ("You joined 2 months ago")

To do: 
aggregate log data for user in profile.html 
- display all reviews associated with the user. this has already been done in testing.html in the movie_csv app. figure out how to do this on the user app. 
- construct some sort of homepage for logged in users that shows reviews from other users (all reviews except their own)


Additional feature --> Video Essay Search
https://learndjango.com/tutorials/django-login-and-logout-tutorial
once this works, incorporate in log form --> 

using serpapi for youtube video scraping 

- attempt to integrate: 
    - search within video essay database 
    - serpapi video fetch 

Home page: 
    Not signed in: 
        Talk about your favorite topics and video essays 
        Get started button --> login/signup 
    Signed in: 
        Display existing video essays (need thumbnails)
        Nav bar will have log button 
        On click nav button --> video essay search 

        - search video essay database: 
            - if title found: 
                - pass video ID to log_movie page
            else: 
                - prompt user to get the url and fetch it
                - fetch video with api 
                    - get video id of api-fetched video and pass to log view/form

Log a movie: 
Current log_movie requires a video essay ID 
Log movie should go to a video essay search (implemented already in testing.html)
Search should later be a modal like in letterboxd


