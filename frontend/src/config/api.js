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
export const getBestMove = (board, currentPlayer) =>
  handleRequest(() =>
    axios.post(`${API_BASE}/bestmove`, {
      board,
      current_player: currentPlayer,
    })
  );

// Generate a random board
export const generateRandomBoard = (moves) =>
  handleRequest(() => axios.post(`${API_BASE}/generate-board`, { moves }));

// Get column scores
export const getColumnScores = (board, currentPlayer) =>
  handleRequest(() =>
    axios.post(`${API_BASE}/column-scores`, {
      board,
      current_player: currentPlayer,
    })
  );
