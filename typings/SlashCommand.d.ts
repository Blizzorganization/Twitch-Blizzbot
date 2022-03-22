import { RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v9";
import { CommandInteraction } from "discord.js";

export interface SlashCommand {
    data: RESTPostAPIApplicationCommandsJSONBody
    execute(interaction: CommandInteraction)
}