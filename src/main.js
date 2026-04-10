import { BOARD_SIZE, buildBoardCells } from "./game.js";

const STORAGE_KEY = "vyom-ki-saanp-seedhi-session";
const boardCells = buildBoardCells();

const elements = {
  appShell: document.querySelector("#app-shell"),
  lobbyPanel: document.querySelector("#lobby-panel"),
  gamePanel: document.querySelector("#game-panel"),
  hostTab: document.querySelector("#host-tab"),
  joinTab: document.querySelector("#join-tab"),
  hostForm: document.querySelector("#host-form"),
  joinForm: document.querySelector("#join-form"),
  hostName: document.querySelector("#host-name"),
  joinName: document.querySelector("#join-name"),
  joinCode: document.querySelector("#join-code"),
  copyRoomButton: document.querySelector("#copy-room-button"),
  actionButton: document.querySelector("#action-button"),
  resetButton: document.querySelector("#reset-button"),
  leaveButton: document.querySelector("#leave-button"),
  roomCode: document.querySelector("#room-code"),
  selfName: document.querySelector("#self-name"),
  board: document.querySelector("#board"),
  gameStatus: document.querySelector("#game-status"),
  gameHint: document.querySelector("#game-hint"),
  turnLabel: document.querySelector("#turn-label"),
  diceValue: document.querySelector("#dice-value"),
  boardSize: document.querySelector("#board-size"),
  boardLegend: document.querySelector("#board-legend"),
  moveSummary: document.querySelector("#move-summary"),
  players: document.querySelector("#players"),
  banner: document.querySelector("#banner"),
  winnerModal: document.querySelector("#winner-modal"),
  winnerTitle: document.querySelector("#winner-title"),
  winnerText: document.querySelector("#winner-text"),
  winnerButton: document.querySelector("#winner-button")
};

const state = {
  view: "host",
  roomCode: "",
  playerId: "",
  game: null,
  eventSource: null,
  pendingAction: false
};

elements.hostTab.addEventListener("click", () => setLobbyMode("host"));
elements.joinTab.addEventListener("click", () => setLobbyMode("join"));

elements.hostForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createRoom(elements.hostName.value);
});

elements.joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await joinRoom(elements.joinName.value, elements.joinCode.value);
});

elements.copyRoomButton.addEventListener("click", async () => {
  if (!state.roomCode) {
    return;
  }

  try {
    await navigator.clipboard.writeText(state.roomCode);
    setBanner("Room code copied. Send it to your friend.");
  } catch {
    setBanner(`Share this room code: ${state.roomCode}`);
  }
});

elements.actionButton.addEventListener("click", async () => {
  if (!state.roomCode || !state.playerId || !state.game || state.pendingAction) {
    return;
  }

  await postRoomAction("roll");
});

elements.resetButton.addEventListener("click", async () => {
  if (!state.roomCode || !state.playerId || !state.game || state.pendingAction) {
    return;
  }

  await postRoomAction("reset");
});

elements.leaveButton.addEventListener("click", () => {
  teardownSession();
  showLobby("You left the room.");
});

elements.winnerButton.addEventListener("click", async () => {
  if (!state.game || state.pendingAction) {
    return;
  }

  await postRoomAction("reset");
});

renderBoard();
elements.boardSize.textContent = String(BOARD_SIZE);
elements.boardLegend.textContent = "🐍 Saanp slide  •  🪜 Seedhi climb";
setLobbyMode("host");
restoreSession();

async function createRoom(playerName) {
  setPending(true);

  try {
    const session = await apiRequest("/api/rooms", {
      method: "POST",
      body: { playerName }
    });

    applySession(session);
    setBanner("Room created. Share the code with your friend.");
  } catch (error) {
    setBanner(error.message);
  } finally {
    setPending(false);
  }
}

async function joinRoom(playerName, roomCode) {
  setPending(true);

  try {
    const session = await apiRequest(`/api/rooms/${normalizeRoomCode(roomCode)}/join`, {
      method: "POST",
      body: { playerName }
    });

    applySession(session);
    setBanner("Joined the room. The match starts now.");
  } catch (error) {
    setBanner(error.message);
  } finally {
    setPending(false);
  }
}

async function postRoomAction(action) {
  setPending(true);

  try {
    const session = await apiRequest(`/api/rooms/${state.roomCode}/${action}`, {
      method: "POST",
      body: { playerId: state.playerId }
    });

    applyGameState(session);
    if (action === "reset") {
      setBanner("Fresh round started with the same players.");
    } else {
      setBanner("");
    }
  } catch (error) {
    setBanner(error.message);
  } finally {
    setPending(false);
  }
}

