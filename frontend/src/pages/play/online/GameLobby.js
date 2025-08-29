import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { db } from "../../../config/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import InviteFriendsDropdown from "../../../components/friends/InviteFriendsDropdown";

const GameLobby = () => {
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const { darkMode } = useTheme();

  const [myGames, setMyGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [guestUsername, setGuestUsername] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [showGuestForm, setShowGuestForm] = useState(!currentUser);
  const [persistedGuestInfo, setPersistedGuestInfo] = useState(null);

  // Check for existing guest session
  useEffect(() => {
    if (!currentUser) {
      const storedGuestInfo = sessionStorage.getItem("guestInfo");
      if (storedGuestInfo) {
        const guestInfo = JSON.parse(storedGuestInfo);
        setPersistedGuestInfo(guestInfo);
        setGuestUsername(guestInfo.username);
        setShowGuestForm(false);
      }
    }
  }, [currentUser]);

  // Generate a random guest ID for anonymous users
  const getGuestId = () => {
    return "guest_" + Math.random().toString(36).substr(2, 9);
  };

  // Generate a short game code (6 characters)
  const generateGameCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  useEffect(() => {
    if (!currentUser?.uid) return; // Only listen for games if authenticated and uid exists

    // Listen for my active games (exclude guest games but include solo waiting games)
    const myGamesQuery = query(
      collection(db, "live-games"),
      where("players", "array-contains", currentUser.uid),
      where("status", "in", ["waiting", "active"]),
      where("hasGuestPlayer", "!=", true)
    );

    const unsubscribeGames = onSnapshot(myGamesQuery, (snapshot) => {
      const games = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Show all games - we want to display solo waiting games now
      setMyGames(games);
    });

    return () => {
      unsubscribeGames();
    };
  }, [currentUser?.uid]); // Use optional chaining in dependency

  // Cleanup old guest games and abandoned single-player waiting games periodically
  useEffect(() => {
    const cleanupExpiredGames = async () => {
      try {
        const now = new Date();

        // Query for games that should be expired (guest games)
        const expiredGamesQuery = query(
          collection(db, "live-games"),
          where("hasGuestPlayer", "==", true),
          where("status", "in", ["waiting", "active"])
        );

        // Query for abandoned single-player waiting games (authenticated users)
        const abandonedGamesQuery = query(
          collection(db, "live-games"),
          where("status", "==", "waiting"),
          where("hasGuestPlayer", "!=", true)
        );

        const [expiredSnapshot, abandonedSnapshot] = await Promise.all([
          getDocs(expiredGamesQuery),
          getDocs(abandonedGamesQuery),
        ]);

        const deletionPromises = [];

        // Handle expired guest games
        expiredSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const expiresAt = data.expiresAt;

          if (expiresAt) {
            // Handle both Firestore Timestamp and JavaScript Date
            const expirationTime = expiresAt.toDate
              ? expiresAt.toDate()
              : new Date(expiresAt);

            if (expirationTime < now) {
              console.log(
                `Deleting expired guest game: ${doc.id}, expired at:`,
                expirationTime
              );
              deletionPromises.push(deleteDoc(doc.ref));
            }
          } else {
            // Fallback: Delete games without expiration that are old (2+ hours)
            const lastActivity =
              data.lastActivity?.toDate() || data.createdAt?.toDate();
            const cutoffTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

            if (lastActivity && lastActivity < cutoffTime) {
              console.log(
                `Deleting old guest game without expiration: ${doc.id}`
              );
              deletionPromises.push(deleteDoc(doc.ref));
            }
          }
        });

        // Handle abandoned single-player waiting games (authenticated users)
        abandonedSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const players = data.players || [];

          // Only delete if game has exactly 1 player and has been waiting for more than 5 minutes
          if (players.length === 1) {
            const lastActivity =
              data.lastActivity?.toDate() || data.createdAt?.toDate();
            const cutoffTime = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

            if (lastActivity && lastActivity < cutoffTime) {
              console.log(
                `Deleting abandoned single-player waiting game: ${doc.id}, created:`,
                lastActivity
              );
              deletionPromises.push(deleteDoc(doc.ref));
            }
          }
        });

        if (deletionPromises.length > 0) {
          await Promise.all(deletionPromises);
          console.log(
            `Cleaned up ${deletionPromises.length} expired/abandoned games`
          );
        }
      } catch (error) {
        console.error("Error cleaning up expired games:", error);
      }
    };

    // Run cleanup immediately and then every 2 minutes
    cleanupExpiredGames();
    const cleanupInterval = setInterval(cleanupExpiredGames, 2 * 60 * 1000); // Every 2 minutes

    return () => clearInterval(cleanupInterval);
  }, []);

  // Cleanup abandoned single-player games when component unmounts
  useEffect(() => {
    return () => {
      // When leaving the lobby, cleanup any single-player waiting games for this user
      if (currentUser?.uid) {
        const cleanupMyAbandonedGames = async () => {
          try {
            const myAbandonedQuery = query(
              collection(db, "live-games"),
              where("players", "array-contains", currentUser.uid),
              where("status", "==", "waiting"),
              where("hasGuestPlayer", "!=", true)
            );

            const snapshot = await getDocs(myAbandonedQuery);
            const deletionPromises = [];

            snapshot.docs.forEach((doc) => {
              const data = doc.data();
              const players = data.players || [];

              // Delete if it's a single-player waiting game
              if (players.length === 1 && players[0] === currentUser.uid) {
                console.log(
                  `Cleaning up abandoned single-player game: ${doc.id}`
                );
                deletionPromises.push(deleteDoc(doc.ref));
              }
            });

            if (deletionPromises.length > 0) {
              await Promise.all(deletionPromises);
              console.log(
                `Cleaned up ${deletionPromises.length} abandoned single-player games on lobby exit`
              );
            }
          } catch (error) {
            console.error("Error cleaning up abandoned games:", error);
          }
        };

        // Use a small delay to avoid race conditions
        setTimeout(cleanupMyAbandonedGames, 1000);
      }
    };
  }, [currentUser?.uid]);

  const createGame = async () => {
    // Check if user already has a waiting game - if so, redirect to it
    if (currentUser) {
      const existingWaitingGame = myGames.find(
        (game) => game.status === "waiting"
      );
      if (existingWaitingGame) {
        // Navigate to existing game instead of creating new one
        navigate(
          `/play/online/${
            existingWaitingGame.gameCode || existingWaitingGame.id
          }`
        );
        return;
      }
    }

    // Handle guest users
    if (!currentUser) {
      // Use persisted guest info if available, otherwise require new username
      if (persistedGuestInfo) {
        // Use existing guest session
      } else if (!guestUsername.trim()) {
        alert("Please enter a username to play as guest");
        return;
      } else if (guestUsername.length < 2) {
        alert("Username must be at least 2 characters long");
        return;
      }
    }

    // Handle authenticated users
    if (currentUser && !userData) {
      alert("User data not loaded yet. Please wait a moment and try again.");
      return;
    }

    setLoading(true);
    try {
      let playerId, playerName;

      if (currentUser) {
        playerId = currentUser.uid;
        playerName = userData.username;
      } else if (persistedGuestInfo) {
        // Create new game with existing guest session
        playerId = `guest_${Math.random().toString(36).substr(2, 9)}`;
        // Ensure the name has exactly one (Guest) suffix
        const baseName = persistedGuestInfo.username
          .replace(/ \(Guest\)$/, "")
          .trim();
        playerName = `${baseName} (Guest)`;
      } else {
        // Create new guest session
        playerId = getGuestId();
        // Ensure username doesn't already have (Guest) suffix before adding it
        const baseName = guestUsername
          .trim()
          .replace(/ \(Guest\)$/, "")
          .trim();
        playerName = `${baseName} (Guest)`;
      }

      const gameCode = generateGameCode(); // Generate the game code

      const gameDoc = await addDoc(collection(db, "live-games"), {
        players: [playerId],
        playerNames: { [playerId]: playerName },
        playerColors: { [playerId]: "red" },
        board: Array(42).fill(0), // Flatten the 6x7 board to a 1D array
        currentPlayer: "red",
        currentPlayerId: playerId,
        status: "waiting",
        gameMode: "standard",
        gameCode: gameCode, // Add short game code
        isGuest: !currentUser, // Track if this is a guest game
        hasGuestPlayer: !currentUser, // Also track for easier querying
        presence: { [playerId]: serverTimestamp() }, // Initialize timestamp presence tracking
        expiresAt: new Date(Date.now() + 2 * 60 * 1000), // Expire in 2 minutes if no activity
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
      });

      // Store guest info in sessionStorage for this game
      if (!currentUser) {
        const guestInfo = {
          id: playerId,
          username: playerName, // This should already have (Guest) suffix
          gameId: gameDoc.id,
        };
        console.log("Storing guest info:", guestInfo); // Debug log
        sessionStorage.setItem("guestInfo", JSON.stringify(guestInfo));
      }

      navigate(`/play/online/${gameCode}`); // Navigate using game code instead of Firebase ID
    } catch (error) {
      console.error("Error creating game:", error);
      alert("Failed to create game. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const joinGame = (gameId, gameCode) => {
    // Use game code if available, otherwise fall back to gameId
    const urlIdentifier = gameCode || gameId;
    navigate(`/play/online/${urlIdentifier}`);
  };

  const copyGameLink = (gameId, gameCode) => {
    // Use game code if available, otherwise fall back to gameId
    const urlIdentifier = gameCode || gameId;
    const gameLink = `${window.location.origin}/play/online/${urlIdentifier}`;
    navigator.clipboard.writeText(gameLink).then(() => {
      alert("Game link copied to clipboard!");
    });
  };

  const saveGuestInfo = () => {
    if (!guestUsername.trim()) {
      alert("Please enter a username to play as guest");
      return;
    } else if (guestUsername.length < 2) {
      alert("Username must be at least 2 characters long");
      return;
    }

    // Clean the username and ensure it has (Guest) suffix only once
    const baseName = guestUsername
      .trim()
      .replace(/ \(Guest\)$/, "")
      .trim();
    const guestName = `${baseName} (Guest)`;

    // Create a guest info object
    const guestInfo = {
      id: getGuestId(),
      username: guestName,
    };

    // Save to session storage
    sessionStorage.setItem("guestInfo", JSON.stringify(guestInfo));
    setPersistedGuestInfo(guestInfo);
    setGuestUsername(guestName);
    setShowGuestForm(false);
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="container mt-4 px-3" style={{ maxWidth: "1000px" }}>
        <h1 className="text-center mb-4" style={{ fontWeight: "600" }}>
          Online Game Lobby
        </h1>

        {/* Guest Username Form - Moved to top for better visibility */}
        {!currentUser && !persistedGuestInfo && (
          <div className="row justify-content-center mb-3">
            <div className="col-12 col-lg-8 col-xl-6">
              <div
                style={{
                  padding: "15px",
                  borderRadius: "8px",
                  background: darkMode
                    ? "rgba(52, 58, 64, 0.6)"
                    : "rgba(248, 249, 250, 0.8)",
                  borderLeft: "4px solid #0d6efd",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                }}
              >
                <div className="mb-2">
                  <label
                    className={`form-label fw-bold small mb-2 ${
                      darkMode ? "text-light" : ""
                    }`}
                  >
                    Enter Guest Name to Play
                  </label>
                  <div className="input-group">
                    <span
                      className={`input-group-text ${
                        darkMode ? "bg-dark text-white border-secondary" : ""
                      }`}
                      id="guest-username-label"
                    >
                      Guest
                    </span>
                    <input
                      type="text"
                      className={`form-control ${
                        darkMode ? "bg-dark text-light border-secondary" : ""
                      }`}
                      style={{ color: darkMode ? "#e9ecef" : "inherit" }}
                      aria-label="Guest username"
                      aria-describedby="guest-username-label"
                      placeholder="Enter your name"
                      value={guestUsername}
                      onChange={(e) => setGuestUsername(e.target.value)}
                      maxLength={20}
                    />
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <small className={darkMode ? "text-light" : "text-muted"}>
                      Playing as guest.{" "}
                      <a
                        href="/register"
                        className={`${
                          darkMode ? "text-info" : ""
                        } text-decoration-none`}
                      >
                        Create account
                      </a>{" "}
                      to save games.
                    </small>
                    <button
                      className={`btn ${
                        darkMode ? "btn-outline-light" : "btn-outline-primary"
                      } btn-sm`}
                      onClick={saveGuestInfo}
                      disabled={!guestUsername.trim()}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Minimized Persisted Guest Info */}
        {!currentUser && persistedGuestInfo && (
          <div className="row justify-content-center mb-3">
            <div className="col-12 col-lg-8 col-xl-6">
              <div
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: darkMode
                    ? "rgba(255, 193, 7, 0.15)"
                    : "rgba(255, 193, 7, 0.1)",
                  borderLeft: "4px solid #ffc107",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                }}
              >
                <div>
                  <small className={darkMode ? "text-light" : ""}>
                    <span className="fw-bold">Playing as Guest:</span>{" "}
                    {persistedGuestInfo.username}
                  </small>
                </div>
                <button
                  className={`btn ${
                    darkMode ? "btn-outline-warning" : "btn-outline-warning"
                  } btn-sm`}
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Clear your guest session and reset username?"
                      )
                    ) {
                      sessionStorage.removeItem("guestInfo");
                      setPersistedGuestInfo(null);
                      setGuestUsername("");
                      setShowGuestForm(true);
                    }
                  }}
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Actions - Create or Join */}
        <div className="row justify-content-center mb-4">
          <div className="col-12 col-lg-8 col-xl-6">
            {currentUser &&
              myGames.some((game) => game.status === "waiting") && (
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "16px",
                    borderRadius: "6px",
                    background: darkMode
                      ? "rgba(13, 110, 253, 0.1)"
                      : "rgba(13, 110, 253, 0.05)",
                    borderLeft: "6px solid #0d6efd",
                  }}
                >
                  <small>
                    <strong>Note:</strong> You have an existing waiting game.
                    Clicking will take you there.
                  </small>
                </div>
              )}

            {/* Create Game Button */}
            <div className="d-grid mb-3">
              <button
                className="btn btn-primary py-3"
                style={{
                  borderRadius: "8px",
                  fontSize: "1.125rem",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                }}
                onClick={createGame}
                disabled={
                  loading ||
                  (!currentUser && !persistedGuestInfo && !guestUsername.trim())
                }
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                    ></span>
                    Creating...
                  </>
                ) : currentUser &&
                  myGames.some((game) => game.status === "waiting") ? (
                  "Go to Existing Game"
                ) : (
                  "Create New Game"
                )}
              </button>
            </div>

            {/* Join Game by Code Section */}
            <div
              style={{
                borderRadius: "8px",
                padding: "16px",
                background: darkMode
                  ? "rgba(52, 58, 64, 0.4)"
                  : "rgba(248, 249, 250, 0.7)",
                borderLeft: "6px solid #0d6efd",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              }}
            >
              <div className="mb-2">
                <label
                  className={`form-label fw-bold small mb-1 ${
                    darkMode ? "text-light" : ""
                  }`}
                >
                  Join with Game Code
                </label>
                <div className="input-group">
                  <input
                    type="text"
                    className={`form-control ${
                      darkMode ? "bg-dark text-light border-secondary" : ""
                    }`}
                    style={{
                      borderRadius: "6px 0 0 6px",
                      color: darkMode ? "#e9ecef" : "inherit",
                    }}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    value={gameCode}
                    onChange={(e) => {
                      // Convert to uppercase as user types and set state
                      setGameCode(e.target.value.toUpperCase());
                    }}
                    onKeyDown={(e) => {
                      // Allow joining by pressing Enter key
                      if (e.key === "Enter" && gameCode.length === 6) {
                        navigate(`/play/online/${gameCode}`);
                      }
                    }}
                  />
                  <button
                    className={`btn ${
                      darkMode ? "btn-outline-light" : "btn-outline-primary"
                    }`}
                    style={{ borderRadius: "0 6px 6px 0" }}
                    onClick={() => {
                      if (gameCode && gameCode.length === 6) {
                        navigate(`/play/online/${gameCode}`);
                      } else {
                        alert("Please enter a valid 6-digit game code");
                      }
                    }}
                  >
                    Join
                  </button>
                </div>
                <small
                  className={`${
                    darkMode ? "text-light" : "text-muted"
                  } mt-1 d-block`}
                >
                  Enter the 6-digit code shared by your friend
                </small>
              </div>
            </div>
          </div>
        </div>

        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
            {/* Guest information sections removed - now displayed at the top of the page */}

            {/* My Active Games Section - Only for authenticated users */}
            {currentUser && myGames.length > 0 && (
              <div
                className="card mb-4 shadow-sm"
                style={{
                  borderRadius: "8px",
                  border: darkMode
                    ? "1px solid rgba(255,255,255,0.1)"
                    : "1px solid rgba(0,0,0,0.1)",
                }}
              >
                <div
                  className="card-header py-3"
                  style={{
                    borderBottom: darkMode
                      ? "1px solid rgba(255,255,255,0.1)"
                      : "1px solid rgba(0,0,0,0.1)",
                  }}
                >
                  <h6 className="card-title mb-0 fw-bold">My Active Games</h6>
                </div>
                <div className="card-body p-3 p-md-4">
                  <div className="d-flex flex-column gap-2">
                    {myGames.map((game) => (
                      <div
                        key={game.id}
                        style={{
                          position: "relative",
                          borderRadius: "6px",
                          padding: "16px",
                          marginBottom: "12px",
                          background: darkMode
                            ? "rgba(52, 58, 64, 0.4)"
                            : "rgba(248, 249, 250, 0.7)",
                          borderLeft: `5px solid ${
                            game.status === "waiting" ? "#ffc107" : "#0d6efd"
                          }`,
                          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                        }}
                      >
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center mb-1">
                              <span className="me-2 small">
                                {game.status === "waiting" ? "⏳" : "⚡"}
                              </span>
                              <h6 className="mb-0 small">
                                {game.status === "waiting"
                                  ? "Waiting for opponent"
                                  : "Active Game"}
                              </h6>
                            </div>
                            <p className="mb-1 small">
                              <strong>Players:</strong>{" "}
                              {game.playerNames
                                ? Object.values(game.playerNames).join(" vs ")
                                : "Loading..."}
                            </p>
                            <div className="d-flex flex-wrap gap-1 mb-1">
                              <small className="badge bg-info">
                                {game.gameMode}
                              </small>
                              <small
                                className={`text-muted ${
                                  darkMode ? "text-light" : ""
                                } d-none d-sm-block`}
                              >
                                Last activity:{" "}
                                {new Date(
                                  game.lastActivity?.toDate()
                                ).toLocaleString()}
                              </small>
                            </div>
                          </div>
                          <div className="d-flex gap-1 flex-wrap">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => joinGame(game.id, game.gameCode)}
                            >
                              {game.status === "waiting"
                                ? "View Game"
                                : "Continue"}
                            </button>
                            {game.status === "waiting" && (
                              <button
                                className="btn btn-outline-info btn-sm"
                                onClick={() =>
                                  copyGameLink(game.id, game.gameCode)
                                }
                              >
                                Copy Link
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Consolidated Info Section */}
            <div
              className="card shadow-sm"
              style={{
                borderRadius: "8px",
                border: darkMode
                  ? "1px solid rgba(255,255,255,0.1)"
                  : "1px solid rgba(0,0,0,0.1)",
              }}
            >
              <div
                className="card-header py-3"
                style={{
                  borderBottom: darkMode
                    ? "1px solid rgba(255,255,255,0.1)"
                    : "1px solid rgba(0,0,0,0.1)",
                }}
              >
                <h6 className="card-title mb-0 fw-bold">Quick Info</h6>
              </div>
              <div className="card-body p-3 p-md-4">
                <div className="d-flex flex-column gap-3">
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "6px",
                      background: darkMode
                        ? "rgba(13, 110, 253, 0.1)"
                        : "rgba(13, 110, 253, 0.05)",
                      borderLeft: "6px solid #0d6efd",
                    }}
                  >
                    <h6 className="fw-bold mb-2">How to Play</h6>
                    <div className="d-flex flex-wrap gap-3">
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-primary rounded-circle p-2">
                          1
                        </span>
                        <span>Create a game</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-primary rounded-circle p-2">
                          2
                        </span>
                        <span>Share the link</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-primary rounded-circle p-2">
                          3
                        </span>
                        <span>Play anytime</span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "6px",
                      background: darkMode
                        ? "rgba(255, 193, 7, 0.1)"
                        : "rgba(255, 193, 7, 0.05)",
                      borderLeft: "6px solid #ffc107",
                    }}
                  >
                    <div className="d-flex align-items-center">
                      <div>
                        <strong>Note:</strong> Guest games are temporary and
                        will be deleted if inactive. Create an account to save
                        your games permanently.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLobby;
