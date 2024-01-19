import { ChatUserstate } from "tmi.js";
import { permissions } from "twitch-blizzbot/constants";
import { TwitchClient } from "twitch-blizzbot/twitchclient";

export interface TwitchCommand {
    run(
        client: TwitchClient,
        target: string,
        context: ChatUserstate,
        msg: string,
        self: boolean,
        args: string[],
    ): Promise<void>;
    help: boolean;
    perm: (typeof permissions)[keyof typeof permissions];
    alias: string[];
    silent?: boolean;
}
