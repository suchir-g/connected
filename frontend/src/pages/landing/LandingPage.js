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
import SEO from "../../components/seo/SEO";

const LandingPage = () => {
  const { darkMode } = useTheme(); // Destructure darkMode from ThemeContext

  const [board, setBoard] = useState(() =>
    Array.from({ length: 6 }, () => Array(7).fill(0))
  );
  const [isLocked, setIsLocked] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isDraw, setIsDraw] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const difficulty = "easy";
  const gameMode = "connect-4";

  useEffect(() => {
    resetGame();
  }, []);

  const resetGame = async () => {
    const newBoard = Array.from({ length: 6 }, () => Array(7).fill(0));
    setBoard(newBoard);
    setWinner(null);
    setIsDraw(false);
    setIsLocked(true); // Lock the board immediately
    setAiThinking(true); // Show AI is thinking

    try {
      const response = await getBestMove(newBoard, -1, gameMode, difficulty);

      // Add minimum 300ms delay before showing AI's move
      const startTime = Date.now();
      const aiMoveDelay = () => {
        const elapsedTime = Date.now() - startTime;

        if (elapsedTime >= 300) {
          // Apply AI move after minimum delay
          const updatedBoard = response.data.board;
          setBoard(updatedBoard);
          setAiThinking(false); // AI finished thinking

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
          setIsLocked(false); // Unlock the board after AI move
        } else {
          // Not enough time has passed, wait longer
          setTimeout(aiMoveDelay, 300 - elapsedTime);
        }
      };

      // Start the delay process
      aiMoveDelay();
    } catch (error) {
      console.error("Error fetching AI move:", error);
      setIsLocked(false); // Ensure board is unlocked even if there's an error
      setAiThinking(false); // AI finished thinking (with error)
    }
  };

  const handleMakeMove = async (column) => {
    if (isLocked || winner || isDraw) return;

    const updatedBoard = applyMove(board, column, 1, gameMode, 6, 7, "place");
    setBoard(updatedBoard);
    setIsLocked(true); // Lock the board immediately after player move
    setAiThinking(true); // Show AI is thinking

    if (checkWinner(updatedBoard, 1, gameMode)) {
      setWinner("Player");
      setIsLocked(false); // Unlock since game is over
      setAiThinking(false);
      return;
    }
    if (isDrawCondition(updatedBoard)) {
      setIsDraw(true);
      setIsLocked(false); // Unlock since game is over
      setAiThinking(false);
      return;
    }

    try {
      // Get AI's move
      const response = await getBestMove(
        updatedBoard,
        -1,
        gameMode,
        difficulty
      );

      // Add minimum 300ms delay before showing AI's move
      const startTime = Date.now();
      const aiMoveDelay = () => {
        const elapsedTime = Date.now() - startTime;

        if (elapsedTime >= 700) {
          // Apply AI move after minimum delay
          const aiBoard = response.data.board;
          setBoard(aiBoard);
          setAiThinking(false); // AI finished thinking

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
          setIsLocked(false); // Unlock the board after AI move
        } else {
          // Not enough time has passed, wait longer
          setTimeout(aiMoveDelay, 300 - elapsedTime);
        }
      };

      // Start the delay process
      aiMoveDelay();
    } catch (error) {
      console.error("Error fetching AI move:", error);
      setIsLocked(false); // Ensure board is unlocked even if there's an error
      setAiThinking(false); // AI finished thinking (with error)
    }
  };

  return (
    <div className={`landing-page ${darkMode ? "dark" : "light"}`}>
      <SEO
        title="Connected | A Connect 4 training platform"
        description="Welcome to Connected, the ultimate Connect 4 training software! Sharpen your skills, learn from our advanced AI, and enjoy a sleek modern gaming experience."
        canonicalUrl="/"
      />
      <div className="landing-left">
        <h5 className="h4">Test your skills!</h5>

        {/* Board placed first for mobile view */}
        <div className="board-container">
          <Board
            rows={6}
            cols={7}
            board={board}
            onColumnClick={handleMakeMove}
          />
        </div>

        {/* Sign Up button moved to center for mobile */}
        <div className="signup-mobile">
          <a href="/register" className="btn btn-primary">
            Sign Up
          </a>
        </div>

        <div className="game-controls mb-3">
          <div
            className={`difficulty-indicator ${
              aiThinking ? "ai-thinking" : ""
            }`}
          >
            <small>{aiThinking ? "AI: Thinking..." : "AI: Easy"}</small>
          </div>
          <button
            onClick={resetGame}
            className="btn btn-sm btn-secondary"
            disabled={isLocked}
          >
            <i className="bi bi-arrow-repeat me-1"></i>New
          </button>
        </div>

        {winner === "Player" && (
          <div className="register-prompt success-prompt mb-3">
            <span>
              <strong>Congratulations!</strong>
            </span>
            <p>Ready for more challenges?</p>
            <a href="/register" className="btn btn-outline-success">
              Register Now
            </a>
          </div>
        )}

        {winner === "AI" && (
          <div className="register-prompt danger-prompt mb-3">
            <span>
              <strong>Nice try!</strong>
            </span>
            <p>Want to improve your skills?</p>
            <a href="/register" className="btn btn-outline-danger">
              Register Now
            </a>
          </div>
        )}

        {isDraw && <div className="alert alert-warning mb-3">It's a draw!</div>}
      </div>

      <div className="landing-right">
        <h1 className="landing-title">CONNECTED</h1>
        <p className="landing-description">
          Welcome to Connected, the ultimate Connect 4 training software!
          Sharpen your skills, learn from our advanced AI, and enjoy a sleek
          modern gaming experience.
        </p>

        <div className="signup-container main-signup">
          <a
            href="/register"
            className="btn btn-primary mb-4 landingButton p-2"
          >
            Sign Up Now
          </a>
        </div>

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
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
