import { Collection, PaginatedCollections } from "../types/collection";
import { authFetch } from "./client";
import { useAuthPost } from "./authPost";
import { useAuthDelete } from "./authDelete";

export async function fetchCollections(token: string): Promise<Collection[]> {
    return authFetch("/collections/", {}, token);
}

export async function addVideoEssayToCollection(token: string, VE_public_id: string, collection_public_id: string): Promise<Collection>{
    console.log(`Video Essay PUBLIC ID ${VE_public_id}`)
    console.log(`collection public id: ${collection_public_id}`)
    return authFetch(`/collections/${collection_public_id}/add/${VE_public_id}/`, {}, token);
}

export async function  fetchUsersCollections(token: string) {
    return authFetch("/collections/user/", {}, token);
}

export async function fetchACollection(public_id: string, token: string): Promise<Collection> {
    console.log(`THIS IS WHAT FETCH A COLLECTION IS TAKING IN ${public_id}`)
    return authFetch(`/collections/${public_id}/`, {}, token)
}

export type CreateCollectionPayload = {
    name: string;
    description?: string;
}

export async function createCollection(
    payload: CreateCollectionPayload,
    authFetch: ReturnType<typeof useAuthPost>
): Promise<Collection> {
    const response = await authFetch("/api/collections/", payload);
    return response.data;
}

export async function deleteCollection(
    collectionPublicId: string,
    authFetch: ReturnType<typeof useAuthDelete>
) {
    return authFetch(`/api/collections/${collectionPublicId}/remove/`);
}

// The add/remove collection endpoints are POST/DELETE, so unlike the
// token-based helpers above these go through the useAuthPost/useAuthDelete
// hooks (same pattern as likeLog/followUser in logs.ts and users.ts).
export async function addToWatchlist(
    essayPublicId: string,
    watchlistPublicId: string,
    authFetch: ReturnType<typeof useAuthPost>
) {
    return authFetch(`/api/collections/${watchlistPublicId}/add/${essayPublicId}/`);
}

export async function removeFromWatchlist(
    essayPublicId: string,
    watchlistPublicId: string,
    authFetch: ReturnType<typeof useAuthDelete>
) {
    return authFetch(`/api/collections/${watchlistPublicId}/remove/${essayPublicId}/`);
}