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
  flipBoardColors,
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
  const [error, setError] = useState("");
  const [difficulty, setDifficulty] = useState("expert");

  useEffect(() => {
    const fetchGame = async () => {
      try {
        setLoading(true);
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
          } else {
            await precomputeBestMoves(parsedMoves, currentGameMode, gameRef);
          }
        } else {
          setError("Game not found.");
        }
      } catch (err) {
        setError("Failed to fetch game. Please try again later.");
      } finally {
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
    const config = getGameModeConfig(currentGameMode);
    let tempBoard = initializeBoard(config.rows, config.cols);
    const bestMoves = [];
    for (let i = 0; i < movesArr.length; i++) {
      const player = i % 2 === 0 ? 1 : -1;
      if (currentGameMode === "colour-switch" && i > 0 && i % 3 === 0) {
        tempBoard = flipBoardColors(tempBoard);
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
      tempBoard = applyMove(tempBoard, movesArr[i], player, currentGameMode);
    }
    try {
      await updateDoc(gameRef, { bestMoves });
      setPrecomputedBestMoves(bestMoves);
    } catch (err) {
      console.error("Error saving best moves:", err);
    }
    setEvaluating(false);
  };

  const computeBoardUpToMove = (moveIndex) => {
    const config = getGameModeConfig(gameMode);
    let tempBoard = initializeBoard(config.rows, config.cols);
    let latest = null;
    for (let i = 0; i <= moveIndex; i++) {
      const player = i % 2 === 0 ? 1 : -1;
      if (gameMode === "colour-switch" && i > 0 && i % 3 === 0) {
        tempBoard = flipBoardColors(tempBoard);
      }
      tempBoard = applyMove(tempBoard, moves[i], player, gameMode);
      const col = moves[i] < 0 ? Math.abs(moves[i]) - 1 : moves[i];
      for (let r = tempBoard.length - 1; r >= 0; r--) {
        if (tempBoard[r][col] === player) {
          latest = { row: r, column: col };
          break;
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
    return (
      <Loading />
    );
  }
  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }
  if (evaluating) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: "100vh" }}
      >
        <div className="spinner-border text-warning" role="status">
          <span className="visually-hidden">Computing evaluation...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div
        className={`card mb-4 shadow-sm border-${darkMode ? "white" : "dark"}`}
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
                className={`btn btn-primary me-2 ${
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
                className={`btn btn-primary ${
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
        className={`card mb-4 shadow-sm border-${darkMode ? "white" : "dark"}`}
      >
        <div className="card-body text-center">
          <Board
            board={board}
            highlightedColumns={[precomputedBestMoves[currentMoveIndex]]}
            latestMove={latestMove}
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
