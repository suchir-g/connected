import axios from "axios";
import {
  isDrawCondition,
  checkWinner,
  getGameModeConfig,
} from "../utilities/gameState";

// Use environment variable if available, otherwise default to Heroku production URL
const API_BASE = process.env.REACT_APP_API_URL || "https://connected-backend-flask-e91b571feaa1.herokuapp.com";

// request wrapper (handles errors pretty much)
const handleRequest = async (requestFn) => {
  try {
    const response = await requestFn();
    return response;
  } catch (error) {
    console.log("err: ", error);
    throw error;
  }
};

const validateBoard = (board, gameMode) => {
  if (!Array.isArray(board)) return false;

  const config = getGameModeConfig(gameMode);
  if (!config) {
    console.error(`Unsupported game mode: ${gameMode}`);
    return false;
  }

  if (board.length !== config.rows) return false;
  return board.every(
    (row) =>
      Array.isArray(row) &&
      row.length === config.cols &&
      row.every((cell) => [-1, 0, 1].includes(cell))
  );
};

export const getBestMove = (board, currentPlayer, gameMode, difficulty) => {
  if (!validateBoard(board, gameMode)) {
    throw new Error("Invalid board format");
  }
  if (![1, -1].includes(currentPlayer)) {
    throw new Error("Invalid current_player value - must be 1 or -1.");
  }

  if (checkWinner(board, currentPlayer, gameMode)) {
    throw new Error("Game already won. No best move needed.");
  }

  if (isDrawCondition(board)) {
    throw new Error("Game is a draw. No best move available.");
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
