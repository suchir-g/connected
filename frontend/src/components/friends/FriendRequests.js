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

  const handleAccept = async (requestId) => {
    await handleRespond(requestId, true);
  };

  const handleReject = async (requestId) => {
    await handleRespond(requestId, false);
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Friend Requests</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="row">
        {requests.map((request, index) => (
          <div key={index} className="col-12 mb-3">
            <div className="card w-100 border-secondary">
              <div className="card-body d-flex flex-column">
                <h5 className="card-title">{request.username}</h5>
                <p className="card-text">{request.bio}</p>
                <div className="mt-auto d-flex justify-content-between">
                  <button
                    className="btn btn-success"
                    onClick={() => handleAccept(request.requestId)}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleReject(request.requestId)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FriendRequests;
