#!node
/* eslint-disable no-console */
import { existsSync, readFileSync, writeFileSync } from "fs";
import lodash from "lodash";
import { EOL } from "os";
import { createInterface } from "readline";
import { promisify } from "util";

const { merge } = lodash;

/**
 * @typedef translations
 * @property {string} welcome
 * @property {string} existing
 * @property {string} confirm
 * @property {string} twitchusername
 * @property {string} twitchpass
 * @property {string} twitchchannels
 * @property {string} permits
 * @property {string} raidduration
 * @property {string} twitchcooldown
 * @property {string} automessagedelay
 * @property {string} twitchclientId
 * @property {string} useDiscord
 * @property {string} setupDiscord
 * @property {string} discordtoken
 * @property {string} discordprefix
 * @property {string} discordwatchtime
 * @property {string} discordevalusers
 * @property {string} discordblchannel
 * @property {string} discordcmdchannel
 * @property {string} discordrelaychannel
 * @property {string} discordadminchannel
 * @property {string} dbpass
 * @property {string} dbhost
 * @property {string} dbname
 * @property {string} dbuser
 * @property {string} yes
 * @property {string} no
 * @property {string} keep
 * @property {string} newValue
 * @property {string} success
 */
/**
 * @typedef all_translations
 * @property {translations} de
 * @property {translations} en
 */
/**
 * @type {all_translations} initStrings
 */
const initStrings = {
    de: {
        welcome:
            "Du hast die Konfiguration auf Deutsch gewählt | If you didn't inted to choose German, please stop the script with ctrl+c and start it again.",
        existing: "Der vorherige Wert war ",
        confirm: "Ist diese Eingabe korrekt?",
        yes: "ja",
        no: "nein",
        keep: "Möchtest du die vorherige Angabe beibehalten?",
        newValue: "Gib den (neuen) Wert an:",
        success: "Die Konfiguration wurde abgeschlossen.",
        twitchusername: "Der Nutzername vom Twitch Bot:",
        twitchpass: "Der OAuth Token vom Twitch Bot:",
        twitchchannels: "Die Twitch Kanäle auf die der Bot reagieren soll (getrennt mit Leerzeichen):",
        permits: "Hier kannst du angeben wie der Bot mit Moderatoren umgehen soll",
        raidduration: "Die Zeit in Minuten, in denen der Follow-Only Modus nach einem Raid deaktiviert wird:",
        twitchcooldown: "Die Zeit in Minuten, wie lange zwischen Befehlen gewartet werden muss:",
        automessagedelay: "Die Zeit in Minuten, wie lange der Bot zwischen automatischen Nachrichten warten soll:",
        twitchclientId: "Die Client ID vom Twitch Bot, notwendig für settitle, setgame:",
        useDiscord: "Möchtest du Discord verwenden?",
        setupDiscord: "Möchtest du Discord trotzdem einrichten?",
        discordtoken:
            "Der Token für den Discord Bot (erhältlich unter https://discord.com/developers/applications/me):",
        discordprefix: "Der Prefix für den Discord Bot:",
        discordwatchtime:
            "Der Twitch Kanal, für den die watchtime abgefragt wird (muss in den Twitch Kanälen enthalten sein)",
        discordevalusers:
            "Welche Nutzer sollen vollständige Rechte auf den Bot haben? - die NutzerIDs mit Leerzeichen getrennt:",
        discordcmdchannel: "Die ID vom Command Channel:",
        discordadminchannel: "Die ID vom Admin Command Channel:",
        discordblchannel: "Die ID vom Blacklist Channel:",
        discordrelaychannel: "Die ID vom Relay Channel (Kanal, dessen Nachrichten zu Twitch übertragen werden sollen):",
        dbhost: "Die IP zum Server auf dem die Datenbank läuft:",
        dbname: "Der Name der Datenbank:",
        dbpass: "Das Passwort für die Datenbank:",
        dbuser: "Der Datenbanknutzer:",
    },
    en: {
        welcome:
            "You chose to do the configuration in English. If you didn't intend to choose English, you can stop the script with ctrl+c and restart it",
        confirm: "Is this okay?",
        existing: "The previous value was ",
        keep: "Do you want to keep the previous value?",
        no: "no",
        yes: "yes",
        newValue: "Please insert the (new) value.",
        success: "successfully created the config.",
        twitchusername: "The username of the twitch bot",
        twitchpass: "the twitch bot oauth token (get it at https://twitchapps.com/tmi/)",
        twitchchannels: "a space separated list of channels the bot should listen to",
        permits: "Here you can specify how the bot should deal with moderators",
        raidduration: "the time a raid removes the follow only mode for",
        twitchcooldown: "the cooldown for chat commands in minutes",
        automessagedelay: "the delay between two automatic messages in minutes",
        twitchclientId: "the client id of the twitch bot (used for !settitle, !setgame)",
        useDiscord: "whether you want to use the discord feature",
        setupDiscord: "do you want to use the discord feature",
        discordtoken: "the discord bot token (get it at https://discord.com/developers/applications/me)",
        discordprefix: "the prefix for the discord bot",
        discordwatchtime:
            "the watchtime channel to use for discord (has to be specified in the twitch channels section)",
        discordevalusers: "the ids of the users that should have complete access on the bot separated by spaces",
        discordcmdchannel: "the id of the discord command channel",
        discordadminchannel: "the id of the discord admin commands channel",
        discordblchannel: "the id of the channel the blacklist is sent to when requested on twitch",
        discordrelaychannel:
            "the id of the channel that allows for messages to be automatically sent to the twitch chat",
        dbhost: "the ip address of the database server",
        dbname: "the name of the database",
        dbpass: "the password for the database user",
        dbuser: "the database username",
    },
};
const supportedLanguages = Object.keys(initStrings);

