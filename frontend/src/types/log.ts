import { VideoEssay } from "./videoEssay"
import {User} from "./user"
import { Comment } from "./comment";
import { Like } from "./like";
import { Profile } from "./profile";
export interface Log {
    // "id": number,
    id: number;
    public_id: string; 
    date: Date;
    essay: string;
    essay_details: VideoEssay
    review_text: string | null;
    rating: number;
    rewatch: boolean;
    owner: string;        // just a username string
    owner_id: number;     // the numeric Django ID
    is_mine: boolean;     // whether the signed-in viewer owns this log (computed by the backend)
    is_liked: boolean;    // whether the signed-in viewer has liked this log (computed by the backend)
    owner_image: string | null;  // the profile image URL
    likes: Like[];
    comments: Comment[]
}

