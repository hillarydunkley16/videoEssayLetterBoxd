import { useAuth } from "@clerk/clerk-expo";
import axios from "axios";
import { SearchResult } from "../types/youtubeResult";
export function useClerkAuthFetch() {
  const { getToken } = useAuth();

  return async (url: string, data?: any, options: any = {}) => {
    const token = await getToken();
    console.log("CLERK TOKEN:", token);
    //need to define method as POST or GET etc. 
    return axios({
      url: `http://127.0.0.1:8000${url}`,
      method: 'POST',
      data,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  };
}

