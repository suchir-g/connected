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

const FriendsList = () => {
  const { currentUser } = useAuth();
  const [friends, setFriends] = useState([]);
  const [error, setError] = useState("");

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
    <div>
      <h3>My Friends</h3>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {friends.length > 0 ? (
        <ul>
          {friends.map((friend) => (
            <li key={friend.uid}>
              <Link to={`/player/${friend.username}`}>{friend.username}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>You have no friends yet.</p>
      )}
    </div>
  );
};

export default FriendsList;
