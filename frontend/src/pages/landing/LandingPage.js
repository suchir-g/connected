import React, { useState, useEffect } from "react";
import Board from "../../components/board/Board";
import { getBestMove } from "../../config/api";
import {
  checkWinner,
  isDrawCondition,
  applyMove,
} from "../../utilities/gameState";
import "./LandingPage.css";
import { useTheme } from "../../contexts/ThemeContext"; // Import useTheme

const LandingPage = () => {
  const { darkMode } = useTheme(); // Destructure darkMode from ThemeContext

  const [board, setBoard] = useState(() =>
    Array.from({ length: 6 }, () => Array(7).fill(0))
  );
  const [isLocked, setIsLocked] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isDraw, setIsDraw] = useState(false);
  const difficulty = "hard";
  const gameMode = "connect-4";

  useEffect(() => {
    resetGame();
  }, []);

  const resetGame = async () => {
    const newBoard = Array.from({ length: 6 }, () => Array(7).fill(0));
    setBoard(newBoard);
    setWinner(null);
    setIsDraw(false);
    setIsLocked(false);

    setIsLocked(true);
    try {
      const response = await getBestMove(newBoard, -1, gameMode, difficulty);
      const updatedBoard = response.data.board;
      setBoard(updatedBoard);

      if (checkWinner(updatedBoard, -1, gameMode)) {
        setWinner("AI");
        setIsLocked(false);
        return;
      }
      if (isDrawCondition(updatedBoard)) {
        setIsDraw(true);
        setIsLocked(false);
        return;
      }
    } catch (error) {
      console.error("Error fetching AI move:", error);
    } finally {
      setIsLocked(false);
    }
  };

  const handleMakeMove = async (column) => {
    if (isLocked || winner || isDraw) return;

    const updatedBoard = applyMove(board, column, 1, gameMode, 6, 7, "place");
    setBoard(updatedBoard);

    if (checkWinner(updatedBoard, 1, gameMode)) {
      setWinner("Player");
      return;
    }
    if (isDrawCondition(updatedBoard)) {
      setIsDraw(true);
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
      const aiBoard = response.data.board;
      setBoard(aiBoard);

      if (checkWinner(aiBoard, -1, gameMode)) {
        setWinner("AI");
        setIsLocked(false);
        return;
      }
      if (isDrawCondition(aiBoard)) {
        setIsDraw(true);
        setIsLocked(false);
        return;
      }
    } catch (error) {
      console.error("Error fetching AI move:", error);
    } finally {
      setIsLocked(false);
    }
  };

  return (
    <div className={`landing-page ${darkMode ? "dark" : "light"}`}>
      <div className="landing-left">
        <h5 className="h4">Test your skills!</h5>
        {winner && (
          <div
            className={`alert ${
              winner === "AI" ? "alert-success" : "alert-primary"
            }`}
          >
            Winner: {winner}
          </div>
        )}
        {isDraw && <div className="alert alert-warning">It's a draw!</div>}
        <Board rows={6} cols={7} board={board} onColumnClick={handleMakeMove} />
        <button
          onClick={resetGame}
          className="btn btn-secondary mt-1 landingButtonn"
        >
          Play Again
        </button>
      </div>

      <div className="landing-right">
        <h1 className="landing-title">CONNECTED</h1>
        <p className="landing-description">
          Welcome to Connected, the ultimate Connect 4 training software!
          Sharpen your skills, learn from our advanced AI, and enjoy a sleek
          modern gaming experience.
        </p>
        <div className="features">
          <div className="feature-item">
            <h3>Smart AI</h3>
            <p>Challenge an AI designed to keep you on your toes.</p>
          </div>
          <div className="feature-item">
            <h3>Play Variants</h3>
            <p>
              Try new exciting variants of the game like Colour Switch and
              Popout.
            </p>
          </div>
          <div className="feature-item">
            <h3>Compete with Friends</h3>
            <p>Track your progress and compare scores with friends.</p>
          </div>
          <div className="feature-item">
            <h3>Hone your skills</h3>
            <p>
              Practice smarter with recommendations crafted to help you overcome
              your toughest challenges and master the game.
            </p>
          </div>
          <div>
            <a href="/register" className="btn btn-primary mt-1 landingButton d-block p-2">
              Sign Up
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
