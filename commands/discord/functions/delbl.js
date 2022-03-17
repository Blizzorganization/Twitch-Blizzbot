import lodash from "lodash";
import { logger } from "twitch-blizzbot/logger";

const { find, findKey } = lodash;

export const adminOnly = true;
/**
 * @name delbl
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
export async function run(client, message, args) {
    if (!args || args.length == 0) return message.channel.send("Du musst angeben, was du von der Blacklist entfernen willst!");
    const blremove = args.join(" ").toLowerCase();
    const blacklists = client.clients.twitch.blacklist[client.config.watchtimechannel];
    const blacklist = find(blacklists, (bl) => bl.includes(blremove));
    const blacklistName = findKey(blacklists, (bl) => bl.includes(blremove));
    if (!blacklist) return message.channel.send({ content: `"${blremove}" ist in keiner Blacklist vorhanden, kann also auch nicht aus der Blacklist entfernt werden.` });
    client.clients.twitch.blacklist[client.config.watchtimechannel][blacklistName] = blacklist.filter(b => b !== blremove);
    await client.clients.db.saveBlacklist();
    message.channel.send(`"${blremove}" wurde von der Blacklist vom Channel ${client.config.watchtimechannel} entfernt`);
    logger.info(`* Removed "${blremove}" from Blacklist of ${client.config.watchtimechannel}`);
}