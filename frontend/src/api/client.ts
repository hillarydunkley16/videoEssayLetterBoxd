import { Platform } from "react-native";
import Constants from "expo-constants";

function getLocalHost() {
  if (Platform.OS === "web") return "127.0.0.1";

  const debuggerHost =
    Constants.manifest?.debuggerHost ||
    Constants.expoConfig?.extra?.DEBUGGER_HOST;

  if (debuggerHost) {
    const host = debuggerHost.split(":")[0];
    if (host) return host;
  }

  if (Platform.OS === "android") {
    return "10.0.2.2"; // Android emulator localhost mapping
  }

  return "127.0.0.1"; // iOS simulator or default local host
}

// Set EXPO_PUBLIC_API_BASE_URL (e.g. in frontend/.env) to the deployed backend's
// root URL, such as https://your-app.onrender.com, to point the app at it.
// When unset, falls back to local-network discovery for dev builds.
const configuredHost = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

export const API_HOST = configuredHost || `http://${getLocalHost()}:8000`;
export const API_BASE_URL = `${API_HOST}/api`;

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

