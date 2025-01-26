import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Board from "../../../components/board/Board";
import { getBestMove } from "../../../config/api";
import { auth, db } from "../../../config/firebase";
import { doc, collection, addDoc } from "firebase/firestore";
import styles from "./PlayBot.module.css";

const difficultyLevels = [
  "very_easy",
  "easy",
  "medium",
  "hard",
  "very_hard",
  "expert",
];

const PlayBot = () => {
  const [board, setBoard] = useState(Array(6).fill(Array(7).fill(0))); // Empty 6x7 board
  const [isLocked, setIsLocked] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isDraw, setIsDraw] = useState(false);
  const [highlightedColumns, setHighlightedColumns] = useState([]);
  const [difficulty, setDifficulty] = useState("medium");
  const [playerGoesFirst, setPlayerGoesFirst] = useState(true); // New state
  const [moves, setMoves] = useState("");
  const movesRef = useRef("");
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    const queryDifficulty = searchParams.get("difficulty");
    if (difficultyLevels.includes(queryDifficulty)) {
      setDifficulty(queryDifficulty);
    } else {
      setDifficulty("medium");
    }
    resetGame();
  }, [searchParams]);

  const resetGame = () => {
    setBoard(Array(6).fill(Array(7).fill(0))); // Reset to empty board
    setWinner(null);
    setIsDraw(false);
    setHighlightedColumns([]);
    setMoves("");
    movesRef.current = "";
    setIsLocked(false);

    // AI makes the first move if player goes second
    if (!playerGoesFirst) {
      makeAIMove(Array(6).fill(Array(7).fill(0)));
    }
  };

  const applyMove = (currentBoard, column, player) => {
    const newBoard = currentBoard.map((row) => [...row]);
    for (let row = newBoard.length - 1; row >= 0; row--) {
      if (newBoard[row][column] === 0) {
        newBoard[row][column] = player;
        return newBoard;
      }
    }
    return currentBoard;
  };

  const makeAIMove = async (currentBoard) => {
    try {
      const response = await getBestMove(
        currentBoard,
        -1,
        "connect-4",
        difficulty
      );
      const { best_move: aiMove, board: updatedBoard, outcome } = response.data;

      setBoard(updatedBoard);

      if (outcome === 1) {
        setWinner("Player");
      } else if (outcome === -1) {
        setIsDraw(true);
      } else if (aiMove !== null) {
        movesRef.current += (aiMove + 1).toString();
        setMoves(movesRef.current);
      }

      if (outcome !== 0) {
        recordGameResult(outcome, outcome === -1);
      }
    } catch (error) {
      console.error("Error fetching AI move:", error);
      setError("Could not fetch AI move.");
    } finally {
      setIsLocked(false);
    }
  };

  const handleMakeMove = async (column) => {
    if (isLocked || winner !== null || isDraw) return;

    // Apply the player's move
    const userMovedBoard = applyMove(board, column, 1);
    setBoard(userMovedBoard);
    movesRef.current += (column + 1).toString();
    setMoves(movesRef.current);

    // Check if the player wins after their move
    if (winner === "Player") return;

    setIsLocked(true);

    // AI's turn
    await makeAIMove(userMovedBoard);
  };

  const handleDifficultyChange = (event) => {
    const selectedDifficulty = event.target.value;
    setDifficulty(selectedDifficulty);
  };

  const handleTurnChange = (event) => {
    const goesFirst = event.target.value === "player";
    setPlayerGoesFirst(goesFirst);
  };

  const recordGameResult = async (gameOutcome, isDraw) => {
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
        gameMode: "connect-4",
        rows: 6,
        cols: 7,
        moves: movesRef.current,
        result: isDraw ? "draw" : gameOutcome === 1 ? "win" : "loss",
        bestMoves: [],
      };

      await addDoc(gameSubCollection, gameData);
    } catch (error) {
      console.error("Error recording game result:", error);
    }
  };

  return (
    <div className="container mt-4 text-center" style={{ minHeight: "100vh" }}>
      <h1 className="my-4">Play against Bot</h1>
      <div className="row">
        <div className="col">
          <Board
            board={board}
            highlightedColumns={highlightedColumns}
            onColumnClick={handleMakeMove}
          />
        </div>
      </div>
      {error && <div className={`alert alert-danger mt-3`}>{error}</div>}

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
      <div className="row mt-4">
        <div className="col d-flex justify-content-center">
          <div className="d-flex align-items-center">
            <label htmlFor="difficulty" className="me-2">
              AI Difficulty:
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={handleDifficultyChange}
              className="form-select w-auto"
              disabled={!board.every((row) => row.every((cell) => cell === 0))}
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
      </div>
      <div className="row mt-4">
        <div className="col d-flex justify-content-center">
          <div className="d-flex align-items-center">
            <label htmlFor="turn" className="me-2">
              Who goes first?
            </label>
            <select
              id="turn"
              value={playerGoesFirst ? "player" : "bot"}
              onChange={handleTurnChange}
              className="form-select w-auto"
            >
              <option value="player">Player</option>
              <option value="bot">Bot</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayBot;
