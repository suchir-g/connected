import React, { useState, useEffect } from "react";
import Board from "../../../components/board/Board";
import {
  checkWinner,
  isDrawCondition,
  applyMove,
} from "../../../utilities/gameState";

const gameModes = ["connect-4", "connect-5", "popout", "anti", "colour-switch"];

const PlayLocal = () => {
  // Initialize board based on default rows and cols
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(7);
  const [board, setBoard] = useState(() =>
    Array.from({ length: 6 }, () => Array(7).fill(0))
  );

  const [currentPlayer, setCurrentPlayer] = useState(1); // 1 for Player 1 (Red), -1 for Player 2 (Yellow)
  const [winner, setWinner] = useState(null);
  const [isDraw, setIsDraw] = useState(false);
  const [gameMode, setGameMode] = useState("connect-4");
  const [actionMode, setActionMode] = useState("place"); // For Popout
  const [moves, setMoves] = useState("");
  const [totalMoves, setTotalMoves] = useState(0); // Tracks the number of moves
  const [colorReversed, setColorReversed] = useState(false); // Tracks if colors are reversed
  const [error, setError] = useState(null);

  // Effect to set default grid based on game mode
  useEffect(() => {
    setDefaultGrid(gameMode);
  }, [gameMode]);

  // Effect to reset game when rows, cols, or game mode changes
  useEffect(() => {
    resetGame();
  }, [rows, cols, gameMode]);

  // Function to set grid size based on game mode
  const setDefaultGrid = (mode) => {
    if (mode === "connect-5") {
      setRows(8);
      setCols(9);
    } else {
      setRows(6);
      setCols(7);
    }
  };

  // Function to reset the game state
  const resetGame = () => {
    const newBoard = Array.from({ length: rows }, () => Array(cols).fill(0));
    setBoard(newBoard);
    setWinner(null);
    setIsDraw(false);
    setMoves("");
    setTotalMoves(0);
    setColorReversed(false);
    setCurrentPlayer(1); // Always start with Player 1 (Red)
    setError(null);
  };

  // Function to flip board colors (for Colour Switch mode)
  const flipBoardColors = (currentBoard) => {
    return currentBoard.map((row) =>
      row.map((cell) => (cell === 1 ? -1 : cell === -1 ? 1 : 0))
    );
  };

  // Function to handle making a move
  const handleMakeMove = (column) => {
    if (winner !== null || isDraw) return;

    // Handle Popout action
    if (gameMode === "popout" && actionMode === "popout") {
      const columnIsEmpty = board.every((row) => row[column] === 0);
      if (columnIsEmpty) {
        setError("Cannot popout from an empty column.");
        return;
      }

      const newBoard = popoutDisc(board, column);
      setBoard(newBoard);
      setMoves((prev) => prev + `-${column + 1}`);
      setTotalMoves((prev) => prev + 1);
      setError(null);

      // check for loss in Anti Connect-4 mode
      if (
        gameMode === "anti" &&
        checkWinner(newBoard, currentPlayer, gameMode)
      ) {
        setWinner(getPlayerName(currentPlayer));
        return;
      }

      if (isDrawCondition(newBoard)) {
        setIsDraw(true);
        return;
      }

      switchPlayer();

      return;
    }

    const updatedBoard = applyMove(
      board,
      column,
      currentPlayer,
      gameMode,
      rows,
      cols,
      actionMode
    );

    if (!updatedBoard) {
      setError("Invalid move. Try a different column.");
      return;
    }

    setBoard(updatedBoard);
    const moveNotation =
      currentPlayer === 1 ? `${column + 1}` : `${column + 1}`;
    setMoves((prev) => prev + moveNotation);
    setTotalMoves((prev) => prev + 1);
    setError(null);

    if (
      (checkWinner(updatedBoard, currentPlayer, gameMode) &&
        gameMode !== "anti") ||
      (checkWinner(updatedBoard, -currentPlayer, gameMode) &&
        gameMode === "anti")
    ) {
      setWinner(getPlayerName(currentPlayer));
      return;
    }

    // Check for loss in Anti Connect-4 mode
    if (
      (checkWinner(updatedBoard, -currentPlayer, gameMode) &&
        gameMode !== "anti") ||
      (checkWinner(updatedBoard, currentPlayer, gameMode) &&
        gameMode === "anti")
    ) {
      setWinner(getPlayerName(-currentPlayer));
      return;
    }

    // Check for draw
    if (isDrawCondition(updatedBoard)) {
      setIsDraw(true);
      return;
    }

    // Switch Player
    switchPlayer();
  };

  // Function to handle Popout action with complete shift-down of all discs above
  const popoutDisc = (currentBoard, column) => {
    const newBoard = currentBoard.map((row) => [...row]);
    // Find the first non-zero cell from the bottom
    let popRow = -1;
    for (let row = rows - 1; row >= 0; row--) {
      if (newBoard[row][column] !== 0) {
        popRow = row;
        break;
      }
    }

    if (popRow === -1) {
      // Column is empty, nothing to pop
      return newBoard;
    }

    // Shift all discs above the popped disc down by one
    for (let row = popRow; row > 0; row--) {
      newBoard[row][column] = newBoard[row - 1][column];
    }

    // Set the top cell to 0
    newBoard[0][column] = 0;

    return newBoard;
  };

  // useEffect to handle Colour Switch after every 3 moves
  useEffect(() => {
    if (
      gameMode === "colour-switch" &&
      totalMoves > 0 &&
      totalMoves % 3 === 0
    ) {
      const flippedBoard = flipBoardColors(board);
      setBoard(flippedBoard);
      setColorReversed((prev) => !prev);
      // Optionally, notify players about color reversal
    }
  }, [totalMoves, gameMode]);

  // Function to switch the current player
  const switchPlayer = () => {
    setCurrentPlayer((prev) => -prev);
  };

  // Function to get player name based on player number
  const getPlayerName = (player) => {
    return player === 1 ? "Red" : "Yellow";
  };

  // Function to handle Game Mode Change
  const handleGameModeChange = (event) => {
    const selectedMode = event.target.value;
    setGameMode(selectedMode);
    setActionMode("place");
    setDefaultGrid(selectedMode);
    resetGame();
  };

  const handleActionModeChange = (event) => {
    setActionMode(event.target.value);
  };

  return (
    <div className="container mt-4 text-center" style={{ minHeight: "100vh" }}>
      {error && <div className="alert alert-warning w-100">{error}</div>}

      <h1 className="my-4">Play Local</h1>

      <div className="d-flex justify-content-center">
        <div className="board-container">
          <Board
            rows={rows}
            cols={cols}
            board={board}
            onColumnClick={handleMakeMove}
          />
        </div>
      </div>

      <div className="row mt-4">
        <div className="col d-flex justify-content-center">
          <label htmlFor="gameMode" className="me-2">
            Game Mode:
          </label>
          <select
            id="gameMode"
            value={gameMode}
            onChange={handleGameModeChange}
            className="form-select d-inline-block w-auto"
          >
            {gameModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode
                  .split("-")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {gameMode === "popout" && (
        <div className="row mt-4">
          <div className="col d-flex justify-content-center">
            <label className="me-2">Action Mode:</label>
            <select
              value={actionMode}
              onChange={handleActionModeChange}
              className="form-select w-auto"
            >
              <option value="place">Place</option>
              <option value="popout">Popout</option>
            </select>
          </div>
        </div>
      )}

      {gameMode === "colour-switch" && (
        <div className="row mt-4">
          <div className="col d-flex justify-content-center">
            <p>Colour switch activated: Colors reverse every 3 moves.</p>
          </div>
        </div>
      )}

      <div className="row mt-4">
        <div className="col d-flex justify-content-center">
          <button onClick={resetGame} className="btn btn-primary">
            Reset Game
          </button>
        </div>
      </div>

      {winner && (
        <div className="alert alert-success mt-4 w-100">Winner: {winner}</div>
      )}
      {isDraw && (
        <div className="alert alert-warning mt-4 w-100">It's a draw!</div>
      )}

      <div className="row mt-4">
        <div className="col d-flex justify-content-center">
          <p>
            Current Turn: <strong>{getPlayerName(currentPlayer)}</strong>
          </p>
        </div>
      </div>

      {gameMode === "colour-switch" && (
        <div className="row mt-2">
          <div className="col d-flex justify-content-center">
            <p>
              {colorReversed
                ? "Colors are currently reversed."
                : "Colors are in normal order."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayLocal;
