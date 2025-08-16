import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import Board from "../../components/board/Board";
import { useTheme } from "../../contexts/ThemeContext";
import {
  initializeBoard,
  getGameModeConfig,
  applyMove,
} from "../../utilities/gameState";
import Loading from "../../components/loading/Loading";

const OnlineReviewGame = () => {
  const { gameId } = useParams();
  const { darkMode } = useTheme();

  const [gameMode, setGameMode] = useState("connect-4");
  const [board, setBoard] = useState([]);
  const [moves, setMoves] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [latestMove, setLatestMove] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gameData, setGameData] = useState(null);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const gameRef = doc(db, "live-games", gameId);
        const gameSnap = await getDoc(gameRef);

        if (gameSnap.exists()) {
          const data = gameSnap.data();
          setGameData(data);

          // Set game mode
          const currentGameMode = data.gameMode || "connect-4";
          setGameMode(currentGameMode);

          // Initialize board
          const config = getGameModeConfig(currentGameMode);
          setBoard(initializeBoard(config.rows, config.cols));

          // Process moves
          if (data.movesString) {
            // Convert string moves to array format
            // Note that move strings are 1-indexed (UI), so we subtract 1 for 0-indexed array
            const movesArray = data.movesString.split('').map(move => parseInt(move) - 1);
            setMoves(movesArray);
          } else if (data.moves && Array.isArray(data.moves)) {
            // Use existing array format
            setMoves(data.moves);
          } else {
            setError("Game has no moves to review.");
          }

          setLoading(false);
        } else {
          setError("Game not found.");
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching online game:", err);
        setError("Failed to fetch game. Please try again later.");
        setLoading(false);
      }
    };

    fetchGame();
  }, [gameId]);

  const computeBoardUpToMove = (moveIndex) => {
    const config = getGameModeConfig(gameMode);
    let tempBoard = initializeBoard(config.rows, config.cols);
    let latest = null;

    for (let i = 0; i <= moveIndex; i++) {
      // For online games, we alternate players starting with player 1
      const player = i % 2 === 0 ? 1 : -1;

      const column = moves[i];
      // Online games only have placement moves (no popouts)
      tempBoard = applyMove(tempBoard, column, player, gameMode, "place");

      // Track the latest move for highlighting
      for (let r = 0; r < tempBoard.length; r++) {
        if (tempBoard[r][column] === player) {
          latest = { row: r, column: column };
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
    return <Loading />;
  }

  if (error) {
    return (
      <div className="container mt-4" style={{ minHeight: "100vh" }}>
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <Link to="/stats" className="btn btn-primary">
          <i className="bi bi-arrow-left me-2"></i>Back to Stats
        </Link>
      </div>
    );
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown date";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  // Get player names
  const playerNames = gameData?.playerNames || {};
  const playerIds = gameData?.players || [];
  const player1Name = playerNames[playerIds[0]] || "Player 1";
  const player2Name = playerNames[playerIds[1]] || "Player 2";

  // Determine winner name
  let winnerName = "Draw";
  if (gameData?.winner && gameData.winner !== "draw") {
    winnerName = playerNames[gameData.winner] || "Unknown";
  }

  // Determine win type
  const winType = gameData?.winType || "connection";
  const winTypeDisplay =
    {
      connection: "4-in-a-row Connection",
      popout: "Popout",
      resignation: "Resignation",
      timeout: "Timeout",
      disconnect: "Disconnect",
    }[winType] || winType;

  return (
    <div className="container py-4" style={{ minHeight: "100vh" }}>
      <div
        className={`card mb-4 shadow-sm ${
          darkMode ? "bg-dark text-light" : "bg-light"
        }`}
      >
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h2 className="card-title">Online Game Review</h2>
              <div className="mb-2">
                <span className="badge bg-primary me-2">
                  Online Multiplayer
                </span>
                <span className="badge bg-secondary">
                  {gameMode.replace("-", " ").toUpperCase()}
                </span>
              </div>
              <div className="mt-2">
                <small className="text-muted">
                  Game played on{" "}
                  {formatDate(gameData?.endedAt || gameData?.createdAt)}
                </small>
              </div>
            </div>
            <div className="col-md-4 text-md-end text-center mt-3 mt-md-0">
              <button
                className={`btn btn-warning me-2 ${
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
                className={`btn btn-warning ${
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

      <div className="row mb-4">
        <div className="col-md-8">
          <div
            className={`card shadow-sm ${
              darkMode ? "bg-dark text-light" : "bg-light"
            }`}
          >
            <div className="card-body text-center">
              <Board
                board={board}
                latestMove={latestMove}
                rows={board.length}
                cols={board[0]?.length || 7}
              />
              <div className="mt-3">
                <strong>
                  Move {currentMoveIndex + 1} of {moves.length}
                </strong>
                <div className="mt-2">
                  {currentMoveIndex % 2 === 0 ? (
                    <span className="text-danger">{player1Name}'s move</span>
                  ) : (
                    <span className="text-warning">{player2Name}'s move</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div
            className={`card shadow-sm mb-3 ${
              darkMode ? "bg-dark text-light" : "bg-light"
            }`}
          >
            <div className="card-body">
              <h5 className="card-title">Game Summary</h5>
              <ul className="list-group list-group-flush">
                <li
                  className={`list-group-item ${
                    darkMode ? "bg-dark text-light border-secondary" : ""
                  }`}
                >
                  <strong>Red Player:</strong> {player1Name}
                </li>
                <li
                  className={`list-group-item ${
                    darkMode ? "bg-dark text-light border-secondary" : ""
                  }`}
                >
                  <strong>Yellow Player:</strong> {player2Name}
                </li>
                <li
                  className={`list-group-item ${
                    darkMode ? "bg-dark text-light border-secondary" : ""
                  }`}
                >
                  <strong>Winner:</strong>{" "}
                  {winnerName === "Draw" ? (
                    <span className="badge bg-warning text-dark">Draw</span>
                  ) : winnerName === player1Name ? (
                    <span className="badge bg-danger">{winnerName}</span>
                  ) : (
                    <span className="badge bg-warning">{winnerName}</span>
                  )}
                </li>
                <li
                  className={`list-group-item ${
                    darkMode ? "bg-dark text-light border-secondary" : ""
                  }`}
                >
                  <strong>Win Type:</strong> {winTypeDisplay}
                </li>
                <li
                  className={`list-group-item ${
                    darkMode ? "bg-dark text-light border-secondary" : ""
                  }`}
                >
                  <strong>Total Moves:</strong> {moves.length}
                </li>
                <li
                  className={`list-group-item ${
                    darkMode ? "bg-dark text-light border-secondary" : ""
                  }`}
                >
                  <strong>Game Code:</strong> {gameData?.gameCode || "N/A"}
                </li>
              </ul>
            </div>
          </div>

          <Link to="/stats" className="btn btn-primary w-100">
            <i className="bi bi-arrow-left me-2"></i>Back to Statistics
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OnlineReviewGame;
