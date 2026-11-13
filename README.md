# Blizzbot v2

Twitch-Chatbot auf Basis von **twurple** (`@twurple/chat` + `@twurple/auth`; vormals tmi.js – siehe "Chat-Verbindung (twurple)" unten), mit **PostgreSQL** im **Schema des alten Twitch-Blizzbot**, Web-Dashboard (Express + React) und Discord-Anbindung. Alle Commands des alten Bots sind wieder da, dazu Automessage, Cooldowns, Alerts, Logging/Statistiken und `!setgame`/`!settitle`.

## Altes Schema

Die Tabellen `streamer`, `watchtime`, `customcommands`, `aliases`, `counters`, `userlink`, `blacklist` und `commands` sind unverändert. **Eine bestehende Datenbank des alten Bots kann direkt weiterverwendet werden** (in `configs/.env` darauf zeigen). Wie im alten Bot gilt:

- Commands und Aliase liegen **mit führendem `!`** in der DB (`!discord`).
- Rechtestufen: `0` alle, `1` Sub, `2` VIP, `3` Mod, `5` Streamer, `10` Dev.
- Blacklist-Aktion: `0` Nachricht löschen, `1-9` Timeout (10 s, 30 s, 42 s, 1 min, 5 min, 10 min, 20 min, 30 min, 1 h), `10` Bann. Treffer = ganzes Wort, bei mehreren Treffern gewinnt die höchste Aktion.
- Watchtime: eine Einheit = 30 s, Monate als `MM-YYYY` plus `alltime`.
- Antworten können Platzhalter wie `{counter:name}` enthalten (Liste siehe "Platzhalter").

Nur **additiv** kommt dazu (alte Daten bleiben unberührt): `customcommands.cooldown/uses`, `streamer.total_subs`, Tabellen `event_log`, `automessages`, `twitch_tokens`.

## Installation

```bash
cp configs/example.env configs/.env   # und ausfüllen
docker compose up -d        # PostgreSQL starten (oder alte DB nutzen)
npm install                 # installiert Bot + Dashboard (npm-Workspaces) in EINEN gemeinsamen node_modules-Ordner
                             # und baut das Dashboard automatisch (postinstall)
npm start
```

Das Projekt nutzt **npm-Workspaces**: `bot/` (Root) und `bot/web-client/` teilen sich einen einzigen `node_modules`-Ordner im Projekt-Root, es gibt keinen separaten `web-client/node_modules` mehr. `npm install` im Root installiert beide Teile; `npm run web:build` baut nur das Dashboard neu, `npm run web:dev` startet den Dashboard-Dev-Server (Vite mit Hot-Reload).

Dashboard: `http://localhost:3080`. Beim ersten Aufruf legst du dort deinen ersten Benutzer (Name + Passwort) an; dieser wird automatisch **Haupt-Admin**. Danach meldest du dich normal damit an. `WEB_ADMIN_TOKEN` ist nur ein Notfallzugang (z. B. falls die Nutzerdatenbank leer/kaputt ist) und kann auf dem Login-Bildschirm über "Mit Admin-Token anmelden" genutzt werden (zählt dabei immer als Haupt-Admin).

## Beenden

`Strg+C` (oder ein `SIGTERM`, z. B. von `docker stop`/`systemctl stop`) fährt den Bot sauber herunter: Watchtime-Erfassung und Automessages stoppen, die EventSub-WebSockets (Rewards, Moderator-Aktionen) und die Twitch-Chat-Verbindung trennen, Discord-Verbindung trennen, den Web-Server schließen und zuletzt die Datenbank-Verbindung beenden - jeder Schritt einzeln abgesichert, damit ein Fehler in einem Schritt die anderen nicht blockiert. Ein zweites `Strg+C` während des Herunterfahrens wird ignoriert (verhindert die alten gelegentlichen Abstürze durch doppeltes Beenden); hängt ein Schritt länger als 8 Sekunden, wird der Prozess trotzdem erzwungen beendet.

## Twitch-API-Token (wichtig)

Twitch hat die IRC-Chat-Befehle (`/ban`, `/timeout`, `/delete`, `/followers` …) im Februar 2023 abgeschaltet, und der alte Weg für Zuschauerlisten existiert nicht mehr. Deshalb läuft alles Moderierende und Abfragende jetzt über die **Twitch-API**. Dafür brauchst du in der `configs/.env`:

1. Eine App auf <https://dev.twitch.tv/console> → `TWITCH_CLIENT_ID` und `TWITCH_CLIENT_SECRET` in der `configs/.env`. Als **OAuth-Redirect-URL** dort `https://DEINE-DOMAIN/api/auth/twitch/callback` eintragen.
2. **API-Token des Streamers:** wird NICHT in der `.env` hinterlegt, sondern im Dashboard unter **Benutzer → Twitch-Autorisierung → "Anwendung autorisieren"** (pro Kanal, mit dem Streamer-Account einloggen). Der Button fordert alle nötigen Scopes an:  
   `channel:manage:broadcast`, `channel:read:subscriptions`, `channel:manage:polls`, `channel:read:polls`, `channel:manage:predictions`, `channel:read:predictions`, `channel:manage:redemptions`, `channel:read:redemptions`, `moderator:manage:chat_settings`, `moderator:manage:banned_users`, `moderator:manage:chat_messages`, `moderator:manage:shoutouts`, `moderator:read:followers`, `moderator:read:chatters` sowie für die Moderator-Statistik `moderator:read:blocked_terms`, `moderator:read:unban_requests`, `moderator:read:warnings`, `moderator:read:moderators`, `moderator:read:vips`.  
   Der Token liegt in der Datenbank (`twitch_tokens`) und wird automatisch erneuert – bereits eine Minute vor Ablauf. Die Variablen `TWITCH_API_ACCESS_TOKEN` / `TWITCH_API_REFRESH_TOKEN` aus älteren Versionen gibt es nicht mehr; sie werden ignoriert.
3. **Bot-Account (optional, empfohlen):** Im selben Bereich unter **"Bot-Account"** → **"Bot-Account autorisieren"**, dabei im Browser mit dem BOT-Account bei Twitch eingeloggt sein (der Bot muss im Kanal Moderator sein). Dann führt der Bot-Account **Nachricht löschen, Timeout, Ban, den Follower-Modus bei `!raid` und Shoutouts** selbst aus – in Twitchs Moderationslog steht der Bot statt des Streamers. Scopes dafür: `moderator:manage:chat_settings`, `moderator:manage:banned_users`, `moderator:manage:chat_messages`, `moderator:manage:shoutouts` und die fünf `moderator:read:*`-Scopes von oben. Der Token wird getrennt gespeichert (`twitch_bot_token`), automatisch erneuert und lässt sich mit **"Bot-Account entfernen"** wieder löschen. Ohne autorisierten Bot-Account (oder wenn er im Kanal kein Moderator ist) übernimmt der Streamer-Token; im Log steht dann einmalig eine Warnung. Der **Chat-Login** des Bots (`TWITCH_OAUTH_TOKEN`, nur `chat:read` + `chat:edit`) ist davon unabhängig.
4. Der Token-Besitzer muss im Kanal Mod (oder der Broadcaster) sein. Der Streamer-Token muss zur selben Client-ID gehören wie `TWITCH_CLIENT_ID`.

Fehlt ein Scope, betrifft das nur die jeweilige Funktion (z. B. `!info` zeigt dann `?` bei den Subs); der Rest läuft weiter.

### Mehrere Kanäle (`TWITCH_CHANNELS`)

Der Bot läuft problemlos auf mehreren Kanälen gleichzeitig (alle Features – Commands, Blacklist, Watchtime, Automessage, Giveaway/Umfrage/Wette, Rewards – laufen pro Kanal). Die API-Tokens werden pro Kanal im Dashboard autorisiert und in der Datenbank (Tabelle `twitch_tokens`, ein Eintrag pro Kanal) gespeichert – `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET` bleiben für alle Kanäle dieselben.

