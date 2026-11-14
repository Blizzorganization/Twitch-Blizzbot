import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { PERMISSION_NAMES } from "../config.js";

const permChoices = Object.values(PERMISSION_NAMES).map((n) => ({ name: n, value: n }));
const channelOpt = (o) => o.setName("channel").setDescription("Twitch-Kanal (Standard: konfigurierter Kanal)").setRequired(false);

/* ------------------------------ Slash-Commands ------------------------------ */

/** Verwaltung – nur für "Server verwalten" bzw. die Admin-Rolle */
export const adminDefs = [
    new SlashCommandBuilder()
        .setName("add")
        .setDescription("Hinzufügen: Command, Alias oder Blacklist-Wort")
        .addSubcommand((sc) => sc.setName("command").setDescription("Custom Command hinzufügen")
            .addStringOption((o) => o.setName("name").setDescription("Name ohne !").setRequired(true))
            .addStringOption((o) => o.setName("antwort").setDescription("Antworttext").setRequired(true))
            .addStringOption((o) => o.setName("berechtigung").setDescription("Wer darf den Command nutzen?").addChoices(...permChoices))
            .addIntegerOption((o) => o.setName("cooldown").setDescription("Cooldown in Sekunden").setMinValue(0))
            .addStringOption(channelOpt))
        .addSubcommand((sc) => sc.setName("alias").setDescription("Alias für einen Command anlegen")
            .addStringOption((o) => o.setName("command").setDescription("Ziel-Command ohne !").setRequired(true))
            .addStringOption((o) => o.setName("alias").setDescription("Neuer Alias ohne !").setRequired(true))
            .addStringOption(channelOpt))
        .addSubcommand((sc) => sc.setName("blacklist").setDescription("Wort zur Blacklist hinzufügen (0 löschen, 1-9 Timeout, 10 Bann)")
            .addStringOption((o) => o.setName("wort").setDescription("Wort oder Phrase").setRequired(true))
            .addIntegerOption((o) => o.setName("aktion").setDescription("0-10").setMinValue(0).setMaxValue(10).setRequired(true))
            .addStringOption(channelOpt)),
    new SlashCommandBuilder()
        .setName("edit")
        .setDescription("Ändern: Command oder Blacklist-Aktion")
        .addSubcommand((sc) => sc.setName("command").setDescription("Custom Command ändern")
            .addStringOption((o) => o.setName("name").setDescription("Name ohne !").setRequired(true))
            .addStringOption((o) => o.setName("antwort").setDescription("Neuer Antworttext"))
            .addStringOption((o) => o.setName("berechtigung").setDescription("Neue Berechtigung").addChoices(...permChoices))
            .addIntegerOption((o) => o.setName("cooldown").setDescription("Neuer Cooldown in Sekunden").setMinValue(0))
            .addStringOption(channelOpt))
        .addSubcommand((sc) => sc.setName("blacklist").setDescription("Aktion eines Blacklist-Worts ändern (0 löschen, 1-9 Timeout, 10 Bann)")
            .addStringOption((o) => o.setName("wort").setDescription("Wort oder Phrase").setRequired(true))
            .addIntegerOption((o) => o.setName("aktion").setDescription("0-10").setMinValue(0).setMaxValue(10).setRequired(true))
            .addStringOption(channelOpt)),
    new SlashCommandBuilder()
        .setName("del")
        .setDescription("Löschen: Command, Alias oder Blacklist-Wort")
        .addSubcommand((sc) => sc.setName("command").setDescription("Custom Command löschen")
            .addStringOption((o) => o.setName("name").setDescription("Name ohne !").setRequired(true))
            .addStringOption(channelOpt))
        .addSubcommand((sc) => sc.setName("alias").setDescription("Alias löschen")
            .addStringOption((o) => o.setName("alias").setDescription("Alias ohne !").setRequired(true))
            .addStringOption(channelOpt))
        .addSubcommand((sc) => sc.setName("blacklist").setDescription("Wort von der Blacklist entfernen")
            .addStringOption((o) => o.setName("wort").setDescription("Wort oder Phrase").setRequired(true))
            .addStringOption(channelOpt)),
    new SlashCommandBuilder()
        .setName("view")
        .setDescription("Zeigt den vollständigen Antworttext eines Custom Commands an")
        .addStringOption((o) => o.setName("name").setDescription("Name ohne !").setRequired(true))
        .addStringOption(channelOpt),
    new SlashCommandBuilder().setName("commands").setDescription("Übersicht: Commands, Mod-Commands, Aliase und Zähler").addStringOption(channelOpt),
    new SlashCommandBuilder().setName("aliase").setDescription("Alle Aliase auflisten").addStringOption(channelOpt),
    new SlashCommandBuilder().setName("blacklist").setDescription("Blacklist anzeigen").addStringOption(channelOpt),
    new SlashCommandBuilder()
        .setName("addmod")
        .setDescription("Nutzer als Verify-Mod eintragen (darf Mod-Commands des Bots nutzen)")
        .addStringOption((o) => o.setName("name").setDescription("Twitch-Name").setRequired(true))
        .addStringOption(channelOpt),
    new SlashCommandBuilder()
        .setName("delmod")
        .setDescription("Verify-Mod wieder austragen")
        .addStringOption((o) => o.setName("name").setDescription("Twitch-Name").setRequired(true))
        .addStringOption(channelOpt),
    new SlashCommandBuilder().setName("mods").setDescription("Verify-Mods anzeigen").addStringOption(channelOpt),
].map((c) => c.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).toJSON());

