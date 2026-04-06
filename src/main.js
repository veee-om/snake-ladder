import { buildBoardCells, BOARD_SIZE } from "./game.js";

const SESSION_KEY = "snakes-ladders-session";
const boardCells = buildBoardCells();

const elements = {
  createForm: document.querySelector("#create-form"),
  joinForm: document.querySelector("#join-form"),
  showCreateButton: document.querySelector("#show-create"),
  showJoinButton: document.querySelector("#show-join"),
  nameInput: document.querySelector("#player-name"),
  joinNameInput: document.querySelector("#join-name"),
  joinCodeInput: document.querySelector("#join-code"),
  joinPanel: document.querySelector("#join-panel"),
  appShell: document.querySelector("#app-shell"),
  lobbyPanel: document.querySelector("#lobby-panel"),
  roomPanel: document.querySelector("#room-panel"),
  lobbyTitle: document.querySelector("#lobby-title"),
  lobbyCopy: document.querySelector("#lobby-copy"),
  backendNote: document.querySelector("#backend-note"),
  board: document.querySelector("#board"),
  roomCode: document.querySelector("#room-code"),
  roomStatus: document.querySelector("#room-status"),
  roomHint: document.querySelector("#room-hint"),
  yourName: document.querySelector("#your-name"),
  turnLabel: document.querySelector("#turn-label"),
  diceValue: document.querySelector("#dice-value"),
  moveSummary: document.querySelector("#move-summary"),
  actionButton: document.querySelector("#action-button"),
  leaveButton: document.querySelector("#leave-button"),
  players: document.querySelector("#players"),
  banner: document.querySelector("#banner")
};

const state = {
  roomId: null,
  playerId: null,
  playerName: "",
  room: null,
  events: null,
  lobbyMode: "create"
};

elements.showCreateButton.addEventListener("click", () => {
  setLobbyMode("create");
});

elements.showJoinButton.addEventListener("click", () => {
  setLobbyMode("join");
});

elements.createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.nameInput.value.trim();
  if (!name) {
    setBanner("Add your name before creating a room.");
    return;
  }

  await createRoom(name);
});

elements.joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.joinNameInput.value.trim();
  const roomId = elements.joinCodeInput.value.trim().toUpperCase();

  if (!name || !roomId) {
    setBanner("Enter your name and a room code to join.");
    return;
  }

  await joinRoom(name, roomId);
});

elements.actionButton.addEventListener("click", async () => {
  if (!state.roomId || !state.playerId) {
    return;
  }

  try {
    const payload = await requestJson(`/api/rooms/${state.roomId}/roll`, {
      method: "POST",
      body: JSON.stringify({ playerId: state.playerId })
    });
    syncRoom(payload.room);
    setBanner("");
  } catch (error) {
    if (error.room) {
      syncRoom(error.room);
    }
    setBanner(error.message);
  }
});

elements.leaveButton.addEventListener("click", () => {
  disconnectEvents();
  resetSession();
  syncRoom(null);
  setBanner("You left the room on this device.");
});

renderBoard();
setLobbyMode("create");
showBackendHintIfNeeded();
restoreSession();

async function createRoom(name) {
  try {
    const payload = await requestJson("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ name })
    });

    setSession(payload.roomId, payload.playerId, name);
    syncRoom(payload.room);
    connectEvents();
    setBanner(`Room ${payload.roomId} is ready. Share the code with player two.`);
  } catch (error) {
    setBanner(error.message);
  }
}

async function joinRoom(name, roomId) {
  try {
    const payload = await requestJson(`/api/rooms/${roomId}/join`, {
      method: "POST",
      body: JSON.stringify({ name })
    });

    setSession(payload.roomId, payload.playerId, name);
    syncRoom(payload.room);
    connectEvents();
    setBanner(`Joined room ${payload.roomId}.`);
  } catch (error) {
    setBanner(error.message);
  }
}

async function restoreSession() {
  const rawSession = window.localStorage.getItem(SESSION_KEY);
  if (!rawSession) {
    syncRoom(null);
    return;
  }

  try {
    const session = JSON.parse(rawSession);
    state.roomId = session.roomId;
    state.playerId = session.playerId;
    state.playerName = session.playerName;

    const payload = await requestJson(`/api/rooms/${state.roomId}?playerId=${state.playerId}`);
    syncRoom(payload.room);
    connectEvents();
  } catch (error) {
    resetSession();
    syncRoom(null);
    setBanner("The previous room is no longer available.");
  }
}

