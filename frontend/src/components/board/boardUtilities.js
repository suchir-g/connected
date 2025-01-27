export const boardToBinary = (board) => {
  let player1Binary = 0;
  let player2Binary = 0;

  board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const cellIndex = rowIndex * board[0].length + colIndex;
      if (cell === 1) {
        player1Binary |= 1 << cellIndex; 
      } else if (cell === -1) {
        player2Binary |= 1 << cellIndex; 
      }
    });
  });

  return { player1Binary, player2Binary };
};

export const binaryToBoard = (player1Binary, player2Binary, rows, cols) => {
  const board = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellIndex = row * cols + col;
      if ((player1Binary >> cellIndex) & 1) {
        board[row][col] = 1; 
      } else if ((player2Binary >> cellIndex) & 1) {
        board[row][col] = -1; 
      }
    }
  }

  return board;
};
