// fetch logs 
// fetch log details 
// create log 
// update log 
// import { authFetch } from "./client";

import { Log } from "../types/log";
import { PaginatedResponse } from "../types/api";
import { VideoEssay } from "../types/videoEssay";
import { useAuthPost } from "./authPost";
import { authFetch } from "./client";
export async function fetchLogs(token: string): Promise<PaginatedResponse<Log>> {
    console.log("fetch logs functin called!!!");
  return authFetch("/logList", {}, token);
}
// export async function fetchLogsFromUser(): Promise<PaginatedResponse<Log>> {
//     const logs = authFetch("/logList"); 
//     console.log(logs)
//     // const userLogs = 
//     return logs

// }

export async function fetchALog(id: string, token: string): Promise<Log> {
    console.log(`fetching log with this ID:  ${id}`)
    const data = await authFetch(`/logList/${id}/`, {}, token);
    return data.log;
}
export type CreateLogPayload = {
    essay: String; 
    date: String;
    rating: number; 
    review_text?: string;
    rewatch?: boolean;
}
export async function createLog(
    authFetch: ReturnType<typeof useAuthPost>,
    payload: CreateLogPayload
): Promise<Log> {
    console.log('Creating log with payload:', payload);
    
    const response = await authFetch("/api/logList/", payload);
    console.log(response)
    return response.data; // axios returns data in response.data
}
// export async function createLog(payload: CreateLogPayload): Promise<Log>{
//     // const authFetch = useClerkAuthFetch();
//     console.log(payload)
//     return authFetch("/logList", {
//         method: "POST", 
//         body: JSON.stringify(payload)
//     })
// }
// export const LogAPI = () => {
//     const authFetch = useClerkAuthFetch();
//     const makeLogAPI = (log: CreateLogPayload): Promise<Log> => {
    
//         const Postlog: CreateLogPayload = {
//             essay: log.essay,
//             date: log.date, 
//             rating: log.rating, 
//             review_text: log.review_text, 
//             rewatch: log.rewatch
//         }
//         const CreateLog = async () => {
//             const log = await authFetch(
//                 "/api/logList/", 
//                 Postlog
//             );
//         }
//         return{
//             Postlog
//         }
       
//     }
// }
