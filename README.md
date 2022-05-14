# Twitch-Blizzbot
### A Twitch bot developed for the streamer [Blizzor](https://twitch.tv/blizzor)

This bot is capable of handling [Twitch](https://twitch.tv) and [Discord](https://discord.com) features.

# Installation
Prequisites:
> This bot runs on node.js and uses the tmi.js and Discord.js library.  It uses a Postgresql database as a back-end.

It requires the following: 

- `git` command line ([Windows](https://git-scm.com/download/win)|[Linux](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)|[MacOS](https://git-scm.com/download/mac)) installed
- [Nodejs 16.0.0 or higher](http://nodejs.org/)
- A Postgres instance. The installation for Windows and MacOS is found at [Installation Guide](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads), for Linux use your package manager.
<details>
<summary>example for Debian+Ubuntu</summary>

```zsh
# Create the file repository configuration:
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Import the repository signing key:
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Update the package lists:
sudo apt-get update

# Install the latest version of PostgreSQL.
# If you want a specific version, use 'postgresql-12' or similar instead of 'postgresql':
sudo apt-get -y install postgresql
```
</details>

# Installation
You can install the bot using
```sh
yarn install
```
To start the bot use
```sh
node bot.js
```
If no configuration file is supplied (You can copy the example_config.json and fill the values) the bot will prompt you to enter the values via the setup.
If you want to use the setup later to edit the config, you can use 
```sh
node setup.js
```
# Documentation

For the documentation of the bot: [Wiki](https://github.com/Blizzor/Twitch-Blizzbot/wiki)<br>