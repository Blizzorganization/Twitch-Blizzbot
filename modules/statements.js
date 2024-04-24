export const statements = {
    userlink: {
        newDiscordConnection: `
            INSERT INTO userlink(discordid, twitchname)
            VALUES($1, $2)
            ON CONFLICT(discordid) DO
            UPDATE SET twitchname = EXCLUDED.twitchname;
        `,
        getDiscordConnection: `
            SELECT twitchname
            FROM userlink
            WHERE discordid = $1;
        `,
        deleteDiscordConnection: `
            DELETE FROM userlink
            WHERE discordid = $1;
        `,
    },
    channels: {
        newChannel: `
            INSERT INTO streamer(name, automessage)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING;
        `,
        getChannel: `
            SELECT *
            FROM streamer
            WHERE name = $1;
        `,
    },
    customCommands: {
        changeCommandPermissions: `
            UPDATE customcommands
            SET permissions = $1
            WHERE command = $2
            AND channel = $3;
        `,
        getCommandPermission: `
            SELECT permissions
            FROM customcommands
            WHERE command = $1
            AND channel = $2;
        `,
        newCommand: `
            INSERT INTO customcommands (command, response, channel, permissions)
            VALUES($1, $2, $3, $4)
            ON CONFLICT
            DO NOTHING;
        `,
        getCommand: `
            SELECT *
            FROM customcommands
            WHERE command = $1
            AND channel = $2;
        `,
        updateCommand: `
            UPDATE customcommands
            SET response = $1
            WHERE command = $2
            AND channel = $3;
        `,
        renameCommand: `
        UPDATE customcommands
        SET command = $1
        WHERE command = $2
        AND channel = $3;
    `,
        deleteCommand: `
            DELETE FROM customcommands
            WHERE command = $1
            AND channel = $2;
        `,
        getAllCommands: `
            SELECT command
            FROM customcommands
            WHERE channel = $1
            AND permissions = $2;
        `,
    },
    counters: {
        newCounter: `
            INSERT INTO counters (channel, name, cur, inc)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT
            DO NOTHING;
        `,
        getCounter: `
            SELECT cur
            FROM counters
            WHERE name = $1
            AND channel = $2;
        `,
        incCounter: `
            UPDATE counters
            SET cur = cur + inc
            WHERE name = $1
            AND channel = $2
            RETURNING cur;
        `,
        setCounter: `
            UPDATE counters
            SET cur = $1
            WHERE name = $2
            AND channel = $3;
        `,
        editCounter: `
            UPDATE counters
            SET inc = $1
            WHERE name = $2
            AND channel = $3;
        `,
        delCounter: `
            DELETE FROM counters
            WHERE channel = $1
            AND name = $2;
        `,
        allCounters: `
            SELECT *
            FROM counters
            WHERE channel = $1;
        `,
    },
    watchtime: {
        renameWatchtimeUser: `
            UPDATE watchtime
            set viewer = $3
            WHERE viewer = $2
            AND channel = $1;
        `,
        getWatchtime: `
            SELECT watchtime
            FROM watchtime
            WHERE viewer = $1
            AND channel = $2
            AND month = $3;
        `,
        setWatchtime: `
            INSERT INTO watchtime (channel, viewer, watchtime, month)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT
            UPDATE SET watchtime = EXCLUDED.watchtime;
        `,
        watchtimeNew: `
            INSERT INTO watchtime (channel, viewer, watchtime, month)
            VALUES ($1, unnest( $2::varchar(25)[])::varchar(25), 0, $3)
            ON CONFLICT
            DO NOTHING;
        `,
        watchtimeInc: `
            UPDATE watchtime
            SET watchtime = watchtime + 1
            WHERE $1::varchar(25)[] @> ARRAY[viewer]::varchar(25)[]
            AND channel = $2
            AND month = $3;
        `,
        watchtimeIncBy: `
            UPDATE watchtime
            SET watchtime = watchtime + $4
            WHERE viewer = $1
            AND channel = $2
            AND month = $3;
        `,
        watchtimeList: `
            SELECT viewer, watchtime
            FROM watchtime
            WHERE month = $1
            AND channel = $2
            ORDER BY watchtime
            DESC LIMIT $3
            OFFSET $4;
        `,
    },
    aliases: {
        newAlias: `
            INSERT INTO aliases (channel, alias, command)
            VALUES ($1, $2, $3)
            ON CONFLICT
            DO NOTHING;
        `,
        delAlias: `
            DELETE FROM aliases
            WHERE channel = $1
            AND alias = $2;
        `,
        resolveAlias: `
            SELECT a.alias, c.command, c.response, c.permissions
            FROM aliases
            as a
            LEFT OUTER
            JOIN customcommands
            AS c
            ON a.command = c.command
            AND a.channel = c.channel
            WHERE a.alias = $1
            AND a.channel = $2;
        `,
        getAliases: `
            SELECT *
            FROM aliases
            WHERE channel = $1;
        `,
        findRelated: `
            SELECT *
            FROM aliases
            WHERE channel = $1
            AND command = $2;
        `,
    },
    blacklist: {
        newBlacklistEntry: `
            INSERT INTO blacklist(channel, blword, action)
            VALUES ($1, $2, $3)
            ON CONFLICT
            DO NOTHING;
        `,
        newBlacklistEntries: `
            INSERT INTO blacklist(channel, blword, action)
            VALUES ($1, unnest($2), $3)
            ON CONFLICT
            DO NOTHING
            RETURNING *;
            `,
        removeBlacklistEntry: `
            DELETE FROM blacklist
            WHERE channel = $1
            AND blword = $2;
        `,
        updateBlacklistEntry: `
            UPDATE blacklist
            SET action = $3
            WHERE channel = $1
            AND blword = $2;
        `,
        loadBlacklist: `
            SELECT *
            FROM blacklist;
        `,
    },
    commands: {
        newCommand: `
            INSERT INTO commands (channel, command, enabled, permission)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT
            DO NOTHING;
        `,
        resolveCommand: `
            SELECT *
            FROM commands
            WHERE channel = $1
            AND command = $2;
        `,
        updateCommandEnabled: `
            UPDATE commands
            SET enabled = $1
            WHERE channel = $2
            AND command = $3;
        `,
        updateCommandPermission: `
            UPDATE commands
            SET permission = $1
            WHERE channel = $2
            AND command = $3;
        `,
    },
};
