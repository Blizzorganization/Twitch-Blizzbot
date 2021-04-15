exports.run = async (clients, args) => {
    await clients.stop()
    process.exit(0)
}