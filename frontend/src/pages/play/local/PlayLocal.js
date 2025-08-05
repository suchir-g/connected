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
  const [showRulesModal, setShowRulesModal] = useState(false);

  useEffect(() => {
    const { rows: newRows, cols: newCols } = getGameModeConfig(gameMode);
    setRows(newRows);
    setCols(newCols);
  }, [gameMode]);

  useEffect(() => {
    resetGame();
  }, [rows, cols, gameMode]);

  useEffect(() => {
    if (showRulesModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showRulesModal]);

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

  const handleRulesModal = () => {
    setShowRulesModal(!showRulesModal);
  };

  const getGameModeRules = (mode) => {
    switch (mode) {
      case "connect-4":
        return "Connect four of your pieces in a row, column, or diagonal to win. Players take turns dropping pieces from the top.";
      case "connect-5":
        return "Similar to Connect 4, but you need to connect five pieces in a row, column, or diagonal on a larger board.";
      case "popout":
        return "Like Connect 4, but with an added twist: you can either add a piece at the top or remove one of your own pieces from the bottom row, causing all pieces above to fall down.";
      case "anti":
        return "In Anti mode, if you create a line of four pieces, you lose! Force your opponent to connect four in a row.";
      case "colour-switch":
        return "Every three moves, all pieces on the board switch colors. Plan carefully, as your opponent's pieces can become yours and vice versa!";
      default:
        return "Select a game mode to see its rules.";
    }
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
          <button
            className="btn btn-secondary btn-sm ms-2"
            onClick={handleRulesModal}
          >
            Variant Rules
          </button>
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

      {/* Rules Modal */}
      {showRulesModal && (
        <>
          <div
            className="modal fade show"
            style={{
              display: "block",
              zIndex: 1050,
            }}
            tabIndex="-1"
            role="dialog"
          >
            <div className="modal-dialog" role="document">
              <div className="modal-content">
                {" "}
                {/* Removed bg-white to respect dark mode */}
                <div className="modal-header">
                  <h5 className="modal-title">Variant Rules</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={handleRulesModal}
                    aria-label="Close"
                  ></button>
                </div>
                <div
                  className="modal-body text-start"
                  style={{ maxHeight: "70vh", overflowY: "auto" }}
                >
                  <h5 className="mb-3">
                    How to Play:{" "}
                    {gameMode
                      .split("-")
                      .map(
                        (word) => word.charAt(0).toUpperCase() + word.slice(1)
                      )
                      .join(" ")}
                  </h5>
                  <p>{getGameModeRules(gameMode)}</p>{" "}
                  {/* Removed text-dark class */}
                  <hr />
                  <h6 className="mb-3">All Game Variants:</h6>
                  <ul className="list-group list-group-flush border-0">
                    {gameModes.map((mode) => (
                      <li key={mode} className="list-group-item border-0">
                        <strong>
                          {mode
                            .split("-")
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() + word.slice(1)
                            )
                            .join(" ")}
                          :
                        </strong>{" "}
                        {getGameModeRules(mode)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleRulesModal}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show"
            onClick={handleRulesModal}
            style={{
              backgroundColor: "rgba(0,0,0,0.3)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1040,
            }}
          ></div>

          <style jsx="true">{`
            body.modal-open {
              overflow: hidden;
              padding-right: 0 !important;
            }
            .modal-content {
              box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
            }
            /* Let Bootstrap handle dark mode styling */
            @media (prefers-color-scheme: dark) {
              .list-group-item {
                background-color: inherit;
                color: inherit;
              }
            }
            /* Remove list group borders */
            .list-group-flush .list-group-item {
              border-width: 0;
              border-radius: 0;
              padding: 0.5rem 0;
            }
          `}</style>
        </>
      )}
    </div>
  );
};

export default PlayLocal;
