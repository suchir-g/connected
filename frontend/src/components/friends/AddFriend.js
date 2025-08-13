import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";

function AddFriend({ targetUsername, targetUserId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [friendshipStatus, setFriendshipStatus] = useState("unknown"); // unknown, friends, pending, none
  const [checkingStatus, setCheckingStatus] = useState(true);
  const { currentUser, userData } = useAuth();

  // Check friendship status on component mount
  useEffect(() => {
    const checkFriendshipStatus = async () => {
      if (!currentUser || (!targetUsername && !targetUserId)) {
        setCheckingStatus(false);
        return;
      }

      try {
        let userId = targetUserId;

        // Get target user ID if we only have username
        if (targetUsername && !targetUserId) {
          const usersRef = collection(db, "players");
          const q = query(
            usersRef,
            where("username", "==", targetUsername.toLowerCase())
          );
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            setFriendshipStatus("none");
            setCheckingStatus(false);
            return;
          }

          userId = querySnapshot.docs[0].id;
        }

        // Check if already friends (accepted relationship)
        const friendsRef = collection(db, "friends");

        // Check both directions for accepted friendship
        const q1 = query(
          friendsRef,
          where("status", "==", "accepted"),
          where("user1", "==", currentUser.uid),
          where("user2", "==", userId)
        );
        const q2 = query(
          friendsRef,
          where("status", "==", "accepted"),
          where("user1", "==", userId),
          where("user2", "==", currentUser.uid)
        );

        const [snapshot1, snapshot2] = await Promise.all([
          getDocs(q1),
          getDocs(q2),
        ]);

        if (!snapshot1.empty || !snapshot2.empty) {
          setFriendshipStatus("friends");
          setCheckingStatus(false);
          return;
        }

        // Check for pending friend request (either direction)
        const q3 = query(
          friendsRef,
          where("status", "==", "pending"),
          where("from.uid", "==", currentUser.uid),
          where("to.uid", "==", userId)
        );
        const q4 = query(
          friendsRef,
          where("status", "==", "pending"),
          where("from.uid", "==", userId),
          where("to.uid", "==", currentUser.uid)
        );

        const [snapshot3, snapshot4] = await Promise.all([
          getDocs(q3),
          getDocs(q4),
        ]);

        if (!snapshot3.empty) {
          setFriendshipStatus("pending_sent");
        } else if (!snapshot4.empty) {
          setFriendshipStatus("pending_received");
        } else {
          setFriendshipStatus("none");
        }
      } catch (err) {
        console.error("Error checking friendship status:", err);
        setFriendshipStatus("none");
      }

      setCheckingStatus(false);
    };

    checkFriendshipStatus();
  }, [currentUser, targetUsername, targetUserId]);

  const sendFriendRequest = async () => {
    if (!currentUser) {
      setError("You must be logged in to send friend requests");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let userId = targetUserId;

      // If we have username but not userId, find the userId
      if (targetUsername && !targetUserId) {
        const usersRef = collection(db, "players");
        const q = query(
          usersRef,
          where("username", "==", targetUsername.toLowerCase())
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setError("User not found");
          setLoading(false);
          return;
        }

        userId = querySnapshot.docs[0].id;
      }

      if (!userId) {
        setError("Invalid user");
        setLoading(false);
        return;
      }

      await addDoc(collection(db, "friends"), {
        from: {
          uid: currentUser.uid,
          username: userData?.username || currentUser.email,
          displayName:
            userData?.displayName || userData?.username || currentUser.email,
        },
        to: {
          uid: userId,
          username: targetUsername,
          displayName: targetUsername, // We can enhance this later to get actual display name
        },
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setFriendshipStatus("pending_sent");
      alert("Friend request sent!");
    } catch (err) {
      console.error("Error sending friend request:", err);
      setError("Failed to send friend request");
    }

    setLoading(false);
  };

  // Don't show anything if we're checking status or if it's the current user
  if (checkingStatus) {
    return (
      <div className="text-center">
        <div className="spinner-border spinner-border-sm" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Render different UI based on friendship status
  const renderButton = () => {
    switch (friendshipStatus) {
      case "friends":
        return (
          <button className="btn btn-sm btn-outline-success" disabled>
            <i className="fas fa-check me-1"></i>
            Friends
          </button>
        );

      case "pending_sent":
        return (
          <button className="btn btn-sm btn-outline-warning" disabled>
            <i className="fas fa-clock me-1"></i>
            Request Sent
          </button>
        );

      case "pending_received":
        return (
          <button className="btn btn-sm btn-outline-info" disabled>
            <i className="fas fa-envelope me-1"></i>
            Request Received
          </button>
        );

      case "none":
      default:
        return (
          <button
            className="btn btn-sm btn-success"
            onClick={sendFriendRequest}
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-1"
                  role="status"
                  aria-hidden="true"
                ></span>
                Sending...
              </>
            ) : (
              <>
                <i className="fas fa-user-plus me-1"></i>
                Add Friend
              </>
            )}
          </button>
        );
    }
  };

  return (
    <div className="d-flex flex-column align-items-center w-100">
      {error && (
        <div className="alert alert-danger w-100 mb-2" role="alert">
          {error}
        </div>
      )}

      {renderButton()}
    </div>
  );
}

export default AddFriend;
