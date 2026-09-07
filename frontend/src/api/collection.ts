import { Collection, PaginatedCollections } from "../types/collection";
import { authFetch } from "./client";

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

export async function fetchACollection(public_id: string, token: string) {
    console.log(`THIS IS WHAT FETCH A COLLECTION IS TAKING IN ${public_id}`)
    return authFetch(`/collections/${public_id}/`, {}, token) 
}