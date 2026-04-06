import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { addPlayer, canPlayerRoll, createRoomState, rollDice, serializeRoomForPlayer } from "./src/game.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const rooms = new Map();
const roomStreams = new Map();

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/") {
      return serveStaticFile("index.html", response);
    }

    if (request.method === "GET" && (url.pathname.startsWith("/src/") || url.pathname === "/styles.css")) {
      return serveStaticFile(url.pathname.slice(1), response);
    }

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const body = await readJsonBody(request);
      const roomId = createRoomId();
      const playerId = createPlayerId();
      const roomState = addPlayer(createRoomState(roomId), body.name, playerId);

      rooms.set(roomId, roomState);
      respondJson(response, 201, {
        roomId,
        playerId,
        room: serializeRoomForPlayer(roomState, playerId)
      });
      return;
    }

    const roomRoute = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/(join|roll|events))?$/);
    if (!roomRoute) {
      respondNotFound(response);
      return;
    }

    const [, roomId, action] = roomRoute;
    const roomState = rooms.get(roomId);
    if (!roomState) {
      respondJson(response, 404, { error: "Room not found." });
      return;
    }

    if (!action && request.method === "GET") {
      const playerId = url.searchParams.get("playerId");
      respondJson(response, 200, {
        room: serializeRoomForPlayer(roomState, playerId)
      });
      return;
    }

    if (action === "join" && request.method === "POST") {
      const body = await readJsonBody(request);
      const playerId = createPlayerId();
      const nextRoomState = addPlayer(roomState, body.name, playerId);

      rooms.set(roomId, nextRoomState);
      broadcastRoom(nextRoomState);
      respondJson(response, 200, {
        roomId,
        playerId,
        room: serializeRoomForPlayer(nextRoomState, playerId)
      });
      return;
    }

    if (action === "roll" && request.method === "POST") {
      const body = await readJsonBody(request);
      if (!canPlayerRoll(roomState, body.playerId)) {
        const current = serializeRoomForPlayer(roomState, body.playerId);
        respondJson(response, 409, {
          error: roomState.status === "waiting" ? "Waiting for the second player to join." : "It is not your turn yet.",
          room: current
        });
        return;
      }

      const nextRoomState = rollDice(roomState, body.playerId);
      rooms.set(roomId, nextRoomState);
      broadcastRoom(nextRoomState);
      respondJson(response, 200, {
        room: serializeRoomForPlayer(nextRoomState, body.playerId)
      });
      return;
    }

    if (action === "events" && request.method === "GET") {
      const playerId = url.searchParams.get("playerId");
      if (!playerId) {
        respondJson(response, 400, { error: "playerId is required." });
        return;
      }

      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      });
      response.write(`data: ${JSON.stringify(serializeRoomForPlayer(roomState, playerId))}\n\n`);

      const streamEntry = { playerId, response };
      const listeners = roomStreams.get(roomId) ?? [];
      listeners.push(streamEntry);
      roomStreams.set(roomId, listeners);

      request.on("close", () => {
        const nextListeners = (roomStreams.get(roomId) ?? []).filter((entry) => entry !== streamEntry);
        if (nextListeners.length === 0) {
          roomStreams.delete(roomId);
          return;
        }
        roomStreams.set(roomId, nextListeners);
      });
      return;
    }

    respondNotFound(response);
  } catch (error) {
    respondJson(response, 400, { error: error.message || "Something went wrong." });
  }
});

server.listen(PORT, () => {
  console.log(`Snakes and Ladders is running on http://localhost:${PORT}`);
});

function broadcastRoom(roomState) {
  const listeners = roomStreams.get(roomState.roomId) ?? [];
  listeners.forEach(({ playerId, response }) => {
    response.write(`data: ${JSON.stringify(serializeRoomForPlayer(roomState, playerId))}\n\n`);
  });
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

function respondJson(response, statusCode, payload) {
  const content = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(content)
  });
  response.end(content);
}

function respondNotFound(response) {
  respondJson(response, 404, { error: "Not found." });
}

function createRoomId() {
  let roomId = "";
  do {
    roomId = Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (rooms.has(roomId));
  return roomId;
}

function createPlayerId() {
  return `player_${Math.random().toString(36).slice(2, 10)}`;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
