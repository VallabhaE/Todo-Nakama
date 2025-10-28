import { Client } from "@heroiclabs/nakama-js";

const SERVER_KEY = "defaultkey";
export const HOST = "127.0.0.1";
const PORT = "7350";
const USE_SSL = false;

const client = new Client(SERVER_KEY, HOST, PORT, USE_SSL);

export async function initPlayer(deviceId) {
  // Auth using device ID (unique per player)
  const session = await client.authenticateDevice(deviceId, true);
  const socket = client.createSocket(USE_SSL, false);
  await socket.connect(session, true);
  return { client, socket, session };
}

export async function startMatchmaking(socket) {
  const ticket = await socket.addMatchmaker("*", 2, 2, {}, {});
  console.log("🎫 Matchmaking started:", ticket.ticket);
  return ticket;
}

export async function cancelMatchmaking(socket, ticket) {
  await socket.removeMatchmaker(ticket.ticket);
  console.log("🛑 Matchmaking cancelled");
}

export function listenForMatch(socket, onMatchFound) {
  socket.onmatchmakermatched = async (matched) => {
    console.log("✅ Match found!", matched.match_id);
    const match = await socket.joinMatch(matched.match_id);
    onMatchFound(match);
  };
}

export function listenForMatchData(socket, onData) {
  socket.onmatchdata = (data) => {
    const decoded = JSON.parse(new TextDecoder().decode(data.data));
    onData(decoded);
  };
}

export async function sendMove(socket, matchId, move) {
  await socket.sendMatchState(matchId, 1, JSON.stringify(move));
}
