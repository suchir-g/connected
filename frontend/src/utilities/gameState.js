export const initializeBoard = (rows, cols) => {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
};

export const getGameModeConfig = (mode) => {
  const config = {
    "connect-4": { rows: 6, cols: 7, nInARow: 4 },
    "connect-5": { rows: 8, cols: 9, nInARow: 5 },
    popout: { rows: 6, cols: 7, nInARow: 4 },
    anti: { rows: 6, cols: 7, nInARow: 4 },
    "colour-switch": { rows: 6, cols: 7, nInARow: 4 },
  };
  return config[mode] || config["connect-4"];
};

export const flipBoardColours = (board) => {
  return board.map((row) => row.map((cell) => -cell));
};

export const switchPlayer = (currentPlayer) => {
  return -currentPlayer;
};

export const isValidMove = (board, column, gameMode, action = "place") => {
  if (action === "popout") {
    return board[board.length - 1][column] !== 0;
  }
  return board[0][column] === 0;
};

export const getMoveNotation = (column, currentPlayer) => {
  return `${column + 1}`;
};

export const getMoveError = (board, column, action = "place") => {
  if (action === "popout" && board[board.length - 1][column] === 0) {
    return "Cannot popout from an empty column.";
  }
  if (action === "place" && board[0][column] !== 0) {
    return "Column is full. Try a different column.";
  }
  return null;
};

export const resetGameState = (rows, cols) => {
  return {
    board: initializeBoard(rows, cols),
    currentPlayer: 1,
    winner: null,
    isDraw: false,
    moves: "",
    totalMoves: 0,
    ColourReversed: false,
    error: null,
  };
};

export const getPlayerName = (player) => {
  return player === 1 ? "Red" : "Yellow";
};

export const checkWinner = (board, currentPlayer, gameMode) => {
  const nInARow = gameMode === "connect-5" ? 5 : 4;
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

        if (count === nInARow) {
          return true;
        }
      }
    }
  }

  return false;
};
export const isDrawCondition = (board) => {
  return board.every((row) => row.every((cell) => cell !== 0));
};

export const applyMove = (
  currentBoard,
  column,
  player,
  gameMode,
  action = "place"
) => {
  const rows = gameMode === "connect-5" ? 8 : 6;
  const newBoard = currentBoard.map((row) => [...row]);

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
    return currentBoard;
  }

  for (let row = rows - 1; row >= 0; row--) {
    if (newBoard[row][column] === 0) {
      newBoard[row][column] = player;
      return newBoard;
    }
  }

  console.error("Column is full. No move made.");
  return currentBoard;
};
