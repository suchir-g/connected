import React, { useState, useEffect } from "react";
import Board from "../../../components/board/Board";

import {
  getGameModeConfig,
  initializeBoard,
  flipBoardColours,
  checkWinner,
  isDrawCondition,
  applyMove,
  getPlayerName,
} from "../../../utilities/gameState";

const gameModes = ["connect-4", "connect-5", "popout", "anti", "colour-switch"];

const PlayLocal = () => {
  const [gameMode, setGameMode] = useState("connect-4");

  const [rows, setRows] = useState(() => getGameModeConfig(gameMode).rows);
  const [cols, setCols] = useState(() => getGameModeConfig(gameMode).cols);

  const [board, setBoard] = useState(() => initializeBoard(rows, cols));

  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [winner, setWinner] = useState(null);
  const [isDraw, setIsDraw] = useState(false);

  const [actionMode, setActionMode] = useState("place");

  const [moves, setMoves] = useState("");
  const [totalMoves, setTotalMoves] = useState(0);

  const [colourReversed, setcolourReversed] = useState(false);

  const [error, setError] = useState(null);

  useEffect(() => {
    const { rows: newRows, cols: newCols } = getGameModeConfig(gameMode);
    setRows(newRows);
    setCols(newCols);
  }, [gameMode]);

  useEffect(() => {
    resetGame();
  }, [rows, cols, gameMode]);

  const resetGame = () => {
    const newBoard = initializeBoard(rows, cols);
    setBoard(newBoard);
    setCurrentPlayer(1);
    setWinner(null);
    setIsDraw(false);
    setMoves("");
    setTotalMoves(0);
    setcolourReversed(false);
    setError(null);
  };

  const handleMakeMove = (column) => {
    if (winner || isDraw) return;

    const updatedBoard = applyMove(
      board,
      column,
      currentPlayer,
      gameMode,
      actionMode
    );

    if (!updatedBoard || updatedBoard === board) {
      setError("Invalid move. Try a different column.");
      return;
    }

    setBoard(updatedBoard);
    setMoves((prev) => prev + (column + 1).toString());
    setTotalMoves((prev) => prev + 1);
    setError(null);

    if (checkWinner(updatedBoard, currentPlayer, gameMode)) {
      if (gameMode === "anti") {
        setWinner(getPlayerName(-currentPlayer));
      } else {
        setWinner(getPlayerName(currentPlayer));
      }
      return;
    }

    if (isDrawCondition(updatedBoard)) {
      setIsDraw(true);
      return;
    }

    if (gameMode === "colour-switch" && (totalMoves + 1) % 3 === 0) {
      const flippedBoard = flipBoardColours(updatedBoard);
      setBoard(flippedBoard);
      setcolourReversed((prev) => !prev);
    }

    setCurrentPlayer((prev) => -prev);
  };

  const handleGameModeChange = (event) => {
    const selectedMode = event.target.value;
    setGameMode(selectedMode);
    setActionMode("place");
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
            <p>Colour switch activated: colours reverse every 3 moves.</p>
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
              {colourReversed
                ? "colours are currently reversed."
                : "colours are in normal order."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayLocal;
