import { VideoEssay } from "./videoEssay";
// Normalized app-level result (what UI uses)
type databaseResult = {
  source: "database";
  video: VideoEssay;}
type APIResult = {
  source: "api"; 
  video: Omit<VideoEssay, "public_id" | "id">;
}
export type SearchResult = databaseResult | APIResult
  // Raw YouTube API response (what Axios returns)
  export interface YouTubeSearchResponse {
    video_results: YouTubeVideoResult[];
    people_also_search_for?: any[];
    channel_results?: any[];
    ads_results?: any[];
    pagination?: any;
  }
  
  export interface YouTubeVideoResult {
    // video: Omit<VideoEssay, "id">;
    youtube_url: string;
    title: string;
    thumbnail: string;
    channel_name: string;
    views: number;
    channel_url: string;
  }
    