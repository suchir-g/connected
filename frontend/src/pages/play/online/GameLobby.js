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
        // Ensure the name has (Guest) suffix if it doesn't already
        const baseName = persistedGuestInfo.username.replace(/ \(Guest\)$/, "");
        playerName = `${baseName} (Guest)`;
      } else {
        // Create new guest session
        playerId = getGuestId();
        playerName = `${guestUsername.trim()} (Guest)`;
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

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-10">
          <div
            className={`card ${darkMode ? "bg-dark text-white" : "bg-light"}`}
          >
            <div className="card-header">
              <h2 className="mb-0">Online Game Lobby</h2>
            </div>
            <div className="card-body">
              {/* Guest Username Form */}
              {!currentUser && !persistedGuestInfo && (
                <div className="mb-4">
                  <div
                    className={`alert ${
                      darkMode ? "alert-dark" : "alert-info"
                    } w-100`}
                  >
                    <h6>Playing as Guest</h6>
                    <p className="mb-2">
                      You're playing without an account. Your game will be lost
                      if you leave the page.
                    </p>
                    <small>
                      To save games and track stats, please{" "}
                      <a href="/register">create an account</a> or{" "}
                      <a href="/login">sign in</a>.
                    </small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Enter Username</label>
                    <input
                      type="text"
                      className={`form-control ${
                        darkMode ? "bg-dark text-white border-secondary" : ""
                      }`}
                      placeholder="Your display name for this game"
                      value={guestUsername}
                      onChange={(e) => setGuestUsername(e.target.value)}
                      maxLength={20}
                    />
                  </div>
                </div>
              )}

              {/* Persisted Guest Info */}
              {!currentUser && persistedGuestInfo && (
                <div className="mb-4">
                  <div className={`alert alert-warning w-100`}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6>Playing as Guest: {persistedGuestInfo.username}</h6>
                        <p className="mb-0">
                          You can continue playing with this username or clear
                          your session to change it.
                        </p>
                      </div>
                      <button
                        className="btn btn-outline-warning btn-sm"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Are you sure you want to clear your guest session? This will reset your username."
                            )
                          ) {
                            sessionStorage.removeItem("guestInfo");
                            setPersistedGuestInfo(null);
                            setGuestUsername("");
                            setShowGuestForm(true);
                          }
                        }}
                      >
                        Clear Session
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Create New Game Section */}
              <div className="mb-4">
                <h4>Create New Game</h4>
                {currentUser &&
                  myGames.some((game) => game.status === "waiting") && (
                    <div className={`alert alert-info mb-3`}>
                      <small>
                        <strong>Note:</strong> You already have a game waiting
                        for an opponent. Clicking "Create New Game" will take
                        you to your existing game.
                      </small>
                    </div>
                  )}
                <button
                  className="btn btn-primary"
                  onClick={createGame}
                  disabled={
                    loading ||
                    (!currentUser &&
                      !persistedGuestInfo &&
                      !guestUsername.trim())
                  }
                >
                  {loading
                    ? "Creating..."
                    : currentUser &&
                      myGames.some((game) => game.status === "waiting")
                    ? "Go to Existing Game"
                    : "Create New Game"}
                </button>
              </div>

              {/* My Active Games Section - Only for authenticated users */}
              {currentUser && myGames.length > 0 && (
                <div className="mb-4">
                  <h4>My Games</h4>
                  <div className="list-group">
                    {myGames.map((game) => (
                      <div
                        key={game.id}
                        className={`list-group-item ${
                          darkMode ? "bg-dark text-white border-secondary" : ""
                        }`}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <h6 className="mb-1">
                              {game.status === "waiting"
                                ? "Waiting for opponent"
                                : "Active Game"}
                            </h6>
                            <p className="mb-1">
                              Players:{" "}
                              {game.playerNames
                                ? Object.values(game.playerNames).join(" vs ")
                                : "Loading..."}
                            </p>
                            <small>
                              {game.gameMode} • Last activity:{" "}
                              {new Date(
                                game.lastActivity?.toDate()
                              ).toLocaleString()}
                            </small>
                          </div>
                          <div>
                            <button
                              className="btn btn-primary btn-sm me-2"
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
              )}

              {/* Info Section */}
              <div
                className={`alert ${
                  darkMode ? "alert-dark" : "alert-info"
                } w-100`}
              >
                <h6>How to play online:</h6>
                <ul className="mb-2">
                  <li>Create a new game and share the link with a friend</li>
                  <li>Accept invites from other players</li>
                  <li>Continue your active games anytime</li>
                  <li>No time limits - take your time to think</li>
                </ul>
                <small className="text-muted">
                  <strong>Note:</strong> Games involving guest players are
                  automatically deleted and not saved permanently.
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLobby;
