import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServerLifecycle } from "../src/lifecycle/serverLifecycle.js";
import { AccountStore } from "../src/api/store.js";

test("BrowserQuest-inspired lifecycle keeps Moo-Quest Z/B countdown and flush order", async () => {
    const trace = [];
    const players = [
        { terminate: () => trace.push("terminate A") },
        { terminate: () => trace.push("terminate B") }
    ];
    const games = new Map([
        ["LC", {
            announceShutdown: s => trace.push(`LC Z ${s}`),
            stop: () => trace.push("LC stop tick"),
            closeAll: () => trace.push("LC B kick")
        }],
        ["MB", {
            announceShutdown: s => trace.push(`MB Z ${s}`),
            stop: () => trace.push("MB stop tick"),
            closeAll: () => trace.push("MB B kick")
        }]
    ]);
    const lifecycle = createServerLifecycle({
        games,
        accounts: { flush: () => trace.push("flush accounts and clans") },
        websocketServer: {
            clients: new Set(players),
            close: cb => { trace.push("close websocket"); cb(); }
        },
        httpServer: {
            listening: true,
            close: cb => { trace.push("close http"); cb(); },
            closeIdleConnections: () => trace.push("drain HTTP keepalives")
        },
        wait: async ms => trace.push(`wait ${ms}`),
        log: () => {},
        noticeSeconds: 3,
        socketGraceMs: 200
    });
    assert.equal(lifecycle.isStopping(), false);
    const first = lifecycle.shutdown("SIGTERM");
    assert.equal(lifecycle.isStopping(), true,
        "readiness must reject joins as soon as SIGTERM is received");
    const second = lifecycle.shutdown("SIGINT");
    assert.equal(first, second, "repeated signals must not exit before flush");
    const result = await first;
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(trace, [
        "LC Z 3", "MB Z 3", "wait 3000",
        "LC stop tick", "MB stop tick",
        "LC B kick", "MB B kick", "wait 200",
        "flush accounts and clans",
        "terminate A", "terminate B", "close websocket",
        "close http", "drain HTTP keepalives"
    ]);
});

test("failed disk flush is not falsely reported as a clean shutdown", async () => {
    const calls = [];
    const games = new Map([["LC", {
        announceShutdown: () => {},
        stop: () => calls.push("stopped tick"),
        closeAll: () => calls.push("kicked")
    }]]);
    const lifecycle = createServerLifecycle({
        games,
        accounts: { flush: () => { throw new Error("disk full"); } },
        websocketServer: {
            clients: new Set(),
            close: cb => { calls.push("websocket closed"); cb(); }
        },
        httpServer: {
            listening: true, close: cb => { calls.push("http closed"); cb(); }
        },
        log: () => {},
        wait: async () => {}
    });
    const result = await lifecycle.shutdown("SIGTERM");
    assert.equal(result.ok, false);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].phase, "accounts and clans");
    assert.deepEqual(calls, ["stopped tick", "kicked", "websocket closed", "http closed"]);
});

test("debounced permanent clans and accounts survive immediate SIGTERM flush", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moo-server-flush-"));
    try {
        const store = new AccountStore(dir);
        store.data.accounts["unit-1"] = { id: "unit-1", name: "LuaUser" };
        store.data.clans["ABC"] = { name: "ABC", members: [{ id: "unit-1" }] };
        store.save(); // Normally writes 250ms later: shutdown must not lose it.
        store.flush();
        assert.equal(store.saveTimer, null);
        const saved = JSON.parse(fs.readFileSync(path.join(dir, "accounts.json"), "utf8"));
        assert.equal(saved.accounts["unit-1"].name, "LuaUser");
        assert.equal(saved.clans.ABC.members[0].id, "unit-1");
        assert.deepEqual(fs.readdirSync(dir).filter(n => n.endsWith(".tmp")), []);
        // A subsequent transaction must replace the old complete file, not append.
        store.data.clans["ABC"].members.push({ id: "unit-2" });
        store.save();
        store.flush();
        const again = JSON.parse(fs.readFileSync(path.join(dir, "accounts.json"), "utf8"));
        assert.equal(again.clans.ABC.members.length, 2);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
