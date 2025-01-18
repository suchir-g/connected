import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Board from "../../../../components/board/Board";
import {
  startGame as apiStartGame,
  makeMove as apiMakeMove,
  setDifficulty as apiSetDifficulty,
} from "../../../../config/api";
import { auth, db } from "../../../../config/firebase";
import { doc, collection, addDoc } from "firebase/firestore";

const difficultyLevels = [
  "very_easy",
  "easy",
  "medium",
  "hard",
  "very_hard",
  "expert",
];

const PlayVariants = () => {
  const [board, setBoard] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isDraw, setIsDraw] = useState(false);
  const [highlightedColumns, setHighlightedColumns] = useState([]);
  const [difficulty, setDifficulty] = useState("medium");
  const [variant, setVariant] = useState("classic");
  const [customRows, setCustomRows] = useState(6);
  const [customCols, setCustomCols] = useState(7);
  const [moves, setMoves] = useState("");
  const movesRef = useRef("");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const queryDifficulty = searchParams.get("difficulty");

    if (difficultyLevels.includes(queryDifficulty)) {
      setDifficulty(queryDifficulty);
    } else {
      setDifficulty("medium");
    }

    initializeGame();
  }, [searchParams]);

  const initializeGame = async () => {
    try {
      setIsLocked(true);
      let rows = customRows;
      let cols = customCols;

      // Adjust rows and columns for 5 in a Row variant
      if (variant === "5_in_a_row") {
        rows = 8; // Set rows to 8 for 5 in a Row
        cols = 9; // Set columns to 9 for 5 in a Row
      }

      // Ensure the row and column values are within the 5 to 10 range
      if (rows < 5 || rows > 10 || cols < 5 || cols > 10) {
        alert("Rows and columns must be between 5 and 10.");
        setIsLocked(false);
        return;
      }

      const response = await apiStartGame(variant, rows, cols);
      const { board, current_player } = response.data;

      if (!Array.isArray(board) || !board.every((row) => Array.isArray(row))) {
        throw new Error("Invalid data received from the server.");
      }

      setBoard(board);
      setWinner(null);
      setIsDraw(false);
      setHighlightedColumns([]);
      setMoves("");
      movesRef.current = "";
      setIsLocked(false);
    } catch (error) {
      console.error("Error initializing game:", error);
      alert("Failed to initialize the game - please try again.");
      setIsLocked(false);
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
      const response = await apiMakeMove(column, board, 1, variant);
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
        }

        setIsLocked(false);
      }, 500);
    } catch (error) {
      console.error("Error making move:", error);
      alert(error.response?.data?.error || "Error making move.");
      setIsLocked(false);
    }
  };

  const handleDifficultyChange = async (event) => {
    const selectedDifficulty = event.target.value;
    setDifficulty(selectedDifficulty);
    try {
      await apiSetDifficulty(selectedDifficulty, variant);
    } catch (error) {
      console.error("Error setting difficulty:", error);
      alert("Failed to set difficulty. Please try again.");
    }
  };

  const handleVariantChange = (event) => {
    const selectedVariant = event.target.value;
    setVariant(selectedVariant);
    initializeGame(); // Trigger the game initialization when variant changes
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
        variant,
        rows: variant === "5_in_a_row" ? 8 : customRows,
        cols: variant === "5_in_a_row" ? 9 : customCols,
        moves: movesRef.current,
        result: isDraw ? "draw" : gameWinner === 1 ? "win" : "loss",
        bestMoves: [],
      };

      await addDoc(gameSubCollection, gameData);
      console.log("Game result recorded:", gameData);
    } catch (error) {
      console.error("Error recording game result:", error);
    }
  };

  return (
    <div className="container mt-4 text-center">
      <h1 className="my-4">Play Variants against Bot</h1>
      <div className="row">
        <div className="col">
          <Board
            board={board}
            rows={variant === "5_in_a_row" ? 8 : customRows} // Passing the correct row count
            cols={variant === "5_in_a_row" ? 9 : customCols} // Passing the correct column count
            highlightedColumns={highlightedColumns}
            onColumnClick={handleMakeMove}
          />
        </div>
      </div>
      <div className="row mt-4">
        <div className="col d-flex justify-content-center">
          <button
            onClick={initializeGame}
            disabled={isLocked}
            className="btn btn-primary"
          >
            Start or Reset Game
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
              className="form-select w-auto me-4"
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
            <label htmlFor="variant" className="me-2">
              Game Variant:
            </label>
            <select
              id="variant"
              value={variant}
              onChange={handleVariantChange}
              className="form-select w-auto"
            >
              <option value="classic">Classic</option>
              <option value="5_in_a_row">5 in a Row (8x9)</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </div>
      {variant === "custom" && (
        <div className="row mt-3">
          <div className="col d-flex justify-content-center">
            <div className="d-flex align-items-center">
              <label htmlFor="rows" className="me-2">
                Rows:
              </label>
              <input
                id="rows"
                type="number"
                value={customRows}
                onChange={(e) =>
                  setCustomRows(
                    Math.max(5, Math.min(10, Number(e.target.value)))
                  )
                }
                min="5"
                max="10"
                className="form-control w-auto me-4"
              />
              <label htmlFor="cols" className="me-2">
                Columns:
              </label>
              <input
                id="cols"
                type="number"
                value={customCols}
                onChange={(e) =>
                  setCustomCols(
                    Math.max(5, Math.min(10, Number(e.target.value)))
                  )
                }
                min="5"
                max="10"
                className="form-control w-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayVariants;
