const fetch = require("node-fetch")
exports.help = false
exports.run = async (client, target, context, msg, self) => {
  let viewerrequest = await fetch("https://decapi.me/twitch/viewercount/blizzor96")
  let viewer = await viewerrequest.text()
  let followrequest = await fetch("https://decapi.me/twitch/followcount/blizzor96")
  let follow = await followrequest.text()
  let subrequest = await fetch("https://decapi.me/twitch/subcount/blizzor96")
  let sub = await subrequest.text()
  if (viewer == "blizzor96 is offline") {
    viewer = 0
  }
  client.say(target, `Blizzor hat  zur Zeit ${viewer} Zuschauer, ${follow} Follower und  ${sub} Subscriber `)
}