const fs = require("fs")
const os = require("os")
const util = require("util")
exports.run = (client, message, args) => {
    message.channel.send(eval(args.join(" ")))
}