const fs = require("fs")
const os = require("os")
const util = require("util")
exports.run = (client, message, args) => {
    var evaled = eval(args.join(" "))
    if (evaled) message.channel.send(evaled)
}