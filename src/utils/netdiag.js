import dns from "node:dns/promises";
import net from "node:net";
import { logger } from "./logger.js";
import { rawFetch } from "../network.js";

/**
 * Netzwerk-Selbsttest für Twitch (läuft einmal im Hintergrund nach dem Start, blockiert nichts).
 * Zeigt, WARUM Anfragen an Twitch langsam sind: DNS, IPv6 vs. IPv4 (je Adresse ein TCP-Verbindungstest auf Port 443)
 * und die Dauer einer echten HTTPS-Anfrage.
 */
const HOSTS = ["id.twitch.tv", "api.twitch.tv"];

function tcpConnect(address, family, port = 443, timeoutMs = 4000) {
    return new Promise((resolve) => {
        const started = Date.now();
        const socket = net.connect({ host: address, port, family });
        const done = (result) => {
            socket.destroy();
            resolve(`${address} ${result}`);
        };
        socket.setTimeout(timeoutMs, () => done(`Zeitüberschreitung (${timeoutMs} ms)`));
        socket.once("connect", () => done(`ok (${Date.now() - started} ms)`));
        socket.once("error", (e) => done(`Fehler ${e.code ?? e.message}`));
    });
}

async function checkHost(host) {
    const t0 = Date.now();
    let addresses;
    try {
        addresses = await dns.lookup(host, { all: true, verbatim: true });
    } catch (e) {
        return `${host}: DNS fehlgeschlagen (${e.code ?? e.message}, ${Date.now() - t0} ms)`;
    }
    const dnsMs = Date.now() - t0;
    // Alle Adressen testen (höchstens 8): eine einzelne nicht erreichbare Adresse reicht für lange Wartezeiten
    const sample = addresses.slice(0, 8);
    const tcp = await Promise.all(sample.map((a) => tcpConnect(a.address, a.family)));
    const t1 = Date.now();
    let https;
    try {
        await rawFetch(`https://${host}/`, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
        https = `eingebautes fetch ${Date.now() - t1} ms`;
    } catch (e) {
        https = `eingebautes fetch Fehler ${e?.cause?.code ?? e.message} (${Date.now() - t1} ms)`;
    }
    const t2 = Date.now();
    try {
        await fetch(`https://${host}/`, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
        https += `, Bot-Anfrage ${Date.now() - t2} ms`;
    } catch (e) {
        https += `, Bot-Anfrage Fehler ${e?.cause?.code ?? e.message} (${Date.now() - t2} ms)`;
    }
    const families = [...new Set(addresses.map((a) => `IPv${a.family}`))].join("+");
    return `${host}: DNS ${dnsMs} ms (${families}), TCP: ${tcp.join(", ")}, ${https}`;
}

export async function runNetworkDiagnose() {
    try {
        const lines = await Promise.all(HOSTS.map(checkHost));
        for (const l of lines) logger.diag(`Netzwerk-Test ${l}`);
    } catch (e) {
        logger.warn(`Netzwerk-Test fehlgeschlagen: ${e.message}`);
    }
}
