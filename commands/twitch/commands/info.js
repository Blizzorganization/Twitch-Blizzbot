const fetch = require("node-fetch")
exports.help = false
exports.run = async (client, target, context, msg, self) => {
  let viewerrequest = await fetch(`https://decapi.me/twitch/viewercount/${target.slice(1)}`)
  let viewer = await viewerrequest.text()
  let followrequest = await fetch(`https://decapi.me/twitch/followcount/${target.slice(1)}`)
  let follow = await followrequest.text()
  let subrequest = await fetch(`https://decapi.me/twitch/subcount/${target.slice(1)}`)
  let sub = await subrequest.text()
  if (viewer == `${target.slice(1)} is offline`) {
    viewer = 0
  }
  client.say(target, `${target.slice(1)} hat  zur Zeit ${viewer} Zuschauer, ${follow} Follower und  ${sub} Subscriber `)
}