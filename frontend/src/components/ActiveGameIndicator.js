import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../config/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const ActiveGameIndicator = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [activeGame, setActiveGame] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) {
      setActiveGame(null);
      return;
    }

    // Listen for active games for this user
    const activeGamesQuery = query(
      collection(db, "live-games"),
      where("players", "array-contains", currentUser.uid),
      where("status", "in", ["waiting", "active"])
    );

    const unsubscribe = onSnapshot(activeGamesQuery, (snapshot) => {
      const games = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Find the most recent active/waiting game
      const game = games.length > 0 ? games[0] : null;
      setActiveGame(game);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Function to determine if opponent is online
  const isOpponentOnline = (game) => {
    if (!game?.presence || !game?.players) return false;

    const opponentId = game.players.find((id) => id !== currentUser.uid);
    if (!opponentId) return false;

    const opponentPresence = game.presence[opponentId];
    if (!opponentPresence?.toDate) return false;

    const lastSeen = opponentPresence.toDate();
    const now = new Date();
    const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
    return lastSeen > threeMinutesAgo;
  };

  // Function to get opponent name
  const getOpponentName = (game) => {
    if (!game?.players || !game?.playerNames) return "Unknown";
    const opponentId = game.players.find((id) => id !== currentUser.uid);
    return game.playerNames[opponentId] || "Unknown";
  };

  // Don't show indicator if no active game or if we're already on the game page
  if (
    !activeGame ||
    window.location.pathname.includes(
      `/play/online/${activeGame.gameCode || activeGame.id}`
    )
  ) {
    return null;
  }

  const isMyTurn = activeGame.currentPlayerId === currentUser.uid;
  const opponentOnline = isOpponentOnline(activeGame);
  const opponentName = getOpponentName(activeGame);

  const handleGameClick = () => {
    const gameIdentifier = activeGame.gameCode || activeGame.id;
    navigate(`/play/online/${gameIdentifier}`);
  };

  if (isCollapsed) {
    return (
      <div
        className={`position-fixed ${
          darkMode ? "bg-dark text-white" : "bg-light"
        } border rounded`}
        style={{
          top: "80px",
          right: "20px",
          zIndex: 1050,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          cursor: "pointer",
        }}
        onClick={() => setIsCollapsed(false)}
      >
        <div className="p-2 d-flex align-items-center">
          <span
            className={`badge ${isMyTurn ? "bg-success" : "bg-warning"} me-2`}
          >
            {activeGame.status === "waiting"
              ? "Waiting"
              : isMyTurn
              ? "Your Turn"
              : "Opponent's Turn"}
          </span>
          <small>Active Game</small>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`position-fixed ${
        darkMode ? "bg-dark text-white border-secondary" : "bg-white border"
      } rounded shadow`}
      style={{
        top: "80px",
        right: "20px",
        zIndex: 1050,
        minWidth: "280px",
        maxWidth: "320px",
      }}
    >
      <div className="p-3">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h6 className="mb-0">
            {activeGame.status === "waiting"
              ? "Waiting for Opponent"
              : "Active Game"}
          </h6>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setIsCollapsed(true)}
            style={{ lineHeight: 1, fontSize: "12px" }}
          >
            ×
          </button>
        </div>

        <div className="mb-2">
          <div className="d-flex align-items-center justify-content-between">
            <span className="text-muted">Opponent:</span>
            <div className="d-flex align-items-center">
              <span
                className="rounded-circle me-1"
                style={{
                  width: "8px",
                  height: "8px",
                  backgroundColor: opponentOnline ? "#28a745" : "#dc3545",
                }}
              ></span>
              <small>{opponentName}</small>
            </div>
          </div>
        </div>

        {activeGame.status === "active" && (
          <div className="mb-2">
            <span
              className={`badge ${
                isMyTurn ? "bg-success" : "bg-warning text-dark"
              } w-100`}
            >
              {isMyTurn ? "Your Turn!" : "Waiting for opponent's move"}
            </span>
          </div>
        )}

        {!opponentOnline && activeGame.status === "active" && (
          <div className="mb-2">
            <small className="text-muted">Opponent appears to be offline</small>
          </div>
        )}

        <div className="d-flex gap-2">
          <button
            className="btn btn-primary btn-sm flex-grow-1"
            onClick={handleGameClick}
          >
            {activeGame.status === "waiting" ? "View Game" : "Continue Game"}
          </button>
        </div>

        <div className="mt-2">
          <small className="text-muted">
            Game Code: {activeGame.gameCode || "Legacy"}
          </small>
        </div>
      </div>
    </div>
  );
};

export default ActiveGameIndicator;
