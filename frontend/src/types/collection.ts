import { VideoEssay } from "./videoEssay";

export interface Collection {
    id: number;
    public_id: string;
    name: string;
    description: string;
    owner: string;        // the owner's display username (see CollectionSerializer)
    is_owner: boolean;    // whether the signed-in viewer owns this collection (computed by the backend)
    essays: VideoEssay[];
    is_watchlist: boolean;
}

export interface PaginatedCollections {
    count: number;
    next: string | null;
    previous: string | null;
    results: Collection[];
}
