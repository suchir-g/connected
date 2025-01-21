import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

const FriendsList = () => {
  const { currentUser } = useAuth();
  const [friends, setFriends] = useState([]);
  const [error, setError] = useState("");

  const darkMode = useTheme().darkMode;

  const fetchFriends = async () => {
    try {
      const friendsRef = collection(db, "friends");
      const q = query(
        friendsRef,
        where("status", "==", "accepted"),
        where("user1", "==", currentUser.uid)
      );
      const q2 = query(
        friendsRef,
        where("status", "==", "accepted"),
        where("user2", "==", currentUser.uid)
      );

      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q),
        getDocs(q2),
      ]);
      const friendIds = new Set();

      snapshot1.forEach((doc) => {
        friendIds.add(doc.data().user2);
      });

      snapshot2.forEach((doc) => {
        friendIds.add(doc.data().user1);
      });

      const friendsData = await Promise.all(
        [...friendIds].map(async (id) => {
          const friendDocRef = doc(db, "players", id);
          const friendDoc = await getDoc(friendDocRef);
          return friendDoc.exists() ? { uid: id, ...friendDoc.data() } : null;
        })
      );

      setFriends(friendsData.filter(Boolean)); // filter out any nulls from missing docs
    } catch (err) {
      console.error("Error fetching friends:", err);
      setError("Failed to load friends list.");
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchFriends();
    }
  }, [currentUser]);

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Friends List</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {friends.length > 0 ? (
        <ul className="list-group">
          {friends.map((friend, index) => (
            <li
              key={index}
              className="list-group-item border-secondary d-flex justify-content-between align-items-center"
            >
              <span>{friend.username}</span>
              <Link
                to={`/player/${friend.username}`}
                className="btn btn-primary btn-sm"
              >
                View Profile
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">You have no friends yet.</p>
      )}
    </div>
  );
};

export default FriendsList;
