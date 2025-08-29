import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { db } from "../../../config/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  deleteDoc,
  serverTimestamp,
  increment,
  getDoc,
  deleteField,
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";

import Board from "../../../components/board/Board";
import PlayerStatus from "../../../components/PlayerStatus";
import {
  initializeOnlineGameState,
  getMyPlayerId,
  validateMove,
  formatGameStatus,
  flattenedTo2D,
  makeMove as makeBoardMove,
} from "../../../utilities/onlineGameState";

const PlayOnline = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const { darkMode } = useTheme();

  const [gameState, setGameState] = useState(null);
  const [actualGameId, setActualGameId] = useState(null); // Store the real Firebase document ID
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [guestInfo, setGuestInfo] = useState(null);
  const [showGuestJoinForm, setShowGuestJoinForm] = useState(false);
  const [guestJoinUsername, setGuestJoinUsername] = useState("");
  const [isJoiningGame, setIsJoiningGame] = useState(false);
  const [notification, setNotification] = useState(null);
  const [friends, setFriends] = useState([]);
  const [sendingInvite, setSendingInvite] = useState(null);
  const [currentInvite, setCurrentInvite] = useState(null);
  const [cancellingInvite, setCancellingInvite] = useState(false);
  const [timeUntilDeletion, setTimeUntilDeletion] = useState(null);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Memoize player list to prevent flickering from reordering
  const sortedPlayers = useMemo(() => {
    if (!gameState?.playerColors) return [];

    // Sort players consistently by their role (creator first, then joiner)
    // or by color (red first, then yellow) to maintain stable order
    return Object.entries(gameState.playerColors).sort(
      ([aId, aColor], [bId, bColor]) => {
        if (aColor === "red" && bColor === "yellow") return -1;
        if (aColor === "yellow" && bColor === "red") return 1;
        return aId.localeCompare(bId); // Fallback to ID comparison for stability
      }
    );
  }, [gameState?.playerColors]);

  // Get guest info from sessionStorage if not authenticated
  useEffect(() => {
    if (!currentUser) {
      const storedGuestInfo = sessionStorage.getItem("guestInfo");
      if (storedGuestInfo) {
        try {
          const parsedGuestInfo = JSON.parse(storedGuestInfo);
          setGuestInfo(parsedGuestInfo);
          console.log(
            "Retrieved guest info from session storage:",
            parsedGuestInfo
          );
          // Make sure we don't show the guest form
          setShowGuestJoinForm(false);
        } catch (error) {
          console.error("Error parsing stored guest info:", error);
          // Clear invalid session storage data
          sessionStorage.removeItem("guestInfo");
        }
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (!gameId) return;

    let unsubscribe = null;

    const loadGame = async () => {
      try {
        setLoading(true);

        // First try to find game by game code
        const gameCodeQuery = query(
          collection(db, "live-games"),
          where("gameCode", "==", gameId.toUpperCase())
        );

        const gameCodeSnapshot = await getDocs(gameCodeQuery);

        let actualGameId = gameId;

        if (!gameCodeSnapshot.empty) {
          // Found by game code
          actualGameId = gameCodeSnapshot.docs[0].id;
          console.log(
            "Game found by code:",
            gameId,
            "-> Firebase ID:",
            actualGameId
          );
        } else {
          // Assume it's already a Firebase ID
          console.log("Using as Firebase ID:", gameId);
        }

        // Store the actual Firebase document ID
        setActualGameId(actualGameId);

        // Now listen to the actual game document
        const gameRef = doc(db, "live-games", actualGameId);

        unsubscribe = onSnapshot(
          gameRef,
          (docSnapshot) => {
            if (docSnapshot.exists()) {
              const data = docSnapshot.data();
              console.log("Game state updated:", data); // Debug log
              console.log("Player names:", data.playerNames); // Debug log
              setGameState(data);
              setLoading(false);

              // Get current user ID (authenticated or guest)
              let userId = null;
              if (currentUser?.uid) {
                userId = currentUser.uid;
              } else if (guestInfo?.id) {
                userId = guestInfo.id;
              }

              // Check for draw offer received
              if (userId && data.drawOffer && data.drawOffer.from !== userId) {
                setDrawOfferReceived(true);
              } else {
                setDrawOfferReceived(false);
              }

              // Join game if not already a player and game is waiting
              if (
                userId &&
                !data.players.includes(userId) &&
                data.status === "waiting"
              ) {
                // Pass the actual Firebase document ID to joinGame
                joinGameWithId(data, actualGameId);
              } else if (
                !userId &&
                !currentUser &&
                !sessionStorage.getItem("guestInfo") && // Check if guest info exists in session storage
                data.status === "waiting" &&
                data.players.length === 1
              ) {
                // Show guest join form for unauthenticated users visiting game links
                setShowGuestJoinForm(true);
              }
            } else {
              setError("Game not found");
              setLoading(false);
              // Show notification and redirect after a short delay
              setNotification({
                type: "error",
                message: "Game not found. Redirecting to lobby...",
              });
              setTimeout(() => {
                navigate("/play/online");
              }, 2000);
            }
          },
          (error) => {
            console.error("Error listening to game:", error);
            setError("Failed to load game");
            setLoading(false);
          }
        );
      } catch (error) {
        console.error("Error loading game:", error);
        setError("Failed to load game");
        setLoading(false);
      }
    };

    loadGame();

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [gameId, guestInfo]); // Removed currentUser dependency to avoid infinite loops

  // Auto-delete guest games after completion
  useEffect(() => {
    if (gameState?.status === "completed" && gameState?.deleteAfterCompletion) {
      const deleteTimeout = setTimeout(async () => {
        try {
          await deleteDoc(doc(db, "live-games", actualGameId || gameId)); // Use actualGameId if available, fallback to gameId
          console.log("Guest game automatically deleted");
        } catch (error) {
          console.error("Error auto-deleting guest game:", error);
        }
      }, 5000); // Delete after 5 seconds to allow viewing results

      return () => clearTimeout(deleteTimeout);
    }
  }, [gameState?.status, gameState?.deleteAfterCompletion, gameId]);

  // Cleanup incomplete guest games when component unmounts
  useEffect(() => {
    return () => {
      // If we're a guest and the game is still active, mark it for deletion
      if (
        !currentUser &&
        guestInfo?.id &&
        gameState?.status === "active" &&
        gameState?.hasGuestPlayer
      ) {
        const gameRef = doc(db, "live-games", actualGameId || gameId); // Use actualGameId if available, fallback to gameId
        updateDoc(gameRef, {
          status: "abandoned",
          deleteAfterCompletion: true,
          endedAt: serverTimestamp(),
        }).catch((error) => {
          console.error("Error marking abandoned guest game:", error);
        });
      }
    };
  }, []);

  // Auto-delete solo lobby games with no invites when leaving
  useEffect(() => {
    return () => {
      // Only delete if:
      // 1. User is authenticated (not guest)
      // 2. Game is in waiting status
      // 3. Only one player (the current user)
      // 4. No pending invites have been sent
      // 5. Game has existed for at least 30 seconds (prevent immediate deletion)
      if (
        currentUser &&
        gameState?.status === "waiting" &&
        gameState?.players?.length === 1 &&
        gameState.players[0] === currentUser.uid &&
        !currentInvite &&
        gameState?.createdAt
      ) {
        // Check if game has existed for at least 30 seconds
        const gameAge = Date.now() - gameState.createdAt.toDate().getTime();
        if (gameAge > 30000) {
          // 30 seconds
          const gameRef = doc(db, "live-games", actualGameId || gameId);
          deleteDoc(gameRef).catch((error) => {
            console.error("Error deleting solo lobby game:", error);
          });
        }
      }
    };
  }, [currentUser, gameState, currentInvite, actualGameId, gameId]);

  // Separate effect to determine if we should track presence
  const shouldTrackPresence = useMemo(() => {
    if (!gameState) return false;

    // Track presence for all online games, not just guest games
    return gameState.status === "waiting" || gameState.status === "active";
  }, [gameState?.status]);

  // Presence tracking for all online games
  useEffect(() => {
    if (!actualGameId) return; // Use actual Firebase ID, not the URL parameter

    const userId = currentUser?.uid || guestInfo?.id;
    if (!userId) return;

    // Only start presence tracking once we have basic game info
    if (!gameState) return;

    // Track presence for all active/waiting games
    if (!shouldTrackPresence) return;

    console.log(
      "Starting presence tracking for user:",
      userId,
      "in game:",
      actualGameId
    );

    const gameRef = doc(db, "live-games", actualGameId);
    let presenceInterval;
    let isActive = true; // Track if this effect is still active

    // Set presence heartbeat immediately
    const sendHeartbeat = async () => {
      if (!isActive) return; // Don't update if effect has been cleaned up

      try {
        console.log(
          "Sending heartbeat for user:",
          userId,
          "at",
          new Date().toLocaleTimeString()
        );

        // Calculate expiration time (2 minutes from now)
        const expirationTime = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

        await updateDoc(gameRef, {
          [`presence.${userId}`]: serverTimestamp(),
          lastActivity: serverTimestamp(),
          // Set game expiration time - if no heartbeat updates this, game expires
          expiresAt: expirationTime,
        });
        console.log(
          "Heartbeat sent successfully, game expires at:",
          expirationTime.toLocaleTimeString()
        );
      } catch (error) {
        console.error("Error sending heartbeat:", error);
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Send heartbeat every 60 seconds (less frequent since we're extending expiration)
    presenceInterval = setInterval(() => {
      if (isActive) {
        sendHeartbeat();
      }
    }, 60000);

    // Handle page visibility changes (tab switching, minimizing, etc.)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("Page hidden, setting short expiration");
        // Page is hidden, set very short expiration (30 seconds)
        if (isActive) {
          const shortExpiration = new Date(Date.now() + 30 * 1000); // 30 seconds
          updateDoc(gameRef, {
            [`presence.${userId}`]: deleteField(),
            expiresAt: shortExpiration,
          }).catch((error) => {
            console.error("Error setting short expiration on hide:", error);
          });
        }
      } else {
        console.log("Page visible, sending heartbeat");
        // Page is visible again, send heartbeat (extends expiration)
        if (isActive) {
          sendHeartbeat();
        }
      }
    };

    // Handle beforeunload (page closing/refreshing)
    const handleBeforeUnload = () => {
      if (isActive) {
        console.log("Page unloading, setting immediate expiration");
        // Set immediate expiration when page unloads
        const immediateExpiration = new Date(Date.now() + 5 * 1000); // 5 seconds

        // Use fetch with keepalive for reliable delivery
        fetch("/api/expire-game", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId: gameId,
            expiresAt: immediateExpiration.toISOString(),
          }),
        }).catch(() => {
          // Fallback - this might not work reliably on page unload
          updateDoc(gameRef, {
            [`presence.${userId}`]: deleteField(),
            expiresAt: immediateExpiration,
          }).catch((error) => {
            console.error("Error setting immediate expiration:", error);
          });
        });
      }
    };

    // Add event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup function
    return () => {
      console.log("Cleaning up presence tracking for user:", userId);
      isActive = false; // Mark effect as inactive

      if (presenceInterval) {
        clearInterval(presenceInterval);
      }

      // Remove event listeners
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Set short expiration on unmount
      const shortExpiration = new Date(Date.now() + 30 * 1000); // 30 seconds
      updateDoc(gameRef, {
        [`presence.${userId}`]: deleteField(),
        expiresAt: shortExpiration,
      }).catch((error) => {
        console.error("Error setting expiration on cleanup:", error);
      });
    };
  }, [actualGameId, currentUser?.uid, guestInfo?.id, shouldTrackPresence]); // Use the memoized value

  // Function to determine if a player is online based on presence data
  const isPlayerOnline = (playerId) => {
    if (!gameState?.presence) return false;

    const playerPresence = gameState.presence[playerId];
    if (!playerPresence) return false;

    // If presence is a timestamp, check if it's recent (within last 3 minutes)
    if (playerPresence?.toDate) {
      const lastSeen = playerPresence.toDate();
      const now = new Date();
      const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
      return lastSeen > threeMinutesAgo;
    }

    // If presence is just a boolean or other value, assume online
    return true;
  };

  // Fetch friends list for inviting
  const fetchFriends = async () => {
    if (!currentUser) return;

    try {
      const friendsRef = collection(db, "friends");
      const q1 = query(
        friendsRef,
        where("user1", "==", currentUser.uid),
        where("status", "==", "accepted")
      );
      const q2 = query(
        friendsRef,
        where("user2", "==", currentUser.uid),
        where("status", "==", "accepted")
      );

      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2),
      ]);

      const friendIds = new Set();
      snapshot1.forEach((doc) => friendIds.add(doc.data().user2));
      snapshot2.forEach((doc) => friendIds.add(doc.data().user1));

      const friendsData = await Promise.all(
        [...friendIds].map(async (id) => {
          const friendDocRef = doc(db, "players", id);
          const friendDoc = await getDoc(friendDocRef);
          return friendDoc.exists() ? { uid: id, ...friendDoc.data() } : null;
        })
      );

      setFriends(friendsData.filter(Boolean));
    } catch (err) {
      console.error("Error fetching friends:", err);
    }
  };

  // Fetch current pending invite for this game
  const fetchCurrentInvite = async () => {
    if (!currentUser || !actualGameId) return;

    try {
      const invitesRef = collection(db, "game-invites");
      const q = query(
        invitesRef,
        where("inviterId", "==", currentUser.uid),
        where("gameId", "==", actualGameId),
        where("status", "==", "pending")
      );

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const inviteDoc = snapshot.docs[0];
        setCurrentInvite({
          id: inviteDoc.id,
          ...inviteDoc.data(),
        });
      } else {
        setCurrentInvite(null);
      }
    } catch (err) {
      console.error("Error fetching current invite:", err);
    }
  };

  // Send game invite to a friend (only one at a time)
  const sendGameInvite = async (friendId, friendUsername) => {
    if (!currentUser || !userData || !gameState) return;
    if (currentInvite) {
      setNotification({
        type: "warning",
        message:
          "You already have a pending invite. Cancel it first to invite someone else.",
      });
      return;
    }

    setSendingInvite(friendId);
    try {
      // Send the invite pointing to this existing game
      const inviteDoc = await addDoc(collection(db, "game-invites"), {
        inviterId: currentUser.uid,
        inviterName: userData.username,
        inviteeId: friendId,
        inviteeName: friendUsername,
        gameId: actualGameId || gameId, // Use the actual Firebase document ID
        gameCode: gameState.gameCode, // Include game code for easier joining
        gameMode: gameState.gameMode || "standard",
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Update current invite state
      setCurrentInvite({
        id: inviteDoc.id,
        inviterId: currentUser.uid,
        inviterName: userData.username,
        inviteeId: friendId,
        inviteeName: friendUsername,
        gameId: actualGameId || gameId,
        gameCode: gameState.gameCode,
        gameMode: gameState.gameMode || "standard",
        status: "pending",
      });

      setNotification({
        type: "success",
        message: `Game invite sent to ${friendUsername}!`,
      });
    } catch (error) {
      console.error("Error sending game invite:", error);
      setNotification({
        type: "error",
        message: "Failed to send game invite. Please try again.",
      });
    } finally {
      setSendingInvite(null);
    }
  };

  // Cancel current game invite
  const cancelGameInvite = async () => {
    if (!currentInvite) return;

    setCancellingInvite(true);
    try {
      await deleteDoc(doc(db, "game-invites", currentInvite.id));
      setCurrentInvite(null);
      setNotification({
        type: "success",
        message: "Game invite cancelled.",
      });
    } catch (error) {
      console.error("Error cancelling game invite:", error);
      setNotification({
        type: "error",
        message: "Failed to cancel invite. Please try again.",
      });
    } finally {
      setCancellingInvite(false);
    }
  };

  // Copy game link to clipboard
  const copyGameLink = () => {
    const urlIdentifier = gameState.gameCode || gameId;
    const gameLink = `${window.location.origin}/play/online/${urlIdentifier}`;
    navigator.clipboard.writeText(gameLink);
    setNotification({
      type: "success",
      message: "Game link copied to clipboard!",
    });
  };

  // Delete solo game immediately (for manual cleanup)
  const deleteSoloGame = async () => {
    if (
      !currentUser ||
      gameState?.status !== "waiting" ||
      gameState?.players?.length !== 1 ||
      gameState.players[0] !== currentUser.uid ||
      currentInvite
    ) {
      return;
    }

    try {
      const gameRef = doc(db, "live-games", actualGameId || gameId);
      await deleteDoc(gameRef);
      console.log("Solo game deleted");
      navigate("/play/online");
    } catch (error) {
      console.error("Error deleting solo game:", error);
    }
  };

  // Auto-dismiss notifications after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Fetch friends when user is authenticated
  useEffect(() => {
    if (currentUser) {
      fetchFriends();
    }
  }, [currentUser]);

  // Fetch current invite when game loads
  useEffect(() => {
    if (currentUser && actualGameId) {
      fetchCurrentInvite();
    }
  }, [currentUser, actualGameId]);

  // Auto-delete solo lobby games after 5 minutes with no invites (consistent with GameLobby cleanup)
  useEffect(() => {
    if (
      currentUser &&
      gameState?.status === "waiting" &&
      gameState?.players?.length === 1 &&
      gameState.players[0] === currentUser.uid &&
      !currentInvite &&
      gameState?.createdAt
    ) {
      // Calculate how long the game has existed
      const gameAge = Date.now() - gameState.createdAt.toDate().getTime();
      const remainingTime = Math.max(0, 5 * 60 * 1000 - gameAge); // 5 minutes minus current age

      // Update countdown every second
      const countdownInterval = setInterval(() => {
        const currentAge = Date.now() - gameState.createdAt.toDate().getTime();
        const remaining = Math.max(0, 5 * 60 * 1000 - currentAge);

        if (remaining > 0) {
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          setTimeUntilDeletion(
            `${minutes}:${seconds.toString().padStart(2, "0")}`
          );
        } else {
          setTimeUntilDeletion(null);
        }
      }, 1000);

      // Only set timer if game still has time left
      if (remainingTime > 0) {
        const deleteTimer = setTimeout(async () => {
          try {
            // Double-check conditions before deleting
            const gameRef = doc(db, "live-games", actualGameId || gameId);
            const gameSnapshot = await getDoc(gameRef);

            if (gameSnapshot.exists()) {
              const currentGameData = gameSnapshot.data();
              // Only delete if still solo and no invites
              if (
                currentGameData.status === "waiting" &&
                currentGameData.players?.length === 1 &&
                currentGameData.players[0] === currentUser.uid
              ) {
                // Check for any pending invites one more time
                const invitesRef = collection(db, "game-invites");
                const inviteQuery = query(
                  invitesRef,
                  where("inviterId", "==", currentUser.uid),
                  where("gameId", "==", actualGameId || gameId),
                  where("status", "==", "pending")
                );
                const inviteSnapshot = await getDocs(inviteQuery);

                if (inviteSnapshot.empty) {
                  console.log(
                    "Auto-deleting solo lobby game after 5 minute timeout"
                  );
                  await deleteDoc(gameRef);
                }
              }
            }
          } catch (error) {
            console.error("Error auto-deleting solo game:", error);
          }
        }, remainingTime);

        return () => {
          clearTimeout(deleteTimer);
          clearInterval(countdownInterval);
        };
      } else {
        return () => clearInterval(countdownInterval);
      }
    } else {
      // Clear countdown when conditions no longer met
      setTimeUntilDeletion(null);
    }
  }, [currentUser, gameState, currentInvite, actualGameId, gameId]);

  const joinGame = async (currentGameState, customGuestInfo = null) => {
    let playerId, playerName;

    if (currentUser && userData) {
      playerId = currentUser.uid;
      playerName = userData.username;
    } else if (customGuestInfo) {
      // Use passed guest info (for immediate joining)
      playerId = customGuestInfo.id;
      playerName = customGuestInfo.username;
    } else if (guestInfo) {
      playerId = guestInfo.id;
      playerName = guestInfo.username;
    } else {
      // This shouldn't happen with the new flow, but keep as fallback
      console.error("No user info available for joining game");
      return;
    }

    if (!playerName) return;

    // Ensure we have the actual Firebase document ID before trying to join
    if (!actualGameId) {
      console.error("Cannot join game: actualGameId not available yet");
      return;
    }

    try {
      const gameRef = doc(db, "live-games", actualGameId); // Use actualGameId directly
      const expirationTime = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now

      const updateData = {
        players: arrayUnion(playerId),
        [`playerNames.${playerId}`]: playerName,
        [`playerColors.${playerId}`]: "yellow",
        [`presence.${playerId}`]: serverTimestamp(), // Set timestamp presence for joining player
        status: "active",
        lastActivity: serverTimestamp(),
        expiresAt: expirationTime, // Set initial expiration
      };

      // Mark game as having guest players if this player is a guest
      if (!currentUser) {
        updateData.hasGuestPlayer = true;
      }

      console.log(
        "Joining game with actualGameId:",
        actualGameId,
        "gameId:",
        gameId
      ); // Debug log
      await updateDoc(gameRef, updateData);
      setShowGuestJoinForm(false); // Hide the form after joining
      console.log("Successfully updated game with new player:", playerName);
      console.log("Update data:", updateData); // Debug log
    } catch (error) {
      console.error("Error joining game:", error);
      setError("Failed to join game");
    }
  };

  // Function that accepts the actual game ID as parameter for use in onSnapshot callback
  const joinGameWithId = async (
    currentGameState,
    firebaseGameId,
    customGuestInfo = null
  ) => {
    let playerId, playerName;

    if (currentUser && userData) {
      playerId = currentUser.uid;
      playerName = userData.username;
    } else if (customGuestInfo) {
      // Use passed guest info (for immediate joining)
      playerId = customGuestInfo.id;
      playerName = customGuestInfo.username;
    } else if (guestInfo) {
      playerId = guestInfo.id;
      playerName = guestInfo.username;
    } else {
      // This shouldn't happen with the new flow, but keep as fallback
      console.error("No user info available for joining game");
      return;
    }

    if (!playerName) return;

    try {
      const gameRef = doc(db, "live-games", firebaseGameId); // Use the passed Firebase document ID
      const expirationTime = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now

      const updateData = {
        players: arrayUnion(playerId),
        [`playerNames.${playerId}`]: playerName,
        [`playerColors.${playerId}`]: "yellow",
        [`presence.${playerId}`]: serverTimestamp(), // Set timestamp presence for joining player
        status: "active",
        lastActivity: serverTimestamp(),
        expiresAt: expirationTime, // Set initial expiration
      };

      // Mark game as having guest players if this player is a guest
      if (!currentUser) {
        updateData.hasGuestPlayer = true;
      }

      console.log(
        "Joining game with firebaseGameId:",
        firebaseGameId,
        "gameId:",
        gameId
      ); // Debug log
      await updateDoc(gameRef, updateData);
      setShowGuestJoinForm(false); // Hide the form after joining
      console.log("Successfully updated game with new player:", playerName);
      console.log("Update data:", updateData); // Debug log
    } catch (error) {
      console.error("Error joining game:", error);
      setError("Failed to join game");
    }
  };

  const makeMove = async (columnIndex) => {
    if (!gameState) return;

    const userId = currentUser?.uid || guestInfo?.id;
    if (!userId) return;

    const myPlayerId = getMyPlayerId(gameState, userId);
    const validation = validateMove(gameState, columnIndex, myPlayerId);

    if (!validation.isValid) {
      setNotification({
        type: "warning",
        message: validation.reason,
      });
      return;
    }

    try {
      // Use the utility function to make the move on the flattened board
      const newFlatBoard = makeBoardMove(
        gameState.board,
        columnIndex,
        gameState.currentPlayer
      );

      // Determine next player
      const nextPlayer = gameState.currentPlayer === "red" ? "yellow" : "red";
      const nextPlayerId = Object.entries(gameState.playerColors).find(
        ([playerId, color]) => color === nextPlayer
      )?.[0];

      // Store moves as a string like local games (columnIndex + 1 because UI is 1-indexed)
      const moveString = gameState.movesString
        ? gameState.movesString + (columnIndex + 1).toString()
        : (columnIndex + 1).toString();

      // Also maintain the array format for backward compatibility
      const updatedMoves = [...(gameState.moves || []), columnIndex];

      const moveData = {
        board: newFlatBoard,
        currentPlayer: nextPlayer,
        currentPlayerId: nextPlayerId,
        lastActivity: serverTimestamp(),
        moves: updatedMoves, // Keep array for backward compatibility
        movesString: moveString, // Add string format to match local games
      };

      // Check for win or draw
      const gameStatus = formatGameStatus(
        newFlatBoard,
        gameState.currentPlayer
      );
      if (gameStatus.gameOver) {
        moveData.status = "completed";
        moveData.winType = gameStatus.winType;
        moveData.endedAt = serverTimestamp();

        if (gameStatus.winner === "draw") {
          moveData.winner = "draw";
        } else {
          // Find the userID of the winner based on their color
          const winnerUserId = Object.entries(gameState.playerColors).find(
            ([playerId, color]) => color === gameStatus.winner
          )?.[0];
          moveData.winner = winnerUserId;
        }

        // If this game involves guest players, mark it for deletion
        if (gameState.hasGuestPlayer || gameState.isGuest) {
          moveData.deleteAfterCompletion = true;
        }
      }

      const gameRef = doc(db, "live-games", actualGameId || gameId); // Use actualGameId if available, fallback to gameId
      await updateDoc(gameRef, moveData);

      console.log("Move made, updated moves array:", updatedMoves);
      setLastMove({ column: columnIndex, player: gameState.currentPlayer });
    } catch (error) {
      console.error("Error making move:", error);
      setNotification({
        type: "error",
        message: "Failed to make move. Please try again.",
      });
    }
  };

  const handleResign = async () => {
    if (!window.confirm("Are you sure you want to resign?")) return;

    const userId = currentUser?.uid || guestInfo?.id;
    if (!userId) return;

    try {
      // Find the opponent's userId (the winner)
      const opponentId = gameState.players.find((id) => id !== userId);

      const gameRef = doc(db, "live-games", actualGameId || gameId);
      const updateData = {
        status: "completed",
        winner: opponentId, // Winner is the opponent's userID, not color
        winType: "resignation",
        endedAt: serverTimestamp(),
      };

      // If this game involves guest players, mark it for deletion
      if (gameState.hasGuestPlayer || gameState.isGuest) {
        updateData.deleteAfterCompletion = true;
      }

      await updateDoc(gameRef, updateData);

      navigate("/play/online");
    } catch (error) {
      console.error("Error resigning:", error);
      setNotification({
        type: "error",
        message: "Failed to resign. Please try again.",
      });
    }
  };

  const handleOfferDraw = async () => {
    const currentUserId = currentUser?.uid || guestInfo?.id;
    if (!currentUserId) return;

    // Check if there's already a pending draw offer
    if (gameState.drawOffer) {
      if (gameState.drawOffer.from === currentUserId) {
        setNotification({
          type: "warning",
          message:
            "You already offered a draw. Wait for your opponent's response.",
        });
        return;
      }

      // If opponent offered draw and we're accepting it
      if (gameState.drawOffer.from !== currentUserId) {
        if (
          window.confirm("Your opponent has offered a draw. Do you accept?")
        ) {
          try {
            const gameRef = doc(db, "live-games", actualGameId || gameId);
            const updateData = {
              status: "completed",
              winner: "draw",
              winType: "agreement",
              endedAt: serverTimestamp(),
              drawOffer: null, // Clear the draw offer
            };

            // If this game involves guest players, mark it for deletion
            if (gameState.hasGuestPlayer || gameState.isGuest) {
              updateData.deleteAfterCompletion = true;
            }

            await updateDoc(gameRef, updateData);

            setNotification({
              type: "success",
              message: "Draw accepted! Game ended in a draw.",
            });
          } catch (error) {
            console.error("Error accepting draw:", error);
            setNotification({
              type: "error",
              message: "Failed to accept draw. Please try again.",
            });
          }
        }
        return;
      }
    }

    // Offer a new draw
    if (window.confirm("Do you want to offer a draw to your opponent?")) {
      try {
        const gameRef = doc(db, "live-games", actualGameId || gameId);
        await updateDoc(gameRef, {
          drawOffer: {
            from: currentUserId,
            timestamp: serverTimestamp(),
          },
          lastActivity: serverTimestamp(),
        });

        setNotification({
          type: "success",
          message: "Draw offer sent to your opponent.",
        });
      } catch (error) {
        console.error("Error offering draw:", error);
        setNotification({
          type: "error",
          message: "Failed to offer draw. Please try again.",
        });
      }
    }
  };

  const handleDrawResponse = async (accept) => {
    const currentUserId = currentUser?.uid || guestInfo?.id;
    if (!currentUserId) return;

    try {
      const gameRef = doc(db, "live-games", actualGameId || gameId);

      if (accept) {
        // Accept the draw
        const updateData = {
          status: "completed",
          winner: "draw",
          winType: "agreement",
          endedAt: serverTimestamp(),
          drawOffer: null,
        };

        // If this game involves guest players, mark it for deletion
        if (gameState.hasGuestPlayer || gameState.isGuest) {
          updateData.deleteAfterCompletion = true;
        }

        await updateDoc(gameRef, updateData);
        setNotification({
          type: "success",
          message: "Draw accepted! Game ended in a draw.",
        });
      } else {
        // Decline the draw
        await updateDoc(gameRef, {
          drawOffer: null,
          lastActivity: serverTimestamp(),
        });
        setNotification({
          type: "info",
          message: "Draw offer declined.",
        });
      }

      setDrawOfferReceived(false);
    } catch (error) {
      console.error("Error responding to draw offer:", error);
      setNotification({
        type: "error",
        message: "Failed to respond to draw offer. Please try again.",
      });
    }
  };

  const handleDeclineDraw = async () => {
    try {
      const gameRef = doc(db, "live-games", actualGameId || gameId);
      await updateDoc(gameRef, {
        drawOffer: null, // Remove the draw offer
        lastActivity: serverTimestamp(),
      });

      setNotification({
        type: "info",
        message: "Draw offer declined.",
      });
    } catch (error) {
      console.error("Error declining draw:", error);
      setNotification({
        type: "error",
        message: "Failed to decline draw. Please try again.",
      });
    }
  };

  const handleGuestJoin = async () => {
    if (!guestJoinUsername.trim() || guestJoinUsername.length < 2) {
      setNotification({
        type: "warning",
        message: "Please enter a username with at least 2 characters",
      });
      return;
    }

    if (!gameState) {
      setNotification({
        type: "warning",
        message: "Game not loaded yet. Please try again.",
      });
      return;
    }

    setIsJoiningGame(true);

    try {
      const playerId = `guest_${Math.random().toString(36).substr(2, 9)}`;

      // Clean the username and ensure it has (Guest) suffix only once
      const cleanedName = guestJoinUsername
        .trim()
        .replace(/ \(Guest\)$/, "")
        .trim();
      const playerName = `${cleanedName} (Guest)`;

      const newGuestInfo = {
        id: playerId,
        username: playerName,
        gameId: gameId,
      };
      setGuestInfo(newGuestInfo);
      sessionStorage.setItem("guestInfo", JSON.stringify(newGuestInfo));

      // Now join the game with the new guest info passed directly
      await joinGame(gameState, newGuestInfo);
      console.log("Successfully joined game as guest:", playerName);
    } catch (error) {
      console.error("Error joining game as guest:", error);
      setNotification({
        type: "error",
        message: "Failed to join game. Please try again.",
      });
    } finally {
      setIsJoiningGame(false);
    }
  };

  const handleRematch = () => {
    navigate("/play/online");
  };

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading game...</span>
          </div>
          <p className="mt-2">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error === "Game not found") {
    // This will briefly show before the redirect happens
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Redirecting...</span>
          </div>
          <p className="mt-2">Game not found. Redirecting to lobby...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <div className={`alert alert-danger`} role="alert">
          <h4>Error</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <p>Game not found</p>
        </div>
      </div>
    );
  }

  let userId = null;
  if (currentUser?.uid) {
    userId = currentUser.uid;
  } else if (guestInfo?.id) {
    userId = guestInfo.id;
  }

  const myPlayerId = userId ? getMyPlayerId(gameState, userId) : null;
  const myColor = userId ? gameState.playerColors?.[userId] : null;
  const isMyTurn = userId ? gameState.currentPlayerId === userId : false;
  const gameOver = gameState.status === "completed";

  // Show guest join form if needed
  if (
    showGuestJoinForm &&
    !currentUser &&
    !guestInfo &&
    !sessionStorage.getItem("guestInfo") && // Double-check session storage
    gameState?.status === "waiting"
  ) {
    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div
              className={`card ${darkMode ? "bg-dark text-white" : "bg-light"}`}
            >
              <div className="card-header">
                <h4 className="mb-0">Join Game</h4>
              </div>
              <div className="card-body">
                <div
                  className={`alert ${darkMode ? "alert-dark" : "alert-info"}`}
                >
                  <h6>Playing as Guest</h6>
                  <p className="mb-0">
                    You're joining without an account. Your game will be lost if
                    you leave the page.
                  </p>
                </div>

                <div className="mb-3">
                  <label className="form-label">Enter Your Username</label>
                  <input
                    type="text"
                    className={`form-control ${
                      darkMode ? "bg-dark text-white border-secondary" : ""
                    }`}
                    placeholder="Your display name for this game"
                    value={guestJoinUsername}
                    onChange={(e) => setGuestJoinUsername(e.target.value)}
                    maxLength={20}
                    onKeyPress={(e) =>
                      e.key === "Enter" && !isJoiningGame && handleGuestJoin()
                    }
                  />
                </div>

                <div className="d-flex gap-2">
                  <button
                    className="btn btn-primary"
                    onClick={handleGuestJoin}
                    disabled={
                      !guestJoinUsername.trim() ||
                      guestJoinUsername.length < 2 ||
                      isJoiningGame
                    }
                  >
                    {isJoiningGame ? "Joining..." : "Join Game"}
                  </button>
                </div>

                <div className="mt-3">
                  <small className="text-muted">
                    Or <a href="/register">create an account</a> to save your
                    games and track stats.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-3 px-3" style={{ maxWidth: "1200px" }}>
      <div className="d-flex flex-column flex-md-row align-items-center justify-content-center mb-3">
        <h1 className="h3 mb-0">Play Online</h1>
      </div>

      <div className="row g-3">
        {/* Sidebar - Game Controls & Info */}
        <div className="col-12 col-md-6 col-lg-5 order-2 order-lg-1">
          <div className="d-flex flex-column gap-3 h-100">
            {/* Game info section - simplified */}

            {/* Game Actions Card - Simplified */}
            <div className="card" style={{ border: "1px solid #808080" }}>
              <div className="card-header">
                <h6 className="card-title mb-0">Game Actions</h6>
              </div>
              <div className="card-body p-2 p-md-3">
                {/* Game Code Display - Centralized here */}
                {gameState.status === "waiting" && gameState.gameCode && (
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-bold">Game Code:</span>
                      <span
                        className="badge bg-primary px-3 py-2"
                        style={{
                          fontFamily: "monospace",
                          letterSpacing: "0.1em",
                          fontSize: "1rem",
                        }}
                      >
                        {gameState.gameCode}
                      </span>
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-outline-primary btn-sm flex-grow-1"
                        onClick={() => {
                          navigator.clipboard.writeText(gameState.gameCode);
                          setNotification({
                            type: "success",
                            message: "Game code copied!",
                          });
                        }}
                      >
                        📋 Copy Code
                      </button>
                      <button
                        className="btn btn-outline-secondary btn-sm flex-grow-1"
                        onClick={copyGameLink}
                      >
                        � Copy Link
                      </button>
                    </div>
                  </div>
                )}

                {/* Invite Friends - Kept separate from code display */}
                {currentUser &&
                  gameState.status === "waiting" &&
                  gameState.players?.length === 1 && (
                    <div className="d-grid gap-2">
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => setShowInviteModal(true)}
                      >
                        {currentInvite
                          ? "Manage Invite"
                          : `Invite Friend${
                              friends.length > 0 ? `s (${friends.length})` : ""
                            }`}
                      </button>
                    </div>
                  )}

                {/* Game Actions */}
                {!gameOver && gameState.status === "active" && (
                  <div className="d-grid gap-2">
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={handleResign}
                    >
                      🏳️ Resign Game
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={handleOfferDraw}
                    >
                      🤝 Offer Draw
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Game Status Card */}
            <div className="card" style={{ border: "1px solid #808080" }}>
              <div className="card-header">
                <h6 className="card-title mb-0">🎮 Game Status</h6>
              </div>
              <div className="card-body p-2 p-md-3">
                {gameState.status === "waiting" && gameState.gameCode && (
                  <div
                    className={`card mb-2 ${
                      darkMode
                        ? "bg-dark border-info"
                        : "bg-light border-primary"
                    }`}
                  >
                    <div className="card-body p-2 text-center">
                      <small className="d-block mb-1 text-muted">
                        Game Code
                      </small>
                      <div className="d-flex align-items-center justify-content-center">
                        <h3
                          className="mb-0 me-2"
                          style={{
                            fontFamily: "monospace",
                            letterSpacing: "0.15em",
                            fontWeight: "bold",
                            color: darkMode ? "#00ccff" : "#0066cc",
                          }}
                        >
                          {gameState.gameCode}
                        </h3>
                        <button
                          className="btn btn-sm btn-outline-secondary border-0"
                          onClick={() => {
                            navigator.clipboard.writeText(gameState.gameCode);
                            setNotification({
                              type: "success",
                              message: "Game code copied to clipboard!",
                            });
                          }}
                          title="Copy code"
                        >
                          📋
                        </button>
                      </div>
                      <small
                        className={`d-block mt-1 ${
                          darkMode ? "text-light" : "text-muted"
                        }`}
                      >
                        Share this code to let others join
                      </small>
                    </div>
                  </div>
                )}

                <div
                  className={`p-2 rounded ${
                    gameState.status === "waiting"
                      ? darkMode
                        ? "bg-info bg-opacity-25 text-white"
                        : "bg-info bg-opacity-15"
                      : gameState.status === "active" && !gameOver
                      ? gameState.drawOffer
                        ? darkMode
                          ? "bg-warning bg-opacity-25 text-white"
                          : "bg-warning bg-opacity-15"
                        : isMyTurn
                        ? darkMode
                          ? "bg-success bg-opacity-25 text-white"
                          : "bg-success bg-opacity-15"
                        : darkMode
                        ? "bg-secondary bg-opacity-25 text-white"
                        : "bg-secondary bg-opacity-15"
                      : gameOver
                      ? darkMode
                        ? "bg-primary bg-opacity-25 text-white"
                        : "bg-primary bg-opacity-15"
                      : darkMode
                      ? "bg-secondary bg-opacity-25 text-white"
                      : "bg-secondary bg-opacity-15"
                  }`}
                >
                  <div className="text-center">
                    <div className="h5 mb-2">
                      {gameState.status === "waiting" && "⏳"}
                      {gameState.status === "active" &&
                        !gameOver &&
                        (gameState.drawOffer ? "🤝" : isMyTurn ? "🎯" : "⏸️")}
                      {gameOver && "🏁"}
                    </div>
                    <div className="fw-bold mb-1">
                      {gameState.status === "waiting" &&
                        currentInvite &&
                        "Waiting for Friend"}
                      {gameState.status === "waiting" &&
                        !currentInvite &&
                        "Waiting for Opponent"}
                      {gameState.status === "active" &&
                        !gameOver &&
                        gameState.drawOffer &&
                        "Draw Offer"}
                      {gameState.status === "active" &&
                        !gameOver &&
                        !gameState.drawOffer &&
                        isMyTurn &&
                        "Your Turn"}
                      {gameState.status === "active" &&
                        !gameOver &&
                        !gameState.drawOffer &&
                        !isMyTurn &&
                        "Opponent's Turn"}
                      {gameOver &&
                        (gameState.winner === "draw" ? "Draw" : "Game Over")}
                    </div>
                    <small className={darkMode ? "text-light" : "text-muted"}>
                      {gameState.status === "waiting" &&
                        currentInvite &&
                        `${currentInvite.inviteeName} will be notified`}
                      {gameState.status === "waiting" &&
                        !currentInvite &&
                        "Share the game link to invite someone"}
                      {gameState.status === "active" &&
                        !gameOver &&
                        gameState.drawOffer &&
                        (gameState.drawOffer.from ===
                        (currentUser?.uid || guestInfo?.id)
                          ? "Waiting for opponent's response"
                          : "Respond in the special alerts section")}
                      {gameState.status === "active" &&
                        !gameOver &&
                        !gameState.drawOffer &&
                        isMyTurn &&
                        "Click a column to make your move"}
                      {gameState.status === "active" &&
                        !gameOver &&
                        !gameState.drawOffer &&
                        !isMyTurn &&
                        `${
                          gameState.playerNames?.[gameState.currentPlayerId]
                        } is thinking...`}
                      {gameOver &&
                        (gameState.winner === "draw"
                          ? "Nobody wins this time"
                          : `${
                              gameState.playerNames?.[gameState.winner]
                            } is the winner!`)}
                    </small>
                    {gameState.status === "waiting" && timeUntilDeletion && (
                      <div className="mt-2">
                        <small className="badge bg-warning text-dark">
                          Auto-delete in {timeUntilDeletion}
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Players Card */}
            {gameState.status === "active" && (
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-header">
                  <h6 className="card-title mb-0">Players</h6>
                </div>
                <div className="card-body p-2 p-md-3">
                  <div className="d-flex flex-column gap-2">
                    <div
                      className={`p-2 rounded ${
                        Object.keys(gameState.playerNames || {})[0] ===
                        (currentUser?.uid || guestInfo?.id)
                          ? "bg-success text-white"
                          : darkMode
                          ? "bg-dark text-white border"
                          : "bg-light text-dark border"
                      }`}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>
                            {Object.values(gameState.playerNames || {})[0] ||
                              "Player 1"}
                            {Object.keys(gameState.playerNames || {})[0] ===
                              (currentUser?.uid || guestInfo?.id) && " (you)"}
                          </strong>
                          {gameState.currentPlayerId ===
                            Object.keys(gameState.playerNames || {})[0] && (
                            <div className="mt-1">
                              <small className="text-warning">
                                {" "}
                                Current Turn
                              </small>
                            </div>
                          )}
                        </div>
                        <div className="text-end">
                          <span className="badge bg-danger">🔴</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`p-2 rounded ${
                        Object.keys(gameState.playerNames || {})[1] ===
                        (currentUser?.uid || guestInfo?.id)
                          ? "bg-success text-white"
                          : darkMode
                          ? "bg-dark text-white border"
                          : "bg-light text-dark border"
                      }`}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>
                            {Object.values(gameState.playerNames || {})[1] ||
                              "Player 2"}
                            {Object.keys(gameState.playerNames || {})[1] ===
                              (currentUser?.uid || guestInfo?.id) && " (you)"}
                          </strong>
                          {gameState.currentPlayerId ===
                            Object.keys(gameState.playerNames || {})[1] && (
                            <div className="mt-1">
                              <small className="text-warning">
                                🎯 Current Turn
                              </small>
                            </div>
                          )}
                        </div>
                        <div className="text-end">
                          <span className="badge bg-warning">🟡</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Game Info Card */}
            <div className="card" style={{ border: "1px solid #808080" }}>
              <div className="card-header">
                <h6 className="card-title mb-0">Game Info</h6>
              </div>
              <div className="card-body p-2 p-md-3">
                <div className="row g-2">
                  <div className="col-6">
                    <div
                      className={`text-center p-2 rounded ${
                        darkMode
                          ? "bg-primary bg-opacity-25 text-white"
                          : "bg-primary bg-opacity-15"
                      }`}
                    >
                      <div
                        className={`fw-bold ${
                          darkMode ? "text-info" : "text-primary"
                        }`}
                      >
                        {gameState.gameMode}
                      </div>
                      <small className={darkMode ? "text-light" : "text-muted"}>
                        Mode
                      </small>
                    </div>
                  </div>
                  <div className="col-6">
                    <div
                      className={`text-center p-2 rounded ${
                        darkMode
                          ? "bg-success bg-opacity-25 text-white"
                          : "bg-success bg-opacity-15"
                      }`}
                    >
                      <div
                        className={`fw-bold ${
                          darkMode ? "text-success" : "text-success"
                        }`}
                      >
                        {gameState.moves?.length || 0}
                      </div>
                      <small className={darkMode ? "text-light" : "text-muted"}>
                        Moves
                      </small>
                    </div>
                  </div>
                  <div className="col-12 mt-2">
                    <hr className="my-2" />
                    <div
                      className={`small ${
                        darkMode ? "text-light" : "text-muted"
                      }`}
                    >
                      <div>
                        <strong>Started:</strong>{" "}
                        {new Date(
                          gameState.createdAt?.toDate()
                        ).toLocaleString()}
                      </div>
                      <div>
                        <strong>Last Move:</strong>{" "}
                        {new Date(
                          gameState.lastActivity?.toDate()
                        ).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Special Alerts */}
            {drawOfferReceived && (
              <div
                className="card border-warning"
                style={{ border: "2px solid #ffc107 !important" }}
              >
                <div className="card-header bg-warning text-dark">
                  <h6 className="card-title mb-0">🤝 Draw Offer</h6>
                </div>
                <div className="card-body p-2 p-md-3">
                  <p className="mb-3">Your opponent has offered a draw.</p>
                  <div className="d-grid gap-2">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleDrawResponse(true)}
                    >
                      ✅ Accept Draw
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => handleDrawResponse(false)}
                    >
                      ❌ Decline Draw
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!currentUser && guestInfo && (
              <div
                className="card border-warning"
                style={{ border: "2px solid #ffc107 !important" }}
              >
                <div className="card-header bg-warning text-dark">
                  <h6 className="card-title mb-0">👤 Guest Account</h6>
                </div>
                <div className="card-body p-2 p-md-3">
                  <p className="mb-2">
                    <strong>Playing as:</strong> {guestInfo.username}
                  </p>
                  <p className="small text-muted mb-3">
                    Your game will be lost if you leave this page.
                  </p>
                  <button
                    className="btn btn-outline-warning btn-sm w-100"
                    onClick={() => setShowGuestModal(true)}
                  >
                    📝 Create Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Game Area - Board Only */}
        <div className="col-12 col-md-6 col-lg-7 order-1 order-lg-2">
          <div className="card h-100" style={{ border: "1px solid #808080" }}>
            <div className="card-body p-2 p-md-3 d-flex flex-column align-items-center justify-content-center">
              {/* Game Board */}
              <div className="d-flex justify-content-center">
                <Board
                  board={flattenedTo2D(gameState.board)}
                  onColumnClick={makeMove}
                  disabled={
                    !isMyTurn || gameOver || gameState.status !== "active"
                  }
                  latestMove={lastMove}
                  rows={6}
                  cols={7}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`alert alert-${
            notification.type === "error"
              ? "danger"
              : notification.type === "warning"
              ? "warning"
              : "success"
          } alert-dismissible fade show mb-4`}
          role="alert"
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 1050,
            minWidth: "300px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <div className="d-flex align-items-center">
            {notification.message}
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setNotification(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Invite Friends Modal */}
      {showInviteModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div
              className={`modal-content ${
                darkMode ? "bg-dark text-white" : ""
              }`}
            >
              <div className="modal-header">
                <h5 className="modal-title">
                  {currentInvite ? "Manage Game Invite" : "Invite Friends"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowInviteModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                {currentInvite ? (
                  // Show current invite status and cancel option
                  <div className="text-center">
                    <div className="alert alert-warning">
                      <h6>Invite Sent!</h6>
                      <p className="mb-2">
                        You've invited{" "}
                        <strong>{currentInvite.inviteeName}</strong> to play.
                      </p>
                      <p className="mb-0">
                        <small>
                          They'll receive a notification to join your game.
                        </small>
                      </p>
                    </div>
                    <button
                      className="btn btn-danger"
                      onClick={cancelGameInvite}
                      disabled={cancellingInvite}
                    >
                      {cancellingInvite ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                          ></span>
                          Cancelling...
                        </>
                      ) : (
                        "Cancel Invite"
                      )}
                    </button>
                  </div>
                ) : friends.length > 0 ? (
                  // Show friends list
                  <div>
                    <p className="mb-3">Select a friend to invite:</p>
                    <div className="list-group">
                      {friends.map((friend) => (
                        <button
                          key={friend.uid}
                          className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                          onClick={() => {
                            sendGameInvite(friend.uid, friend.username);
                            setShowInviteModal(false);
                          }}
                          disabled={sendingInvite === friend.uid}
                        >
                          <span>{friend.username}</span>
                          {sendingInvite === friend.uid && (
                            <span
                              className="spinner-border spinner-border-sm"
                              role="status"
                            ></span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Show when no friends available
                  <div className="text-center">
                    <div className="alert alert-info">
                      <h6>No Friends Found</h6>
                      <p className="mb-0">
                        Add friends to invite them directly to your games!
                      </p>
                    </div>
                    <p className="text-muted">
                      <small>
                        You can still share the game link to invite anyone.
                      </small>
                    </p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowInviteModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayOnline;
