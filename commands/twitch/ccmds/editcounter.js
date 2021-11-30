exports.help = false;
exports.perm = true;
/**
 * @name editcounter
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
exports.run = async (client, target, context, msg, self, args) => {
    const user = context["display-name"];
    if (!args) return client.say(target, "Welchen Zähler möchtest du bearbeiten?");
    if (args.length == 3) {
        const name = args.shift();
        const counter = await client.clients.db.readCounter(target, name);
        const field = args.shift().toLowerCase();
        const value = args.shift();
        if (!counter) return client.say(target, `Ich kenne keinen Zähler ${name}.`);
        let num = undefined;
        try {
            num = parseInt(value);
        } catch (e) {
            client.say(target, "Dein Letztes Argument muss eine Ganzzahl sein.");
        }
        switch (field) {
            case "inc":
            case "increase":
            case "erhöhung":
                await client.clients.db.editCounter(target, name, num);
                break;
            case "val":
            case "value":
            case "wert":
                await client.clients.db.setCounter(target, name, num);
                break;
            default:
                client.say(target, "Mögliche Aktionen sind `val` und `inc`.");
                return;
        }
        client.say(target, `${user} Zähler ${name} wurde bearbeitet.`);
        client.clients.logger.log("command", `* Edited Counter ${name}`);
    } else {
        client.say(target, "Du musst angeben, welchen Zähler du bearbeiten willst, ob du den Wert oder die Erhöhung ändern willst und auf welchen Wert du dies anpassen willst.");
    }
};