function applySession(session) {
  state.roomCode = session.roomCode;
  state.playerId = session.playerId;
  saveSession();
  openEventStream();
  applyGameState(session);
}

function applyGameState(session) {
  state.roomCode = session.roomCode;
  state.playerId = session.playerId;
  state.game = session.game;
  saveSession();
  showGame();
  syncGame();
}

function syncGame() {
  if (!state.game) {
    return;
  }

  const self = state.game.players.find((player) => player.id === state.playerId);
  const activePlayer = state.game.players[state.game.currentTurn];
  const canRoll =
    state.game.status === "playing" &&
    activePlayer?.id === state.playerId &&
    state.game.players.length === 2 &&
    !state.pendingAction;
  const canReset = state.game.players.length === 2 && !state.pendingAction;

  elements.roomCode.textContent = state.roomCode;
  elements.selfName.textContent = self?.name ?? "Unknown player";
  elements.gameStatus.textContent = formatGameStatus(state.game);
  elements.gameHint.textContent = getGameHint(state.game, self);
  elements.turnLabel.textContent = getTurnLabel(state.game);
  elements.diceValue.textContent = state.game.lastRoll ? String(state.game.lastRoll.dice) : "–";
  elements.moveSummary.textContent = getMoveSummary(state.game);
  elements.actionButton.disabled = !canRoll;
  elements.actionButton.textContent = state.game.status === "waiting" ? "Waiting for friend" : "🎲 Roll dice";
  elements.resetButton.disabled = !canReset;

  renderPlayers(state.game);
  updateBoardTokens(state.game.players);
  renderWinnerModal(state.game);
}

function renderPlayers(game) {
  elements.players.replaceChildren();

  game.players.forEach((player, index) => {
    const card = document.createElement("article");
    card.className = "player-card";

    if (index === game.currentTurn && game.status === "playing") {
      card.classList.add("player-card--active");
    }
    if (player.id === game.winnerId) {
      card.classList.add("player-card--winner");
    }
    if (player.id === state.playerId) {
      card.classList.add("player-card--self");
    }

    const label = document.createElement("p");
    label.className = "player-card__label";
    label.textContent = player.id === state.playerId ? "You" : `Player ${index + 1}`;

    const name = document.createElement("h3");
    name.textContent = player.name;

    const meta = document.createElement("p");
    meta.className = "player-card__meta";
    meta.textContent = `Token ${player.token} • Square ${player.position}`;

    card.append(label, name, meta);
    elements.players.append(card);
  });
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

    tile.classList.add((cell.row + cell.column) % 2 === 0 ? "tile--warm" : "tile--cool");
    if (cell.value === 1) {
      tile.classList.add("tile--start");
    }
    if (cell.value === BOARD_SIZE) {
      tile.classList.add("tile--finish");
    }

    const number = document.createElement("span");
    number.className = "tile__number";
    number.textContent = String(cell.value);

    const marker = document.createElement("span");
    marker.className = "tile__marker";
    if (cell.destination) {
      marker.textContent = `${cell.destination > cell.value ? "🪜" : "🐍"} ${cell.destination}`;
    }

    const tokens = document.createElement("div");
    tokens.className = "tile__tokens";

    tile.append(number, marker, tokens);
    elements.board.append(tile);
  });
}

