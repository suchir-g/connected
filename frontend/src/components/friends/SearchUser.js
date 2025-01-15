import React, { useState, useEffect } from "react";
import { db } from "../../config/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const lev = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (a[0] === b[0]) return lev(a.slice(1), b.slice(1));
  return (
    1 +
    Math.min(
      lev(a.slice(1), b),
      lev(a, b.slice(1)),
      lev(a.slice(1), b.slice(1))
    )
  );
};

const SearchUser = () => {
  const { currentUser } = useAuth();
  const [username, setUsername] = useState("");
  const [results, setResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
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
        setError("Failed to load friends list.");
      }
    };

    fetchFriends();
  }, [currentUser]);

  const handleSearch = async () => {
    if (!username.trim()) {
      setError("Please enter a username.");
      return;
    }

    try {
      const usersRef = collection(db, "players");
      const querySnapshot = await getDocs(usersRef);
      const users = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const filteredUsers = users
        .filter(
          (user) =>
            lev(user.username.toLowerCase(), username.trim().toLowerCase()) <= 3
        )
        .sort(
          (a, b) =>
            lev(a.username.toLowerCase(), username.trim().toLowerCase()) -
            lev(b.username.toLowerCase(), username.trim().toLowerCase())
        );

      const prioritizedResults = filteredUsers.sort((a, b) => {
        const isAFriend = friends.some((friend) => friend.uid === a.id);
        const isBFriend = friends.some((friend) => friend.uid === b.id);
        if (isAFriend && !isBFriend) return -1;
        if (!isAFriend && isBFriend) return 1;
        return 0;
      });

      if (prioritizedResults.length === 0) {
        setResults([]);
        setError("No users found.");
      } else {
        setResults(prioritizedResults);
        setError("");
      }
    } catch (err) {
      console.error("Error searching users:", err);
      setError("Failed to search users. Please try again.");
    }
  };

  return (
    <div>
      <h3>Search Users</h3>
      <input
        type="text"
        placeholder="Enter username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <button onClick={handleSearch}>Search</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <ul>
        {results.map((user) => (
          <li key={user.id}>
            <Link to={`/player/${user.username}`}>
              {user.username}
              {friends.some((friend) => friend.uid === user.id) && (
                <span style={{ marginLeft: "8px", color: "green" }}>
                  Friend
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchUser;
