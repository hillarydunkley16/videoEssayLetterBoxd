// export function listUsers()
// export function getUsers()
// export function createUser(data)
// export function updateUser(id, data)
// export function getAUser()

import { authFetch } from "./client";
import {User} from "../types/user";
import { PaginatedResponse } from "../types/api";

export async function fetchUsers(): Promise<PaginatedResponse<User>>{
    console.log("fetch users function called?!")
    return authFetch("/users");
} 

export async function fetchAUser(id: number): Promise<User>{
    console.log("get a user function called!!"); 
    return authFetch(`/users/${id}`)
}