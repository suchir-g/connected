import axios from "axios";

const API_BASE = "http://192.168.35.37:5000" || "http://127.0.0.1:5000";

// request wrapper (handles errors pretty much)
const handleRequest = async (requestFn) => {
  try {
    const response = await requestFn();
    return response;
  } catch (error) {
    throw error;
  }
};

const validateBoard = (board, gameMode) => {
  if (!Array.isArray(board)) return false;

  const modeDimensions = {
    "connect-4": { rows: 6, cols: 7 },
    "connect-5": { rows: 8, cols: 9 },
    "popout": { rows: 6, cols: 7 }, 
    "anti": { rows: 6, cols: 7 }, 
    "colour-switch": { rows: 6, cols: 7 }
  };

  const dimensions = modeDimensions[gameMode];

  if (!dimensions) {
    console.error(`Unsupported game mode: ${gameMode}`);
    return false;
  }

  const rows = board.length;

  if (dimensions.rows && dimensions.cols) {
    if (rows !== dimensions.rows) return false;
    return board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === dimensions.cols &&
        row.every((cell) => [-1, 0, 1].includes(cell))
    );
  }

  return false; // if it's not a valid config it just returns false
};

export const apiMakeMove = (column, board, currentPlayer, difficulty) =>
  handleRequest(() =>
    axios.post(`${API_BASE}/move`, {
      column,
      board,
      current_player: currentPlayer,
      difficulty,
    })
  );

export const getBestMove = (board, currentPlayer, gameMode, difficulty) => {
  if (!validateBoard(board, gameMode)) {
    throw new Error("Invalid board format");
  }
  if (![1, -1].includes(currentPlayer)) {
    throw new Error("Invalid current_player value - must be 1 or -1.");
  }
  return handleRequest(() =>
    axios.post(`${API_BASE}/bestmove`, {
      board,
      current_player: currentPlayer,
      game_mode: gameMode,
      difficulty,
    })
  );
};

export const generateRandomBoard = (moves) =>
  handleRequest(() => axios.post(`${API_BASE}/generate-board`, { moves }));

export const getColumnScores = (board, currentPlayer, gameMode) => {
  if (!validateBoard(board, gameMode)) {
    throw new Error("Invalid board format");
  }
  if (![1, -1].includes(currentPlayer)) {
    throw new Error("Invalid current_player value - must be 1 or -1.");
  }
  return handleRequest(() =>
    axios.post(`${API_BASE}/column-scores`, {
      board,
      current_player: currentPlayer,
      game_mode: gameMode,
    })
  );
};
