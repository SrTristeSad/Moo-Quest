// Moo-Quest native loopback bridge for al007ex/moomoo-clone Node.js server.
// Install at server/src/network/nativeBridge.js using tools/prepare-node-server.mjs.
// Uses the ORIGINAL reconstructed Game, Player, AI and handlePacket functions.
// Explicitly loopback-only: NOT a public online endpoint or a browser-anticheat bypass.
import net from "node:net";
import { randomBytes } from "node:crypto";
import msgpack from "msgpack-lite";
import { handlePacket } from "./packets.js";

const MAX_FRAME = 1024 * 1024;
const MAX_QUEUE = 2 * MAX_FRAME;
const MAX_RATE = 80;
const allowedHost = new Set(["127.0.0.1", "::1"]);
const isLoopback = (ip) => ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
const isPacketName = (name) =>
    typeof name === "string" && name.length === 1 && /^[A-Za-z0-9]$/.test(name);

function frame(message) {
    const body = msgpack.encode(message);
    if (body.length < 1 || body.length > MAX_FRAME) throw Error("native frame too large");
    const out = Buffer.allocUnsafe(body.length + 4);
    out.writeUInt32BE(body.length, 0);
    body.copy(out, 4);
    return out;
}

// Host is deliberately non-configurable through environment variables. The Node game
// can be hosted online separately via its own production-ready authenticated gateway,
// but the temporary raw TCP bridge must NEVER become publicly accessible.
export function startNativeBridge({ games, accounts, moderation, chat, log, port = 17017 }) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw Error("invalid native bridge port");
    }
    const game = games.get("LC");
    if (!game) throw Error("native bridge requires existing LC game");
    let openConnections = 0;
    const bridge = net.createServer((socket) => {
        if (!isLoopback(socket.remoteAddress) || moderation.isBanned(socket.remoteAddress, null, null)) {
            socket.destroy();
            return;
        }
        if (openConnections >= 32 || game.playerCount() >= game.capacity) {
            socket.destroy();
            return;
        }

        openConnections++;
        const id = "native-" + randomBytes(8).toString("hex");
        const ip = socket.remoteAddress;
        let closed = false;
        let player = null;
        let input = Buffer.alloc(0);
        let violations = 0;
        let rateAt = Date.now();
        let packetsThisSecond = 0;

        socket.setNoDelay(true);
        socket.setTimeout(60_000);
        const disconnect = () => {
            if (closed) return;
            closed = true;
            openConnections--;
            if (player) game.removePlayer(player);
            log(`[LC/native] disconnected ${id}`);
        };
        const send = (name, ...args) => {
            if (closed || socket.destroyed) return;
            const outbound = frame(["event", name, args]);
            if (socket.writableLength + outbound.length > MAX_QUEUE) {
                socket.destroy();
                return;
            }
            socket.write(outbound);
        };
        const kick = (why) => {
            send("B", String(why || "disconnected"));
            socket.end();
        };

        try {
            player = game.addPlayer({ send, account: null, ip, id });
            if (!player) {
                socket.destroy();
                return;
            }
        } catch (error) {
            log(`[LC/native] addPlayer failed: ${String(error)}`);
            socket.destroy();
            return;
        }
        // The native client has no browser bundle or browser-integrity telemetry.
        // Instead, it receives a separate protocol and server-side invalid-packet,
        // rate and abuse enforcement. No original game mechanics are bypassed.
        const invalid = (name, detail) => {
            violations++;
            log(`[LC/native] invalid ${name}: ${detail} (${violations})`);
            if (violations >= 4) socket.destroy();
        };
        player.anticheat = {
            invalid,
            onGameStart() {},
            onTelemetry() { invalid("T", "native telemetry is not supported"); },
            tick() {}
        };
        player.kick = kick;
        const ctx = { game, accounts, moderation, chat, log };

        socket.on("data", (chunk) => {
            if (closed) return;
            input = Buffer.concat([input, chunk]);
            if (input.length > MAX_FRAME + 4) {
                socket.destroy();
                return;
            }
            while (input.length >= 4) {
                const length = input.readUInt32BE(0);
                if (length < 1 || length > MAX_FRAME) {
                    socket.destroy();
                    return;
                }
                if (input.length < length + 4) break;
                const body = input.subarray(4, length + 4);
                input = input.subarray(length + 4);
                const now = Date.now();
                if (now - rateAt >= 1000) {
                    rateAt = now;
                    packetsThisSecond = 0;
                }
                packetsThisSecond++;
                if (packetsThisSecond > MAX_RATE) {
                    socket.destroy();
                    return;
                }
                let packet;
                try { packet = msgpack.decode(body); }
                catch {
                    invalid("?", "bad MessagePack");
                    if (socket.destroyed) return;
                    continue;
                }
                if (!Array.isArray(packet) || packet.length !== 2
                        || !isPacketName(packet[0]) || !Array.isArray(packet[1])) {
                    invalid("?", "invalid packet envelope");
                    if (socket.destroyed) return;
                    continue;
                }
                const [name, args] = packet;
                if (name === "T") {
                    invalid(name, "browser telemetry not available in native protocol");
                    if (socket.destroyed) return;
                    continue;
                }
                try { handlePacket(ctx, player, name, args); }
                catch (error) {
                    log(`[LC/native] handler error: ${String(error)}`);
                    invalid(name, "handler exception");
                    if (socket.destroyed) return;
                }
            }
        });
        socket.on("timeout", () => socket.destroy());
        socket.on("close", disconnect);
        socket.on("error", () => {});
    });
    bridge.on("error", (error) => log(`[LC/native] listener error: ${error.message}`));
    bridge.listen(port, "127.0.0.1", () => {
        log(`[LC/native] Lua client connection ready on 127.0.0.1:${port}`);
    });
    return bridge;
}
