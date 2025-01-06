import axios from "axios";

const API_BASE = "http://127.0.0.1:5000";

export const startGame = () => {
  return axios.post(`${API_BASE}/start`);
};

export const makeMove = (column, board, currentPlayer) => {
  return axios.post(`${API_BASE}/move`, {
    column,
    board,
    current_player: currentPlayer,
  });
};

export const getBestMove = (board, currentPlayer) => {
  return axios.post(`${API_BASE}/bestmove`, {
    board, 
    current_player: currentPlayer,
  });
};

export const setDifficulty = (difficulty) => {
  return axios.post(`${API_BASE}/set-difficulty`, {
    difficulty,
  });
};

export const generateRandomBoard = (moves) => {
  return axios.post(`${API_BASE}/generate-board`, {
    moves, 
  });
};
