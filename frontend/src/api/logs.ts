// fetch logs 
// fetch log details 
// create log 
// update log 
import { authFetch } from "./client";
import { Log } from "../types/log";
import { PaginatedResponse } from "../types/api";
import { VideoEssay } from "../types/videoEssay";
import { useClerkAuthFetch } from "./authFetch";
export async function fetchLogs(): Promise<PaginatedResponse<Log>> {
    console.log("fetch logs functin called!!!");
  return authFetch("/logList");
}

// export async function fetchALog()
export async function fetchALog(id: string): Promise<Log> {
    console.log(`fetching ${id}`)
    return authFetch(`/logList/${id}`);
}
export type CreateLogPayload = {
    essay: String; 
    date: String;
    rating: number; 
    review_text?: string;
    rewatch?: boolean;
}
export async function createLog(payload: CreateLogPayload): Promise<Log>{

    console.log(payload)
    return authFetch("/logList", {
        method: "POST", 
        body: JSON.stringify(payload)
    })
}
export const makeLogAPI = (log: CreateLogPayload) => {
    const authFetch = useClerkAuthFetch();
    const Postlog: CreateLogPayload = {
        essay: log.essay,
        date: log.date, 
        rating: log.rating, 
        review_text: log.review_text, 
        rewatch: log.rewatch
    }
    const CreateLog = async () => {
        const log = await authFetch(
            "/api/logList/", 
            Postlog
        );
    }
    return {CreateLog};
}