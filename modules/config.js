import { existsSync, readFileSync } from "fs";
import { logger } from "twitch-blizzbot/logger";
import { z } from "zod";

const DiscordSchema = z.object({
    token: z.string(),
    prefix: z.string(),
    watchtimechannel: z.string(),
    evalUsers: z.array(z.string()),
    channels: z.object({
        blacklist: z.string().regex(/\d+/),
        commands: z.string().regex(/\d+/),
        relay: z.string().regex(/\d+/),
        adminCommands: z.string().regex(/\d+/),
    }),
});
const TwitchSchema = z.object({
    identity: z.object({
        username: z.string(),
        password: z.string(),
    }),
    connection: z.object({
        reconnect: z.boolean().default(true),
        secure: z.boolean().default(true),
    }),
    permit: z.boolean(),
    Raidminutes: z.number(),
    Cooldown: z.number(),
    automessagedelay: z.number(),
    clientId: z.string(),
    channels: z.array(z.string()),
    devs: z.array(z.string()),
});
const DatabaseSchema = z.object({
    host: z.string(),
    database: z.string(),
    port: z.number().int().nonnegative().lte(65535).default(5432),
    keepAlive: z.boolean(),
    user: z.string(),
    password: z.string(),
});

const ConfigSchema = z.object({
    discord: DiscordSchema.optional(),
    useDiscord: z.boolean().default(false),
    twitch: TwitchSchema,
    db: DatabaseSchema,
});
const EnvConfigSchema = z
    .object({
        DISCORD_TOKEN: z.string(),
        DISCORD_PREFIX: z.string(),
        DISCORD_WATCHTIME_CHANNEL: z.string(),
        DISCORD_EVAL_USERS: z
            .string()
            .transform((arg) => arg.split(","))
            .pipe(z.string().regex(/\d+/)),
        DISCORD_BLACKLIST_CHANNEL: z.string().regex(/\d+/),
        DISCORD_COMMANDS_CHANNEL: z.string().regex(/\d+/),
        DISCORD_RELAY_CHANNEL: z.string().regex(/\d+/),
        DISCORD_ADMIN_COMMANDS_CHANNEL: z.string().regex(/\d+/),
        USE_DISCORD: z.coerce.boolean().default(false),
        TWITCH_USERNAME: z.string(),
        TWITCH_PASSWORD: z.string(),
        TWITCH_RECONNECT: z.coerce.boolean().default(true),
        TWITCH_CONNECTION_SECURE: z.coerce.boolean().default(true),
        TWITCH_PERMIT: z.coerce.boolean(),
        TWITCH_RAID_MINUTES: z.coerce.number(),
        TWITCH_COOLDOWN: z.coerce.number(),
        TWITCH_AUTO_MESSAGE_DELAY: z.coerce.number(),
        TWITCH_CLIENT_ID: z.string(),
        TWITCH_DEVS: z.string().transform((arg) => arg.split(",")),
        TWITCH_CHANNELS: z.string().transform((arg) => arg.split(",")),
        DB_HOST: z.string(),
        DB_NAME: z.string(),
        DB_PORT: z.coerce.number().int().nonnegative().lte(65535).default(5432),
        DB_USER: z.string(),
        DB_PASS: z.string(),
        DB_KEEP_ALIVE: z.coerce.boolean(),
    })
    .transform((envConfig) => ({
        useDiscord: envConfig.USE_DISCORD,
        discord: {
            token: envConfig.DISCORD_TOKEN,
            prefix: envConfig.DISCORD_PREFIX,
            watchtimechannel: envConfig.DISCORD_WATCHTIME_CHANNEL,
            evalUsers: envConfig.DISCORD_EVAL_USERS,
            channels: {
                blacklist: envConfig.DISCORD_BLACKLIST_CHANNEL,
                commands: envConfig.DISCORD_COMMANDS_CHANNEL,
                relay: envConfig.DISCORD_RELAY_CHANNEL,
                adminCommands: envConfig.DISCORD_ADMIN_COMMANDS_CHANNEL,
            },
        },
        twitch: {
            identity: {
                username: envConfig.TWITCH_USERNAME,
                password: envConfig.TWITCH_PASSWORD,
            },
            connection: {
                reconnect: envConfig.TWITCH_RECONNECT,
                secure: envConfig.TWITCH_CONNECTION_SECURE,
            },
            channels: envConfig.TWITCH_CHANNELS,
            permit: envConfig.TWITCH_PERMIT,
            Raidminutes: envConfig.TWITCH_RAID_MINUTES,
            Cooldown: envConfig.TWITCH_COOLDOWN,
            automessagedelay: envConfig.TWITCH_AUTO_MESSAGE_DELAY,
            clientId: envConfig.TWITCH_CLIENT_ID,
            devs: envConfig.TWITCH_DEVS,
        },
        db: {
            host: envConfig.DB_HOST,
            port: envConfig.DB_PORT,
            database: envConfig.DB_NAME,
            keepAlive: envConfig.DB_KEEP_ALIVE,
            user: envConfig.DB_USER,
            password: envConfig.DB_PASS,
        },
    }));

/**
 * parse config from configs/config.json
 * @returns {unknown}
 */
export function parseConfig() {
    if (existsSync("configs/config.json")) {
        let configJson;
        try {
            configJson = readFileSync("configs/config.json", "utf-8");
        } catch (e) {
            logger.error("failed to read the config.json:", e);
            throw e;
        }
        const conf = ConfigSchema.parse(JSON.parse(configJson));
        if (conf.useDiscord && !conf.discord)
            throw new Error("config.json is missing the discord property (required when useDiscord is true)");
        return conf;
    }
    return parseEnvConfig();
}

/**
 * Parse configuration from environement
 * @returns {z.infer<typeof EnvConfigSchema>}
 */
function parseEnvConfig() {
    const cfg = EnvConfigSchema.parse(process.env);
    if (cfg.useDiscord && !cfg.discord)
        throw new Error("opted in to using discord using ENV Variables but did not supply discord configurations.");
    return cfg;
}
