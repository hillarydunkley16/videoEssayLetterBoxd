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
import { useAuthDelete } from "./authDelete";

export async function fetchLogs(token: string): Promise<PaginatedResponse<Log>> {
    console.log("fetch logs functin called!!!");
  return authFetch("/logList", {}, token);
}
export async function fetchUserLogs(token: string): Promise<PaginatedResponse<Log>> {
    return authFetch(`/userLogs/`, {}, token);
}
export async function likeLog( id: string, authFetch: ReturnType<typeof useAuthPost>,) {
    return authFetch(`/api/logList/${id}/like/`);
}
export type CreateCommentPayLoad = {
    log_id: string, 
    text: string, 
    user: string
}

export async function commentOnLog(log: Log, authFetch: ReturnType<typeof useAuthPost>, payload: CreateCommentPayLoad): Promise<Comment>{
    console.log('Creating comment with payload: ', payload); 
    // const id = log?.public_id
    const response = await authFetch(`/api/logList/${log?.public_id}/comment/`, payload)
    console.log(response); 
    return response.data
}
export async function fetchALog(id: string, token: string): Promise<Log> {
    console.log(`fetching log with this ID:  ${id}`)
    const data = await authFetch(`/logList/${id}/`, {}, token);
    return data.log;
}

export async function deleteLog(id: string, token: string, authFetch: ReturnType<typeof useAuthDelete>){
    console.log(`deleting log with this ID: ${id}`); 
    const response = await authFetch(`/api/logList/${id}/delete`);
    return response; 
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
