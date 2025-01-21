import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Board from "../../../../components/board/Board";
import { getBestMove } from "../../../../config/api";
import { auth, db } from "../../../../config/firebase";
import { doc, collection, addDoc } from "firebase/firestore";
import styles from "./PlayVariants.module.css";
import { checkWinner, isDrawCondition } from "../../../../utilities/gameState";
const difficultyLevels = [
  "very_easy",
  "easy",
  "medium",
  "hard",
  "very_hard",
  "expert",
];

const gameModes = ["connect-4", "connect-5", "var-grid", "no-grav"];

const PlayVariants = () => {
  const [board, setBoard] = useState(Array(6).fill(Array(7).fill(0))); // Default 6x7 board
  const [isLocked, setIsLocked] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isDraw, setIsDraw] = useState(false);
  const [highlightedColumns, setHighlightedColumns] = useState([]);
  const [difficulty, setDifficulty] = useState("medium");
  const [gameMode, setGameMode] = useState("connect-4");
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(7);
  const [moves, setMoves] = useState("");
  const movesRef = useRef("");
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);

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
      setDefaultGrid(queryMode);
    } else {
      setGameMode("connect-4");
      setDefaultGrid("connect-4");
    }

    resetGame();
  }, [searchParams]);

  const setDefaultGrid = (mode) => {
    if (mode === "connect-5") {
      setRows(8);
      setCols(9);
    } else if (mode === "var-grid") {
      setRows(6);
      setCols(7);
    } else {
      setRows(6);
      setCols(7);
    }
  };

  const resetGame = () => {
    const newBoard = Array.from({ length: rows }, () => Array(cols).fill(0));
    setBoard(newBoard);
    setWinner(null);
    setIsDraw(false);
    setHighlightedColumns([]);
    setMoves("");
    movesRef.current = "";
    setIsLocked(false);
  };

  const applyMove = (currentBoard, column, player) => {
    const newBoard = currentBoard.map((row) => [...row]);

    if (gameMode === "no-grav") {
      // In no-gravity mode, place the piece in the first available slot in the column
      for (let row = 0; row < rows; row++) {
        if (newBoard[row][column] === 0) {
          newBoard[row][column] = player;
          return newBoard;
        }
      }
    } else {
      // Standard gravity-based placement
      for (let row = rows - 1; row >= 0; row--) {
        if (newBoard[row][column] === 0) {
          newBoard[row][column] = player;
          return newBoard;
        }
      }
    }
    return currentBoard;
  };

  const handleMakeMove = async (column) => {
    if (isLocked || winner !== null || isDraw) return;

    // Apply the player's move
    const userMovedBoard = applyMove(board, column, 1);
    setBoard(userMovedBoard);
    movesRef.current += (column + 1).toString();
    setMoves(movesRef.current);

    // Check if the player wins after their move
    if (checkWinner(userMovedBoard, 1, gameMode)) {
      setWinner("Player");
      recordGameResult(1, false); // Player wins
      return; // Stop further processing
    }

    // Check for a draw after the player's move
    if (isDrawCondition(userMovedBoard)) {
      setIsDraw(true);
      recordGameResult(-1, true); // It's a draw
      return; // Stop further processing
    }

    setIsLocked(true);

    try {
      // Fetch the AI's best move and outcome
      const response = await getBestMove(
        userMovedBoard,
        -1,
        gameMode,
        difficulty
      );
      const { best_move: aiMove, board: updatedBoard, outcome } = response.data;

      // Always update the board with the backend's updated board
      setBoard(updatedBoard);

      // Update moves history
      if (aiMove !== null) {
        movesRef.current += (aiMove + 1).toString();
        setMoves(movesRef.current);
      }

      // Handle the outcome
      if (outcome === 1) {
        setWinner("AI"); // AI wins
        recordGameResult(-1, false); // Log the result
      } else if (outcome === -1) {
        setIsDraw(true); // It's a draw
        recordGameResult(-1, true);
      }
    } catch (error) {
      console.error("Error fetching AI move:", error);
      setError("Could not fetch AI move.");
    } finally {
      setIsLocked(false);
    }
  };

  const handleDifficultyChange = (event) => {
    setDifficulty(event.target.value);
  };

  const handleGameModeChange = (event) => {
    const selectedMode = event.target.value;
    setGameMode(selectedMode);
    setDefaultGrid(selectedMode);
    resetGame();
  };

  const handleGridSizeChange = (type, value) => {
    const newValue = Math.max(4, Math.min(10, parseInt(value, 10) || 4));
    if (type === "rows") setRows(newValue);
    if (type === "cols") setCols(newValue);
    resetGame();
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
        gameMode,
        rows,
        cols,
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
    <div className="container mt-4 text-center">
      {error && <div className={styles.errorMsg}>{error}</div>}

      <h1 className="my-4">Play Variants against Bot</h1>
      <div className="row">
        <div className="col">
          <Board
            rows={rows}
            cols={cols}
            board={board}
            highlightedColumns={highlightedColumns}
            onColumnClick={handleMakeMove}
          />
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
      <div className="row mt-4">
        <div className="col d-flex justify-content-center">
          <div className="d-flex align-items-center me-3">
            <label htmlFor="difficulty" className="me-2">
              AI Difficulty:
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={handleDifficultyChange}
              className="form-select w-auto"
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
          <div className="d-flex align-items-center">
            <label htmlFor="gameMode" className="me-2">
              Game Mode:
            </label>
            <select
              id="gameMode"
              value={gameMode}
              onChange={handleGameModeChange}
              className="form-select w-auto"
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
      </div>
      {gameMode === "var-grid" && (
        <div className="row mt-4">
          <div className="col d-flex justify-content-center">
            <div className="d-flex align-items-center me-3">
              <label htmlFor="rows" className="me-2">
                Rows:
              </label>
              <input
                id="rows"
                type="number"
                value={rows}
                onChange={(e) => handleGridSizeChange("rows", e.target.value)}
                className="form-control w-auto"
                min="4"
                max="10"
              />
            </div>
            <div className="d-flex align-items-center">
              <label htmlFor="cols" className="me-2">
                Columns:
              </label>
              <input
                id="cols"
                type="number"
                value={cols}
                onChange={(e) => handleGridSizeChange("cols", e.target.value)}
                className="form-control w-auto"
                min="4"
                max="10"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayVariants;
