import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Board from "../../../components/board/Board";
import { apiMakeMove } from "../../../config/api";
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

  const handleMakeMove = async (column) => {
    if (isLocked || winner !== null || isDraw) {
      return;
    }

    const playerMove = column + 1;
    movesRef.current += playerMove.toString();
    setMoves(movesRef.current);

    const userMovedBoard = applyMove(board, column, 1);
    setBoard(userMovedBoard);
    setIsLocked(true);

    try {
      const response = await apiMakeMove(column, board, 1, difficulty); // Pass difficulty dynamically
      console.log(response.data);
      const {
        board: updatedBoard,
        current_player,
        winner: gameWinner,
        is_draw,
        ai_move,
      } = response.data;

      setTimeout(() => {
        setBoard(updatedBoard);
        setWinner(gameWinner !== 0 ? gameWinner : null);
        setIsDraw(is_draw);
        setHighlightedColumns([]);

        if (ai_move !== undefined && ai_move !== null) {
          const aiMove = ai_move + 1;
          movesRef.current += aiMove.toString();
          setMoves(movesRef.current);
        }

        if (gameWinner !== 0 || is_draw) {
          recordGameResult(gameWinner, is_draw);
          setIsLocked(true);
        } else {
          setIsLocked(false);
        }
      }, 500);
    } catch (error) {
      console.error("Error making move:", error);
      setError("Could not make move. " + error.message);
      setIsLocked(false);
    }
  };

  const handleDifficultyChange = (event) => {
    const selectedDifficulty = event.target.value;
    setDifficulty(selectedDifficulty);
  };

  const recordGameResult = async (gameWinner, isDraw) => {
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
        moves: movesRef.current,
        result: isDraw ? "draw" : gameWinner === 1 ? "win" : "loss",
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
    </div>
  );
};

export default PlayBot;