function setSession(roomId, playerId, playerName) {
  state.roomId = roomId;
  state.playerId = playerId;
  state.playerName = playerName;
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ roomId, playerId, playerName })
  );
}

function resetSession() {
  state.roomId = null;
  state.playerId = null;
  state.playerName = "";
  window.localStorage.removeItem(SESSION_KEY);
  disconnectEvents();
}

function connectEvents() {
  disconnectEvents();
  if (!state.roomId || !state.playerId) {
    return;
  }

  state.events = new EventSource(`/api/rooms/${state.roomId}/events?playerId=${state.playerId}`);
  state.events.onmessage = (event) => {
    syncRoom(JSON.parse(event.data));
  };
  state.events.onerror = () => {
    setBanner("Live connection dropped. Trying again when the room updates.");
  };
}

function disconnectEvents() {
  if (state.events) {
    state.events.close();
    state.events = null;
  }
}

function syncRoom(room) {
  state.room = room;
  const inRoom = Boolean(room);

  elements.lobbyPanel.hidden = inRoom;
  elements.roomPanel.hidden = !inRoom;
  elements.appShell.dataset.mode = inRoom ? "room" : "lobby";

  if (!inRoom) {
    updateBoardTokens([]);
    renderLobbyCopy();
    return;
  }

  elements.roomCode.textContent = room.roomId;
  elements.roomStatus.textContent = formatRoomStatus(room);
  elements.roomHint.textContent = getRoomHint(room);
  elements.yourName.textContent = room.you?.name ?? state.playerName;
  elements.turnLabel.textContent = getTurnLabel(room);
  elements.diceValue.textContent = room.lastRoll ? String(room.lastRoll.dice) : "–";
  elements.moveSummary.textContent = getMoveSummary(room);

  renderPlayers(room);
  updateBoardTokens(room.players);
  renderAction(room);
}

function setLobbyMode(mode) {
  state.lobbyMode = mode;
  const isCreate = mode === "create";
  elements.joinPanel.hidden = isCreate;
  elements.showCreateButton.classList.toggle("switch-button--active", isCreate);
  elements.showJoinButton.classList.toggle("switch-button--active", !isCreate);
  elements.showCreateButton.setAttribute("aria-selected", String(isCreate));
  elements.showJoinButton.setAttribute("aria-selected", String(!isCreate));
  renderLobbyCopy();
}

function renderLobbyCopy() {
  if (state.lobbyMode === "create") {
    elements.lobbyTitle.textContent = "Create room";
    elements.lobbyCopy.textContent = "Start a new room, then share the room code with the second player.";
    return;
  }

  elements.lobbyTitle.textContent = "Join a room";
  elements.lobbyCopy.textContent = "Enter the room code from player one to join the same live match.";
}

function renderPlayers(room) {
  elements.players.replaceChildren();

  room.players.forEach((player, index) => {
    const card = document.createElement("article");
    card.className = "player-card";
    if (player.id === room.currentTurnPlayerId && room.status === "playing") {
      card.classList.add("player-card--active");
    }
    if (player.id === room.winnerId) {
      card.classList.add("player-card--winner");
    }

    const label = document.createElement("p");
    label.className = "player-card__label";
    label.textContent = `Player ${index + 1}`;

    const name = document.createElement("h3");
    name.textContent = player.name;

    const meta = document.createElement("p");
    meta.className = "player-card__meta";
    meta.textContent = `Token ${player.token} • Square ${player.position}`;

    card.append(label, name, meta);
    elements.players.append(card);
  });
}

function renderAction(room) {
  const canRoll = room.status === "playing" && room.currentTurnPlayerId === state.playerId;
  elements.actionButton.disabled = !canRoll;
  elements.actionButton.textContent = room.status === "finished" ? "Match finished" : canRoll ? "Roll dice" : "Waiting";
}

