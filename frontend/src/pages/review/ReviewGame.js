import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import Board from "../../components/board/Board";
import { getBestMove } from "../../config/api";
import { useTheme } from "../../contexts/ThemeContext";
import {
  initializeBoard,
  getGameModeConfig,
  flipBoardColours,
  applyMove,
} from "../../utilities/gameState";
import Loading from "../../components/loading/Loading";

const ReviewGame = () => {
  const { gameId, playerId } = useParams();
  const { darkMode } = useTheme();

  const [gameMode, setGameMode] = useState("connect-4");
  const [board, setBoard] = useState([]);
  const [moves, setMoves] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [precomputedBestMoves, setPrecomputedBestMoves] = useState([]);
  const [latestMove, setLatestMove] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationProgress, setEvaluationProgress] = useState(0);
  const [error, setError] = useState("");
  const [difficulty, setDifficulty] = useState("expert");

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const gameRef = doc(db, "players", playerId, "games", gameId);
        const gameSnap = await getDoc(gameRef);
        if (gameSnap.exists()) {
          const gameData = gameSnap.data();
          const currentGameMode = gameData.gameMode || "connect-4";
          setGameMode(currentGameMode);
          const config = getGameModeConfig(currentGameMode);
          setBoard(initializeBoard(config.rows, config.cols));

          const parsedMoves = parseMoves(gameData.moves);
          setMoves(parsedMoves);

          const gameDifficulty = gameData.difficulty || "medium";
          setDifficulty(gameDifficulty);

          if (gameData.bestMoves && gameData.bestMoves.length > 0) {
            setPrecomputedBestMoves(gameData.bestMoves);
            setLoading(false);
          } else {
            setLoading(false);
            await precomputeBestMoves(parsedMoves, currentGameMode, gameRef);
          }
        } else {
          setError("Game not found.");
          setLoading(false);
        }
      } catch (err) {
        setError("Failed to fetch game. Please try again later.");
        setLoading(false);
      }
    };

    fetchGame();
  }, [gameId, playerId]);

  const parseMoves = (moveString) => {
    const parsed = [];
    let isNegative = false;
    for (const char of moveString) {
      if (char === "-") {
        isNegative = true;
      } else {
        const move = parseInt(char, 10);
        if (!isNaN(move)) {
          parsed.push(isNegative ? -move : move - 1);
          isNegative = false;
        }
      }
    }
    return parsed;
  };

  const precomputeBestMoves = async (movesArr, currentGameMode, gameRef) => {
    setEvaluating(true);
    setEvaluationProgress(0);
    const config = getGameModeConfig(currentGameMode);
    let tempBoard = initializeBoard(config.rows, config.cols);

    const bestMoves = [];
    for (let i = 0; i < movesArr.length; i++) {
      const player = i % 2 === 0 ? 1 : -1;

      if (currentGameMode === "colour-switch" && i > 0 && i % 3 === 0) {
        tempBoard = flipBoardColours(tempBoard);
      }

      try {
        const response = await getBestMove(
          tempBoard,
          player,
          currentGameMode,
          difficulty
        );
        bestMoves.push(response.data.best_move);
      } catch (err) {
        bestMoves.push(null);
      }

      // Update progress
      const progress = ((i + 1) / movesArr.length) * 100;
      setEvaluationProgress(progress);

      const isPopout = movesArr[i] < 0;
      const colIndex = isPopout ? Math.abs(movesArr[i]) - 1 : movesArr[i];
      tempBoard = applyMove(
        tempBoard,
        colIndex,
        player,
        currentGameMode,
        isPopout ? "popout" : "place"
      );
    }

    try {
      await updateDoc(gameRef, { bestMoves });
      setPrecomputedBestMoves(bestMoves);
    } catch (err) {
      console.error("Error saving best moves:", err);
    }
    setEvaluating(false);
    setEvaluationProgress(0);
  };

  const computeBoardUpToMove = (moveIndex) => {
    const config = getGameModeConfig(gameMode);
    let tempBoard = initializeBoard(config.rows, config.cols);
    let latest = null;

    for (let i = 0; i <= moveIndex; i++) {
      const player = i % 2 === 0 ? 1 : -1;

      if (gameMode === "colour-switch" && i > 0 && i % 3 === 0) {
        tempBoard = flipBoardColours(tempBoard);
      }

      const isPopout = moves[i] < 0;
      const colIndex = isPopout ? Math.abs(moves[i]) - 1 : moves[i];

      tempBoard = applyMove(
        tempBoard,
        colIndex,
        player,
        gameMode,
        isPopout ? "popout" : "place"
      );

      if (isPopout) {
        for (let r = tempBoard.length - 1; r >= 0; r--) {
          if (tempBoard[r][colIndex] === 0) {
            latest = { row: r, column: colIndex };
            break;
          }
        }
      } else {
        for (let r = 0; r < tempBoard.length; r++) {
          if (tempBoard[r][colIndex] === player) {
            latest = { row: r, column: colIndex };
            break;
          }
        }
      }
    }

    return { board: tempBoard, latestMove: latest };
  };

  const renderBoardAtMove = (moveIndex) => {
    const { board: newBoard, latestMove: latest } =
      computeBoardUpToMove(moveIndex);
    setBoard(newBoard);
    setLatestMove(latest);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowRight" && currentMoveIndex < moves.length - 1) {
      const newIndex = currentMoveIndex + 1;
      setCurrentMoveIndex(newIndex);
      renderBoardAtMove(newIndex);
    } else if (e.key === "ArrowLeft" && currentMoveIndex > 0) {
      const newIndex = currentMoveIndex - 1;
      setCurrentMoveIndex(newIndex);
      renderBoardAtMove(newIndex);
    }
  };

  useEffect(() => {
    if (moves.length > 0) {
      renderBoardAtMove(currentMoveIndex);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moves, currentMoveIndex, gameMode]);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="container mt-4" style={{ minHeight: "100vh" }}>
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (evaluating) {
    return (
      <div className="container py-4" style={{ minHeight: "100vh" }}>
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            <div
              className={`card shadow-lg ${
                darkMode ? "bg-dark text-light" : "bg-light"
              }`}
            >
              <div className="card-body text-center py-5">
                <div className="mb-4">
                  <div className="d-flex justify-content-center mb-3">
                    <div
                      className="spinner-grow text-danger me-2"
                      style={{
                        animationDelay: "0s",
                        width: "1rem",
                        height: "1rem",
                      }}
                    ></div>
                    <div
                      className="spinner-grow text-warning me-2"
                      style={{
                        animationDelay: "0.2s",
                        width: "1rem",
                        height: "1rem",
                      }}
                    ></div>
                    <div
                      className="spinner-grow text-danger me-2"
                      style={{
                        animationDelay: "0.4s",
                        width: "1rem",
                        height: "1rem",
                      }}
                    ></div>
                    <div
                      className="spinner-grow text-warning me-2"
                      style={{
                        animationDelay: "0.6s",
                        width: "1rem",
                        height: "1rem",
                      }}
                    ></div>
                    <div
                      className="spinner-grow text-danger"
                      style={{
                        animationDelay: "0.8s",
                        width: "1rem",
                        height: "1rem",
                      }}
                    ></div>
                  </div>
                </div>
                <h4 className={`mb-3 ${darkMode ? "text-light" : "text-dark"}`}>
                  Computing Best Moves
                </h4>
                <p
                  className={`mb-4 ${
                    darkMode ? "text-light-emphasis" : "text-muted"
                  }`}
                >
                  Analyzing game positions and calculating optimal moves...
                </p>
                <div className="progress mb-3" style={{ height: "12px" }}>
                  <div
                    className="progress-bar progress-bar-striped progress-bar-animated bg-warning"
                    role="progressbar"
                    style={{ width: `${evaluationProgress}%` }}
                    aria-valuenow={evaluationProgress}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  ></div>
                </div>
                <div
                  className={`mb-2 ${darkMode ? "text-light" : "text-dark"}`}
                >
                  <strong>{Math.round(evaluationProgress)}% Complete</strong>
                </div>
                <small
                  className={`${
                    darkMode ? "text-light-emphasis" : "text-muted"
                  }`}
                >
                  {evaluationProgress < 50
                    ? "Analyzing early game positions..."
                    : evaluationProgress < 80
                    ? "Computing mid-game strategies..."
                    : "Finalizing optimal moves..."}
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ minHeight: "100vh" }}>
      <div
        className={`card mb-4 shadow-sm ${
          darkMode ? "bg-dark text-light" : "bg-light"
        }`}
      >
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h2 className="card-title">Review Game</h2>
              <h6 className="card-subtitle mb-2 text-warning">
                Game Mode: {gameMode.replace("-", " ").toUpperCase()}
              </h6>
            </div>
            <div className="col-md-4 text-md-end text-center mt-3 mt-md-0">
              <button
                className={`btn btn-warning me-2 ${
                  currentMoveIndex === 0 ? "disabled" : ""
                }`}
                onClick={() => {
                  if (currentMoveIndex > 0) {
                    const newIndex = currentMoveIndex - 1;
                    setCurrentMoveIndex(newIndex);
                    renderBoardAtMove(newIndex);
                  }
                }}
              >
                <i className="bi bi-arrow-left"></i> Previous Move
              </button>
              <button
                className={`btn btn-warning ${
                  currentMoveIndex === moves.length - 1 ? "disabled" : ""
                }`}
                onClick={() => {
                  if (currentMoveIndex < moves.length - 1) {
                    const newIndex = currentMoveIndex + 1;
                    setCurrentMoveIndex(newIndex);
                    renderBoardAtMove(newIndex);
                  }
                }}
              >
                Next Move <i className="bi bi-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`card mb-4 shadow-sm ${
          darkMode ? "bg-dark text-light" : "bg-light"
        }`}
      >
        <div className="card-body text-center">
          <Board
            board={board}
            highlightedColumns={[precomputedBestMoves[currentMoveIndex]]}
            latestMove={latestMove}
            rows={board.length}
            cols={board[0].length}
          />
          <div className="mt-3">
            <strong>Best Move for this turn:</strong>{" "}
            {precomputedBestMoves[currentMoveIndex] !== null
              ? precomputedBestMoves[currentMoveIndex] + 1
              : "Not available"}
          </div>
          <div className="mt-2">
            <strong>
              Move {currentMoveIndex + 1} of {moves.length}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewGame;
