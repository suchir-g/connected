// src/components/friends/AddFriend.jsx
import React, { useState } from "react";
import { db } from "../../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";

const AddFriend = ({ targetUsername }) => {
  const [message, setMessage] = useState("");
  const { currentUser, userData } = useAuth();

  const handleAddFriend = async () => {
    if (!targetUsername) {
      setMessage("Username is required.");
      return;
    }

    try {
      const usersRef = collection(db, "players");
      const q = query(
        usersRef,
        where("username", "==", targetUsername.trim().toLowerCase())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setMessage("User not found.");
        return;
      }

      const targetUserDoc = querySnapshot.docs[0];
      const targetUser = targetUserDoc.data();
      const targetUserID = targetUserDoc.id; // This is the document ID used as UID

      console.log("Target User Data:", targetUser);
      console.log("Target User ID:", targetUserID);

      if (targetUserID === currentUser.uid) {
        setMessage("You cannot add yourself as a friend.");
        return;
      }

      const friendsRef = collection(db, "friends");
      const existingQuery = query(
        friendsRef,
        where("user1", "in", [currentUser.uid, targetUserID]),
        where("user2", "in", [currentUser.uid, targetUserID])
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        const existingFriendship = existingSnapshot.docs[0].data();
        console.log("Existing Friendship:", existingFriendship);
        if (existingFriendship.status === "pending") {
          setMessage("Friend request already pending");
        } else if (existingFriendship.status === "accepted") {
          setMessage("You are already friends");
        } else if (existingFriendship.status === "rejected") {
          setMessage("Friend request was rejected");
        }
        return;
      }

      await addDoc(friendsRef, {
        user1: currentUser.uid,
        user2: targetUserID,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMessage("Friend request sent");
    } catch (error) {
      console.error("Error adding friend:", error);
      setMessage("Friend request failed");
    }
  };

  return (
    <div>
      <button onClick={handleAddFriend} className="btn btn-primary">Add Friend</button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default AddFriend;
