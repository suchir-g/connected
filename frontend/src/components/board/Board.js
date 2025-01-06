import "./Board.css";

const Board = ({
  board,
  highlightedColumns = [],
  latestMove = null,
  onColumnClick,
}) => {
  if (
    !Array.isArray(board) ||
    board.length !== 6 ||
    !board.every((row) => Array.isArray(row) && row.length === 7)
  ) {
    return <div className="board-loading">LOADING BOArd...</div>;
  }

  return (
    <div className="board">
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="board-row">
          {row.map((cell, colIndex) => {
            const isHighlighted = highlightedColumns.includes(colIndex);
            const isLatestMove =
              latestMove &&
              latestMove.row === rowIndex &&
              latestMove.column === colIndex;

            let cellClass = "cell";
            if (cell === 1) cellClass += " player1";
            else if (cell === -1) cellClass += " player2";

            if (isHighlighted) cellClass += " highlighted";
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
