import { BOARD_SIZE, MAX_PLAYERS, MIN_PLAYERS, buildBoardCells, createLocalGame, rollTurn } from "./game.js";

const boardCells = buildBoardCells();

const elements = {
  appShell: document.querySelector("#app-shell"),
  setupPanel: document.querySelector("#setup-panel"),
  gamePanel: document.querySelector("#game-panel"),
  playerCount: document.querySelector("#player-count"),
  playerFields: document.querySelector("#player-fields"),
  setupForm: document.querySelector("#setup-form"),
  actionButton: document.querySelector("#action-button"),
  resetButton: document.querySelector("#reset-button"),
  setupButton: document.querySelector("#setup-button"),
  board: document.querySelector("#board"),
  gameStatus: document.querySelector("#game-status"),
  gameHint: document.querySelector("#game-hint"),
  turnLabel: document.querySelector("#turn-label"),
  diceValue: document.querySelector("#dice-value"),
  boardSize: document.querySelector("#board-size"),
  boardLegend: document.querySelector("#board-legend"),
  moveSummary: document.querySelector("#move-summary"),
  players: document.querySelector("#players"),
  banner: document.querySelector("#banner")
};

const state = {
  game: null,
  playerCount: 2
};

elements.playerCount.addEventListener("change", () => {
  state.playerCount = Number(elements.playerCount.value);
  renderPlayerFields();
});

elements.setupForm.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    const names = getPlayerNames();
    state.game = createLocalGame(names);
    elements.appShell.dataset.mode = "game";
    elements.setupPanel.hidden = true;
    elements.gamePanel.hidden = false;
    setBanner("");
    syncGame();
  } catch (error) {
    setBanner(error.message);
  }
});

elements.actionButton.addEventListener("click", () => {
  if (!state.game) {
    return;
  }

  try {
    state.game = rollTurn(state.game);
    setBanner("");
    syncGame();
  } catch (error) {
    setBanner(error.message);
  }
});

elements.resetButton.addEventListener("click", () => {
  if (!state.game) {
    return;
  }

  const names = state.game.players.map((player) => player.name);
  state.game = createLocalGame(names);
  setBanner("Fresh round started with the same players.");
  syncGame();
});

elements.setupButton.addEventListener("click", () => {
  state.game = null;
  elements.appShell.dataset.mode = "setup";
  elements.setupPanel.hidden = false;
  elements.gamePanel.hidden = true;
  updateBoardTokens([]);
  setBanner("");
});

renderBoard();
renderPlayerFields();
elements.boardSize.textContent = String(BOARD_SIZE);
elements.boardLegend.textContent = "🐍 Snake slide  •  🪜 Ladder climb";

function renderPlayerFields() {
  elements.playerFields.replaceChildren();

  for (let index = 0; index < state.playerCount; index += 1) {
    const field = document.createElement("label");
    field.className = "field";

    const label = document.createElement("span");
    label.textContent = `Player ${index + 1} name`;

    const input = document.createElement("input");
    input.name = `player-${index + 1}`;
    input.maxLength = 20;
    input.required = true;
    input.placeholder = defaultName(index);

    field.append(label, input);
    elements.playerFields.append(field);
  }
}

function getPlayerNames() {
  return Array.from(elements.playerFields.querySelectorAll("input")).map(
    (input, index) => input.value.trim() || defaultName(index)
  );
}

function syncGame() {
  if (!state.game) {
    return;
  }

  elements.gameStatus.textContent = formatGameStatus(state.game);
  elements.gameHint.textContent = getGameHint(state.game);
  elements.turnLabel.textContent = getTurnLabel(state.game);
  elements.diceValue.textContent = state.game.lastRoll ? String(state.game.lastRoll.dice) : "–";
  elements.moveSummary.textContent = getMoveSummary(state.game);
  elements.actionButton.disabled = state.game.status === "finished";
  elements.actionButton.textContent = state.game.status === "finished" ? "Match finished" : "Roll dice";

  renderPlayers(state.game);
  updateBoardTokens(state.game.players);
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

function formatGameStatus(game) {
  if (game.status === "finished") {
    return `${game.players.find((player) => player.id === game.winnerId)?.name ?? "A player"} won`;
  }

  return `${game.players.length} player match`;
}

function getGameHint(game) {
  if (game.status === "finished") {
    return "Tap Play again for the same group or Back to setup for a fresh table.";
  }

  return "Pass the device after each turn. Roll a 6 to go again, and land exactly on 100 to win.";
}

function getTurnLabel(game) {
  if (game.status === "finished") {
    const winner = game.players.find((player) => player.id === game.winnerId);
    return `${winner?.name ?? "A player"} wins`;
  }

  return `${game.players[game.currentTurn]?.name}'s turn`;
}

function getMoveSummary(game) {
  if (!game.lastRoll) {
    return "Choose your players and roll to start the match.";
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

function defaultName(index) {
  return `Player ${index + 1}`;
}
