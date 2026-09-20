import { VideoEssay } from "./videoEssay";

export interface Collection {
    id: number;
    public_id: string;
    name: string;
    description: string;
    owner: string;        // the owner's username (see CollectionSerializer)
    essays: VideoEssay[];
    is_watchlist: boolean;
}

export interface PaginatedCollections {
    count: number;
    next: string | null;
    previous: string | null;
    results: Collection[];
}
