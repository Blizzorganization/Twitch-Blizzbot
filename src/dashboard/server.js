import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { isWeakSecret, createLoginLimiter, createRateLimiter, securityHeaders } from "./security.js";
import { auth, adminTokenUsable } from "./context.js";
import { createAuthRoutes } from "./auth-routes.js";
import { registerMeta } from "./routes/meta.js";
import { registerTwitchAuth } from "./routes/twitch-auth.js";
import { registerCommands } from "./routes/commands.js";
import { registerBackup } from "./routes/backup.js";
import { registerBlacklist } from "./routes/blacklist.js";
import { registerAutomessages } from "./routes/automessages.js";
import { registerTimers } from "./routes/timers.js";
import { registerQuotes } from "./routes/quotes.js";
import { registerGreetings } from "./routes/greetings.js";
import { registerVerifyMods } from "./routes/verify-mods.js";
import { registerGiveaways } from "./routes/giveaways.js";
import { registerPolls } from "./routes/polls.js";
import { registerPredictions } from "./routes/predictions.js";
import { registerRewards } from "./routes/rewards.js";
import { registerAlerts } from "./routes/alerts.js";
import { registerSettings } from "./routes/settings.js";
import { registerLoyalty } from "./routes/loyalty.js";
import { registerOverview } from "./routes/overview.js";
import { registerUsers } from "./routes/users.js";
import { registerAudit } from "./routes/audit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startWebServer() {
    // Ohne eigenes, starkes Geheimnis könnte jeder gültige Anmelde-Tokens selbst ausstellen - dann lieber kein Dashboard.
    if (isWeakSecret(config.web.jwtSecret)) {
        logger.error(
            "Web-Dashboard NICHT gestartet: WEB_JWT_SECRET fehlt oder ist unsicher (Platzhalter oder unter 16 Zeichen). " +
                "In configs/.env eine lange Zufallszeichenkette eintragen, z. B. mit: " +
                "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
        );
        return null;
    }
    if (!adminTokenUsable()) {
        logger.warn(
            config.web.adminToken
                ? "WEB_ADMIN_TOKEN ist unsicher (Platzhalter oder unter 16 Zeichen) - der Notfall-Zugang per Admin-Token ist deaktiviert."
                : "WEB_ADMIN_TOKEN ist nicht gesetzt - der Notfall-Zugang per Admin-Token ist deaktiviert.",
        );
    }
    const app = express();
    app.disable("x-powered-by");
    if (config.web.trustProxy) app.set("trust proxy", config.web.trustProxy);
    app.use(securityHeaders);
    if (config.web.corsOrigin) {
        if (config.web.corsOrigin === "*") logger.warn('WEB_CORS_ORIGIN=* erlaubt Aufrufe von jeder Webseite - besser leer lassen oder auf die Dashboard-Adresse setzen.');
        app.use(cors({ origin: config.web.corsOrigin }));
    }
    const loginLimiter = createLoginLimiter();

    // Allgemeine Anfrage-Begrenzung pro IP (großzügig, das Dashboard läuft normal weiter) und eine strengere für
    // Anmeldung/Einrichtung/Twitch-Callback (zusätzlich zur Sperre nach Fehlversuchen).
    const apiRateLimiter = createRateLimiter({ windowMs: 60_000, limit: 1000 });
    const authRateLimiter = createRateLimiter({ windowMs: 60_000, limit: 30, message: "Zu viele Anmeldeversuche. Bitte kurz warten." });
    app.use(apiRateLimiter);
    app.use("/api/auth", authRateLimiter);
    app.use(express.json({ limit: "5mb" })); // groß genug für Sicherungs-Dateien (Import)

    // Fehlersuche: Anfragen, die länger als 1 s dauern, landen mit Pfad und Dauer im Log.
    app.use((req, res, next) => {
        const started = Date.now();
        res.on("finish", () => {
            const ms = Date.now() - started;
            if (ms > 1000) logger.warn(`Langsame Anfrage: ${req.method} ${req.originalUrl.split("?")[0]} – ${ms} ms`);
        });
        next();
    });

    // Debug-Hilfe für WEB_PUBLIC_URL (Twitch-Autorisierung nutzt diese als OAuth-Redirect-URI): zeigt beim Start
    // genau, welchen Wert der Prozess tatsächlich geladen hat - "(leer, Fallback auf Request-Host/localhost)"
    // bedeutet, dass WEB_PUBLIC_URL in configs/.env nicht (oder nicht für DIESEN Prozess) gesetzt ist.
    logger.diag(`WEB_PUBLIC_URL: ${config.web.publicUrl ? config.web.publicUrl : "(leer, Fallback auf Request-Host/localhost)"}`);


    app.use("/api/auth", createAuthRoutes(loginLimiter));

    const api = express.Router();
    api.use(auth);
    registerMeta(api);
    registerTwitchAuth(api);
    registerCommands(api);
    registerBackup(api);
    registerBlacklist(api);
    registerAutomessages(api);
    registerTimers(api);
    registerQuotes(api);
    registerGreetings(api);
    registerVerifyMods(api);
    registerGiveaways(api);
    registerPolls(api);
    registerPredictions(api);
    registerRewards(api);
    registerAlerts(api);
    registerSettings(api);
    registerLoyalty(api);
    registerOverview(api);
    registerUsers(api);
    registerAudit(api);

    app.use("/api", api);


    // Gebautes React-Frontend ausliefern (falls vorhanden)
    const dist = path.resolve(__dirname, "../../web-client/dist");
    if (fs.existsSync(dist)) {
        app.use(express.static(dist));
        app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
    } else {
        app.get("/", (req, res) =>
            res.send("API läuft. Frontend bauen mit: cd web-client && npm install && npm run build"),
        );
    }

    const server = app.listen(config.web.port, () => logger.diag(`Web-Interface läuft auf http://localhost:${config.web.port}`));
    server.on("error", (e) => {
        if (e?.code === "EADDRINUSE" || e?.code === "EACCES") {
            // Sofort und klar beenden: sonst läuft der Start weiter und der Bot fährt danach in Folgefehlern herunter.
            logger.error(e.code === "EADDRINUSE" ? `Port ${config.web.port} ist schon belegt.` : `Keine Berechtigung für Port ${config.web.port}.`);
            // Fehleranalyse nur mit DEBUG=true in configs/.env
            logger.debug(
                e.code === "EADDRINUSE"
                    ? `Läuft der Bot noch einmal (alter Prozess, zweites Terminal)? Mit "ss -ltnp | grep ${config.web.port}" den Prozess finden und beenden oder in configs/.env einen anderen Port setzen.`
                    : "Ports unter 1024 brauchen unter Linux erhöhte Rechte - einen höheren Port in configs/.env wählen.",
            );
            process.exit(1);
        }
        throw e;
    });
    return server;
}
