import { useAuth } from "@clerk/clerk-expo";
import axios from "axios";
import { SearchResult } from "../types/youtubeResult";
import { getAccessToken } from "../helpers/jwt";
import { API_HOST } from "./client";
// import { getAccessToken } from "../helpers/jwt";
export function useAuthUpdate() {
  const { getToken } = useAuth();

  return async (url: string, data?: any, options: any = {}) => {
    const token = await getToken();
    console.log("token: ", token)
    // const access = await getAccessToken(); 
    // console.log("access: ", access);
    // console.log("ACCESS token: ", access);
    console.log("CLERK TOKEN:", token);
    //need to define method as POST or GET etc. 
    return axios({
      url: `${API_HOST}${url}`,
      method: 'PATCH',
      data,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  };
}