/** Für alle Mitglieder – wie die slash-Commands des alten Bots */
export const publicDefs = [
    new SlashCommandBuilder()
        .setName("watchtime")
        .setDescription("Watchtime")
        .addStringOption((o) => o.setName("twitchuser").setDescription("Twitch-Username eines Nutzers"))
        .addUserOption((o) => o.setName("user").setDescription("Ein Nutzer, wenn nicht du gemeint sein sollst"))
        .addBooleanOption((o) => o.setName("monat").setDescription("Nur den aktuellen Monat anzeigen")),
    new SlashCommandBuilder()
        .setName("profil")
        .setDescription("Zeigt Level und Punkte")
        .addStringOption((o) => o.setName("twitchuser").setDescription("Twitch-Username eines Nutzers"))
        .addUserOption((o) => o.setName("user").setDescription("Ein Nutzer, wenn nicht du gemeint sein sollst")),
    new SlashCommandBuilder().setName("top10").setDescription("Watchtime Ranking"),
    new SlashCommandBuilder()
        .setName("link")
        .setDescription("Verknüpfe deinen Twitch Account mit deinem Discord Account")
        .addStringOption((o) => o.setName("name").setDescription("Twitch Username").setRequired(true)),
    new SlashCommandBuilder()
        .setName("zitat")
        .setDescription("Zeigt ein Zitat an (zufällig oder mit Nummer)")
        .addIntegerOption((o) => o.setName("nummer").setDescription("Nummer des Zitats (ohne Angabe: zufällig)").setMinValue(1)),
    new SlashCommandBuilder().setName("unlink").setDescription("Entferne die Verknüpfung zu deinem Twitch Account"),
    new SlashCommandBuilder()
        .setName("info")
        .setDescription("Frage einen Twitch Username ab")
        .addUserOption((o) => o.setName("user").setDescription("Ein Nutzer, wenn nicht du gemeint sein sollst")),
].map((c) => c.toJSON());

export const ADMIN_NAMES = new Set(adminDefs.map((d) => d.name));
// Diese Verwaltungs-Commands antworten sichtbar im Kanal statt "versteckt" (ephemeral), damit andere
// Moderatoren mitbekommen, wenn ein Command/Alias/Blacklist-Eintrag angelegt/geändert/gelöscht wird
// oder jemand sich die Übersicht ansieht.
export const PUBLIC_REPLY_NAMES = new Set(["add", "edit", "del", "view", "commands", "addmod", "delmod"]);