function renderBoard() {
  boardCells.forEach((cell) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.style.gridRowStart = String(cell.row + 1);
    tile.style.gridColumnStart = String(cell.column + 1);
    tile.dataset.value = String(cell.value);

    if (cell.destination) {
      tile.classList.add(cell.destination > cell.value ? "tile--ladder" : "tile--snake");
    }

    const number = document.createElement("span");
    number.className = "tile__number";
    number.textContent = String(cell.value);

    const marker = document.createElement("span");
    marker.className = "tile__marker";
    if (cell.destination) {
      marker.textContent = `${cell.destination > cell.value ? "L" : "S"}→${cell.destination}`;
    }

    const tokens = document.createElement("div");
    tokens.className = "tile__tokens";

    tile.append(number, marker, tokens);
    elements.board.append(tile);
  });
}

function updateBoardTokens(players) {
  const playerMap = new Map(players.map((player) => [player.position, player]));

  boardCells.forEach((cell) => {
    const tile = elements.board.querySelector(`[data-value="${cell.value}"] .tile__tokens`);
    tile.replaceChildren();

    const playersHere = players.filter((player) => player.position === cell.value);
    playersHere.forEach((player) => {
      const token = document.createElement("span");
      token.className = `token token--${player.color}`;
      token.textContent = player.token;
      token.title = player.name;
      tile.append(token);
    });
  });
}

function formatRoomStatus(room) {
  if (room.status === "waiting") {
    return "Waiting for player two";
  }

  if (room.status === "finished") {
    return `${room.players.find((player) => player.id === room.winnerId)?.name ?? "A player"} won`;
  }

  return "Match in progress";
}

function getRoomHint(room) {
  if (room.status === "waiting") {
    return `Share code ${room.roomId} so the second player can join.`;
  }

  if (room.status === "finished") {
    return "Refresh or create a new room for another round.";
  }

  return "Roll a 6 to earn another turn. You must land exactly on 100 to win.";
}

function getTurnLabel(room) {
  if (room.status === "waiting") {
    return "Lobby open";
  }

  if (room.status === "finished") {
    return room.winnerId === state.playerId ? "You won the match" : "Match complete";
  }

  return room.currentTurnPlayerId === state.playerId ? "Your turn" : `${room.players[room.currentTurn]?.name}'s turn`;
}

function getMoveSummary(room) {
  if (!room.lastRoll) {
    return "No dice rolled yet.";
  }

  const player = room.players.find((entry) => entry.id === room.lastRoll.playerId);
  const actor = player?.id === state.playerId ? "You" : player?.name ?? "A player";
  const stayed = room.lastRoll.attempted > BOARD_SIZE;

  if (stayed) {
    return `${actor} rolled ${room.lastRoll.dice} and stayed on ${room.lastRoll.from} because the move would overshoot 100.`;
  }

  if (room.lastRoll.movementType === "ladder") {
    return `${actor} rolled ${room.lastRoll.dice}, climbed a ladder, and moved to ${room.lastRoll.to}.`;
  }

  if (room.lastRoll.movementType === "snake") {
    return `${actor} rolled ${room.lastRoll.dice}, hit a snake, and slid to ${room.lastRoll.to}.`;
  }

  return `${actor} rolled ${room.lastRoll.dice} and moved to ${room.lastRoll.to}.`;
}

function setBanner(message) {
  elements.banner.textContent = message;
}

function showBackendHintIfNeeded() {
  if (!window.location.hostname.endsWith("github.io")) {
    return;
  }

  elements.backendNote.hidden = false;
  elements.backendNote.textContent =
    "This page is running as static hosting only. Room codes need the Node backend, so create/join will not work here unless /api is deployed too.";
}

async function requestJson(url, options = {}) {
  let response;
  try {
    response = await window.fetch(url, {
      headers: {
        "Content-Type": "application/json"
      },
      ...options
    });
  } catch (error) {
    throw new Error(getBackendUnavailableMessage());
  }

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.");
    if (payload.room) {
      error.room = payload.room;
    }
    throw error;
  }

  return payload;
}

function getBackendUnavailableMessage() {
  return "Room creation needs the backend server. Run `npm run dev` in the `Snake and Ladder` folder or deploy `server.js` to a Node host.";
}

document.querySelector("#board-size").textContent = String(BOARD_SIZE);
