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
**Search should later be a modal like in letterboxd**

Use AWS Postgresql: https://www.w3schools.com/django/django_db_postgresql_intro.php 

Future capabilities: 
- 
- Backend / Middle 
    - Search/Log video flow: 
        - bring back regular search for video in database --> if not found in database then call API ✅
    - Home: 
        - For each video essay generate stats on number of logs 
            - Will probably require changing the video essay model ✅ --> foriegn key with logs, calculate no. of logs that reference the youtube_id? 
        - Have a section that shows the most recently added video essays 
        - Have a section that shows the video essays with the most logs associated with it in the past week 
    

- Frontend: 
    - Profile stats
        - Add a section on the profile template for personal info ✅
            - Number of days since joining platform 
            - Number of days since last log 
            - Number of total logs ✅
            - Top rated videos 
        - Add profile picture!! Big one that I have been avoiding 

    - Home 
        - add modals for video essay details --> will call up last 5 logs associated with the video essay 


    - General 
        - Figure out styling issue --> why does the mystyles.css not actually work in the master.html? :check
        - Add stars for rating instead of just numbers 
        - Organize pages with html groupings, javascript, css 
        -
    
    Django REST (REpresentational State Transfer) framework for the API
    - implemented django rest framework so superusers can interact with and manage the data and the APIs easily. 
    - the data can be viewed and managed on the browser rather than the shell, which makes administration of the application more user-friendly. 
    JWT (JSON Web Token) authentication: 
    - implemented JWT authentication so the APIs are protected from potential bad actors. It is used in tandem with the REST framework 
    - Token based access
    Deployment: 
    --
    Use AWS Postgresql: https://www.w3schools.com/django/django_db_postgresql_intro.php
