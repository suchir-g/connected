import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { db } from "../../config/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import styles from "./InviteNotifications.module.css";

const InviteNotifications = () => {
  const { currentUser, userData } = useAuth();
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  const [gameInvites, setGameInvites] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [latestInvite, setLatestInvite] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) return;

    // Listen for game invites
    const invitesQuery = query(
      collection(db, "game-invites"),
      where("inviteeId", "==", currentUser.uid),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(invitesQuery, (snapshot) => {
      const invites = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Check for new invites
      if (invites.length > gameInvites.length && invites.length > 0) {
        const newInvite = invites[invites.length - 1];
        setLatestInvite(newInvite);
        setShowPopup(true);

        // Auto-hide popup after 10 seconds
        setTimeout(() => {
          setShowPopup(false);
        }, 10000);
      }

      setGameInvites(invites);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, gameInvites.length]);

  const acceptInvite = async (inviteId, gameId) => {
    if (!currentUser || !userData) return;

    try {
      console.log("🎮 Accepting invite from popup:", {
        inviteId,
        gameId,
        currentUser: currentUser.uid,
      });

      // Update the game to add this player
      const gameRef = doc(db, "live-games", gameId);
      await updateDoc(gameRef, {
        players: arrayUnion(currentUser.uid), // Properly add to existing array
        [`playerNames.${currentUser.uid}`]: userData.username,
        [`playerColors.${currentUser.uid}`]: "yellow",
        status: "active",
        lastActivity: serverTimestamp(),
        // Add a flag to indicate invite was just accepted
        inviteAcceptedAt: serverTimestamp(),
        inviteAcceptedBy: currentUser.uid,
      });

      console.log("Game updated successfully from popup");

      // Delete the invite
      await deleteDoc(doc(db, "game-invites", inviteId));

      console.log("Invite deleted from popup");

      navigate(`/play/online/${gameId}`);
    } catch (error) {
      console.error("Error accepting invite:", error);
      alert("Failed to join game. Please try again.");
    }
  };

  const rejectInvite = async (inviteId) => {
    try {
      await deleteDoc(doc(db, "game-invites", inviteId));
    } catch (error) {
      console.error("Error rejecting invite:", error);
    }
  };

  const dismissPopup = () => {
    setShowPopup(false);
  };

  if (!currentUser) return null;

  return (
    <>
      {/* Popup Notification */}
      {showPopup && latestInvite && (
        <div
          className={`${styles.invitePopup} ${
            darkMode ? styles.dark : styles.light
          }`}
        >
          <div className={styles.popupContent}>
            <button
              className={styles.closeButton}
              onClick={dismissPopup}
              aria-label="Close notification"
            >
              ×
            </button>
            <div className={styles.popupHeader}>
              <i className="bi bi-controller fs-4 text-primary"></i>
              <h5 className="mb-0">Game Invite!</h5>
            </div>
            <p className="mb-2">
              <strong>{latestInvite.inviterName}</strong> has invited you to
              play Connect 4!
            </p>
            <div className={styles.popupActions}>
              <button
                className="btn btn-success btn-sm me-2"
                onClick={() => {
                  acceptInvite(latestInvite.id, latestInvite.gameId);
                  dismissPopup();
                }}
              >
                Accept
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  rejectInvite(latestInvite.id);
                  dismissPopup();
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar Badge */}
      {gameInvites.length > 0 && (
        <div className={styles.inviteBadge}>
          <span className="badge bg-danger">{gameInvites.length}</span>
        </div>
      )}
    </>
  );
};

export default InviteNotifications;
