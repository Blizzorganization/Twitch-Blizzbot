import { ChatInputCommandInteraction, RESTPostAPIApplicationCommandsJSONBody } from "discord.js";

export interface SlashCommand {
    data: RESTPostAPIApplicationCommandsJSONBody;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
