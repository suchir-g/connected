import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import AddFriend from "./AddFriend";

function InviteFriendsDropdown({ onInvite }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { currentUser } = useAuth();
  const { darkMode } = useTheme();

  useEffect(() => {
    const fetchFriends = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setError("");

        const friendsRef = collection(db, "friends");
        const q = query(
          friendsRef,
          where("users", "array-contains", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);

        const friendsList = [];

        for (const docSnap of querySnapshot.docs) {
          const friendData = docSnap.data();
          const friendId = friendData.users.find(
            (id) => id !== currentUser.uid
          );

          if (friendId) {
            const userDoc = await getDoc(doc(db, "users", friendId));
            if (userDoc.exists()) {
              friendsList.push({
                id: friendId,
                ...userDoc.data(),
              });
            }
          }
        }

        setFriends(friendsList);
      } catch (err) {
        console.error("Error fetching friends:", err);
        setError("Failed to load friends");
      }

      setLoading(false);
    };

    fetchFriends();
  }, [currentUser]);

  const handleInvite = (friendId) => {
    if (onInvite) {
      onInvite(friendId);
    }
  };

  return (
    <div className="dropdown">
      <button
        className="btn btn-outline-primary dropdown-toggle"
        type="button"
        data-bs-toggle="dropdown"
        disabled={loading}
      >
        {loading ? "Loading..." : "Invite Friends"}
      </button>

      <ul className={`dropdown-menu ${darkMode ? "dropdown-menu-dark" : ""}`}>
        {error && (
          <li>
            <span className="dropdown-item-text text-danger small">
              {error}
            </span>
          </li>
        )}

        {friends.length === 0 ? (
          <li>
            <span className="dropdown-item-text text-muted">
              No friends to invite
            </span>
          </li>
        ) : (
          friends.map((friend) => (
            <li key={friend.id}>
              <button
                className="dropdown-item d-flex justify-content-between align-items-center"
                onClick={() => handleInvite(friend.id)}
              >
                <span>{friend.displayName || "Unknown User"}</span>
                <small className="text-muted">Invite</small>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export default InviteFriendsDropdown;
