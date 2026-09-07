import { VideoEssayData} from "./videoEssay";
import { User } from "./user";

export interface Collection {
    id: number; 
    public_id: string;
    name: string; 
    owner: User; 
    essays: VideoEssayData[];
}

export interface PaginatedCollections {
    count: number;
    next: string | null;
    previous: string | null;
    results: Collection[];
}
