import { authFetch, API_BASE_URL } from "./client";
import { VideoEssay, VideoEssayData } from "../types/videoEssay";
import { SearchResult, YouTubeSearchResponse, YouTubeVideoResult} from "../types/youtubeResult"; 
import { PaginatedResponse } from "../types/api";
import axios from "axios";
import { SearchOrHash } from "expo-router";
import * as Crypto from 'expo-crypto';

import { useAuthPost } from "./authPost";
import { useAuth } from "@clerk/clerk-expo";

/**
 * Fetch ALL video essays
 * Calls: GET /api/videoessays/
 * Do an API call to create video essay object from YouTubeResults?? 
 */
export async function fetchVideoEssays(token: string): Promise<PaginatedResponse<VideoEssay>> {
  // const clerk = useClerkAuthFetch();
  // console.log(clerk)
  
  console.log("fetch videos essays functin called!!!");
  return authFetch("/VideoEssays/", {}, token);
}

// Most-logged essays in the trailing 7 days, ranked by log_count.
// Calls: GET /api/VideoEssays/popular/
export async function fetchPopularVideoEssays(token: string): Promise<PaginatedResponse<VideoEssay>> {
  return authFetch("/VideoEssays/popular/", {}, token);
}

// Same endpoint, unauthenticated — it's AllowAny server-side (see
// PopularVideoEssays in views/api.py) so the signed-out home screen can show
// a teaser feed before the user has a Clerk token.
export async function fetchPopularVideoEssaysPublic(): Promise<PaginatedResponse<VideoEssay>> {
  const response = await axios.get<PaginatedResponse<VideoEssay>>(`${API_BASE_URL}/VideoEssays/popular/`);
  return response.data;
}

export async function getAVideoEssay(publicId: string, token: string): Promise<VideoEssayData> {
    console.log("id received: ", publicId);
    console.log("get a video essay function called!");
    return authFetch(`/VideoEssays/${publicId}/`, {}, token)
}

// Get-or-create a VideoEssay by youtube_id — backs the share-to-app flow
// (a shared YouTube URL resolves to an essay without going through search).
// Calls: POST /api/VideoEssays/from-youtube-id/
export async function getOrCreateVideoEssayByYoutubeId(youtubeId: string, token: string): Promise<VideoEssay> {
    return authFetch(
        "/VideoEssays/from-youtube-id/",
        { method: "POST", body: JSON.stringify({ youtube_id: youtubeId }) },
        token
    );
}

// export async function getLogData(publicId: string, token: string): Promise<VideoEssayData> {
//     console.log("id received: ", publicId); 
//     console.log("get a video essay function called!");
//     const response =  authFetch(`/VideoEssays/${publicId}`, {}, token)
//     console.log("response:", response);
//    return response;
// }
/** 
 * fetch youtube results
 * does axios post for search
 */
export const fetchYoutubeResults = async(query: string, location='us', language='en'): Promise<SearchResult[]>=> {
  try{
      console.log(query);
      console.log(location);
      console.log(language);

      const response = await axios.post<YouTubeSearchResponse>(`${API_BASE_URL}/search/`,
          {
              "q": query,
              "location": location,
              "language": language,
          }
      );
      const videoResults = response.data?.video_results ?? [];
      const results: SearchResult[] = videoResults.map((v) => ({
        source : "api",
        video: {
          youtube_url: v.link,
          title: v.title,
          thumbnail: v.thumbnail?.static,
          channel_name: v.channel?.name,
          views: v.views,
          channel_url: v.channel?.link,
        },
      }))
      return results

  } catch(error){
      console.error("Error fetching Youtube data: ", error);
      return [];
  }
};

// Searches the whole VideoEssays table server-side (?search=<query>, matched
// against title/channel_name — see VideoEssays.search_fields), instead of
// fetching only the first page of the unfiltered listing and filtering it
// client-side, which meant an already-logged essay past page 1 could never
// show up no matter what you searched for.
export const searchDataBase = async (
  query: string, token: string
): Promise<SearchResult[]>  => {
  try {
      const response: PaginatedResponse<VideoEssay> = await authFetch(
        `/VideoEssays/?search=${encodeURIComponent(query)}`,
        {},
        token
      );
      return response.results.map((v) => ({
        source: "database",
        video: v,
      }));
  } catch(error){
      console.error("Error searching database: " , error);
      return []
  }
}
export const callSerpAPI = async (query: string) => {
  
  // const lastID = Number(response.results[response.count-1].id);
  const apiCall =  await fetchYoutubeResults(query)
  return apiCall;
      
}
// as user is typing search existing database. if no video is found require user to submit query to serpapi 
//this function will call django api /api/fetch with the params from YouTubeResult
export const useVideoApi = () => {
  const authFetch = useAuthPost();

  const convertYouTubeResultToVideoEssay = async (
    result: Omit<VideoEssay, "id" | "public_id">
  ): Promise<SearchResult> => {
    console.log("result in convertYoutubeResultToVideoEssay: ", result)
    const payload = {
      youtube_url: result.youtube_url ?? null,
      title: result.title,
      thumbnail:
        typeof result.thumbnail === "string"
          ? result.thumbnail
          : null,
      channel_name: result.channel_name ?? null,
      views: result.views ?? null,
      channel_url: result.channel_url ?? null,
    };

    const video = await authFetch(
      "/api/video-essays/",
      payload
    );
    
    return {
      source: "database",
      video: video.data as VideoEssay
    };
  };

  return { convertYouTubeResultToVideoEssay };
};