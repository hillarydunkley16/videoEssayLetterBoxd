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
        - need to check for repeat log w/o rewatch checked ==> ask if they meant to log it, and if it is a rewatch. 
            - would need to check if associated user (user_id) has already logged the video (video_id)
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


Writing through the issue: 
I want to display the videos with the most positive aggregate logs associated with it (most positive overall). This is a one-to-many relationship. 

However, only the logs have an associated video id via a foreign key. The logs point to a video, the manys point to the one. the video doesn't have associated log ids. 

At the moment, I am trying to use django.db.models imports Avg, Count and Q. When I try to filter logs by rating it doesn't work. 

I am filtering **logs**, not video essays. 

create a subset for each video essay id, and filter those based on # of positive reviews? 
From chatgpt: 
That’s because you were filtering logs in isolation, then trying to infer video-level meaning.

**Aggregation logic must live at the VideoEssay level, not in Python loops.**

1/21/2026 

Now adding expo front end 
Need to recreate my existing django templates for front-end expo/react-native development 

List of pages to recreate: 
1. home.html
2. master.html (figure out what the equivalent of this is in react-native)
3. search.html 
4. submit_movie.html 
5. video_info.html
6. log_movie.html
7. login.html 
8. logged_out.html
9. profile.html 
10. register.html


PK stands for primary key

Why I had to delete my database this time: 
I made public_id, deleted the ID which is the foreign key for log 
I assigned public_id as the primary key assuming that SQLite would adapt easily to this. 


 --legacy-peer-deps helps with difficulty with npm package things

  {Platform.OS === 'web' ? (
                <input type = "date"/>
            ): <DatePicker/>}

2/11 problem 
successfully making log and video essay exists in the api 
HOWEVER the video essay is not added to the videoessay group
Basically you don't get it if you do a get request for all fo the video essays you can only get it if you do a get request for that specific video esay with it's UUID
Not good. 


Progress as of 2/16 

User can sign up/ sign in 
Log video flow is finished 
Search video --> Log review --> view logs by video 


Features to implement 

Make each review a page where you can look at more details --> style as a modal that overlays over the video info screen 
Add profile page: 
- user can view their previous logs 
- add profile picture 
- change username
- delete their account 

Add watchlist feature for videos users want to see 
Link youtube videos to the original video on youtube 

Make page for an individual log :check 

Progress as of Feb 25 
Profile page 
- Profile now sort of works 

- Improve filter logs 
- At the moment it only allows for 1 log per user
- can't do a normal .filter() operation because previous logs/users have undefined for id 
- can't access django rest backend, and unsure why this is happening --> getting 403 error 
- probably because i have clerk auth before jwt auth, so the superuser doesn't exist on the clerk auth end 


Log likes and comments 


Issues 3/10
1. Filtering logs in profile isn't working for specific users
johndoe11 --> user_id = 4 but the logs aren't showing up 
need to investigate further 

2. imageUrl for profile is being saved only upon user creation. I would like to be able to update it when the user updates their profile photo on the profile page. 

upon loading log info check if imageUrl is None. If None, set imageUrl to be the clerk auto image 

when user updates their profile image post the url to the Profile model on the backend 

File "/Users/hillarydunkley/csv_movie_downloader/backend/movie_csv/views/api.py", line 274, in update
    profile.imageUrl = request.data.get('imageUrl', profile.imageUrl)
                       ^^^^^^^^^^^^^^^^
AttributeError: 'str' object has no attribute 'get'
[11/Mar/2026 16:00:24] "PATCH /api/users/updatePic HTTP/1.1" 500 102476


The error is because you're passing imageUrl as a plain string to authFetch, but request.data expects a JSON object. When axios receives a string it sends it as-is, so request.data becomes the string "http://..." instead of a dict.

Fix the frontend to send an object:

typescript
export async function updateProfileImageAPI(imageUrl: string, authFetch: ReturnType<typeof useAuthUpdate>) {
    const response = await authFetch(`/api/users/updatePic`, { imageUrl });  // wrap in object
    return response;
}
That's the only fix needed — your Django view is correct, it just wasn't receiving a dict.



i am setting the imageUrl to a blob: 'blob:http://localhost:8081/9fc96078-7987-48b2-9fb5-761d1865e7a6'
if i try to get the imageUrl and set it to the user profile image on the frontend will it work? for clerk it's a clerk url, like http://www.clerk.com/stringofnumbersandletters

5:11 PM
No, a blob: URL won't work for your profile image. Blob URLs are temporary and only exist in the browser's memory for the current session — they can't be stored in a database or accessed later.


The problem is you're sending uri (the local file path) to your backend before Clerk has processed it. You need to wait for Clerk to finish uploading and then get the new URL:

 if (!result.canceled) {
        const uri = result.assets[0].uri;
        const response = await fetch(uri);
        const blob = await response.blob();
        
        // upload to Clerk first
        await user?.setProfileImage({ file: blob });
        
        // reload the user to get the updated imageUrl from Clerk
        await user?.reload();
        
        // now send the Clerk URL to your backend
        const clerkImageUrl = user?.imageUrl;
        console.log("clerk image url: ", clerkImageUrl);
        await updateProfileImageAPI(clerkImageUrl!, authUpdate);
    }
}
user?.reload() forces Clerk to refresh the user object with the newly uploaded image URL, then user?.imageUrl will have the real Clerk CDN URL to save to your backend. 

default clerk img url is https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCIsImlpZCI6Imluc18zOHFPakFDRkhNV1FPNXVBSTdBV20yQnY5YkgiLCJyaWQiOiJ1c2VyXzM5R2w1OFp2OGhZWHhjbTYzYjRUYnpuaElWbiJ9

change the api view for getting info 

more features/requirements: 
- enable remember me for log in --> not possible on clerk
- add following/followers 
    - 3/23 implemented in the backend 
    - need to implement following action 
- track number of logs associated with user  :check
- view other's profile pages
    - need this in order to implement following action 
    - , rn you can only view your own // when you click on a profile picture on logInfo have it take you to that user's profile page. 

Make a section that shows the most popular video essays 
Make a section that shows the most popular log / users `

query ai model to categorize the genre/topic of video essay

expo link push asChild
index >> videoInfo >> logInfo 

libFontParser.dylib] FontParser could not open filePath
/Library/Developer/CoreSimulator/Volumes/iOS_23D8133/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS
26.3.simruntime/Contents/Resources/RuntimeRoot/System/Library/Fonts/Core/AppleColorEmoji.ttc: [2: No such file or directory]

Module provider RNDatePickerManager does not conform to RCTModuleProvider

## Future Extension Project
Chrome extension so you can write your review in the browser when you're done watching your YT video 
On phone maybe as part of share feature on YT?  