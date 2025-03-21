import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Board from "../../../components/board/Board";
import { getBestMove } from "../../../config/api";
import { auth, db } from "../../../config/firebase";
import { doc, collection, addDoc } from "firebase/firestore";

import {
  getGameModeConfig,
  initializeBoard,
  flipBoardColors,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPlayer]);

  useEffect(() => {
    resetGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols]);

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
        let finalBoard = updatedBoardAI;

        if (gameMode === "colour-switch" && (totalMoves + 1) % 3 === 0) {
          finalBoard = flipBoardColors(finalBoard);
        }

        setBoard(finalBoard);

        if (aiMove !== null) {
          movesRef.current += `${aiMove}`;
          setMoves(movesRef.current);
        }

        // >>> AI's immediate winner check <<<
        if (
          (checkWinner(finalBoard, -1, gameMode) && gameMode !== "anti") ||
          (checkWinner(finalBoard, 1, gameMode) && gameMode === "anti")
        ) {
          setWinner("AI");
          recordGameResult(-1, false);
          setIsLocked(false);
          return;
        }

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

  const handleMakeMove = async (column) => {
    if (isLocked || winner || isDraw) return;

    if (!isValidMove(board, column, gameMode, actionMode)) {
      const moveError = getMoveError(board, column, actionMode);
      setError(moveError || "Invalid move. Try a different column.");
      return;
    }

    setError(null);
    const updatedBoard = applyMove(board, column, 1, gameMode, actionMode);
    setBoard(updatedBoard);

    const moveNotation =
      actionMode === "place" ? (column + 1).toString() : `-${column + 1}`;
    movesRef.current += moveNotation;
    setMoves(movesRef.current);
    setTotalMoves((prev) => prev + 1);

    // >>> Player's immediate winner check <<<
    if (
      (checkWinner(updatedBoard, 1, gameMode) && gameMode !== "anti") ||
      (checkWinner(updatedBoard, -1, gameMode) && gameMode === "anti")
    ) {
      setWinner("Player");
      recordGameResult(1, false);
      return;
    }

    if (
      (checkWinner(updatedBoard, -1, gameMode) && gameMode !== "anti") ||
      (checkWinner(updatedBoard, 1, gameMode) && gameMode === "anti")
    ) {
      setWinner("AI");
      recordGameResult(-1, false);
      return;
    }

    if (isDrawCondition(updatedBoard)) {
      setIsDraw(true);
      recordGameResult(-1, true);
      return;
    }

    setIsLocked(true);

    try {
      const response = await getBestMove(
        updatedBoard,
        -1,
        gameMode,
        difficulty
      );
      const { best_move: aiMove, board: updatedBoardAI } = response.data;

      let finalBoard = updatedBoardAI;
      if (gameMode === "colour-switch" && (totalMoves + 1) % 3 === 0) {
        finalBoard = flipBoardColors(finalBoard);
      }

      setBoard(finalBoard);

      if (aiMove !== null) {
        const aiMoveNotation = aiMove < 0 ? `${aiMove}` : `${aiMove + 1}`;
        movesRef.current += aiMoveNotation;
        setMoves(movesRef.current);
      }

      if (
        (checkWinner(finalBoard, -1, gameMode) && gameMode !== "anti") ||
        (checkWinner(finalBoard, 1, gameMode) && gameMode === "anti")
      ) {
        setWinner("AI");
        recordGameResult(-1, false);
        setIsLocked(false);
        return;
      }

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

      setTotalMoves((prev) => prev + 1);
    } catch (error) {
      console.error("Error fetching AI move:", error);
      setError("Could not fetch AI move.");
    } finally {
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

  return (
    <div className="container mt-4 text-center" style={{ minHeight: "100vh" }}>
      {error && <div className="alert alert-warning w-100">{error}</div>}

      <h1 className="my-4">Play against Bot</h1>

      <div className="d-flex justify-content-center">
        <div className="board-container">
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
    </div>
  );
};

export default PlayBot;
