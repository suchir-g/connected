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