Für die normalen Moderations-/Info-Funktionen reicht meist ein Mod-Token, der für alle Kanäle funktioniert, auf denen der Mod-Account Moderator ist. **Für Punkte-Rewards ist das aber nicht genug** – Twitch verlangt dort zwingend den Token des jeweiligen **Broadcasters selbst** (siehe Abschnitt "Rewards" unten). Am einfachsten lässt sich das im Dashboard unter **Benutzer → Twitch-Autorisierung** einrichten: dort pro Kanal auf **"Anwendung autorisieren"** klicken und dabei mit dem jeweiligen Streamer-Account selbst bei Twitch einloggen. Der Button führt durch Twitchs eigenen Login/Autorisierungs-Dialog (inkl. aller oben genannten Scopes) und speichert den resultierenden Token zusammen mit der Broadcaster-User-ID automatisch in der Datenbank – kein externes Token-Generator-Tool mehr nötig. Direkt darunter zeigt eine Tabelle zu jedem konfigurierten Kanal, ob ein Token hinterlegt ist und zu welcher Broadcaster-ID er gehört, damit sich das bei mehreren Kanälen leicht nachhalten lässt.

Dafür muss einmalig `WEB_PUBLIC_URL` (öffentlich erreichbare Dashboard-URL, siehe `configs/example.env`) gesetzt und in der eigenen App unter <https://dev.twitch.tv/console> als **OAuth Redirect URL** exakt `<WEB_PUBLIC_URL>/api/auth/twitch/callback` eingetragen werden. Der Button ist nur für Admins/den Haupt-Admin sichtbar.

## Chat-Verbindung (twurple)

Die eigentliche Chat-Verbindung (Nachrichten lesen/schreiben, Sub-/Resub-/Raid-/Gift-Events) läuft über **twurple** (`@twurple/chat`, `@twurple/auth`) statt wie zuvor über tmi.js – tmi.js wird nicht mehr weiterentwickelt. Für den Bot-Account brauchst du in der `configs/.env`:

- `TWITCH_BOT_USERNAME` und `TWITCH_OAUTH_TOKEN` (`oauth:...`) wie bisher – reicht für den einfachen Betrieb ohne Auto-Refresh, genau wie zuvor mit tmi.js.
- Optional `TWITCH_BOT_CLIENT_ID` (Standard: `TWITCH_CLIENT_ID`), falls der Bot-Account-Token über eine andere App als der Broadcaster-API-Token erzeugt wurde. **Wichtig:** Die Client-ID muss zur App gehören, die den Token ausgestellt hat, sonst schlägt die Verbindung fehl.
- Optional `TWITCH_BOT_ACCESS_TOKEN` (reiner Token ohne `oauth:`-Präfix) als Alternative zu `TWITCH_OAUTH_TOKEN`.
- Optional `TWITCH_BOT_REFRESH_TOKEN` (+ `TWITCH_BOT_CLIENT_SECRET` oder `TWITCH_CLIENT_SECRET`): Ist ein Refresh-Token gesetzt, erneuert der Bot den Chat-Token automatisch, sobald er abläuft, und speichert ihn in der Tabelle `twitch_tokens` (Schlüssel `__bot_chat__`). **Ohne** Refresh-Token verhält sich der Bot wie zuvor mit tmi.js: Der Token muss gültig bleiben (Scopes `chat:read` + `chat:edit`), sonst trennt die Verbindung.

## Chat-Commands

Rechte: alle = jeder, sonst mindestens die genannte Stufe. Aliase in Klammern.

**Für alle:** `!help` (`!befehle`, `!cmd`, `!cmds`, `!command`, `!commands`), `!age` (`!alter`), `!fage` (`!followage`, `!folgezeit`), `!uptime`, `!game` (`!spiel`), `!title` (`!titel`), `!info`, `!watchtime` (`!wt`), `!stats` (`!profil`: Level, Watchtime und Punkte mit Platzierung, auch für andere Nutzer: `!stats <name>`), `!level` (`!rank`), `!punkte`

**Mods:** `!dice`, `!emote sub|bttv` (`!emotes`), `!mtime`, `!setgame <Kategorie>`, `!settitle <Titel>` (max. 140 Zeichen), `!shoutout` (`!so`), `!aliase`, `!ccmd` (`!ccmds`, listet Mod-Commands), `!switch <command>` (Command ein-/ausschalten), `!transfer` (`!tf`, Nutzer- ⇄ Mod-Command), `!automessage` (`!am`)

`!shoutout`/`!so` nutzt Twitchs eigene Shoutout-Funktion (Scope `moderator:manage:shoutouts`): der Zielkanal bekommt einen eigenen, von Twitch markierten Shoutout-Chateintrag und wird in Twitchs "Empfehlungen"/Stream-Browse hervorgehoben, zusätzlich zur gewohnten Chat-Nachricht mit Link. Ist die API nicht konfiguriert oder schlägt der Aufruf fehl, sendet der Bot nur den Chat-Text wie bisher.

**Custom Commands (Mod):** `!add`, `!edit`, `!del`, `!madd`, `!medit`, `!mdel` (Mod-Commands), `!recmd <alt> <neu>`, `!addalias <alias> <command>`, `!delalias <alias>`  
Optionale Flags beim Anlegen/Ändern: `-p=everyone|subscriber|vip|moderator|broadcaster` und `-cd=<Sekunden>`, z. B. `!add !discord -cd=30 Unser Discord: …`. Platzhalter: `{user}`, `{touser}`, `{args}`, `{count}`, `{channel}`, `{counter:name}`, `{random:1-100}`, `{pick:a|b|c}`, `{game}`, `{title}`, `{viewers}`, `{uptime}`, `{time}`, `{date}` (siehe Abschnitt "Platzhalter").

**Zähler (Mod):** `!addcounter <name> [inc] [start]`, `!delcounter`, `!editcounter <name> val|inc <zahl>`, `!counter <name>`, `!counters`

**Blacklist (Mod):** `!addbl <0-10> <wort>`, `!delbl <wort>`, `!blacklist` (schickt sie in den Discord-Blacklist-Kanal, sonst in den Chat)

**Zitate (für alle, Verwalten nur Mods):** `!zitat` (`!quote`, `!zitate`, `!quotes`) zeigt ein zufälliges Zitat, `!zitat <ID>` ein bestimmtes, `!zitat add <Text>` legt eines an (nur Mod/Streamer), `!zitat remove <ID>` löscht eines (nur Mod/Streamer)

**Neu:** *Follow-Alert* (Dashboard → Alerts; Schutz vor Follower-Bots: mehr als X Follower in Y Sekunden → keine Meldungen, nutzt EventSub und den vorhandenen Scope `moderator:read:followers`), *Begrüßungen* (Chat → Begrüßungen: Bot antwortet hinterlegten Nutzern bei der ersten Nachricht im laufenden Stream), *Watchtime bearbeiten* (Community → Loyalty, nur Admins; Suchfeld über der Rangliste).

