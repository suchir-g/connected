import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db } from "../../config/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Board from "../../components/board/Board";
import { getBestMove } from "../../config/api";
import { useTheme } from "../../contexts/ThemeContext";
import Loading from "../../components/loading/Loading";

const ReviewGame = () => {
  const { gameId, playerId } = useParams();
  const { darkMode } = useTheme(); 

  const [board, setBoard] = useState(Array(6).fill(Array(7).fill(0)));
  const [moves, setMoves] = useState([]);
  const [gameMode, setGameMode] = useState("connect-4");
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [precomputedBestMoves, setPrecomputedBestMoves] = useState([]);
  const [latestMove, setLatestMove] = useState(null);
  const [scores, setScores] = useState(Array(7).fill(null));
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [startPlayer, setStartPlayer] = useState(1);
  useEffect(() => {
    const fetchGame = async () => {
      try {
        setLoading(true);
        const gameRef = doc(db, "players", playerId, "games", gameId);
        const gameSnap = await getDoc(gameRef);

        if (gameSnap.exists()) {
          const gameData = gameSnap.data();
          setGameMode(gameData.gameMode || "connect-4");

          const parsedMoves = parseMoves(gameData.moves);
          setMoves(parsedMoves);

          const gameDifficulty = gameData.difficulty || "medium";
          setDifficulty(gameDifficulty);

          const gameStartPlayer = gameData.startPlayer || 1;
          setStartPlayer(gameStartPlayer);

          if (gameData.bestMoves && gameData.bestMoves.length > 0) {
            setPrecomputedBestMoves(gameData.bestMoves);
          } else {
            await precomputeBestMoves(parsedMoves, gameMode, gameRef);
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
  }, [gameId, playerId, gameMode]);

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

  const flipBoardColors = (board) => {
    return board.map((row) =>
      row.map((cell) => (cell === 1 ? -1 : cell === -1 ? 1 : 0))
    );
  };

  const precomputeBestMoves = async (moves, gameMode, gameRef) => {
    setEvaluating(true);
    let tempBoard = Array(6).fill(Array(7).fill(0));
    const bestMoves = [];

    for (let i = 0; i < moves.length; i++) {
      const player = (i + (startPlayer == 1 ? 0 : 1)) % 2 === 0 ? 1 : -1;

      if (gameMode === "colour-switch" && i > 0 && i % 3 === 0) {
        tempBoard = flipBoardColors(tempBoard);
      }

      try {
        const response = await getBestMove(
          tempBoard,
          player,
          gameMode,
          difficulty
        );
        bestMoves.push(response.data.best_move);
      } catch (err) {
        bestMoves.push(null);
      }

      tempBoard = applyMove(tempBoard, moves[i], player, gameMode);
    }

    try {
      await updateDoc(gameRef, { bestMoves });
      setPrecomputedBestMoves(bestMoves);
    } catch (err) {
      console.error("Error saving best moves:", err);
    }

    setEvaluating(false);
  };

  const applyMove = (board, move, player, mode) => {
    const newBoard = board.map((row) => [...row]);
    let latestRow = null;

    if (mode === "popout" && move < 0) {
      const colIndex = Math.abs(move) - 1;
      for (let row = newBoard.length - 1; row > 0; row--) {
        newBoard[row][colIndex] = newBoard[row - 1][colIndex];
      }
      newBoard[0][colIndex] = 0;
    } else {
      for (let row = newBoard.length - 1; row >= 0; row--) {
        if (newBoard[row][move] === 0) {
          newBoard[row][move] = player;
          latestRow = row;
          break;
        }
      }
    }

    setLatestMove({ row: latestRow, column: move });
    return newBoard;
  };

  const renderBoardAtMove = (moveIndex) => {
    let tempBoard = Array(6).fill(Array(7).fill(0));

    for (let i = 0; i <= moveIndex; i++) {
      const player = (i + (startPlayer == 1 ? 0 : 1)) % 2 === 0 ? 1 : -1;

      if (gameMode === "colour-switch" && i > 0 && i % 3 === 0) {
        tempBoard = flipBoardColors(tempBoard);
      }

      tempBoard = applyMove(tempBoard, moves[i], player, gameMode);
    }

    setBoard(tempBoard);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowRight" && currentMoveIndex < moves.length - 1) {
      setCurrentMoveIndex((prevIndex) => {
        const newIndex = prevIndex + 1;
        renderBoardAtMove(newIndex);
        return newIndex;
      });
    } else if (e.key === "ArrowLeft" && currentMoveIndex > 0) {
      setCurrentMoveIndex((prevIndex) => {
        const newIndex = prevIndex - 1;
        renderBoardAtMove(newIndex);
        return newIndex;
      });
    }
  };

  useEffect(() => {
    if (moves.length > 0) {
      renderBoardAtMove(currentMoveIndex);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moves, currentMoveIndex]);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger w-100" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (evaluating) {
    return <Loading />;
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
                    setCurrentMoveIndex(currentMoveIndex - 1);
                    renderBoardAtMove(currentMoveIndex - 1);
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
                    setCurrentMoveIndex(currentMoveIndex + 1);
                    renderBoardAtMove(currentMoveIndex + 1);
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
