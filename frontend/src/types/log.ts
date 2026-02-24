import { VideoEssay } from "./videoEssay"
import {User} from "./user"
export interface Log {
    // "id": number,
    id: number;
    public_id: string; 
    date: string;
    essay: string;
    essay_details: VideoEssay
    review_text: string | null;
    rating: number;
    rewatch: boolean;
    owner: User;
}

// "id",
// "public_id",
// "date",
// "essay",
// "essay_details",  # Optional
// "review_text",
// "rating",
// "rewatch",
// "owner",xw