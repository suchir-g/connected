import React, { use, useState } from "react";
import Board from "../../../components/board/Board";
import { getBestMove as apiGetBestMove } from "../../../config/api";
import { useTheme } from "../../../contexts/ThemeContext";

const PlayLocal = () => {
  const initialBoard = Array.from({ length: 6 }, () => Array(7).fill(0));

  const darkMode = useTheme().darkMode;

  const [board, setBoard] = useState(initialBoard);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [winner, setWinner] = useState(null);
  const [isDraw, setIsDraw] = useState(false);
  const [highlightedColumns, setHighlightedColumns] = useState([]);
  const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false);
  const [lastMove, setLastMove] = useState({ row: null, column: null });
  const [error, setError] = useState(null);

  const initializeGame = () => {
    setBoard(initialBoard);
    setCurrentPlayer(1);
    setWinner(null);
    setIsDraw(false);
    setHighlightedColumns([]);
  };

  const handleMakeMove = (column) => {
    if (winner !== null || isDraw) {
      return;
    }

    const row = findEmptyRow(board, column);
    if (row === -1) {
      alert("fulll col");
      return;
    }
    console.log(row, column);

    const updatedBoard = board.map((row) => [...row]);
    updatedBoard[row][column] = currentPlayer;

    const gameStatus = checkGameStatus(
      updatedBoard,
      row,
      column,
      currentPlayer
    );

    if (gameStatus.winner) {
      setWinner(currentPlayer);
    } else if (gameStatus.isDraw) {
      setIsDraw(true);
    }

    setBoard(updatedBoard);
    setCurrentPlayer(currentPlayer === 1 ? -1 : 1);
    setLastMove({ row, column });
    setHighlightedColumns([]);
  };

  const findEmptyRow = (board, column) => {
    for (let row = 5; row >= 0; row--) {
      if (board[row][column] === 0) {
        return row;
      }
    }
    return -1; //full col
  };

  const checkGameStatus = (board, row, column, player) => {
    if (isWinningMove(board, row, column, player)) {
      return { winner: player, isDraw: false };
    }

    const isBoardFull = board.every((row) => row.every((cell) => cell !== 0));
    if (isBoardFull) {
      return { winner: null, isDraw: true };
    }

    return { winner: null, isDraw: false };
  };

  const isWinningMove = (board, row, column, player) => {
    const directions = [
      { dr: 0, dc: 1 }, // dr = change in r, cd = change in c
      { dr: 1, dc: 0 },
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 },
    ];

    for (let { dr, dc } of directions) {
      let count = 1;

      count += countConsecutive(board, row, column, dr, dc, player);

      count += countConsecutive(board, row, column, -dr, -dc, player);

      if (count >= 4) {
        return true;
      }
    }

    return false;
  };

  const countConsecutive = (board, row, column, dr, dc, player) => {
    let r = row + dr;
    let c = column + dc;
    let count = 0;

    while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
      count++;
      r += dr;
      c += dc;
    }

    return count;
  };

  const handleSuggestMove = async () => {
    if (winner !== null || isDraw) {
      return;
    }

    setIsFetchingSuggestion(true);

    try {
      const response = await apiGetBestMove(board, currentPlayer);
      const { best_column } = response.data;

      if (best_column !== -1) {
        setHighlightedColumns([best_column]);
      } else {
        setHighlightedColumns([]);
      }
    } catch (error) {
      console.error("Error fetching AI suggestion:", error);
      setError("Could not fetch AI suggestion.");
    }

    setIsFetchingSuggestion(false);
  };

  return (
    <div className={`container mt-4 text-center ${darkMode ? "bg-dark text-white" : ""}`} style={{minHeight: "100vh"}}>
      <h1 className="my-4">Play Locally</h1>
      <div className="row justify-content-center">
        <div className="col-md-8">
          <Board
            board={board}
            highlightedColumns={highlightedColumns}
            onColumnClick={handleMakeMove}
            latestMove={lastMove}
          />
        </div>
      </div>
      {error && <div className="alert alert-danger mt-3">{error}</div>}
      <div className="row justify-content-center mt-3">
        <div className="col-auto">
          <div
            style={{
              borderRadius: "50%",
              width: "50px",
              height: "50px",
              backgroundColor: currentPlayer === 1 ? "red" : "yellow",
              border: "4px solid black",
              boxShadow: `0px 0px 20px ${
                currentPlayer === 1 ? "#eb4034a8" : "#ffe419a8"
              }`,
            }}
          ></div>
        </div>
      </div>
      <div className="row justify-content-center mt-4">
        <div className="col-auto">
          <button
            onClick={initializeGame}
            disabled={isFetchingSuggestion}
            className="btn btn-primary mx-2 shadow"
          >
            Start or Reset Game
          </button>
          <button
            onClick={handleSuggestMove}
            disabled={isFetchingSuggestion || winner !== null || isDraw}
            className="btn btn-success mx-2 shadow"
          >
            {isFetchingSuggestion
              ? "Fetching Suggestion..."
              : "Suggest AI Move"}
          </button>
        </div>
      </div>
      <div className="row justify-content-center mt-4">
        <div className="col-auto">
          <div className="status">
            {winner === 1 && <p className="alert alert-success">Player 1 wins!</p>}
            {winner === -1 && <p className="alert alert-success">Player 2 wins!</p>}
            {isDraw && <p className="alert alert-secondary">It's a draw!</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayLocal;
