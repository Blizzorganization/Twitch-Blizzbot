const { MessageEmbed } = require("discord.js");
const { time } = require("twitch-blizzbot/functions");

module.exports = {
    data: {
        name: "twitchname",
        description: "Frage einen twitch username ab",
        type: 1,
        options: [{
            type: 6,
            name: "user",
            description: "Ein Nutzer, wenn nicht du gemeint sein sollst",
            required: false,
        }],
    },
    /**
     * @param  {import("discord.js").CommandInteraction} interaction
     */
    execute: async (interaction) => {
        const fetch = (await import("node-fetch")).default;
        /** @type {import("twitch-blizzbot/discordclient").DiscordClient}*/
        // @ts-ignore
        const client = interaction.client;
        const dcuser = interaction.options.getUser("user") || interaction.user;
        const twuser = await client.clients.db.getDiscordConnection(dcuser);
        if (!twuser) return interaction.reply(`Der Nutzer ${dcuser.tag} hat keinen Namen hinterlegt.`);
        const channel = client.config.watchtimechannel;
        const resp = await fetch(`https://decapi.me/twitch/accountage/${twuser}`);
        const age = time(await resp.text());
        const res = await fetch(`https://decapi.me/twitch/followage/${channel}/${twuser}`);
        const fage = time(await res.text());
        const embed = new MessageEmbed()
            .setColor(0xedbc5d)
            .setThumbnail(dcuser.avatarURL())
            .setTitle("**__Linkinginfo__**")
            .addField("Discord-name", dcuser.username)
            .addField("Twitch-name", twuser)
            .addField("__Der Twitchaccount wurde erstellt vor__", age)
            .addField("__Folgt schon__", fage);

        await interaction.reply({ embeds: [embed] });
    },
};