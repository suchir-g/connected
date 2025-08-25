import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Board from "../../../components/board/Board";
import { getBestMove } from "../../../config/api";
import { auth, db } from "../../../config/firebase";
import { doc, collection, addDoc } from "firebase/firestore";
import SEO from "../../../components/seo/SEO";

import {
  getGameModeConfig,
  initializeBoard,
  flipBoardColours,
  checkWinner,
  isDrawCondition,
  applyMove,
  isValidMove,
  getMoveError,
} from "../../../utilities/gameState";

const difficultyLevels = [
  "very_easy",
  "easy",
  "medium",
  "hard",
  "very_hard",
  "expert",
];

const gameModes = ["connect-4", "connect-5", "popout", "anti", "colour-switch"];

const PlayBot = () => {
  const [searchParams] = useSearchParams();
  const [gameMode, setGameMode] = useState("connect-4");
  const { rows: initialRows, cols: initialCols } = getGameModeConfig(gameMode);
  const [rows, setRows] = useState(initialRows);
  const [cols, setCols] = useState(initialCols);

  const [board, setBoard] = useState(() =>
    initializeBoard(initialRows, initialCols)
  );
  const [isLocked, setIsLocked] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isDraw, setIsDraw] = useState(false);
  const [highlightedColumns, setHighlightedColumns] = useState([]);
  const [difficulty, setDifficulty] = useState("medium");
  const [actionMode, setActionMode] = useState("place");
  const [moves, setMoves] = useState("");
  const [totalMoves, setTotalMoves] = useState(0);
  const [firstPlayer, setFirstPlayer] = useState("player");
  const movesRef = useRef("");
  const [error, setError] = useState(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationDuration = 1000; // Animation duration in milliseconds
  const minAiDelay = 600; // Minimum delay before AI makes a move (in milliseconds)

  useEffect(() => {
    const queryDifficulty = searchParams.get("difficulty");
    const queryMode = searchParams.get("mode");

    if (difficultyLevels.includes(queryDifficulty)) {
      setDifficulty(queryDifficulty);
    } else {
      setDifficulty("medium");
    }

    if (gameModes.includes(queryMode)) {
      setGameMode(queryMode);
      setActionMode("place");
    } else {
      setGameMode("connect-4");
    }
  }, [searchParams]);

  useEffect(() => {
    const { rows: newRows, cols: newCols } = getGameModeConfig(gameMode);
    setRows(newRows);
    setCols(newCols);
  }, [gameMode]);

  useEffect(() => {
    resetGame();
  }, [firstPlayer]);

  useEffect(() => {
    resetGame();
  }, [rows, cols]);

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

  const resetGame = async () => {
    const newBoard = initializeBoard(rows, cols);
    setBoard(newBoard);
    setWinner(null);
    setIsDraw(false);
    setHighlightedColumns([]);
    setMoves("");
    movesRef.current = "";
    setTotalMoves(0);
    setIsLocked(false);
    setError(null);

    if (firstPlayer === "bot") {
      setIsLocked(true);
      try {
        const response = await getBestMove(newBoard, -1, gameMode, difficulty);
        const { best_move: aiMove, board: updatedBoardAI } = response.data;

        if (aiMove !== null) {
          const colIndex = Math.abs(aiMove);
          if (aiMove < 0) {
            movesRef.current += `-${colIndex + 1}`;
          } else {
            movesRef.current += (colIndex + 1).toString();
          }
          setMoves(movesRef.current);
        }

        const newTotalMoves = totalMoves + 1;

        // Check AI win BEFORE color flipping
        if (
          (checkWinner(updatedBoardAI, -1, gameMode) && gameMode !== "anti") ||
          (checkWinner(updatedBoardAI, 1, gameMode) && gameMode === "anti")
        ) {
          // No color flipping when there's a winner - just set the board
          setBoard(updatedBoardAI);
          setTotalMoves(newTotalMoves);
          setWinner("AI");
          recordGameResult(-1, false);
          setIsLocked(false);
          return;
        }

        // Only flip if there's no winner
        let finalBoard = updatedBoardAI;
        if (gameMode === "colour-switch" && newTotalMoves % 3 === 0) {
          finalBoard = flipBoardColours(finalBoard);
        }

        setBoard(finalBoard);
        setTotalMoves(newTotalMoves);

        // Check for player win after color flip
        if (
          (checkWinner(finalBoard, 1, gameMode) && gameMode !== "anti") ||
          (checkWinner(finalBoard, -1, gameMode) && gameMode === "anti")
        ) {
          setWinner("Player");
          recordGameResult(1, false);
          setIsLocked(false);
          return;
        }

        if (isDrawCondition(finalBoard)) {
          setIsDraw(true);
          recordGameResult(-1, true);
          setIsLocked(false);
          return;
        }
      } catch (error) {
        console.error("Error fetching AI move:", error);
        setError("Could not fetch AI move.");
      } finally {
        setIsLocked(false);
      }
    }
  };

  const handleMakeMove = async (column) => {
    if (isLocked || winner || isDraw || isAnimating) return;

    if (!isValidMove(board, column, gameMode, actionMode)) {
      const moveError = getMoveError(board, column, actionMode);
      setError(moveError || "Invalid move. Try a different column.");
      return;
    }

    setError(null);

    const updatedBoard = applyMove(board, column, 1, gameMode, actionMode);
    let finalBoard = updatedBoard;

    if (actionMode === "place") {
      movesRef.current += (column + 1).toString();
    } else {
      movesRef.current += `-${column + 1}`;
    }
    setMoves(movesRef.current);

    const newTotalMoves = totalMoves + 1;

    // Check win condition BEFORE color flipping
    if (
      (checkWinner(finalBoard, 1, gameMode) && gameMode !== "anti") ||
      (checkWinner(finalBoard, -1, gameMode) && gameMode === "anti")
    ) {
      // No color flipping when there's a winner - just set the board
      setBoard(finalBoard);
      setTotalMoves(newTotalMoves);
      setWinner("Player");
      recordGameResult(1, false);
      return;
    }

    // Now flip colors if needed - only when there's no winner
    if (gameMode === "colour-switch" && newTotalMoves % 3 === 0) {
      setIsAnimating(true);
      setBoard(finalBoard); // First set the board before flip

      // Wait for animation to complete before actually flipping colors
      setTimeout(() => {
        const flippedBoard = flipBoardColours(finalBoard);
        setBoard(flippedBoard);
        finalBoard = flippedBoard;
        setIsAnimating(false);

        // Check for AI win after color flip
        if (
          (checkWinner(finalBoard, -1, gameMode) && gameMode !== "anti") ||
          (checkWinner(finalBoard, 1, gameMode) && gameMode === "anti")
        ) {
          setWinner("AI");
          recordGameResult(-1, false);
          return;
        }

        if (isDrawCondition(finalBoard)) {
          setIsDraw(true);
          recordGameResult(-1, true);
          return;
        }

        // Continue with AI move after animation
        makeAIMove(finalBoard, newTotalMoves);
      }, animationDuration);

      setTotalMoves(newTotalMoves);
      return;
    }

    setBoard(finalBoard);
    setTotalMoves(newTotalMoves);

    // Check for AI win after color flip
    if (
      (checkWinner(finalBoard, -1, gameMode) && gameMode !== "anti") ||
      (checkWinner(finalBoard, 1, gameMode) && gameMode === "anti")
    ) {
      setWinner("AI");
      recordGameResult(-1, false);
      return;
    }

    if (isDrawCondition(finalBoard)) {
      setIsDraw(true);
      recordGameResult(-1, true);
      return;
    }

    makeAIMove(finalBoard, newTotalMoves);
  };

  // Enhanced makeAIMove function with minimum delay
  const makeAIMove = async (currentBoard, currentTotalMoves) => {
    setIsLocked(true);

    // Add minimum delay for better UX and memory purposes
    const startTime = Date.now();

    try {
      const response = await getBestMove(
        currentBoard,
        -1,
        gameMode,
        difficulty
      );
      const { best_move: aiMove, board: updatedBoardAI } = response.data;

      // Calculate elapsed time and wait if needed
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < minAiDelay) {
        await new Promise((resolve) =>
          setTimeout(resolve, minAiDelay - elapsedTime)
        );
      }

      let finalBoardAI = updatedBoardAI;

      if (aiMove !== null) {
        const colIndex = Math.abs(aiMove);
        if (aiMove < 0) {
          movesRef.current += `-${colIndex + 1}`;
        } else {
          movesRef.current += (colIndex + 1).toString();
        }
        setMoves(movesRef.current);
      }

      const newTotalMovesAI = currentTotalMoves + 1;

      // Check AI win BEFORE color flipping
      if (
        (checkWinner(finalBoardAI, -1, gameMode) && gameMode !== "anti") ||
        (checkWinner(finalBoardAI, 1, gameMode) && gameMode === "anti")
      ) {
        // No color flipping when there's a winner - just set the board
        setBoard(finalBoardAI);
        setTotalMoves(newTotalMovesAI);
        setWinner("AI");
        recordGameResult(-1, false);
        setIsLocked(false);
        return;
      }

      // Now flip colors if needed - only when there's no winner
      if (gameMode === "colour-switch" && newTotalMovesAI % 3 === 0) {
        setIsAnimating(true);
        setBoard(finalBoardAI); // Set board before flip

        setTimeout(() => {
          const flippedBoard = flipBoardColours(finalBoardAI);
          setBoard(flippedBoard);
          finalBoardAI = flippedBoard;

          // Check for player win after color flip
          if (
            (checkWinner(finalBoardAI, 1, gameMode) && gameMode !== "anti") ||
            (checkWinner(finalBoardAI, -1, gameMode) && gameMode === "anti")
          ) {
            setWinner("Player");
            recordGameResult(1, false);
          } else if (isDrawCondition(finalBoardAI)) {
            setIsDraw(true);
            recordGameResult(-1, true);
          }

          setIsAnimating(false);
          setIsLocked(false);
        }, animationDuration);
      } else {
        setBoard(finalBoardAI);

        // Check for player win after normal move
        if (
          (checkWinner(finalBoardAI, 1, gameMode) && gameMode !== "anti") ||
          (checkWinner(finalBoardAI, -1, gameMode) && gameMode === "anti")
        ) {
          setWinner("Player");
          recordGameResult(1, false);
        } else if (isDrawCondition(finalBoardAI)) {
          setIsDraw(true);
          recordGameResult(-1, true);
        }

        setIsLocked(false);
      }

      setTotalMoves(newTotalMovesAI);
    } catch (error) {
      console.error("Error fetching AI move:", error);
      setError("Could not fetch AI move.");
      setIsLocked(false);
    }
  };

  const recordGameResult = async (gameOutcome, draw) => {
    if (!auth.currentUser) {
      console.error("User not authenticated");
      return;
    }
    try {
      const playerDocRef = doc(db, "players", auth.currentUser.uid);
      const gameSubCollection = collection(playerDocRef, "games");
      const gameData = {
        timestamp: new Date(),
        difficulty,
        gameMode,
        moves: movesRef.current,
        result: draw ? "draw" : gameOutcome === 1 ? "win" : "loss",
        bestMoves: [],
        startPlayer: firstPlayer === "player" ? 1 : -1,
      };
      await addDoc(gameSubCollection, gameData);
    } catch (error) {
      console.error("Error recording game result:", error);
    }
  };

  const handleDifficultyChange = (event) => {
    setDifficulty(event.target.value);
  };

  const handleGameModeChange = (event) => {
    const selectedMode = event.target.value;
    setGameMode(selectedMode);
    setActionMode("place");
  };

  const handleFirstPlayerChange = (event) => {
    setFirstPlayer(event.target.value);
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

  // Calculate moves until next flip
  const getMovesUntilFlip = () => {
    if (gameMode !== "colour-switch") return null;
    const currentCyclePosition = totalMoves % 3;
    return 3 - currentCyclePosition;
  };

  return (
    <div className="container mt-4 text-center" style={{ minHeight: "100vh" }}>
      <SEO
        title="Play Against AI Bot - Connected"
        description="Challenge our AI bot at various difficulty levels in multiple game variants including Connect-4, Popout, and Color Switch."
        canonicalUrl="/play/bot"
      />
      {error && <div className="alert alert-warning w-100">{error}</div>}

      <h1 className="my-4">Play against Bot</h1>

      <div className="d-flex justify-content-center">
        <div
          className={`board-container ${
            isAnimating ? "board-color-switching" : ""
          }`}
        >
          <Board
            rows={rows}
            cols={cols}
            board={board}
            highlightedColumns={highlightedColumns}
            onColumnClick={handleMakeMove}
          />
        </div>
      </div>

      {/* Color flip counter */}
      {gameMode === "colour-switch" && (
        <div className="row mt-2">
          <div className="col d-flex justify-content-center">
            <div className="color-flip-indicator">
              <p>
                {isAnimating ? (
                  <span className="text-warning">Colors flipping...</span>
                ) : (
                  <>
                    Next color flip in: <strong>{getMovesUntilFlip()}</strong>{" "}
                    move{getMovesUntilFlip() !== 1 ? "s" : ""}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="row mt-4">
        <div className="col d-flex justify-content-center">
          <label htmlFor="firstPlayer" className="me-2 align-self-center">
            First Player:
          </label>
          <select
            id="firstPlayer"
            value={firstPlayer}
            onChange={handleFirstPlayerChange}
            className="form-select w-auto"
            disabled={totalMoves > 0}
          >
            <option value="player">Player</option>
            <option value="bot">Bot</option>
          </select>
        </div>
      </div>

      {gameMode === "popout" && (
        <div className="row mt-4">
          <div className="col d-flex justify-content-center">
            <label className="me-2 align-self-center">Action Mode:</label>
            <select
              value={actionMode}
              onChange={(e) => setActionMode(e.target.value)}
              className="form-select w-auto"
            >
              <option value="place">Place</option>
              <option value="popout">Popout</option>
            </select>
          </div>
        </div>
      )}

      <div className="row mt-4">
        <div className="col-md-6 d-flex justify-content-center mb-3 mb-md-0">
          <div>
            <label htmlFor="difficulty" className="me-2">
              AI Difficulty:
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={handleDifficultyChange}
              className="form-select d-inline-block w-auto"
              disabled={totalMoves > 1}
            >
              {difficultyLevels.map((level) => (
                <option key={level} value={level}>
                  {level
                    .split("_")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="col-md-6 d-flex justify-content-center">
          <div>
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
      </div>

      <div className="row mt-4">
        <div className="col d-flex justify-content-center">
          <button
            onClick={resetGame}
            disabled={isLocked}
            className="btn btn-primary"
          >
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
                  <p>{getGameModeRules(gameMode)}</p>

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

      <style jsx="true">{`
        .board-color-switching {
          animation: fadeAnimation ${animationDuration}ms ease-in-out;
        }

        @keyframes fadeAnimation {
          0% {
            opacity: 1;
          }
          45% {
            opacity: 0.3;
          }
          55% {
            opacity: 0.3;
          }
          100% {
            opacity: 1;
          }
        }

        .color-flip-indicator {
          background-color: ${gameMode === "colour-switch"
            ? "rgba(0,0,0,0.1)"
            : "transparent"};
          padding: 5px 15px;
          border-radius: 15px;
          display: inline-block;
        }

        /* Add transition to counters in the board */
        :global(.board-container .cell .counter) {
          transition: background-color ${animationDuration / 2}ms ease-in-out,
            box-shadow ${animationDuration / 2}ms ease-in-out,
            transform ${animationDuration / 3}ms ease;
        }

        .board-color-switching :global(.cell .counter) {
          animation: counterTransition ${animationDuration}ms ease-in-out;
        }

        @keyframes counterTransition {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(0.9);
            filter: blur(1px);
          }
          55% {
            transform: scale(0.9);
            filter: blur(1px);
          }
          100% {
            transform: scale(1);
            filter: blur(0);
          }
        }
      `}</style>
    </div>
  );
};

export default PlayBot;
