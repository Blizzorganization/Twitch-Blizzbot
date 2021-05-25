# Konfiguration vom Bot

## Twitch 

### Eintragung der Daten für den Bot 

```
username -> Hier gibst du den Nutzernamen vom Bot an, so wie er angezeigt werden soll
password -> Hier gibst du den OAuth-Token von dem Account an als welcher der Bot arbeiten soll wichtig hierbei
            muss nur das angeben was hinter oauth. steht

channels -> Hier gibst du an auf welchem Twitchchanel der Bot arbeiten soll
```
### Cooldowns

#### Raidminutes

```
Hier gibts du die Minutenzahl wie lange der Raidmodus aktiv sein soll 
da heißt wie viel Zeit zwischwn aktivieren und deaktivieren vergeht
```
#### Cooldown

```
Hier kannst du angeben wie viel Zeit in Sekunden vergehen muss das der Bot wieder auf 
einen einprogrammierten Command reagiert (z.b. followage, age, Watchtime)
```
### Links die Erlaubt sein

```
Um Ausgewählte Link in deinem Chat zu Aktivieren schreibe einfach in die links.txt die Seiten rein 
    z.b clips.twitch.tv
```
## Discord 

### Grundlegendes 

```
Token ->
Hier wird der Discord Token angegeben über welchen der Bot auf Discord interagieren soll 

Prefix ->
Hier wird der Prefix angeben mit welchem der Bot auf Discord interagiert (z.b !top10)
    
```
### Watchtimefunktion auf dem Discord

```
watchtimechannel -> Hier musst du angeben den Namen aus dem Twitch Teil wo der Bot arbeitet
```
### Eval User

```
evalUsers -> Hier musst du die User ID angeben welcher Discord Nutzer alle Rechte auf den Bot haben soll
    z.B ["523963492408229888", "523963492408229888"]
```
**Damit kann man remote code ausführen und man sollte aufpassen, wer Zugriff hat,<br> 
da man damit Zugriff auf sämtliche Daten vom Bot und dem Hostsystem hat**

### Channel

```
blacklist ->  Hier wird der Channel angegeben indem die Blacklist angezeigt wird 

commands -> In diesem Channel können die Commands !top10 und !watchtime

relay -> Alles was in diesen Channel geschrieben wird als Bot im Twitchchannel geschrieben 

adminCommands -> In dem channel können alle moderations Befehle ausgeführt werden (!addbl, !delbl, !blacklist, !eval, !mwatchtime)
```