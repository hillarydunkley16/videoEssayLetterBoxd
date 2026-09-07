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

export async function getAVideoEssay(publicId: string, token: string): Promise<VideoEssayData> {
    console.log("id received: ", publicId); 
    console.log("get a video essay function called!");
    return authFetch(`/VideoEssays/${publicId}/`, {}, token)
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
      console.log(response)
      console.log(response.data.video_results)
      const results: SearchResult[] = response.data.video_results.map((v) => ({
        source : "api", 
        video: {
          youtube_url: v.link,
          title: v.title, 
          thumbnail: v.thumbnail.static,
          channel_name: v.channel.name,
          views: v.views,
          channel_url: v.channel.link,
        },
      }))
      console.log("fetchYoutubeResult results: ", results)
      console.log("thumbnail: ", results[0].video.thumbnail)
      return results
      
  } catch(error){
      console.error("Error fetching Youtube data: ", error);
      return [];
  }
};

export const searchDataBase = async (
  query: string, token: string
): Promise<SearchResult[]>  => {
  // this needs to be done on the backend i think 
  try {
      const response = await fetchVideoEssays(token!);
      const lastID = response.results[response.results.length-1]?.public_id;
      if (!lastID) {
        throw new Error("No video essays in database");
      }
      const results = response.results
      const filtered = results.filter(item => Object.values(item).join('').
      toLowerCase().includes(query.toLowerCase()));
      // add each result in filtered to search result array and then return search result array 
      if (filtered.length > 0){
        //add : SearchResult to force the results to be of type SearchResult instead of a string? 
        const results: SearchResult[] = filtered.map((v) => ({
          source: "database", 
          video: v,
        }))
        console.log("filtered results: ", filtered)
        return results
      } 
      
  } catch(error){
      console.error("Error fetching Youtube Data: " , error);
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