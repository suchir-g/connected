import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:5000";

// Simple request wrapper
const handleRequest = async (requestFn) => {
  try {
    const response = await requestFn();
    return response;
  } catch (error) {
    throw error;
  }
};

// Validate board dynamically based on gameMode and board dimensions
const validateBoard = (board, gameMode) => {
  if (!Array.isArray(board)) return false;

  const modeDimensions = {
    "connect-4": { rows: 6, cols: 7 },
    "connect-5": { rows: 8, cols: 9 },
    popout: { rows: 6, cols: 7 }, // Popout uses fixed dimensions of 6x7
    anti: { rows: 6, cols: 7 }, // Anti uses the same dimensions as Connect-4
    "colour-switch": { rows: 6, cols: 7 }, // Colour-switch also uses 6x7
  };

  const dimensions = modeDimensions[gameMode];

  if (!dimensions) {
    console.error(`Unsupported game mode: ${gameMode}`);
    return false;
  }

  const rows = board.length;

  // Validate fixed dimensions
  if (dimensions.rows && dimensions.cols) {
    if (rows !== dimensions.rows) return false;
    return board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === dimensions.cols &&
        row.every((cell) => [-1, 0, 1].includes(cell))
    );
  }

  return false; // Fallback for unsupported configurations
};

// Make a move
export const apiMakeMove = (column, board, currentPlayer, difficulty) =>
  handleRequest(() =>
    axios.post(`${API_BASE}/move`, {
      column,
      board,
      current_player: currentPlayer,
      difficulty,
    })
  );

// Get the best move
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

// Generate a random board
export const generateRandomBoard = (moves) =>
  handleRequest(() => axios.post(`${API_BASE}/generate-board`, { moves }));

// Get column scores
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