function updateBoardTokens(players) {
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

function renderWinnerModal(game) {
  const winner = game.players.find((player) => player.id === game.winnerId);
  const isVisible = game.status === "finished" && Boolean(winner);
  elements.winnerModal.classList.toggle("hidden", !isVisible);

  if (!winner) {
    return;
  }

  elements.winnerTitle.textContent = `${winner.name} wins!`;
  elements.winnerText.textContent = `${winner.name} reached square 100 first. Tap below to play another round in the same room.`;
}

function hideWinnerModal() {
  elements.winnerModal.classList.add("hidden");
}

function formatGameStatus(game) {
  if (game.status === "waiting") {
    return "Waiting for your friend";
  }

  if (game.status === "finished") {
    return `${game.players.find((player) => player.id === game.winnerId)?.name ?? "A player"} won`;
  }

  return "2 player live match";
}

function getGameHint(game, self) {
  if (game.status === "waiting") {
    return `Share room code ${state.roomCode} so your friend can join this board.`;
  }

  if (game.status === "finished") {
    return "Tap Play again to start a fresh round with the same room.";
  }

  if (game.players[game.currentTurn]?.id === state.playerId) {
    return `${self?.name ?? "You"} can roll now. A 6 gives you another turn.`;
  }

  return `${game.players[game.currentTurn]?.name ?? "Your friend"} is rolling from their device.`;
}

function getTurnLabel(game) {
  if (game.status === "waiting") {
    return "Waiting…";
  }

  if (game.status === "finished") {
    const winner = game.players.find((player) => player.id === game.winnerId);
    return `${winner?.name ?? "A player"} wins`;
  }

  const activePlayer = game.players[game.currentTurn];
  return activePlayer?.id === state.playerId ? "Your turn" : `${activePlayer?.name ?? "Friend"}'s turn`;
}

function getMoveSummary(game) {
  if (!game.lastRoll) {
    return game.status === "waiting"
      ? "Create a room and invite a friend to begin the live match."
      : "Both players are ready. Roll the dice to start the race.";
  }

  const player = game.players.find((entry) => entry.id === game.lastRoll.playerId);
  const actor = player?.name ?? "A player";
  const stayed = game.lastRoll.attempted > BOARD_SIZE;

  if (stayed) {
    return `${actor} rolled ${game.lastRoll.dice} and stayed on ${game.lastRoll.from} because the move would overshoot 100.`;
  }

  if (game.lastRoll.movementType === "ladder") {
    return `${actor} rolled ${game.lastRoll.dice}, climbed a ladder, and moved to ${game.lastRoll.to}.`;
  }

  if (game.lastRoll.movementType === "snake") {
    return `${actor} rolled ${game.lastRoll.dice}, hit a snake, and slid to ${game.lastRoll.to}.`;
  }

  return `${actor} rolled ${game.lastRoll.dice} and moved to ${game.lastRoll.to}.`;
}

function setBanner(message) {
  elements.banner.textContent = message;
}

function showLobby(message = "") {
  state.game = null;
  closeEventStream();
  elements.appShell.dataset.mode = "lobby";
  elements.lobbyPanel.hidden = false;
  elements.gamePanel.hidden = true;
  hideWinnerModal();
  updateBoardTokens([]);
  setBanner(message);
}

function showGame() {
  elements.appShell.dataset.mode = "game";
  elements.lobbyPanel.hidden = true;
  elements.gamePanel.hidden = false;
}

function setLobbyMode(view) {
  state.view = view;
  const isHost = view === "host";

  elements.hostTab.classList.toggle("is-active", isHost);
  elements.joinTab.classList.toggle("is-active", !isHost);
  elements.hostForm.hidden = !isHost;
  elements.joinForm.hidden = isHost;
}

function setPending(isPending) {
  state.pendingAction = isPending;
  elements.hostForm.querySelector("button").disabled = isPending;
  elements.joinForm.querySelector("button").disabled = isPending;

  if (state.game) {
    syncGame();
  }
}

function normalizeRoomCode(value) {
  return String(value || "").trim().toUpperCase();
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "Something went wrong.");
  }

  return payload;
}

function openEventStream() {
  closeEventStream();

  const eventSource = new EventSource(
    `/api/rooms/${state.roomCode}/events?playerId=${encodeURIComponent(state.playerId)}`
  );

  eventSource.addEventListener("room", (event) => {
    const session = JSON.parse(event.data);
    applyGameState(session);
  });

  eventSource.onerror = async () => {
    closeEventStream();

    if (!state.roomCode || !state.playerId) {
      return;
    }

    try {
      const session = await apiRequest(
        `/api/rooms/${state.roomCode}?playerId=${encodeURIComponent(state.playerId)}`
      );
      applyGameState(session);
      openEventStream();
    } catch {
      teardownSession();
      showLobby("Your room session ended. Create a new room or join again.");
    }
  };

  state.eventSource = eventSource;
}

function closeEventStream() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
}

function saveSession() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      roomCode: state.roomCode,
      playerId: state.playerId
    })
  );
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const session = JSON.parse(raw);
    if (!session.roomCode || !session.playerId) {
      return;
    }

    state.roomCode = session.roomCode;
    state.playerId = session.playerId;
    reconnectSession();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

async function reconnectSession() {
  try {
    const session = await apiRequest(
      `/api/rooms/${state.roomCode}?playerId=${encodeURIComponent(state.playerId)}`
    );
    applySession(session);
    setBanner("Reconnected to your room.");
  } catch {
    teardownSession();
  }
}

function teardownSession() {
  closeEventStream();
  state.roomCode = "";
  state.playerId = "";
  state.game = null;
  state.pendingAction = false;
  localStorage.removeItem(STORAGE_KEY);
}
