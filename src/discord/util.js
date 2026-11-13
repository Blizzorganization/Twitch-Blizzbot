import { PermissionFlagsBits } from "discord.js";
import { config } from "../config.js";

export const P = config.bot.prefix;
export const cn = (s) => s.replace(/^!/, "").toLowerCase();

export function isAllowed(interaction) {
    const { adminRoleId } = config.discord;
    if (adminRoleId && interaction.member?.roles?.cache?.has(adminRoleId)) return true;
    return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}