/** @type {import("./typings/config.js").config} existingconfig*/
let existingconfig = {
    twitch: {
        identity: {
            password: undefined,
            username: undefined,
        },
        Cooldown: undefined,
        permit: undefined,
        Raidminutes: undefined,
        automessagedelay: undefined,
        channels: undefined,
        clientId: undefined,
        connection: {
            reconnect: undefined,
            secure: undefined,
        },
        devs: undefined,
    },
    db: {
        database: undefined,
        host: undefined,
        keepAlive: undefined,
        password: undefined,
        user: undefined,
    },
    useDiscord: undefined,
    discord: {
        channels: {
            adminCommands: undefined,
            blacklist: undefined,
            commands: undefined,
            relay: undefined,
        },
        evalUsers: undefined,
        prefix: undefined,
        token: undefined,
        watchtimechannel: undefined,
    },
};
if (existsSync("./configs/config.json")) {
    const file = readFileSync("./configs/config.json", "utf8");
    const jsonData = JSON.parse(file);
    if (jsonData) existingconfig = merge(existingconfig, jsonData);
}
export const createConfig = async () => {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "> ",
        terminal: true,
    });

    /** @type {(question: string) => Promise<string>} */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const protoQuestion = promisify(rl.question).bind(rl);
    /**
     * @param {string} q
     * @returns {Promise<string>} the answer
     */
    const question = (q) => protoQuestion(`${q}${EOL}`);
    console.log("Welcome to the Twitch Blizzbot configuration guide");
    /** @type {keyof initStrings}*/
    let language;
    while (!supportedLanguages.includes(language)) {
        if (language) console.log(`${language} is not a supported language.`);
        // @ts-expect-error -- as this is a checking loop we are validating that we are using an existing language
        language = (
            await question(
                `Which language do you want to use?${EOL}Following languages are supported:${EOL}en\t\tEnglish${EOL}de\t\tDeutsch`,
            )
        ).toLowerCase();
    }
    console.log(initStrings[language].welcome);

    /**
     * @param  {keyof translations} which which question to ask
     * @param  {(string | number | boolean)} [pre] previous value if exists
     * @returns {Promise<string>} the answer
     */
    async function request(which, pre) {
        let response;
        let confirm = false;
        while (!confirm) {
            console.log(initStrings[language][which]);
            if (pre) {
                console.log(initStrings[language].existing + (typeof pre === "string" ? `"${pre}"` : pre.toString()));
                if (parseBoolean(await question(initStrings[language].keep))) {
                    response = pre.toString();
                    confirm = true;
                } else {
                    response = await question(initStrings[language].newValue);
                    confirm = parseBoolean(await question(initStrings[language].confirm));
                }
            } else {
                response = await question(initStrings[language].newValue);
                confirm = parseBoolean(await question(initStrings[language].confirm));
            }
        }
        return response;
    }
    existingconfig.twitch.connection = {
        reconnect: true,
        secure: true,
    };
    existingconfig.twitch.devs = ["blackdemonfire4", "speed_r"];
    existingconfig.db.keepAlive = true;
    existingconfig.twitch.identity.username = await request("twitchusername", existingconfig.twitch.identity.username);
    existingconfig.twitch.identity.password = await request("twitchpass", existingconfig.twitch.identity.password);
    existingconfig.twitch.channels = (await request("twitchchannels", existingconfig.twitch.channels?.join(" "))).split(
        / +/g,
    );
    existingconfig.twitch.permit = parseBoolean(
        await request(
            "permits",
            typeof existingconfig.twitch.permit === "boolean"
                ? existingconfig.twitch.permit
                    ? initStrings[language].yes
                    : initStrings[language].no
                : undefined,
        ),
    );
    existingconfig.twitch.Raidminutes = parseFloat(await request("raidduration", existingconfig.twitch.Raidminutes));
    existingconfig.twitch.Cooldown = parseInt(await request("twitchcooldown", existingconfig.twitch.Cooldown));
    existingconfig.twitch.automessagedelay = parseInt(await request("automessagedelay"));
    existingconfig.twitch.clientId = await request("twitchclientId", existingconfig.twitch.clientId);
    existingconfig.useDiscord = parseBoolean(
        await request(
            "useDiscord",
            typeof existingconfig.useDiscord === "boolean"
                ? existingconfig.useDiscord
                    ? initStrings[language].yes
                    : initStrings[language].no
                : undefined,
        ),
    );
    if (existingconfig.useDiscord || parseBoolean(await request("setupDiscord", undefined))) {
        existingconfig.discord.token = await request("discordtoken", existingconfig.discord.token);
        existingconfig.discord.prefix = await request("discordprefix", existingconfig.discord.prefix);
        existingconfig.discord.watchtimechannel = await request(
            "discordwatchtime",
            existingconfig.discord.watchtimechannel,
        );
        existingconfig.discord.evalUsers = (
            await request("discordevalusers", existingconfig.discord.evalUsers?.join(" "))
        ).split(" ");
        existingconfig.discord.channels.commands = await request(
            "discordcmdchannel",
            existingconfig.discord.channels.commands,
        );
        existingconfig.discord.channels.adminCommands = await request(
            "discordadminchannel",
            existingconfig.discord.channels.adminCommands,
        );
        existingconfig.discord.channels.blacklist = await request(
            "discordblchannel",
            existingconfig.discord.channels.blacklist,
        );
        existingconfig.discord.channels.relay = await request(
            "discordrelaychannel",
            existingconfig.discord.channels.relay,
        );
    }
    existingconfig.db.host = await request("dbhost", existingconfig.db.host);
    existingconfig.db.database = await request("dbname", existingconfig.db.database);
    existingconfig.db.user = await request("dbuser", existingconfig.db.user);
    existingconfig.db.password = await request("dbpass", existingconfig.db.password);
    writeData();
    rl.close();
    console.log(initStrings[language].success);
};
const writeData = () => writeFileSync("./configs/config.json", JSON.stringify(existingconfig, undefined, 4), "utf8");

/**
 * @param {string} response
 * @returns {boolean|null} the parsed boolean or null if not a boolean
 */
function parseBoolean(response) {
    response = response.toLowerCase();
    if (["y", "j", "yes", "ja", "nya", "jup", "true"].includes(response)) return true;
    if (["n", "no", "nein", "ne", "nö", "nah", "nop", "nou", "false"].includes(response)) return false;
    return null;
}
if (process.argv[1].endsWith("setup.js") || process.argv[1].endsWith("setup")) {
    process.on("exit", writeData);
    await createConfig();
}
(() => {
    if (!existsSync("configs/automessages.json")) {
        writeFileSync("configs/automessages.json", '{"channelname": ["message"]}');
        return console.log("You should fill in the automessages.json");
    }
})();
