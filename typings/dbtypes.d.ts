import { Snowflake } from "discord.js";
import { PoolConfig } from "pg";

type d = 1|2|3|4|5|6|7|8|9|0;
type mon = `${d}${d}`;
type year = `${d}${d}${d}${d}`
export interface Counter {
    channel: string
    name: string
    cur: number
    inc: number
}

export interface CustomCommand {
    command: string
    response: string
    permissions: number
}
export interface streamer {
    name: string
    automessage: boolean
}
export interface Watchtime {
    channel: string
    viewer: string
    watchtime: number
    month: "alltime"|`${mon}-${year}`
}
export interface Alias {
    alias: string
    channel: string
    command: string
}
export interface Userlink {
    discordid: Snowflake
    twitchname: string
}
export interface Blacklist {
    channel: string
    blwords: string[]
    action: number
}
export interface Config extends PoolConfig {}
export interface resolvedAlias {
    alias: string
    command: string
    response: string
    permissions: number
}