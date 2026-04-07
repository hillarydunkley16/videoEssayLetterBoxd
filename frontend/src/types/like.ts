import { User } from "./user";
import { Log } from "./log";
import { Profile } from "./profile";
export interface Like{
    id: number,
    user: Profile,
    date: Date,
    log: Log,  
}