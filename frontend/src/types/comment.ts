import { User } from "./user";
import { Log } from "./log";
export interface Comment {
    user: string,
    is_mine: boolean,   // whether the signed-in viewer wrote it (computed by the backend)
    date: Date,
    log: string, 
    text: string, 
    id: number
}