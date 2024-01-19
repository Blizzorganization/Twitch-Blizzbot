import { Snowflake } from "discord.js";

export type config = {
    twitch: {
        identity: {
            username: string; //the twitch bot username
            password: string; //the twitch bot oauth token
        };
        connection: {
            reconnect: boolean; //whether the twitch bot should reconnect after losing connection
            secure: boolean; //whether to use a secure connection for the twitch bot
        };
        channels: string[]; //the channels the twitch bot should listen to
        permit: boolean; //moderatorsaction
        Raidminutes: number; //how many minutes of follow-only off a raid should grant
        Cooldown: number; //how much time users have to wait between commands
        automessagedelay: number; //the frequency of posted automessages
        clientId: string; //the clientid of the bot for use with the twitch api
        devs: string[]; //the names of the developers (they are granted all permissions)
    };
    useDiscord: boolean; //whether to use the discord bot feature
    discord?: {
        token: string;
        prefix: string;
        watchtimechannel: string;
        evalUsers: string[];
        channels: {
            blacklist: Snowflake;
            commands: Snowflake;
            relay: Snowflake;
            adminCommands: Snowflake;
        };
    };
    db: {
        keepAlive: boolean;
        host: string;
        database: string;
        user: string;
        password: string;
    };
};