**Sonstige:** `!raid` (VIP, Follower-Modus für die im Dashboard eingestellten Raid-Minuten aus), `!rename <alter name>` (Dev, Watchtime übertragen), `!setsubs <zahl>` (Streamer, Zähler „verschenkte Subs")

Custom Commands haben **pro Command einen Cooldown** (global; pro Nutzer der doppelte Wert; Mods ausgenommen). Eingebaute Commands nutzen den Kanal-Cooldown aus den Dashboard-Einstellungen.

**Twitch-Autorisierung am Handy:** Öffnet sich die Rückleitung von Twitch in einem neuen Tab/Fenster (kein gemeinsamer `sessionStorage`), würde man sonst auf der Anmeldung landen. Deshalb wird die Anmeldung direkt vor dem Twitch-Login 10 Minuten lang abgelegt, nach der Rückleitung (`?twitchAuth=`) einmalig wiederhergestellt und sofort gelöscht. In einem komplett anderen Browser/einer App klappt das nicht – dort muss man sich neu anmelden.

## Commands, Aliase und Zähler (Dashboard)

Der Unterpunkt **Alias** zeigt pro Command eine Zeile mit allen seinen Aliasen (`!setup` → `!amazon`, `!equip`, `!pc`); ein Alias wird über das ✕ daneben (am Handy: Knopf in der aufgeklappten Karte) nach Rückfrage gelöscht. Das Discord-Embed von `/commands` zeigt die Aliase genauso gruppiert: `!setup= !amazon, !equip, !pc | !twitter= !tw`. Das Embed zeigt wie beim alten Bot nur die Bereiche, für die es Daten gibt (Commands, Mod-Commands, Aliase, Counter); ist gar nichts angelegt, steht „Es ist leider kein Command hinterlegt“. Aliase von **ausgeschalteten** Commands tauchen im Embed nicht auf (`/aliase` und das Dashboard listen weiterhin alle).

Im Dashboard unter **Chat → Commands** gibt es vier Unterpunkte: **Command**, **Counter**, **Timer** (laufende Timer ansehen, neue starten, abbrechen) und **Botcommands**. Aliase von eigenen Commands werden im aufgeklappten Bearbeiten-Bereich des Commands angezeigt, angelegt und gelöscht. Der Unterpunkt **Command** hat wiederum zwei eigene Unterpunkte: **Standard Befehle** (die fest einprogrammierten Commands mit ihren Aliasen, der nötigen Rechtestufe und einem Schalter "Aktiv" – darüber lässt sich jeder Standard-Befehl pro Kanal ein-/ausschalten, genau wie bisher per `!switch` im Chat, nur eben bequem im Dashboard) und **Custom Befehle** (die eigentliche Verwaltung: Custom Commands anlegen/bearbeiten/löschen, siehe "Kanal-Einstellungen" unten für den Cooldown eingebauter Commands sowie das Bulk-Ein-/Ausschalten). **Alias** legt Aliase an/löscht sie, **Counter** legt Zähler an/bearbeitet/löscht sie (Name, Startwert und Schritt – die Hinweise im Dashboard erklären, wofür die beiden Zahlen stehen; der aktuelle Wert kann jederzeit überschrieben werden). **Botcommands** ist eine reine Übersichtsseite (nichts zu bearbeiten) mit einer kurzen Erklärung zu jedem Mod-only-Chatbefehl (`!add`, `!edit`, `!del`, `!addalias`, `!delalias`, `!addbl`, `!delbl`, `!ccmd`, `!aliase`, `!counter`, `!addcounter`, `!editcounter`, `!delcounter`, `!zitat add`, `!zitat remove`) – praktisch als Spickzettel für neue Moderatoren. Auf dem Handy (schmaler Bildschirm, hochkant) werden die Custom Befehle als einklappbare Karten angezeigt: Command, Rechte, Cooldown, Aktiv-Schalter und eine gekürzte Antwort; ein Tipp auf die Karte klappt sie auf und zeigt **Bearbeiten** und **Löschen**. Am Desktop bleibt es die normale Tabelle. Alle Unterpunkte greifen auf denselben Kanal zu, den du oben in der Kanalauswahl gesetzt hast. Änderungen hier erscheinen auch im Audit-Log.

## Automessage

Wie im alten Bot: reihum die nächste Nachricht, nur wenn der Kanal live ist (abschaltbar im Dashboard). Das Intervall gilt standardmäßig für alle Nachrichten (Dashboard "Standard-Intervall"), kann aber **pro Nachricht** überschrieben werden (Feld "Intervall" beim Anlegen bzw. editierbar in der Tabelle) – das eigene Intervall einer Nachricht bestimmt dann die Wartezeit bis zur nächsten. Nachrichten liegen in der Datenbank und sind per `!automessage add <Text>` / `del <Nr>` / `list` / `on` / `off` oder im Dashboard änderbar; der Schalter pro Kanal ist die alte Spalte `streamer.automessage`. Eine vorhandene `configs/automessages.json` (`{"kanal": ["text", …]}`) wird beim Start für Kanäle ohne Einträge importiert.

## Alerts

**Hype-Train-Zusammenfassung:** Am Ende eines Hype Trains schreibt der Bot Level, Gesamtpunkte und die Top-Unterstützer in den Chat (Alert „Hype Train (Zusammenfassung am Ende)", Text und Schalter im Dashboard → Alerts; Platzhalter `{level}`, `{total}`, `{top}`). Nutzt EventSub und braucht den Scope `channel:read:hype_train` – nach dem Update den Twitch-Zugang im Dashboard einmal neu autorisieren. Fehlt der Scope, steht eine Info in „Letzte Warnungen & Fehler".

Sub, Resub, Bits, Raid (`xyz raidet mit z Zuschauern`), verschenkte Subs (mit Gesamtzahl; Mass-Gifts werden nicht doppelt gezählt) sowie verlängerte Gift-/Prime-Subs. Bei Sub, Resub und einzelnem Gift-Sub steht zusätzlich die Tierstufe zur Verfügung (`{tier}`: "Tier 1", "Tier 2", "Tier 3" oder "Prime", ermittelt aus den Daten von Twitch). Texte und Standardwerte in `src/db/alerts.js` (`ALERT_TYPES`).

**Shared Chat:** Läuft dein Kanal mit anderen zusammen in Twitchs "Shared Chat" (z. B. bei Collabs), bekommt der Bot über seine eine Chat-Verbindung auch Sub-/Resub-/Raid-/Bits-Events aus den ANDEREN beteiligten Kanälen gespiegelt in den eigenen Chat. Diese werden automatisch erkannt (anhand von Twitchs `source-room-id`-Kennzeichnung) und ignoriert – der Bot löst Alerts nur noch für Events aus, die wirklich aus dem eigenen Kanal stammen.

## Zitate (Dashboard)

Der Tab **"Zitat"** (zwischen "Automessages" und "Alerts") zeigt alle gespeicherten Zitate eines Kanals, erlaubt das Hinzufügen neuer Zitate per Textfeld und das Löschen einzelner Einträge über den Button "Löschen". Dieselben Zitate stehen über `!zitat`/`!zitat <ID>`/`!zitat add`/`!zitat remove` auch im Twitch-Chat zur Verfügung (siehe "Chat-Commands" oben). Die Nummer eines neuen Zitats ist immer die **kleinste freie Nummer innerhalb des Kanals**: Ist z. B. #1 frei (weil gelöscht), bekommt das nächste neue Zitat #1, statt dass die Nummern immer weiter hochzählen.

## Filter (nur für Nutzer ohne Rolle, wie im alten Bot)

Blacklist, Links (erlaubt: `configs/links.txt`; ausgelöst durch `www.`, `http(s)://` oder Endungen aus `configs/TLDs.txt`) und `/me`-Nachrichten werden gelöscht. `configs/mods.txt` gilt nur mit `TWITCH_PERMIT=true`. Zusätzliche **Verify-Mods** (Dashboard → Moderation → Verify-Mods, nur Admins, oder Discord `/addmod` `/delmod` `/mods`) gelten – nur wenn dort die Option „Nur Nutzer aus dieser Liste gelten als Moderator“ aktiviert ist – als einzige Moderatoren für den Bot (`mods.txt` und Twitch-Abzeichen werden dann ignoriert); ohne die Option hat die Liste keine Wirkung. Ausschalten: im Dashboard (Link-Filter bzw. /me-Nachrichten löschen).

## Rollen: Haupt-Admin, Admin, Mitglied

Es gibt drei Rollenstufen:

- **Haupt-Admin (Owner):** Der allererste im Dashboard angelegte Benutzer (beim ersten Aufruf über den Einrichtungs-Bildschirm) wird automatisch zum Haupt-Admin. Es gibt immer genau einen. Nur der Haupt-Admin darf die **Admin**-Rolle vergeben oder entziehen. Seine eigene Rolle kann nicht geändert, er selbst nicht gelöscht werden, damit niemand sich versehentlich aussperrt.
- **Admin:** Darf im Tab "Benutzer" neue Benutzer anlegen, bearbeiten, löschen und ihnen Kanäle zuweisen – aber ausschließlich mit der Rolle **Mitglied**. Admins können weder sich selbst noch andere zu Admin machen; das bleibt dem Haupt-Admin vorbehalten.
- **Mitglied:** Kein Zugriff auf die Tabs "Benutzer" und "Audit-Log"; sonst für die freigegebenen Kanäle voller Dashboard-Zugriff.

Der Bereich **Verwaltung** (Benutzer, Audit-Log, Sicherung) ist für Mitglieder gar nicht sichtbar. Jeder angemeldete Benutzer – unabhängig von der Rolle – kann über den Button "Konto" oben im Dashboard seinen eigenen Benutzernamen und sein Passwort ändern. Der `WEB_ADMIN_TOKEN`-Notfallzugang zählt dabei immer als Haupt-Admin.

## Benutzerverwaltung (Dashboard)

Unter **Verwaltung → Benutzer** legst du weitere Dashboard-Zugänge an, änderst Benutzername/Passwort oder löschst Zugänge (der letzte verbleibende Benutzer kann nicht gelöscht werden, und du kannst dich nicht selbst löschen). Passwörter werden gehasht gespeichert (bcrypt), Logins laufen über ein signiertes Token (`WEB_JWT_SECRET`). Diese beiden Schutzmaßnahmen gelten nicht für den `WEB_ADMIN_TOKEN`-Notfallzugang: darüber lässt sich auch der letzte verbleibende bzw. der erst angelegte Haupt-Administrator-Account löschen.

Oben im selben Tab findet sich außerdem der Abschnitt "Twitch-Autorisierung" (siehe "Mehrere Kanäle" oben) zum (Neu-)Autorisieren des Twitch-API-Tokens pro Kanal direkt über Twitchs Login.

## Dashboard-Navigation

Das Dashboard hat sechs Hauptreiter mit Unterreitern: **Übersicht**, **Chat** (Commands, Automessages, Zitate, Alerts), **Moderation** (Blacklist,
Auswertung – Auswertung nur für Admins), **Community** (Loyalty System, Aktionen), **Statistiken** und **Verwaltung**
(nur Admins: Benutzer, Audit-Log, Sicherung). Hat ein Hauptreiter nur einen sichtbaren Unterreiter, entfällt die zweite Leiste.
Auf dem Handy werden die Hauptreiter als Auswahlmenü angezeigt, die Unterreiter lassen sich seitlich wischen.

## Code-Aufbau (Twitch)

- `src/twitch/commands.js` setzt die eingebauten Chat-Commands zusammen (plus `!help`); die Commands selbst liegen thematisch in `src/twitch/chat-commands/`:
  `info.js`, `fun.js`, `loyalty.js`, `stream.js`, `custom-commands.js`, `counters.js`, `quotes.js`, `moderation.js`, `automessage.js`, `admin.js`; gemeinsame Helfer in `shared.js`.
  Einen neuen Command legst du in der passenden Datei an und trägst seinen Namen in der Liste `ORDER` in `commands.js` ein.
- `src/twitch/bot.js` verbindet den Chat und verarbeitet Nachrichten/Commands; die Alerts (Sub, Resub, Bits, Raid, Gift, Mass-Gift, Upgrades) liegen in `src/twitch/alerts.js` (`registerAlerts(client, { say, action })`), die Zuordnung von Mass-Gift und Einzel-Gifts in `src/services/gift-dedupe.js`.
- `src/twitch/api.js` ist nur noch die Sammelstelle; die Helix-Funktionen liegen in `src/twitch/api/`:
  `tokens.js` (Streamer-/Bot-Token, Refresh), `client.js` (`helix()`, Moderations-Request), `channel.js` (Spiel/Titel, Nutzer, Stream, Emotes ...),
  `moderation.js` (Löschen, Timeout/Ban, Follower-Modus, Shoutout), `engagement.js` (Umfragen, Wetten, Rewards). Andere Module importieren weiter aus `./api.js`.

## Code-Aufbau (Dashboard-Server)

- `src/dashboard/server.js` baut nur den Express-Server auf (Sicherheits-Header, Login-Routen, Einbinden aller Bereiche, Ausliefern des Frontends).
- `src/dashboard/context.js` enthält die gemeinsamen Helfer: Anmeldung (`auth`), Rechteprüfung (`requireAdmin`, `requireOwner`), Kanalzugriff, Fehlerbehandlung (`wrap`).
- `src/dashboard/auth-routes.js` sind die öffentlichen Routen (Ersteinrichtung, Login, Twitch-Rückkehr); `auth.js` und `security.js` liegen ebenfalls hier.
- `src/dashboard/routes/` hat pro Bereich eine Datei (`commands.js`, `blacklist.js`, `giveaways.js`, `loyalty.js`, `settings.js`, `users.js` ...). Eine neue Route kommt in die passende Datei; ein neuer Bereich bekommt eine eigene Datei mit `registerXyz(api)`, die in `server.js` eingetragen wird.

## Reward-System ein-/ausschalten (Dashboard)

Unter **Community → Aktionen → Rewards** schaltet der Haken **Reward-System aktiv** (im ausklappbaren Bereich **Reward-Einstellungen**) das Protokollieren der Punkte-Reward-Einlösungen pro Kanal ein oder aus (Standard: an).
Ist es aus, werden Einlösungen nicht mehr gespeichert oder bei Twitch als erledigt markiert, und im Dashboard lassen sich keine neuen Rewards anlegen.
Bereits bei Twitch vorhandene Rewards bleiben unverändert. Das Umschalten wirkt sofort, ein Neustart ist nicht nötig: Sind alle Kanäle ausgeschaltet, baut der Bot die EventSub-Verbindung zu Twitch ab (bzw. beim Einschalten wieder auf). In der Übersicht steht die Karte "Reward-Erfassung" dann auf "Ausgeschaltet".

**Fehler 429 "websocket transports limit exceeded":** Twitch erlaubt pro Account und Twitch-App (Client-ID) nur 3 gleichzeitige WebSocket-Verbindungen. Ist das Limit durch eine zweite Bot-Instanz, ein altes Programm mit derselben App oder durch Bot-Account = Streamer-Account belegt, lehnt Twitch die Reward-Erfassung ab. Der Bot versucht es dann 3-mal und stoppt die Erfassung mit einer klaren Warnung (statt endlos alle 10 Sekunden); die Karte "Reward-Erfassung" zeigt "Fehler". Mit `DIAGNOSE=true` listet der Start auf, welche Sessions Twitch gerade sieht. Nach dem Beenden der anderen Verbindung: Reward-System im Dashboard aus- und wieder einschalten oder den Bot neu starten.

## Suche und Filter in den Listen (Dashboard)

Über den langen Listen steht eine Suchleiste (Treffer sofort beim Tippen, Zähler "x von y", "×" setzt zurück):
**Commands** (Name/Antwort, dazu Filter nach Rechten und an/aus), **Standard Befehle**, **Alias**, **Counter**, **Blacklist** (Wort, dazu Filter nach Aktion) und **Zitate** (Text, Nummer, Autor).
Im **Audit-Log** wird auf dem Server gefiltert (Benutzer/Ziel/Kanal, dazu Aktion und Typ), damit es auch über alle Seiten hinweg funktioniert.

## Sicherung: Export und Import (Dashboard, nur Admin/Haupt-Admin)

Unter **Verwaltung → Sicherung** lässt sich pro Kanal eine JSON-Datei herunterladen und wieder einspielen. Enthalten sind Commands, Aliase,
eingebaute Commands (an/aus, Rechte), Counter, Blacklist, Automessages, Zitate, Alert-Texte und die Kanal-Einstellungen
(nur selbst gesetzte Werte). **Nicht** enthalten: Twitch-Zugänge, Dashboard-Benutzer, XP/Punkte/Watchtime der Zuschauer, Giveaway-/Umfrage-/Wetten-Verlauf, Audit-Log.

Beim Import wählst du die Bereiche und den Modus: *Zusammenführen* (vorhandene Einträge bleiben, fehlende werden ergänzt) oder
*Ersetzen* (gewählte Bereiche werden erst geleert). Die **Vorschau** zeigt vorher, wie viele Einträge neu, übersprungen oder ungültig sind,
ohne etwas zu speichern. Die Datei kann auch in einen anderen Kanal eingespielt werden. Export und Import stehen im Audit-Log.

## Audit-Log (Dashboard, nur Admin/Haupt-Admin)

**Verwaltung → Audit-Log** protokolliert, wer wann einen Command/Mod-Command angelegt, bearbeitet oder gelöscht hat, ebenso Aliase, Zähler, Zitate, Giveaways (Start/Stopp/Ziehung/Löschen), Umfragen, Wetten (Start/Sperren/Auswertung/Abbruch/Löschen) und Dashboard-Benutzer – egal ob die Änderung über das Dashboard, den Twitch-Chat oder Discord-Slash-Commands ausgelöst wurde. In der Spalte "Wer" steht bei Chat-Aktionen zusätzlich `(Twitch)` bzw. `(Discord)` hinter dem Namen, damit klar ist, über welchen Weg die Änderung kam (Dashboard-Aktionen zeigen nur den Benutzernamen). Für Mitglieder ist dieser Bereich unsichtbar.

## Aktionen: Giveaway, Umfrage, Wette und Rewards (Dashboard)

Der Tab **"Aktionen"** fasst vier Unterpunkte zusammen, die alle im Web-Dashboard gestartet/verwaltet werden und automatisch mit Twitch zusammenspielen:

- **Giveaway:** Titel, Stichwort und Anzahl Gewinner festlegen, optional automatische Ziehung nach X Sekunden. Zuschauer nehmen teil, indem sie das Stichwort als Chatnachricht schreiben (Mehrfachteilnahme zählt nur einmal). Im Dashboard lässt sich die Teilnahme vorzeitig schließen, manuell ziehen oder löschen. Start, Ende und Gewinner werden automatisch im Chat angekündigt.
- **Umfrage:** Frage und Antworten (mit Komma getrennt) sowie die Dauer festlegen. Zwei Modi:
  - **Chat:** Zuschauer stimmen mit der Zahl der Antwort ab (z. B. `2`); eine Stimme pro Nutzer, die letzte zählt.
  - **Twitch:** nutzt die native Twitch-Umfrage (braucht die Scopes `channel:manage:polls` / `channel:read:polls`).  
  Ergebnis und Prozente werden bei Ende automatisch im Chat gepostet.
- **Wette:** nutzt Twitchs native Prediction-Funktion mit Channel Points (braucht die Scopes `channel:manage:predictions` / `channel:read:predictions`). Titel, 2-10 Ergebnisse (mit Komma getrennt) und die Dauer (Sekunden) festlegen; Zuschauer setzen direkt auf der Twitch-Kanalseite, nicht im Chat. Im Dashboard lässt sich die Wette vorzeitig sperren (keine neuen Einsätze mehr), auswerten (Gewinner-Ergebnis wählen – Twitch zahlt die Punkte automatisch aus) oder abbrechen (alle Einsätze werden zurückerstattet). Nach Auswertung/Abbruch kann der Eintrag im Dashboard gelöscht werden.
- **Rewards:** protokolliert Channel-Points-Einlösungen in Echtzeit im Dashboard (Nutzer, Reward, eingegebener Text, Zeitpunkt) und erlaubt es, eigene Rewards anzulegen. Braucht die Scopes `channel:manage:redemptions` (zum Anlegen/Löschen eigener Rewards) und `channel:read:redemptions` (fürs Erfassen der Einlösungen). Wichtig dabei:
  - Erfasst werden **wirklich ALLE Rewards des Kanals** – auch manuell im Twitch-Creator-Dashboard angelegte, nicht nur die über das Formular hier angelegten. Das läuft über Twitchs EventSub (Echtzeit-WebSocket, `@twurple/eventsub-ws`), nicht per Polling.
  - Nur für Rewards, die der Bot **selbst** angelegt hat, kann er die Einlösung bei Twitch danach auch automatisch als **erledigt ("FULFILLED")** markieren (Twitch-Einschränkung: das geht nur für Rewards desselben Client-Tokens). Bei allen anderen Rewards bleibt die Einlösung zusätzlich in Twitchs eigener Liste als "offen" stehen – im Dashboard wird trotzdem jede Einlösung protokolliert, mit einer Spalte, ob sie automatisch erledigt werden konnte.
  - Eine über das Formular angelegte Reward lässt sich im Dashboard wieder löschen; das löscht sie auch bei Twitch.
  - Die EventSub-Verbindung wird pro Kanal mit einem eigenen, separat verwalteten Token aufgebaut (unabhängig von den übrigen API-Aufrufen des Bots) und beim Beenden des Bots wieder sauber getrennt.
  - **Fehler `403 subscription missing proper authorization`**, obwohl der Scope laut Token vorhanden ist: hat meist einen von zwei Gründen, die der Bot beim Start jeweils einmalig als Warnung loggt (und die Erfassung für den betroffenen Kanal dann überspringt, statt es endlos erfolglos erneut zu versuchen):
    1. Der Token gehört nicht dem **Broadcaster selbst**, sondern z. B. nur einem Moderator- oder Bot-Account – für Punkte-Reward-Einlösungen muss es der Broadcaster-eigene Token sein.
    2. Der Token wurde über eine **andere Twitch-App** (Client-ID) autorisiert als die hier in `TWITCH_CLIENT_ID` hinterlegte – Twitch verknüpft die Berechtigung mit der autorisierenden App, nicht nur mit dem Scope-Namen.
    
    Abhilfe in beiden Fällen: Den Access-/Refresh-Token für diesen Kanal neu erzeugen, dabei mit dem **Broadcaster-Account selbst** einloggen und über die eigene, in `TWITCH_CLIENT_ID` hinterlegte App autorisieren, inklusive der Scopes `channel:manage:redemptions` und `channel:read:redemptions`. Am einfachsten über den Button **Anwendung autorisieren** im Dashboard-Bereich **Verwaltung → Benutzer** (siehe Abschnitt "Mehrere Kanäle" oben) – der erledigt beides automatisch richtig.

Nur ein Giveaway, eine Umfrage und eine Wette können gleichzeitig pro Kanal laufen; ein neuer Start schließt bei Giveaway/Umfrage den vorherigen automatisch ab (bei Wetten verhindert eine bereits laufende Wette einen neuen Start, bis sie ausgewertet oder abgebrochen ist). Rewards sind davon unabhängig – es können beliebig viele gleichzeitig aktiv sein.

## Emotes (`!emote <plattform>`)

`!emote twitch` (Kanal-Sub-Emotes über die Twitch-API), `!emote bttv` und `!emote 7tv` – beide über die öffentlichen APIs von BetterTTV und 7TV, kein zusätzliches Token nötig.

## Sicherheit des Dashboards

- **Pflicht-Geheimnisse:** `WEB_JWT_SECRET` muss gesetzt, mindestens 16 Zeichen lang und kein Platzhalter (`changeme`, `bitte-aendern` ...) sein, sonst startet das Dashboard nicht (der Bot läuft weiter, das Log nennt den Grund). `WEB_ADMIN_TOKEN` gilt nur, wenn er genauso stark ist; sonst ist der Notfall-Zugang per Token deaktiviert (Warnung im Log). Zufallswert erzeugen: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- **Ersteinrichtung:** Solange noch kein Benutzer existiert, verlangt das Anlegen des Haupt-Admins zusätzlich den `WEB_ADMIN_TOKEN` (Feld auf der Login-Seite), damit nicht jeder Besucher ihn anlegen kann.
- **Anmelde-Begrenzung:** Fehlgeschlagene Anmeldungen werden begrenzt (10 pro Benutzername und 20 pro IP-Adresse in 15 Minuten, danach Antwort 429). Steht ein Reverse-Proxy vor dem Bot, `WEB_TRUST_PROXY=true` setzen, sonst sehen alle Besucher wie eine einzige IP aus.
- **Benutzerverwaltung:** Admins können Konten von Haupt-Admin und anderen Admins weder ändern (Passwort, Name, Rolle) noch löschen; das darf nur der Haupt-Admin. Ein gelöschter Benutzer verliert seinen Zugang sofort (sein Anmelde-Token wird nicht mehr akzeptiert).
- **Sonstiges:** Sicherheits-Header (u. a. Content-Security-Policy, kein Einbetten in fremde Seiten), kein CORS ohne `WEB_CORS_ORIGIN`, zeitkonstanter Vergleich des Admin-Tokens, Datenbankfehler gehen nicht im Klartext an den Browser. Das Dashboard gehört hinter HTTPS (Reverse-Proxy).

## Übersicht, Loyalty-System und Diagnose (Dashboard)

- **Übersicht** (erster Reiter): zeigt auf einen Blick, ob der Chat verbunden ist, ob der Kanal live ist (mit Zuschauerzahl), ob Kanal-Token und Bot-Account vorhanden sind, ob die Moderator- und Reward-Erfassung laufen, welche Module aktiv sind und – nur für Admins – die letzten Warnungen/Fehler. Aktualisiert sich alle 15 Sekunden.
- **Loyalty System** (für alle Dashboard-Benutzer sichtbar): Einstellungen je Kanal in zwei Gruppen: *Level-/XP-System* (XP für Level 1, **Faktor pro Level** – jedes Level kostet so viel mal mehr wie das vorherige, XP pro Chatnachricht samt Cooldown, XP pro Minute Watchtime) und *Punkte-System* (Punkte pro Chatnachricht samt Cooldown, Punkte pro Minute Watchtime). Der Schalter *Watchtime-Erfassung* und die Liste **Nutzer ohne Watchtime** (z. B. andere Bots oder der Streamer selbst; sie sammeln dann auch keine Watch-XP/-Punkte, bereits gesammelte Watchtime bleibt) stehen im Unterreiter **Watchtime** unter „Einstellungen". Die Ranglisten lassen sich je Kanal mit **Zurücksetzen** leeren (XP/Level und Punkte getrennt; mit Bestätigung und im Audit-Log); Nutzer, die danach weder XP noch Punkte haben, werden komplett aus der Tabelle gelöscht. Unter den Ranglisten können **Punkte** und **XP** an einzelne Nutzer vergeben oder (negativer Wert) entzogen werden – nie unter 0, ohne Level-Up-Meldung im Chat, mit Eintrag im Audit-Log. **Zurücksetzen** und **Vergeben/Entziehen** (Punkte und XP) sind nur für Admins möglich; Mitglieder sehen die Ranglisten und Einstellungen, aber diese Knöpfe und Formulare nicht (der Server lehnt die Aufrufe zusätzlich ab). Wird das Level-System ausgeschaltet, kommen sofort keine Level-Up-Meldungen mehr.
- **Rückmeldungen:** Nach Speichern, Löschen oder Zurücksetzen blendet das Dashboard kurz eine Meldung ein. Zahlenfelder speichern beim Verlassen des Feldes bzw. mit Enter.
- **Diagnose:** Mit `DIAGNOSE=true` in der `configs/.env` gibt der Bot beim Start zusätzliche Hinweise aus (Web-Adresse, über welchen Account die Moderator-Aktionen erfasst werden, belegte EventSub-WebSocket-Sessions). Hilfreich z. B. bei Twitch-Fehler 429 "websocket transports limit exceeded" (Limit: 3 Verbindungen pro Account und App).

## Kanal-Einstellungen (pro Twitch-Kanal)

Statt eines eigenen Tabs stecken diese Einstellungen direkt in den passenden Tabs, jeweils mit einem "Standard"-Knopf, um zum eingebauten Standardwert zurückzukehren:

- **Commands-Tab:** Cooldown für eingebaute Commands, `!raid`-Dauer und Mindestzuschauerzahl für Raid-Alerts, sowie "Alle aktivieren"/"Alle deaktivieren" um auf einen Schlag sämtliche Custom Commands des Kanals ein-/auszuschalten (einzeln geht es über die Checkbox "Aktiv" je Zeile). Ein deaktivierter Command reagiert im Chat nicht mehr, bleibt aber inklusive Text/Aliase/Nutzungszähler erhalten.
- **Automessages-Tab:** Intervall in Minuten und "nur wenn live".
- **Filter-Tab (Moderation → Filter):** Link-Filter an/aus, `/me`-Nachrichten löschen an/aus, sowie eigene Listen für erlaubte Links und auslösende Domain-Endungen (ersetzen `configs/links.txt`/`configs/TLDs.txt` nur für diesen Kanal).

Ohne eigene Anpassung gilt für jeden Kanal der eingebaute Standardwert. Diese Werte stehen nicht mehr in der `.env`; sie werden nur noch im Dashboard geändert.

## Benutzerrechte pro Kanal

Unter **Verwaltung → Benutzer** kannst du beim Bearbeiten eines Benutzers auswählen, welche Twitch-Kanäle er verwalten darf. Ohne Auswahl hat er wie bisher Zugriff auf alle Kanäle. Mit Auswahl sieht er in der Kanalauswahl oben nur noch seine erlaubten Kanäle, und die API lehnt Zugriffe auf andere Kanäle mit einer Fehlermeldung ab. Der `WEB_ADMIN_TOKEN`-Notfallzugang ist von dieser Einschränkung immer ausgenommen.

## Alerts (Dashboard)

Unter **Chat → Alerts** siehst und bearbeitest du die Texte für Sub, Resub, Bits, Raid, Einzel-Gift, Community-Gift, verlängerten Gift-Sub und Prime-Upgrade. Jeder Text hat feste Platzhalter (z. B. `{user}`, `{months}`, `{bits}`, `{viewers}`, bei Sub/Resub/Einzel-Gift zusätzlich `{tier}`), die beim Senden ersetzt werden. Über "Testen" schickt der Bot den aktuellen Text sofort mit Beispielwerten in den Chat, ohne dass ein echtes Ereignis nötig ist. "Auf Standard zurücksetzen" stellt den ursprünglichen Text wieder her. Ohne eigene Anpassung gelten die bisherigen Standardtexte unverändert weiter. **Alerts kommen standardmäßig als normale Chatnachricht**; die farbige/kursive `/me`-Darstellung lässt sich pro Alert mit der Checkbox „Als /me senden“ zuschalten (gilt auch für die Level-Up-Meldung und für den Testversand).

## Login-Sitzung

Das Dashboard-Login bleibt im Browser gespeichert (`localStorage`), solange der Bot-Prozess durchläuft. **Nach jedem Neustart des Bots** (und damit des Web-Servers) werden alle zuvor ausgestellten Login-Tokens automatisch ungültig – wer das Dashboard danach öffnet, sieht wieder den Login-Bildschirm, statt automatisch eingeloggt zu bleiben. Der `WEB_ADMIN_TOKEN`-Notfallzugang ist davon unberührt (er ist kein Login-Token, sondern ein statischer Schlüssel). Nach dem Login landet man immer zuerst in der "Übersicht".

## Discord

Verwaltung (für „Server verwalten" bzw. `DISCORD_ADMIN_ROLE_ID`): `/add`, `/edit`, `/del` (jeweils mit Unterpunkt `command`, `alias` bzw. `blacklist`, z. B. `/add alias command:<command> alias:<alias>`, `/add blacklist wort:<wort> aktion:<0-10>`; `/edit` kennt `command` und `blacklist`), `/view /commands /aliase /blacklist`. Für alle: `/watchtime` (optional `monat`), `/profil` (Embed „Nutzer- Profil“: Twitch-Name, Level, Punkt und ein Fortschrittsbalken mit Prozent bis zum nächsten Level; Thumbnail ist das Discord-Profilbild des Nutzers; wie `/watchtime` mit optional `twitchuser`/`user`, sonst der verknüpfte Twitch-Name), `/top10` (mit Seitenknöpfen), `/link`, `/unlink`, `/info` (früher `/twitchname`: Discord-/Twitch-Name, Account-Alter, Follow-Dauer), `/zitat` (optional `nummer`, sonst zufällig; nutzt den Twitch-Kanal von `DISCORD_TWITCH_CHANNEL`).

**Status:** In der Dashboard-Übersicht zeigt eine Karte "Discord", ob der Bot verbunden ist; darunter stehen Serveranzahl, registrierte Slash-Commands und ob Blacklist-/Say-Kanal gesetzt sind. Schlägt der Start fehl, steht der Grund dort (nur für Admins).

**Code-Aufbau (`src/discord/`):** `bot.js` (Start, Registrierung, Verteiler), `definitions.js` (Slash-Command-Definitionen), `handlers/admin.js` und `handlers/public.js` (Logik), `blacklist-channel.js`, `say.js`, `state.js` (Client + Status), `util.js`, `embeds.js`.

- **`/view name:<command> [channel]`** zeigt den vollständigen, unveränderten Antworttext eines Custom Commands (oder, wenn `name` ein Alias ist, des Ziel-Commands) als Embed an ("Command-Info:", mit Aliasen – gibt es keine, steht „Es sind keine Aliase zu diesem Befehl vorhanden“ – und Cooldown; Fußzeile "CCMD"/"MCMD" je nach Rechtestufe) – wie `!view` im alten Bot, hier als Slash-Command.
- **`/commands [channel]`** zeigt wie `!cmd` im alten Bot die komplette Übersicht als Embed: NUR Custom Commands, Mod-Commands, Aliase und Zähler (keine fest einprogrammierten Standard-Commands).
- **`/add`, `/edit`, `/del`, `/view` und `/commands` antworten sichtbar im Kanal** (nicht "versteckt"/ephemeral wie die übrigen Verwaltungs-Commands), damit andere Moderatoren mitbekommen, wenn jemand einen Command anlegt, ändert oder löscht bzw. sich die Übersicht ansieht.
- Alle Discord-Embeds liegen zentral in `src/discord/embeds.js` und teilen sich eine gemeinsame Farbe, einstellbar über `DISCORD_EMBED_COLOR` in der `configs/.env` (Hex, z. B. `#1abc9c`; ohne Angabe gilt der bisherige Standard).
- **"say"-Funktion:** Jede Nachricht, die im Discord-Kanal `DISCORD_SAY_CHANNEL_ID` geschrieben wird, postet der Bot 1:1 in den Twitch-Chat von `DISCORD_SAY_TWITCH_CHANNEL` (Standard: `DISCORD_TWITCH_CHANNEL`). Nachrichten von Bots werden ignoriert. Dafür braucht der Bot den **"Message Content Intent"** – im [Discord Developer Portal](https://discord.com/developers/applications) unter *Bot → Privileged Gateway Intents* aktivieren, sonst sieht der Bot den Nachrichtentext nicht.
- Bot mit den Scopes `bot` **und** `applications.commands` einladen (fehlt `applications.commands`, erscheinen keine Slash-Commands); `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` und `DISCORD_GUILD_ID` müssen gesetzt sein, sonst startet der Discord-Teil gar nicht. Neu registrierte Slash-Commands können serverseitig bis zu einigen Minuten brauchen, bis Discord sie anzeigt.

### Nur einen Twitch-Kanal angeben

Für die Verwaltungs-Commands, `/watchtime` & Co. und die "say"-Funktion reicht jetzt eine einzige Angabe:

```
DISCORD_TWITCH_CHANNEL=dein_kanal
```

`DISCORD_SAY_TWITCH_CHANNEL` bleibt als **optionaler** Override erhalten, falls die "say"-Funktion einen anderen Kanal bespielen soll als der Rest. Die älteren Variablen `DISCORD_DEFAULT_CHANNEL` und `DISCORD_WATCHTIME_CHANNEL` gibt es nicht mehr; ohne `DISCORD_TWITCH_CHANNEL` gilt der erste Kanal aus `TWITCH_CHANNELS`.

### Verwaltung und Nutzer-Commands auf getrennten Servern

Standardmäßig laufen alle Slash-Commands auf dem/den in `DISCORD_GUILD_ID` angegebenen Server(n). Sollen die **Nutzer-Commands** (`/watchtime`, `/profil`, `/top10`, `/link`, `/unlink`, `/info`) auf einem **anderen** Discord-Server laufen als die **Verwaltungs-Commands** (`/add`, `/edit`, `/del`, `/view`, `/addbl`, …), trägst du den Nutzer-Server in `DISCORD_PUBLIC_GUILD_ID` ein:

```
DISCORD_GUILD_ID=123   # Server mit den Verwaltungs-Commands
DISCORD_PUBLIC_GUILD_ID=456   # Server mit den Nutzer-Commands
```

Beide Werte akzeptieren auch mehrere, Komma-getrennte Server-IDs. Auf jedem Server werden nur die Commands registriert, für die er konfiguriert ist – `/add` taucht dann auf Server 456 gar nicht erst auf, `/watchtime` nicht auf Server 123. Der Bot muss auf **beiden** Servern eingeladen sein (Scopes `bot` + `applications.commands`). Lässt du `DISCORD_PUBLIC_GUILD_ID` leer, bleibt alles wie bisher auf einem gemeinsamen Server.

## Unterschiede zum alten Bot

- **Nicht übernommen:** das `hosted`-Event (Twitch hat den Host-Modus abgeschafft), der Discord-`eval`-Befehl (bewusst weggelassen: beliebige Code-Ausführung), die Discord-Prefix-Befehle (ersetzt durch Slash-Commands) und die Konsolen-Commands.
- Abfragen (`!uptime`, `!game`, `!title`, `!info`, `!age`, `!fage`, `!emote sub`) laufen über die Twitch-API statt über decapi.me; `!dice` rechnet lokal.
- Hat ein Nutzer mehrere Rollen (z. B. VIP und Mod), gilt die höchste (im alten Bot die erste zutreffende).
- Alte Werte wie `blizzorLogo` (`!uptime`) und `TPFufun` (`!addbl`) stehen in `EMOTES` in `src/twitch/commands.js`.


**Handy-Ansicht:** Custom Befehle, Automessages, Umfragen, Zitate, Aliase, Zähler und Blacklist erscheinen auf schmalen Bildschirmen als einklappbare Karten; Bearbeiten/Löschen (bzw. Beenden) erscheinen erst nach dem Aufklappen. Der Umfrage-Modus heißt jetzt "Twitch-Poll".


## Platzhalter in Custom Commands

| Platzhalter | Ergebnis |
|---|---|
| `{user}` | Name des Aufrufers |
| `{touser}` | erstes Argument (ohne @), sonst der Aufrufer – z. B. `!hug @anna` |
| `{args}` | alle Argumente |
| `{channel}`, `{count}` | Kanalname, Anzahl der Aufrufe |
| `{counter:name}` | erhöht den Zähler und setzt den neuen Wert ein |
| `{random:1-100}` | Zufallszahl (Grenzen eingeschlossen) |
| `{pick:Ja\|Nein\|Vielleicht}` | zufällige Auswahl |
| `{game}`, `{title}` | aktuelle Kategorie / Stream-Titel (Twitch-API) |
| `{viewers}`, `{uptime}` | Zuschauerzahl / Live-Dauer (Twitch-API, offline: 0 bzw. "offline") |
| `{time}`, `{date}` | Uhrzeit / Datum (deutsche Zeit) |

Die Twitch-API wird nur abgefragt, wenn der Text einen der API-Platzhalter wirklich enthält. Der Code liegt in `src/twitch/placeholders.js`.

## Timer und Erinnerungen

Moderatoren können im Chat Erinnerungen stellen: `!timer 10m Pause vorbei` schreibt nach Ablauf „⏰ Pause vorbei (Timer von <Name>)“ in den Chat. Dauer: `10m`, `1h30m`, `90s`, `1:30` oder nur eine Zahl (= Minuten), maximal 24 Stunden. `!timer list` zeigt die laufenden Timer, `!timer cancel <Nr>` bricht einen ab, `!timer clear` alle. Höchstens 10 Timer pro Kanal. Die Timer stehen in der Datenbank (Tabelle `timers`) und laufen nach einem Neustart weiter. Was in der Zwischenzeit abgelaufen ist, wird bis 15 Minuten danach noch mit dem Zusatz „verspätet wegen Neustart“ nachgeholt, ältere Timer werden verworfen.

## Spam-Filter (Caps, Emotes, Wiederholungen, Zeichen)

Im Dashboard unter **Moderation → Filter → „Spam-Filter“** (pro Kanal, standardmäßig aus). Er gilt nur für Nutzer ohne Rolle; auffällige Nachrichten werden gelöscht (und im Moderations-Statistik-Zähler als Treffer gezählt).

- **Caps-Filter:** löscht Nachrichten mit mindestens X % Großbuchstaben (Standard 70 %), geprüft erst ab einer Mindestzahl Buchstaben (Standard 10). Nur Buchstaben zählen.
- **Emote-Spam-Filter:** löscht Nachrichten mit mehr als X Emotes (Standard 10). Gezählt werden Twitch-Emotes; 7TV/BTTV/FFZ-Emotes erkennt der Bot nicht.

- **Wiederholungs-Filter:** löscht eine Nachricht, wenn derselbe Nutzer sie innerhalb von 60 Sekunden zum X-ten Mal schickt (Standard 3, Groß-/Kleinschreibung egal). Der Zähler liegt im Arbeitsspeicher.
- **Zeichen-Spam-Filter:** löscht Nachrichten, in denen ein Zeichen X-mal hintereinander vorkommt (Standard 15) oder die zu mindestens X % aus Sonderzeichen bestehen (Standard 60 %, ab 10 Zeichen). Reine Emoji-Nachrichten zählen als Sonderzeichen.

Links filtert der bestehende Link-Filter (gleiche Stelle im Dashboard).


## Start des Bots

Beim Start meldet der Bot, wie lange die einzelnen Schritte gedauert haben (`Start: Datenbank-Schema - … ms`, `Start: Twitch-Verbindung - … ms`, zuletzt `Start abgeschlossen nach … ms`). Beim Start misst der Bot außerdem, wie lange Verbindungsaufbau und eine einfache Abfrage zur Datenbank dauern (`Datenbank (…): Verbindungsaufbau … ms, Abfrage … ms`) und schreibt Web-Anfragen, die länger als 1 Sekunde dauern, als `Langsame Anfrage: …` ins Log. Der Datenbank-Pool schließt ungenutzte Verbindungen nach 10 s selbst, damit ein `idle_session_timeout` des Postgres-Servers keine Fehlermeldung auslöst; der Neuaufbau kostet lokal nur wenige Millisekunden. Scheitert schon der Verbindungsaufbau (z. B. `Connection terminated due to connection timeout` bei einem kurzen Postgres-/Netzwerkaussetzer), versucht der Bot die Abfrage einmal nach 2 Sekunden erneut; Fehler mitten in einer Abfrage werden bewusst nicht wiederholt, damit nichts doppelt ausgeführt wird. Ist der Verbindungsaufbau langsam und `PGHOST=localhost` gesetzt, hilft oft `PGHOST=127.0.0.1` in `configs/.env`. Das Datenbankschema wird nur noch geprüft, wenn es sich geändert hat (Fingerabdruck in der Tabelle `schema_meta`); sonst entfällt dieser Schritt. Wer die Prüfung trotzdem erzwingen will (z. B. nach manuellen Eingriffen in die Datenbank), setzt `FORCE_SCHEMA_CHECK=true` in `configs/.env`.

## Link-Freigabe (`!permit`)

Der Link-Filter löscht Links von Nutzern ohne Rolle. Mit einer Freigabe darf ein Nutzer trotzdem Links posten, alle anderen Filter (Blacklist, Caps, Emotes, ...) gelten weiter:

- `!permit <Name>` (Mods): 5 Minuten. `!permit <Name> 30m` (auch `1h`, `90s`) setzt eine eigene Dauer, `!permit <Name> stream` gilt, solange der Kanal live ist. Jede Freigabe endet nach höchstens 12 Stunden. `stream` geht nur, wenn der Kanal gerade live ist. Der Bot bestätigt im Chat.
- `!unpermit <Name>` nimmt die Freigabe zurück. Erneutes `!permit` ersetzt die bestehende Freigabe (kein Doppeleintrag).
- Dashboard: **Moderation → Filter** → einklappbarer Abschnitt **Link-Freigaben** mit der Liste der aktuellen Freigaben (Ablaufzeit, Freigegeben von, *Entfernen*) und einem Formular zum Freigeben. Änderungen im Dashboard stehen im Audit-Log.
- Die Freigaben stehen in der Datenbank (`link_permits`) und überleben einen Neustart. Eine „bis Stream-Ende"-Freigabe wird gelöscht, sobald die Watchtime-Erfassung (alle 30 s) oder der nächste Link nach dem Stream-Ende bemerkt, dass der Kanal offline ist.

## Token-Überwachung

Der Bot prüft 45 Sekunden nach dem Start und danach alle 6 Stunden, ob die gespeicherten Twitch-Tokens noch gültig sind (Streamer-Token jedes Kanals, Bot-Account-Token, Chat-Token). Ein abgelaufener Access-Token ist dabei **kein** Problem: Er wird automatisch mit dem Refresh-Token erneuert (die Tokens halten nur wenige Stunden). Gemeldet wird erst, wenn auch die Erneuerung scheitert, weil der Token widerrufen wurde, das Passwort geändert wurde oder die App neu erstellt wurde. Ist Twitch nur nicht erreichbar, gibt es keinen Alarm.

- **Dashboard:** In der Übersicht steht über den Karten eine Warnung mit dem nötigen Schritt (z. B. neu autorisieren). Bot-Account- und Chat-Token-Warnungen sehen nur Admins. Nach dem Neu-Autorisieren verschwindet die Warnung, sobald der neue Token geprüft ist.
- **Chat-Token ohne Refresh-Token** (`TWITCH_OAUTH_TOKEN` allein): läuft er in weniger als 7 Tagen ab, kommt eine Warnung, ist er abgelaufen, eine Fehlermeldung. Mit `TWITCH_BOT_REFRESH_TOKEN` erneuert der Bot ihn selbst und prüft ihn nicht gesondert.
- **Log:** Ein neues Problem steht einmal als Warnung im Log (`Token-Prüfung: …`), ebenso, wenn es behoben ist. Nicht bei jeder Prüfung erneut.

## npm-Hinweis zu esbuild

Neuere npm-Versionen blockieren Install-Skripte von Abhängigkeiten, bis man sie freigibt, und warnen dann (`npm warn install-scripts … esbuild`). `esbuild` gehört zum Dashboard-Build (Vite) und braucht sein Install-Skript. Die Freigabe steht an drei Stellen, damit sie sicher greift: `allowScripts` in der `package.json` im Hauptordner **und** in `web-client/` (einmal fest auf die Version aus der Warnung, einmal für jede Version) sowie `allow-scripts=esbuild` in der `.npmrc` im Hauptordner. Bleibt die Warnung trotzdem, hilft: `npm install-scripts approve esbuild --no-allow-scripts-pin` (im Hauptordner ausführen).

## Netzwerk: IPv4 bevorzugt

Der Bot bevorzugt IPv4 (`src/network.js`). Hintergrund: Wenn ein Netz für Twitch zwar IPv6-Adressen liefert, darüber aber keine Verbindung zustande kommt, wartet Node rund 10 Sekunden, bevor es IPv4 versucht – Token-Erneuerung, Twitch-Autorisierung und Live-Status wurden dadurch jedes Mal um etwa 10 Sekunden langsamer. Wer ein reines IPv6-Netz nutzt, setzt `PREFER_IPV6=true` in `configs/.env`.

## Fehlersuche bei langsamen Twitch-Anfragen

- Mit `DIAGNOSE=true` (siehe oben) zeigt der Start die Zeiten der einzelnen Schritte (`Start: … - … ms`, Datenbank-Messung, `Start abgeschlossen nach … ms`) und startet im Hintergrund einen Netzwerk-Test; ohne `DIAGNOSE` bleiben diese Zeilen aus. Der Netzwerk-Test: `Netzwerk-Test id.twitch.tv: DNS … ms (IPv4+IPv6), TCP: IPv6 …, IPv4 …, HTTPS … ms`. Er zeigt, ob DNS, IPv6 oder IPv4 der Grund ist, wenn Twitch langsam antwortet.
- Dauert ein Schritt der Twitch-Autorisierung länger als 1 s, steht im Log `Twitch-Autorisierung, Schritt "…": … ms`.

## Twitch-Anfragen: erreichbare Server-Adresse wählen

`id.twitch.tv` und `api.twitch.tv` liefern mehrere Server-Adressen. Ist eine davon im eigenen Netz nicht erreichbar, wartet Nodes eingebautes `fetch` nur auf diese eine und gibt nach 10 Sekunden mit `UND_ERR_CONNECT_TIMEOUT` auf (Folgen: Token-Erneuerung und Twitch-Autorisierung scheitern oder dauern 10 s länger, der Chat bricht mit „fetch failed“ ab). Darum laufen Anfragen an diese beiden Hosts über `src/utils/twitch-fetch.js`: Sie testet alle Adressen gleichzeitig (TCP, Port 443), nimmt die schnellste erreichbare und merkt sie sich 5 Minuten. Zertifikat und TLS werden normal gegen den Hostnamen geprüft. Der Netzwerk-Test nach dem Start zeigt pro Adresse, ob sie erreichbar ist (`Netzwerk-Test id.twitch.tv: … TCP: <IP> ok/Zeitüberschreitung …`).
