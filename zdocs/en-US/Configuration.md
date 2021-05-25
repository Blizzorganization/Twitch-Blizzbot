# Configuration from bot

## Twitch

### Enter the data for the bot

```
username -> Here you enter the bot's username as it should be displayed
password -> Here you enter the OAuth token of the account as which the bot should work - important here
            just have to specify what is behind oauth. stands

channels -> Here you specify on which Twitchchanel the bot should work
```
### Cooldowns

#### Raidminutes

```
Here you can find the number of minutes for how long the raid mode should be active
it means how much time between activating and deactivating passes
```
#### Cool down

```
Here you can specify how much time in seconds must pass for the bot to open again
a programmed command reacts (e.g. followage, age, watchtime)
```
### Links are allowed

```
To activate selected links in your chat just write in the links.txt the pages
    e.g. clips.twitch.tv
```
## Discord

### Basics

```
Token ->
Here the Discord token is specified with which the bot should interact on Discord

Prefix ->
The prefix with which the bot interacts on Discord is specified here (e.g.! Top10)
    
```
### Watch time function on the Discord

```
watchtimechannel -> Here you have to enter the name from the Twitch part where the bot works
```
### Eval User

```
evalUsers -> Here you have to specify the user ID which Discord user should have all rights to the bot
    e.g. ["523963492408229888", "523963492408229888"]
```
**So you can run remote code and you have to be careful who has access, <br>
because you have access to all data from the bot and the host system**

### Channel

```
blacklist -> The channel in which the blacklist is displayed is specified here

commands -> In this channel the commands !top10 and !watchtime

relay -> Everything that is written in this channel is written as a bot in the Twitchchannel

adminCommands -> All moderation commands can be executed in the channel (!addbl, !delbl, !blacklist, !eval, !mwatchtime)
```