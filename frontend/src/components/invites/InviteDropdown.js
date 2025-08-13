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
  addDoc,
  getDocs,
} from "firebase/firestore";
import styles from "./InviteDropdown.module.css";

const InviteDropdown = () => {
  const { currentUser, userData } = useAuth();
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  const [gameInvites, setGameInvites] = useState([]);

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
      setGameInvites(invites);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const acceptInvite = async (inviteId, gameId) => {
    if (!currentUser || !userData) return;

    try {
      console.log("🎮 Accepting invite:", {
        inviteId,
        gameId,
        currentUser: currentUser.uid,
      });

      // First, get the invite details to know who sent it
      const inviteQuery = query(
        collection(db, "game-invites"),
        where("inviteeId", "==", currentUser.uid),
        where("status", "==", "pending")
      );

      const inviteSnapshot = await getDocs(inviteQuery);
      let inviterUserId = null;
      let inviterName = null;

      inviteSnapshot.docs.forEach((doc) => {
        if (doc.id === inviteId) {
          const inviteData = doc.data();
          inviterUserId = inviteData.inviterId;
          inviterName = inviteData.inviterName;
        }
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

      console.log("Game updated successfully");

      // Send a notification to the inviter
      if (inviterUserId) {
        await addDoc(collection(db, "notifications"), {
          recipientId: inviterUserId,
          type: "invite_accepted",
          message: `${userData.username} accepted your game invite!`,
          gameId: gameId,
          fromUserId: currentUser.uid,
          fromUserName: userData.username,
          createdAt: serverTimestamp(),
          read: false,
        });
        console.log("📬 Notification sent to inviter");
      }

      // Delete the invite
      await deleteDoc(doc(db, "game-invites", inviteId));

      console.log("Invite deleted");

      // Show success message
      alert("Invite accepted! Joining game...");

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

  if (!currentUser) return null;

  return (
    <li className="nav-item dropdown">
      <span
        className={`nav-link dropdown-toggle position-relative ${styles.navLink}`}
        id="invitesDropdown"
        role="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        style={{ cursor: "pointer" }}
      >
        <i className="bi bi-bell fs-5"></i>
        {gameInvites.length > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
            {gameInvites.length}
            <span className="visually-hidden">game invites</span>
          </span>
        )}
      </span>
      <ul
        className={`dropdown-menu dropdown-menu-end ${
          darkMode ? "dropdown-menu-dark" : ""
        } ${styles.dropdownMenu}`}
        aria-labelledby="invitesDropdown"
        style={{ minWidth: "320px" }}
      >
        <li>
          <h6
            className="dropdown-header"
            style={{ color: darkMode ? "#fff" : "#000" }}
          >
            <i className="bi bi-controller me-2"></i>
            Game Invites
          </h6>
        </li>
        {gameInvites.length === 0 ? (
          <li>
            <span
              className="dropdown-item-text"
              style={{ color: darkMode ? "#adb5bd" : "#6c757d" }}
            >
              No pending invites
            </span>
          </li>
        ) : (
          gameInvites.map((invite) => (
            <li key={invite.id} className={styles.inviteItem}>
              <div
                className="dropdown-item-text"
                style={{ color: darkMode ? "#fff" : "#000" }}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="flex-grow-1">
                    <div
                      className="fw-semibold"
                      style={{ color: darkMode ? "#fff" : "#000" }}
                    >
                      {invite.inviterName}
                    </div>
                    <small style={{ color: darkMode ? "#adb5bd" : "#6c757d" }}>
                      wants to play Connect 4
                    </small>
                    <br />
                    <small style={{ color: darkMode ? "#adb5bd" : "#6c757d" }}>
                      {new Date(invite.createdAt?.toDate()).toLocaleString()}
                    </small>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-success btn-sm flex-fill"
                    onClick={() => acceptInvite(invite.id, invite.gameId)}
                  >
                    Accept
                  </button>
                  <button
                    className={`btn btn-sm flex-fill ${
                      darkMode ? "btn-outline-light" : "btn-outline-secondary"
                    }`}
                    onClick={() => rejectInvite(invite.id)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            </li>
          ))
        )}
        {gameInvites.length > 0 && (
          <>
            <li>
              <hr className="dropdown-divider" />
            </li>
            <li>
              <button
                className="dropdown-item text-center"
                style={{ color: darkMode ? "#fff" : "#000" }}
                onClick={() => navigate("/play/online")}
              >
                View All in Game Lobby
              </button>
            </li>
          </>
        )}
      </ul>
    </li>
  );
};

export default InviteDropdown;
