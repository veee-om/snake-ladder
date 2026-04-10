import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { addPlayerToGame, createRoomGame, restartRoomGame, rollForPlayer, serializeGameForPlayer } from "./src/game.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4173);
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;

const rooms = new Map();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApiRequest(request, response, url);
      return;
    }

    const relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    await serveStaticFile(relativePath, response);
  } catch (error) {
    respondJson(response, 500, {
      error: error instanceof Error ? error.message : "Something went wrong."
    });
  }
});

server.listen(PORT, () => {
  console.log(`Vyom ki Saanp Seedhi is running on http://localhost:${PORT}`);
});

setInterval(pruneRooms, 1000 * 60 * 10).unref();

async function handleApiRequest(request, response, url) {
  const routeMatch = url.pathname.match(/^\/api\/rooms(?:\/([A-Z0-9]+)(?:\/(join|roll|reset|events))?)?$/);

  if (!routeMatch) {
    respondJson(response, 404, { error: "Route not found." });
    return;
  }

  const [, roomCode, action] = routeMatch;
  const method = request.method ?? "GET";

  if (method === "POST" && !roomCode) {
    const body = await readJsonBody(request);
    const playerName = String(body.playerName || "");
    const room = createRoom(playerName);
    respondJson(response, 201, buildPlayerSession(room, room.game.players[0].id));
    return;
  }

  if (!roomCode) {
    respondJson(response, 400, { error: "Room code is required." });
    return;
  }

  const room = rooms.get(roomCode);
  if (!room) {
    respondJson(response, 404, { error: "Room not found. Check the code and try again." });
    return;
  }

  room.lastActivityAt = Date.now();

  if (method === "GET" && !action) {
    const playerId = url.searchParams.get("playerId") ?? "";
    ensurePlayerInRoom(room, playerId);
    respondJson(response, 200, buildPlayerSession(room, playerId));
    return;
  }

  if (method === "GET" && action === "events") {
    const playerId = url.searchParams.get("playerId") ?? "";
    ensurePlayerInRoom(room, playerId);
    openEventStream(room, playerId, response);
    return;
  }

  if (method !== "POST") {
    respondJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const body = await readJsonBody(request);

  if (action === "join") {
    const playerName = String(body.playerName || "");
    const updatedRoom = joinRoom(room, playerName);
    respondJson(response, 200, buildPlayerSession(updatedRoom, updatedRoom.game.players.at(-1).id));
    broadcastRoom(updatedRoom);
    return;
  }

  const playerId = String(body.playerId || "");
  ensurePlayerInRoom(room, playerId);

  if (action === "roll") {
    room.game = rollForPlayer(room.game, playerId);
    respondJson(response, 200, buildPlayerSession(room, playerId));
    broadcastRoom(room);
    return;
  }

  if (action === "reset") {
    room.game = restartRoomGame(room.game);
    respondJson(response, 200, buildPlayerSession(room, playerId));
    broadcastRoom(room);
    return;
  }

  respondJson(response, 404, { error: "Action not found." });
}

function createRoom(playerName) {
  const roomCode = generateRoomCode();
  const game = createRoomGame(playerName);
  const room = {
    code: roomCode,
    game,
    clients: new Map(),
    createdAt: Date.now(),
    lastActivityAt: Date.now()
  };

  rooms.set(roomCode, room);
  return room;
}

function joinRoom(room, playerName) {
  room.game = addPlayerToGame(room.game, playerName);
  return room;
}

function buildPlayerSession(room, playerId) {
  return {
    roomCode: room.code,
    playerId,
    game: serializeGameForPlayer(room.game, playerId)
  };
}

function openEventStream(room, playerId, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });
  response.write("\n");

  const streamId = Math.random().toString(36).slice(2);
  room.clients.set(streamId, { playerId, response });
  writeEvent(response, "room", buildPlayerSession(room, playerId));

  requestCleanup(response, () => {
    room.clients.delete(streamId);
    room.lastActivityAt = Date.now();
  });
}

function broadcastRoom(room) {
  for (const { playerId, response } of room.clients.values()) {
    writeEvent(response, "room", buildPlayerSession(room, playerId));
  }
}

async function serveStaticFile(relativePath, response) {
  const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(__dirname, safePath);

  if (!existsSync(filePath)) {
    respondNotFound(response);
    return;
  }

  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    respondNotFound(response);
    return;
  }

  const extension = path.extname(filePath);
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extension] ?? "application/octet-stream",
    "Content-Length": fileStat.size
  });
  createReadStream(filePath).pipe(response);
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function respondJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function respondNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found.");
}

function ensurePlayerInRoom(room, playerId) {
  const player = room.game.players.find((entry) => entry.id === playerId);

  if (!player) {
    throw new Error("This player session is no longer valid for the room.");
  }
}

function generateRoomCode() {
  let roomCode = "";

  do {
    roomCode = Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (rooms.has(roomCode));

  return roomCode;
}

function writeEvent(response, eventName, payload) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function requestCleanup(response, callback) {
  response.on("close", callback);
  response.on("error", callback);
}

function pruneRooms() {
  const now = Date.now();

  for (const [roomCode, room] of rooms.entries()) {
    if (room.clients.size > 0) {
      continue;
    }

    if (now - room.lastActivityAt > ROOM_TTL_MS) {
      rooms.delete(roomCode);
    }
  }
}
