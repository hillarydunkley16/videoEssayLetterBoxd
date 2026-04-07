import { User } from "./user";
import { Log } from "./log";
export interface Comment {
    user: string,
    date: Date,
    log: string, 
    text: string, 
    id: number
}