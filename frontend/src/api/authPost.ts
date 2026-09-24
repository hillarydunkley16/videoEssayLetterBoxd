import { useAuth } from "@clerk/clerk-expo";
import axios from "axios";
import { SearchResult } from "../types/youtubeResult";
import { API_HOST } from "./client";
export function useAuthPost() {
  const { getToken } = useAuth();

  return async (url: string, data?: any) => {
    const token = await getToken();
    console.log("TOKEN IN useAuthPost:", token ? "exists" : "NULL");  // add this
    return axios({
      url: `${API_HOST}${url}`,
      method: 'POST',
      data,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  };
}
// export function useAuthPost() {
//   const { getToken } = useAuth();

//   return async (url: string, data?: any, options: any = {}) => {
//     const token = await getToken();
//     console.log("token: ", token)
//     console.log("CLERK TOKEN:", token);
//     //need to define method as POST or GET etc. 
//     return axios({
//       url: `http://127.0.0.1:8000${url}`,
//       method: 'POST',
//       data,
//       headers: {
//         Authorization: `Bearer ${token}`,
//         "Content-Type": "application/json",
//       },
//     });
//   };
// }

