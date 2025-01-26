export const checkWinner = (board, currentPlayer, gameMode) => {
  const nInARow = gameMode === "connect-5" ? 5 : 4; // Adjust win condition
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] !== currentPlayer) continue;

      for (const [dr, dc] of directions) {
        let count = 0;
        for (let k = 0; k < nInARow; k++) {
          const r = row + dr * k;
          const c = col + dc * k;
          if (
            r >= 0 &&
            r < board.length &&
            c >= 0 &&
            c < board[row].length &&
            board[r][c] === currentPlayer
          ) {
            count++;
          } else {
            break;
          }
        }
        if (count === nInARow) return true;
      }
    }
  }

  return false; // No winner
};

export const isDrawCondition = (board) => {
  return board.every((row) => row.every((cell) => cell !== 0));
};

export const getValidMoves = (board, gameMode, currentPlayer) => {
  const validMoves = [];
  for (let col = 0; col < board[0].length; col++) {
    if (board[0][col] === 0) {
      validMoves.push({ column: col, action: "place" });
    }

    if (
      gameMode === "popout" &&
      board[board.length - 1][col] === currentPlayer
    ) {
      validMoves.push({ column: col, action: "popout" });
    }
  }
  return validMoves;
};

export const applyMove = (
  currentBoard,
  column,
  player,
  gameMode,
  rows,
  cols,
  action = "place"
) => {
  const newBoard = currentBoard.map((row) => [...row]);

  if (gameMode === "no-grav") {
    // No-gravity: Place in the first available slot from the top
    for (let row = 0; row < rows; row++) {
      if (newBoard[row][column] === 0) {
        newBoard[row][column] = player;
        return newBoard;
      }
    }
    console.error("Column is full. No move made.");
    return currentBoard; // Return unchanged board if column is full
  }

  if (gameMode === "popout" && action === "popout") {
    for (let row = rows - 1; row >= 0; row--) {
      if (newBoard[row][column] !== 0) {
        newBoard[row][column] = 0;

        for (let r = row; r > 0; r--) {
          newBoard[r][column] = newBoard[r - 1][column];
        }
        newBoard[0][column] = 0;
        return newBoard;
      }
    }
    console.error("No piece to popout. No move made.");
    return currentBoard; // Return unchanged board if no piece exists to pop
  }

  // Default: Gravity-based placement
  for (let row = rows - 1; row >= 0; row--) {
    if (newBoard[row][column] === 0) {
      newBoard[row][column] = player;
      return newBoard;
    }
  }

  console.error("Column is full. No move made.");
  return currentBoard; // Return unchanged board if column is full
};
