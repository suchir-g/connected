import React, { createContext, useContext, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { db } from "../config/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const GameRedirectContext = createContext();

export const useGameRedirect = () => {
  const context = useContext(GameRedirectContext);
  if (!context) {
    throw new Error(
      "useGameRedirect must be used within a GameRedirectProvider"
    );
  }
  return context;
};

export const GameRedirectProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeGameRef = useRef(null);
  const hasRedirectedThisSession = useRef(new Set());

  // Function to check if opponent is online
  const isOpponentOnline = (game) => {
    if (!game?.presence || !game?.players) return false;

    const opponentId = game.players.find((id) => id !== currentUser?.uid);
    if (!opponentId) return false;

    const opponentPresence = game.presence[opponentId];
    if (!opponentPresence?.toDate) return false;

    const lastSeen = opponentPresence.toDate();
    const now = new Date();
    const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
    return lastSeen > threeMinutesAgo;
  };

  // Function to determine if we should redirect to a game
  const shouldRedirect = (game, currentPath) => {
    if (!game || !currentUser?.uid) return false;

    // Don't redirect if already on a game page
    if (currentPath.includes("/play/online/")) return false;

    // Only redirect from lobby or dashboard
    const redirectablePages = ["/play/online", "/dashboard"];
    if (!redirectablePages.some((page) => currentPath === page)) return false;

    // Don't redirect if game is just waiting
    if (game.status === "waiting") return false;

    // For active games, only redirect if:
    // 1. It's the player's turn AND
    // 2. The opponent is online AND
    // 3. We haven't already redirected for this game in this session
    if (game.status === "active") {
      const isPlayerTurn = game.currentPlayerId === currentUser.uid;
      const opponentOnline = isOpponentOnline(game);
      const gameId = game.gameCode || game.id;
      const alreadyRedirected = hasRedirectedThisSession.current.has(gameId);

      return isPlayerTurn && opponentOnline && !alreadyRedirected;
    }

    return false;
  };

  useEffect(() => {
    if (!currentUser?.uid) {
      activeGameRef.current = null;
      return;
    }

    // Listen for active games
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

      // Find the most recent active game
      const activeGame = games.length > 0 ? games[0] : null;
      activeGameRef.current = activeGame;

      // Check if we should redirect
      if (activeGame && shouldRedirect(activeGame, location.pathname)) {
        const gameIdentifier = activeGame.gameCode || activeGame.id;
        hasRedirectedThisSession.current.add(gameIdentifier);
        navigate(`/play/online/${gameIdentifier}`);
      }
    });

    return () => unsubscribe();
  }, [currentUser?.uid, navigate, location.pathname]);

  // Clear redirect tracking when user manually navigates away from a game
  useEffect(() => {
    if (location.pathname.includes("/play/online/")) {
      // User is on a game page, don't clear tracking yet
      return;
    }

    // If user navigated away from game pages, allow future redirects
    // but only after a small delay to prevent immediate re-redirects
    const timer = setTimeout(() => {
      hasRedirectedThisSession.current.clear();
    }, 1000);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  const value = {
    activeGame: activeGameRef.current,
    isOpponentOnline,
  };

  return (
    <GameRedirectContext.Provider value={value}>
      {children}
    </GameRedirectContext.Provider>
  );
};
