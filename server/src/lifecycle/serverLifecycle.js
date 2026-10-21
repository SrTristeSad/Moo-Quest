// Server lifecycle inspired by the operational patterns used in
// SrTristeSad/BrowserQuest-Revived, adapted to Moo-Quest's authoritative
// real-time simulation, encrypted WebSocket protocol and restart notices.
// No BrowserQuest movement, combat or network protocol is imported here.
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const closeSockets = (socketServer, log) => new Promise((resolve, reject) => {
    if (!socketServer) return resolve();
    for (const ws of socketServer.clients || []) {
        try { ws.terminate(); } catch (error) { log(`[Moo-Quest] socket: ${error}`); }
    }
    socketServer.close(error => error ? reject(error) : resolve());
});

export function createServerLifecycle({
    games, accounts, httpServer, websocketServer, social, stream, log = console.log,
    wait = sleep, noticeSeconds = 3, socketGraceMs = 200
}) {
    let stopping = false;
    let task = null;

    function isStopping() { return stopping; }

    function shutdown(signal = "shutdown") {
        // Subsequent signals share the same work. Never exit early and lose
        // pending account/clan writes just because Ctrl+C was pressed twice.
        if (task) return task;
        stopping = true;
        task = (async () => {
            const errors = [];
            const phase = async (label, action) => {
                try { await action(); }
                catch (error) {
                    errors.push({ phase: label, error });
                    log(`[Moo-Quest] shutdown ${label}: ${error?.stack || error}`);
                }
            };
            log(`[Moo-Quest] ${signal}: closing game safely`);
            await phase("notice", () => {
                for (const game of games.values()) game.announceShutdown(noticeSeconds);
            });
            // The "Z" countdown is a real promise to connected clients.
            await phase("countdown", () => wait(noticeSeconds * 1000));
            await phase("simulation", () => {
                for (const game of games.values()) game.stop();
            });
            await phase("disconnect", () => {
                for (const game of games.values()) game.closeAll();
            });
            // Player.kick sends the original B packet and closes after 100ms.
            // Allow its data frame to leave before terminating lingering peers.
            await phase("socket grace", () => wait(socketGraceMs));
            // Closing sockets triggers Game.removePlayer -> recordLife ->
            // AccountStore.save(). Flush only AFTER those close handlers finish,
            // or the last lifetime stats and clan updates are lost.
            await phase("websocket", () => closeSockets(websocketServer, log));
            // FRVR social uses another noServer WebSocketServer and page
            // events use long-lived HTTP SSE connections. Closing only the
            // gameplay sockets leaves a VPS restart hanging on open streams.
            await phase("social websocket", () => closeSockets(social?.wss, log));
            await phase("page streams", () => {
                if (!stream) return;
                for (const page of [...stream.pages]) page.res.end();
                stream.pages.clear();
            });
            await phase("accounts and clans", () => {
                if (accounts && typeof accounts.flush === "function") accounts.flush();
            });
            await phase("http", () => new Promise((resolve, reject) => {
                if (!httpServer || !httpServer.listening) return resolve();
                httpServer.close(error => error ? reject(error) : resolve());
                if (typeof httpServer.closeIdleConnections === "function") httpServer.closeIdleConnections();
            }));
            if (errors.length) log(`[Moo-Quest] shutdown finished with ${errors.length} error(s)`);
            else log("[Moo-Quest] shutdown complete: all sessions closed, accounts saved");
            return { ok: errors.length === 0, errors };
        })();
        return task;
    }
    return { isStopping, shutdown };
}

// A bounded final fallback is necessary when a transport or filesystem
// dependency hangs on an OS signal; the normal path always flushes first.
export function installShutdownSignals(lifecycle, {
    processObject = process, log = console.error, timeoutMs = 10000
} = {}) {
    const onSignal = (signal) => {
        const watchdog = setTimeout(() => {
            log(`[Moo-Quest] shutdown timed out after ${timeoutMs}ms`);
            processObject.exit(1);
        }, timeoutMs);
        watchdog.unref?.();
        lifecycle.shutdown(signal).then(
            result => { clearTimeout(watchdog); processObject.exit(result.ok ? 0 : 1); },
            error => {
                clearTimeout(watchdog);
                log(`[Moo-Quest] shutdown exception: ${error?.stack || error}`);
                processObject.exit(1);
            }
        );
    };
    processObject.once("SIGINT", () => onSignal("SIGINT"));
    processObject.once("SIGTERM", () => onSignal("SIGTERM"));
}
