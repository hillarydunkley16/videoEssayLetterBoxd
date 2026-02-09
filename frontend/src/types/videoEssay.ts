import { Log } from "./log";
export interface VideoEssay {
    //question mark next to name means it is not necessary
    id: number;
    public_id: string;
    youtube_url: string | null; 
    title: string; 
    thumbnail: string | null; 
    views: number | null; 
    channel_name: string | null; 
    channel_url: string | null;
}

        
export interface VideoEssayData {
    video: VideoEssay;
    logs: Log[];
    log_count: number;
}


// "id", 
// "youtube_url",
// "youtube_id", 
// "title", 
// "thumbnail", 
// "views", 
// "likes", 
// "channel_name", 
// "channel_url", 
// "subscribers", 