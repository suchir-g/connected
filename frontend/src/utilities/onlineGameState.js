import { checkWinner, isDrawCondition } from "./gameState";

/**
 * Convert flattened board to 2D array for display and game logic
 */
export const flattenedTo2D = (flatBoard) => {
  const board2D = [];
  for (let row = 0; row < 6; row++) {
    board2D.push(flatBoard.slice(row * 7, (row + 1) * 7));
  }
  return board2D;
};

/**
 * Convert 2D board to flattened array for Firestore storage
 */
export const twoDToFlattened = (board2D) => {
  return board2D.flat();
};

/**
 * Initialize the online game state structure
 */
export const initializeOnlineGameState = (hostUserId, hostUsername) => {
  return {
    players: [hostUserId],
    playerNames: { [hostUserId]: hostUsername },
    playerColors: { [hostUserId]: "red" },
    board: Array(42).fill(0), // Flattened 6x7 board (6*7=42)
    currentPlayer: "red",
    currentPlayerId: hostUserId,
    status: "waiting", // waiting, active, completed
    gameMode: "standard",
    moves: [],
    createdAt: new Date(),
    lastActivity: new Date(),
  };
};

/**
 * Get the current player's ID based on user ID
 */
export const getMyPlayerId = (gameState, userId) => {
  return gameState.players.includes(userId) ? userId : null;
};

/**
 * Get the current player's color
 */
export const getMyColor = (gameState, userId) => {
  return gameState.playerColors?.[userId] || null;
};

/**
 * Check if it's the current user's turn
 */
export const isMyTurn = (gameState, userId) => {
  return gameState.currentPlayerId === userId;
};

/**
 * Validate if a move is legal
 */
export const validateMove = (gameState, columnIndex, playerId) => {
  // Check if it's the player's turn
  if (gameState.currentPlayerId !== playerId) {
    return { isValid: false, reason: "It's not your turn!" };
  }

  // Check if game is active
  if (gameState.status !== "active") {
    return { isValid: false, reason: "Game is not active" };
  }

  // Check if column is valid
  if (columnIndex < 0 || columnIndex >= 7) {
    return { isValid: false, reason: "Invalid column" };
  }

  // Check if column is full (top row is not 0)
  // Top row for column is at index: columnIndex
  if (gameState.board[columnIndex] !== 0) {
    return { isValid: false, reason: "Column is full" };
  }

  return { isValid: true };
};

/**
 * Get the row where a piece would land in a column (for flattened board)
 */
export const getDropRow = (flatBoard, columnIndex) => {
  for (let row = 5; row >= 0; row--) {
    // Bottom to top (row 5 to 0)
    const index = row * 7 + columnIndex;
    if (flatBoard[index] === 0) {
      return row;
    }
  }
  return -1; // Column is full
};

/**
 * Create a new flattened board state after making a move
 */
export const makeMove = (flatBoard, columnIndex, player) => {
  const newBoard = [...flatBoard];
  const dropRow = getDropRow(newBoard, columnIndex);

  if (dropRow >= 0) {
    // Convert color string to numeric value for board storage
    const numericPlayer = player === "red" ? 1 : -1;
    const index = dropRow * 7 + columnIndex;
    newBoard[index] = numericPlayer;
  }

  return newBoard;
};

/**
 * Get the next player
 */
export const getNextPlayer = (currentPlayer) => {
  return currentPlayer === "red" ? "yellow" : "red";
};

/**
 * Get the next player ID
 */
export const getNextPlayerId = (gameState) => {
  const nextColor = getNextPlayer(gameState.currentPlayer);
  return Object.entries(gameState.playerColors).find(
    ([playerId, color]) => color === nextColor
  )?.[0];
};

/**
 * Check game status after a move
 */
export const formatGameStatus = (flatBoard, lastPlayer) => {
  // Convert flattened board to 2D for existing checkWinner function
  const board2D = flattenedTo2D(flatBoard);

  // Convert color to numeric value for existing checkWinner function
  const numericPlayer = lastPlayer === "red" ? 1 : -1;

  const hasWinner = checkWinner(board2D, numericPlayer, "connect-4");

  if (hasWinner) {
    return {
      gameOver: true,
      winner: lastPlayer,
      winType: "connection",
    };
  }

  if (isDrawCondition(board2D)) {
    return {
      gameOver: true,
      winner: "draw",
      winType: "draw",
    };
  }

  return {
    gameOver: false,
    winner: null,
    winType: null,
  };
};

/**
 * Format player names for display
 */
export const formatPlayerNames = (gameState) => {
  const playerNames = Object.values(gameState.playerNames || {});
  return playerNames.join(" vs ");
};

/**
 * Get opponent information
 */
export const getOpponent = (gameState, myUserId) => {
  const opponentId = gameState.players.find((id) => id !== myUserId);
  return {
    id: opponentId,
    name: gameState.playerNames?.[opponentId],
    color: gameState.playerColors?.[opponentId],
  };
};

/**
 * Check if user can join the game
 */
export const canJoinGame = (gameState, userId) => {
  return (
    gameState.status === "waiting" &&
    gameState.players.length < 2 &&
    !gameState.players.includes(userId)
  );
};

/**
 * Get who made a specific move based on move number and game setup
 */
export const getMoveMaker = (gameState, moveIndex) => {
  if (
    !gameState.moves ||
    moveIndex < 0 ||
    moveIndex >= gameState.moves.length
  ) {
    return null;
  }

  // First player (red) makes moves 0, 2, 4, 6...
  // Second player (yellow) makes moves 1, 3, 5, 7...
  const isFirstPlayerMove = moveIndex % 2 === 0;
  const firstPlayerId = Object.entries(gameState.playerColors).find(
    ([playerId, color]) => color === "red"
  )?.[0];
  const secondPlayerId = Object.entries(gameState.playerColors).find(
    ([playerId, color]) => color === "yellow"
  )?.[0];

  return {
    playerId: isFirstPlayerMove ? firstPlayerId : secondPlayerId,
    playerName:
      gameState.playerNames?.[
        isFirstPlayerMove ? firstPlayerId : secondPlayerId
      ],
    color: isFirstPlayerMove ? "red" : "yellow",
    column: gameState.moves[moveIndex],
    moveNumber: moveIndex + 1,
  };
};

/**
 * Calculate ELO rating change (placeholder for future implementation)
 */
export const calculateEloChange = (
  winnerRating,
  loserRating,
  isDraw = false
) => {
  const K = 32; // K-factor
  const expectedWinner =
    1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;

  if (isDraw) {
    return {
      winnerChange: Math.round(K * (0.5 - expectedWinner)),
      loserChange: Math.round(K * (0.5 - expectedLoser)),
    };
  }

  return {
    winnerChange: Math.round(K * (1 - expectedWinner)),
    loserChange: Math.round(K * (0 - expectedLoser)),
  };
};

/**
 * Generate a shareable game link
 */
export const generateGameLink = (gameId) => {
  return `${window.location.origin}/play/online/${gameId}`;
};
