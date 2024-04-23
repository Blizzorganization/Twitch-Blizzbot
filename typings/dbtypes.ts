import { Snowflake } from "discord.js";
import { PoolConfig } from "pg";

export interface Counter {
    channel: string;
    name: string;
    cur: number;
    inc: number;
}

export interface CustomCommand {
    command: string;
    response: string;
    permissions: number;
}
export interface streamer {
    name: string;
    automessage: boolean;
}
export interface Watchtime {
    channel: string;
    viewer: string;
    watchtime: number;
    month: "alltime" | `${number}`;
}
export interface Alias {
    alias: string;
    channel: string;
    command: string;
}
export interface Userlink {
    discordid: Snowflake;
    twitchname: string;
}
export interface Blacklist {
    channel: string;
    blword: string;
    action: number;
}
export interface Config extends PoolConfig {}
export interface ResolvedAlias {
    alias: string;
    command: string;
    response: string;
    permissions: number;
}
export interface Command {
    channel: string;
    command: string;
    permission: number;
    enabled: boolean;
}
