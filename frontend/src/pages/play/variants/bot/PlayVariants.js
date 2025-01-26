import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Board from "../../../../components/board/Board";
import { getBestMove } from "../../../../config/api";
import { auth, db } from "../../../../config/firebase";
import { doc, collection, addDoc } from "firebase/firestore";
import styles from "./PlayVariants.module.css";
import {
  checkWinner,
  isDrawCondition,
  applyMove,
} from "../../../../utilities/gameState";

const difficultyLevels = [
  "very_easy",
  "easy",
  "medium",
  "hard",
  "very_hard",
  "expert",
];

const gameModes = ["connect-4", "connect-5", "popout", "anti", "colour-switch"];

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
  const [actionMode, setActionMode] = useState("place");
  const [moves, setMoves] = useState("");
  const [totalMoves, setTotalMoves] = useState(0); // Tracks the number of moves
  const [firstPlayer, setFirstPlayer] = useState("player"); // State for selecting the first player
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
      setActionMode("place");
      setDefaultGrid(queryMode);
    } else {
      setGameMode("connect-4");
      setDefaultGrid("connect-4");
    }

    resetGame();
  }, [searchParams]);

  useEffect(() => {
    resetGame();
  }, [firstPlayer]);

  const setDefaultGrid = (mode) => {
    if (mode === "connect-5") {
      setRows(8);
      setCols(9);
    } else {
      setRows(6);
      setCols(7);
    }
  };

  const resetGame = async () => {
    const newBoard = Array.from({ length: rows }, () => Array(cols).fill(0));
    setBoard(newBoard);
    setWinner(null);
    setIsDraw(false);
    setHighlightedColumns([]);
    setMoves("");
    movesRef.current = "";
    setTotalMoves(0); // Reset move counter
    setIsLocked(false);
    setError(null); // Clear any previous errors

    // If the bot is set to play first, make the bot's move
    if (firstPlayer === "bot") {
      setIsLocked(true);
      try {
        const response = await getBestMove(
          newBoard,
          -1, // AI always plays as -1
          gameMode,
          difficulty
        );
        const {
          best_move: aiMove,
          board: updatedBoardAI,
          outcome,
        } = response.data;

        let finalBoard = updatedBoardAI;

        // Handle board flipping for "colour-switch" mode
        if (gameMode === "colour-switch" && (totalMoves + 1) % 3 === 0) {
          finalBoard = flipBoardColors(updatedBoardAI);
        }

        setBoard(finalBoard);

        // Update moves history
        if (aiMove !== null) {
          const aiMoveNotation = aiMove < 0 ? `${aiMove}` : `${aiMove + 1}`;
          movesRef.current += aiMoveNotation;
          setMoves(movesRef.current);
        }

        // Check if the AI wins
        if (checkWinner(finalBoard, -1, gameMode)) {
          setWinner("AI");
          recordGameResult(-1, false);
          setIsLocked(false);
          return;
        }

        // Check for a draw
        if (isDrawCondition(finalBoard)) {
          setIsDraw(true);
          recordGameResult(-1, true);
          setIsLocked(false);
          return;
        }

        setTotalMoves((prev) => prev + 1);
      } catch (error) {
        console.error("Error fetching AI move:", error);
        setError("Could not fetch AI move.");
      } finally {
        setIsLocked(false);
      }
    }
  };

  const flipBoardColors = (board) => {
    return board.map((row) =>
      row.map((cell) => (cell === 1 ? -1 : cell === -1 ? 1 : 0))
    );
  };

  const handleMakeMove = async (column) => {
    if (isLocked || winner !== null || isDraw) return;

    // Validation for popout mode
    if (actionMode === "popout") {
      const columnIsEmpty = board.every((row) => row[column] === 0);
      if (columnIsEmpty) {
        setError("Cannot popout from an empty column.");
        return;
      }
    }

    // Apply the player's move
    const updatedBoard = applyMove(
      board,
      column,
      1, // Player always plays as 1
      gameMode,
      rows,
      cols,
      actionMode
    );
    setBoard(updatedBoard);

    // Clear any previous error message
    setError(null);

    // Update move history and total moves
    const moveNotation =
      actionMode === "place" ? (column + 1).toString() : `-${column + 1}`;
    movesRef.current += moveNotation;
    setMoves(movesRef.current);
    setTotalMoves((prev) => prev + 1);

    // Check if the player wins
    if (checkWinner(updatedBoard, 1, gameMode)) {
      setWinner("Player");
      recordGameResult(1, false);
      return;
    }

    // Check for a draw
    if (isDrawCondition(updatedBoard)) {
      setIsDraw(true);
      recordGameResult(-1, true);
      return;
    }

    setIsLocked(true);

    try {
      // Fetch the AI's best move and outcome
      const response = await getBestMove(
        updatedBoard,
        -1, // AI always plays as -1
        gameMode,
        difficulty
      );
      const {
        best_move: aiMove,
        board: updatedBoardAI,
        outcome,
      } = response.data;

      let finalBoard = updatedBoardAI;

      // Handle board flipping for "colour-switch" mode
      if (gameMode === "colour-switch" && (totalMoves + 1) % 3 === 0) {
        finalBoard = flipBoardColors(updatedBoardAI);
      }

      setBoard(finalBoard);

      // Update moves history
      if (aiMove !== null) {
        const aiMoveNotation = aiMove < 0 ? `${aiMove}` : `${aiMove + 1}`;
        movesRef.current += aiMoveNotation;
        setMoves(movesRef.current);
      }

      // Check if the AI wins
      if (checkWinner(finalBoard, -1, gameMode)) {
        setWinner("AI");
        recordGameResult(-1, false);
        setIsLocked(false);
        return;
      }

      // Check for a draw
      if (isDrawCondition(finalBoard)) {
        setIsDraw(true);
        recordGameResult(-1, true);
        setIsLocked(false);
        return;
      }

      setTotalMoves((prev) => prev + 1);
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
    setActionMode("place");
    resetGame();
  };

  const handleFirstPlayerChange = (event) => {
    setFirstPlayer(event.target.value);
    // The game will reset automatically due to the useEffect listening to firstPlayer changes
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
    <div className="container mt-4 text-center" style={{ minHeight: "100vh" }}>
      {error && <div className={styles.errorMsg}>{error}</div>}

      <h1 className="my-4">Play against Bot</h1>
      <Board
        rows={rows}
        cols={cols}
        board={board}
        highlightedColumns={highlightedColumns}
        onColumnClick={handleMakeMove}
      />

      {/* First Player Selection */}
      <div className="row mt-4">
        <div className="col d-flex justify-content-center">
          <label htmlFor="firstPlayer" className="me-2">
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

      {/* Action Mode Selection for Popout */}
      <div
        className="row mt-4"
        style={{ display: gameMode === "popout" ? "block" : "none" }}
      >
        <div className="col d-flex justify-content-center">
          <label className="me-2">Action Mode:</label>
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

      {/* Difficulty and Game Mode Selection */}
      <div className="row mt-4">
        <div className="col d-flex justify-content-center">
          <label htmlFor="difficulty" className="me-2">
            AI Difficulty:
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={handleDifficultyChange}
            className="form-select w-auto"
            disabled={totalMoves > 0}
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
        <div className="col d-flex justify-content-center">
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

      {/* Reset Game Button */}
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

      {/* Display Winner or Draw Message */}
      {winner && (
        <div className="alert alert-success mt-4">Winner: {winner}</div>
      )}
      {isDraw && <div className="alert alert-warning mt-4">It's a draw!</div>}
    </div>
  );
};

export default PlayVariants;
