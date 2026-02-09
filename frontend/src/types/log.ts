import { VideoEssay } from "./videoEssay"
import {User} from "./user"
export interface Log {
    // "id": number, 
    "date": string, 
    "essay": VideoEssay,
    "review_text": string | null, 
    "rating": number, 
    "rewatch": boolean, 
    "owner": User,
}