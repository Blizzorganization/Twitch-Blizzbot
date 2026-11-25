import { PermissionFlagsBits } from "discord.js";
import { config } from "../config.js";

export const P = config.bot.prefix;
export const cn = (s) => s.replace(/^!/, "").toLowerCase();

/** Darf der Nutzer die Verwaltungs-Commands nutzen? s = Discord-Einstellungen des Kanals (Admin-Rolle oder "Server verwalten"). */
export function isAllowed(interaction, s) {
    const roleId = s?.adminRoleId;
    if (roleId && interaction.member?.roles?.cache?.has(roleId)) return true;
    return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}
