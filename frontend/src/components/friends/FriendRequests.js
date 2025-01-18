import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";

const FriendRequests = () => {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");

  const fetchRequests = async () => {
    try {
      const friendsRef = collection(db, "friends");
      const q = query(
        friendsRef,
        where("user2", "==", currentUser.uid),
        where("status", "==", "pending")
      );
      const snapshot = await getDocs(q);
      const incomingRequests = [];

      for (const docSnap of snapshot.docs) {
        const friendDoc = docSnap.data();
        const userDocRef = doc(db, "players", friendDoc.user1);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const requester = userDocSnap.data();
          incomingRequests.push({
            requestId: docSnap.id,
            username: requester.username,
          });
        }
      }

      setRequests(incomingRequests);
    } catch (err) {
      console.error("error fetching friend requests:", err);
      setError("failed to load friend requests.");
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchRequests();
    }
  }, [currentUser]);

  const handleRespond = async (requestId, accept) => {
    try {
      const requestDoc = doc(db, "friends", requestId);
      await updateDoc(requestDoc, {
        status: accept ? "accepted" : "rejected",
        updatedAt: new Date(),
      });
      fetchRequests();
    } catch (err) {
      console.error("Error responding to friend request:", err);
      setError("Failed to respond to the request.");
    }
  };

  return (
    <div>
      <h3>Friend Requests</h3>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {requests.length > 0 ? (
        <ul>
          {requests.map((req) => (
            <li key={req.requestId}>
              {req.username}
              <button onClick={() => handleRespond(req.requestId, true)}>
                Accept
              </button>
              <button onClick={() => handleRespond(req.requestId, false)}>
                Reject
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No incoming friend requests.</p>
      )}
    </div>
  );
};

export default FriendRequests;
