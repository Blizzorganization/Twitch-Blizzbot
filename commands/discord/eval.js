module.exports = (client, message, args) => {
    message.channel.send(eval(args.join(" ")))
}