import { Platform } from "react-native";
// client.ts

const API_BASE_URL = Platform.OS === 'web' 
    ? "http://127.0.0.1:8000/api"
    : "http://172.20.10.2:8000/api";  // your Mac's local IP with port

export async function authFetch(endpoint: string, options: any = {}, clerkToken?: string) {
    if (!clerkToken) throw new Error("No token provided");
    
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${clerkToken}`,
        ...(options.headers || {}),
    };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error: ${res.status} — ${text}`);
    }

    return res.json();
}

// import {
//     getAccessToken,
//     getRefreshToken,
//     setTokens,
//     clearTokens,
//   } from "../helpers/jwt";
  
//   const API_BASE_URL = "http://127.0.0.1:8000/api";
  
//   async function refreshAccessToken() {
//     const refresh = await getRefreshToken();
//     if (!refresh) throw new Error("No refresh token");
  
//     const res = await fetch(`${API_BASE_URL}/token/refresh/`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ refresh }),
//     });
  
//     if (!res.ok) {
//       await clearTokens();
//       throw new Error("Refresh failed");
//     }
  
//     const data = await res.json();
//     await setTokens({
//       access: data.access,
//       refresh,
//     });
  
//     return data.access;
//   }
  
//   export async function authFetch(endpoint: string, options: any = {}, clerkToken?: string) {
//     let access = clerkToken || await getAccessToken();
    
//     // attach access token
//     let headers = {
//       "Content-Type": "application/json",
//       ...(options.headers || {}),
//     };
//     if (access) headers["Authorization"] = `Bearer ${access}`;
  
//     let res = await fetch(`${API_BASE_URL}${endpoint}`, {
//       ...options,
//       headers,
//     });
  
//     // if expired or unauthorized → try refresh
//     if (res.status === 401) {
//       try {
//         access = await refreshAccessToken();
//         headers["Authorization"] = `Bearer ${access}`;
//         res = await fetch(`${API_BASE_URL}${endpoint}`, {
//           ...options,
//           headers,
//         });
//       } catch (err) {
//         throw err;
//       }
//     }
  
//     if (!res.ok) {
//       const text = await res.text();
//       throw new Error(`API error: ${res.status} — ${text}`);
//     }
  
//     return res.json();
//   }

