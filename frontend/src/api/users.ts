// export function listUsers()
// export function getUsers()
// export function createUser(data)
// export function updateUser(id, data)
// export function getAUser()

import { authFetch } from "./client";
import {User} from "../types/user";
import { PaginatedResponse } from "../types/api";
import { useAuthUpdate } from "./authUpdate";
import { UrlObject } from "expo-router/build/global-state/routeInfo";
import { Profile } from "../types/profile";
export async function fetchUsers(): Promise<PaginatedResponse<User>>{
    console.log("fetch users function called?!")
    return authFetch("/users");
} 

export async function fetchAUser(id: number): Promise<User>{
    console.log("get a user function called!!"); 
    return authFetch(`/users/${id}`)
}
export async function fetchProfile( token: string): Promise<Profile>{
    console.log("fetch profile"); 
    const response = await authFetch(`/users/profile`, {}, token)
    return response
}
export async function fetchAProfileById(id: number, token: string): Promise<Profile>{
    console.log("fetch a profile by id: ", id); 
    const response = await authFetch(`/users/profile/${id}/`, {}, token)
    return response
}
export async function updateProfileImageAPI( imageUrl: string,  authFetch: ReturnType<typeof useAuthUpdate>){
    console.log("UPDATE user PROFILE IMAGE");
    const response = await authFetch(`/api/users/updatePic`, {imageUrl});
    return response;
}