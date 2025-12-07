import WebSocket from "ws";
import fetch from "node-fetch";
globalThis.WebSocket = WebSocket;
globalThis.fetch = fetch;

import { Client } from "@heroiclabs/nakama-js";

const SERVER_KEY = "defaultkey";
const HOST = "127.0.0.1";
const PORT = "7350";
const USE_SSL = false;

const client = new Client(SERVER_KEY, HOST, PORT, USE_SSL);

async function createPlayer(emailSuffix) {
    const session = await client.authenticateDevice("device-" + emailSuffix, true);
    const socket = client.createSocket(USE_SSL, false);
    await socket.connect(session, true);
    return { session, socket };
}

function waitForMatch(socket, playerName) {
    return new Promise((resolve, reject) => {
        socket.onmatchmakermatched = (matched) => {
            console.log(`\n[${playerName}] ✅ Match found!`);
            console.log(`[${playerName}] 📋 Match ID: ${matched.match_id}`);
            console.log(`[${playerName}] 👥 Players: ${matched.users.length}`);
            resolve(matched);
        };
        setTimeout(() => reject(new Error(`[${playerName}] ❌ Timeout waiting for match`)), 30000);
    });
}

async function main() {
    console.log("🔧 Connecting both players...");

    // Create players
    const playerA = await createPlayer("playerA");
    const playerB = await createPlayer("playerB");

    console.log("🧩 Both connected. Starting matchmaking...");

    // Add to matchmaking
    const ticketA = await playerA.socket.addMatchmaker("*", 2, 2, {}, {});
    const ticketB = await playerB.socket.addMatchmaker("*", 2, 2, {}, {});
    console.log("🎫 Matchmaking tickets created");

    try {
        // Wait until both get matched
        const matchedA = await waitForMatch(playerA.socket, "Player A");
        const matchedB = await waitForMatch(playerB.socket, "Player B");

        const matchId = matchedA.match_id;
        console.log("🆔 Match ID:", matchId);

        // Join the match
        const matchA = await playerA.socket.joinMatch(matchId);
        const matchB = await playerB.socket.joinMatch(matchId);

        console.log("✅ Both players joined match!");

        // Listen for updates
        playerA.socket.onmatchdata = (data) => {
            const decoded = JSON.parse(new TextDecoder().decode(data.data));
            console.log("[Player A] 📩 Match data:", decoded);
        };
        playerB.socket.onmatchdata = (data) => {
            const decoded = JSON.parse(new TextDecoder().decode(data.data));
            console.log("[Player B] 📩 Match data:", decoded);
        };

        // Simulate gameplay
        const moves = [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 },
            { x: 2, y: 0 },
            { x: 2, y: 2 },
        ];

        let turn = 0;
        const interval = setInterval(async () => {
            const move = moves[turn];
            const moveData = JSON.stringify(move);
            if (turn % 2 === 0) {
                console.log("[Player A] 🎮 Sending move:", move);
                await playerA.socket.sendMatchState(matchId, 1, moveData);
            } else {
                console.log("[Player B] 🎮 Sending move:", move);
                await playerB.socket.sendMatchState(matchId, 1, moveData);
            }
            turn;
            if (turn >= moves.length) {
                clearInterval(interval);
                console.log("✅ All test moves sent!");
            }
        }, 2000);

    } catch (err) {
        console.error("❌ Error during test:", err);
    }
}

main();
