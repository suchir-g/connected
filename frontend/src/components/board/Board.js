import "./Board.css";

const Board = ({
  rows = 6, // Default to 6 rows
  cols = 7, // Default to 7 columns
  board = Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => 0)), // Default to 6x7 empty board
  highlightedColumns = [],
  latestMove = null,
  onColumnClick,
}) => {
  console.log("Board props:", {
    rows,
    cols,
    board,
    highlightedColumns,
    latestMove,
    onColumnClick,
  });

  if (
    !Array.isArray(board) ||
    board.length !== rows ||
    !board.every((row) => Array.isArray(row) && row.length === cols)
  ) {
    return <div className="board-loading">LOADING BOARD...</div>;
  }

  return (
    <div
      className="board"
      style={{
        gridTemplateColumns: `repeat(${cols}, auto)`,
        gridTemplateRows: `repeat(${rows}, auto)`,
      }}
    >
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="board-row">
          {row.map((cell, colIndex) => {
            // Determine if the column is highlighted
            const isHighlighted = highlightedColumns.some((highlighted) => {
              // Popout moves are negative values
              if (highlighted < 0) {
                return Math.abs(highlighted) - 1 === colIndex; // Popout column
              }
              return highlighted === colIndex; // Regular column
            });

            // Determine if the column is a popout move
            const isPopoutMove = highlightedColumns.includes(
              -(colIndex + 1) // Popout column representation
            );

            // Determine if this cell is the latest move
            const isLatestMove =
              latestMove &&
              latestMove.row === rowIndex &&
              latestMove.column === colIndex;

            // Apply appropriate cell classes
            let cellClass = "cell";
            if (cell === 1) cellClass += " player1";
            else if (cell === -1) cellClass += " player2";

            if (isHighlighted) {
              cellClass += isPopoutMove
                ? " popout-highlighted"
                : " highlighted";
            }
            if (isLatestMove) cellClass += " latest-move";

            return (
              <div
                key={colIndex}
                className={cellClass}
                onClick={() => onColumnClick && onColumnClick(colIndex)}
                style={{ cursor: onColumnClick ? "pointer" : "default" }}
              >
                {cell === 1 && <div className="piece player1-piece" />}
                {cell === -1 && <div className="piece player2-piece" />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default Board;
