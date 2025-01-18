import axios from "axios";

const API_BASE = "http://127.0.0.1:5000";

// Utility function to construct API payloads
const buildPayload = (data, variant) => {
  if (variant) {
    return { ...data, variant };
  }
  return data;
};

// Start a new game
export const startGame = (variant) =>
  axios.post(`${API_BASE}/start`, buildPayload({}, variant));

// Make a move
export const makeMove = (column, board, currentPlayer, variant) =>
  axios.post(
    `${API_BASE}/move`,
    buildPayload({ column, board, current_player: currentPlayer }, variant)
  );

// Get the best move
export const getBestMove = (board, currentPlayer, variant) =>
  axios.post(
    `${API_BASE}/bestmove`,
    buildPayload({ board, current_player: currentPlayer }, variant)
  );

// Set the difficulty
export const setDifficulty = (difficulty, variant) =>
  axios.post(
    `${API_BASE}/set-difficulty`,
    buildPayload({ difficulty }, variant)
  );

// Generate a random board
export const generateRandomBoard = (moves, variant) =>
  axios.post(`${API_BASE}/generate-board`, buildPayload({ moves }, variant));
