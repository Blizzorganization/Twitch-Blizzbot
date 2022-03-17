import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { logger } from "./logger.js";
/**
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Snowflake} guildid
 */
export default async function(client, guildid) {
    const commands = client.slashcommands.map(({ data }) => data);

    const rest = new REST({ version: "9" }).setToken(client.token);
    try {
        logger.debug("Started refreshing application (/) commands.");

        logger.silly(await rest.put(
            Routes.applicationGuildCommands(client.user.id, guildid),
            { body: commands },
        ));
        logger.info("Successfully reloaded application (/) commands.");
        logger.log("debug", await rest.get(Routes.applicationGuildCommands(client.application.id || client.user.id, guildid)));
    } catch (error) {
        logger.error(error.message);
    }
}