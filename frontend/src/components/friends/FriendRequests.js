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
import { useTheme } from "../../contexts/ThemeContext";
import "./Friends.css";

const FriendRequests = () => {
  const { currentUser } = useAuth();
  const { darkMode } = useTheme();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingRequest, setProcessingRequest] = useState(null);

  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fetchRequests = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const q = query(
        collection(db, "friends"),
        where("to.uid", "==", currentUser.uid),
        where("status", "==", "pending")
      );
      const querySnapshot = await getDocs(q);
      const incomingRequests = [];

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const requesterId = data.from.uid;
        const requesterDoc = await getDoc(doc(db, "users", requesterId));

        if (requesterDoc.exists()) {
          const requester = requesterDoc.data();
          incomingRequests.push({
            id: docSnap.id,
            from: data.from,
            createdAt: data.createdAt,
            requestId: docSnap.id,
            username: requester.username,
          });
        }
      }

      setRequests(incomingRequests);
    } catch (err) {
      console.error("error fetching friend requests:", err);
      setError("failed to load friend requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchRequests();
    }
  }, [currentUser]);

  const handleRespond = async (requestId, accept) => {
    setProcessingRequest(requestId);
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
    } finally {
      setProcessingRequest(null);
    }
  };

  return (
    <div className={`friend-requests-container ${darkMode ? "dark" : ""}`}>
      <div className="friend-requests-header">
        <h4 className="mb-3 text-center">
          <i className="fa fa-user-plus me-2"></i>
          Friend Requests
        </h4>
        {error && <div className="alert alert-danger text-center">{error}</div>}
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state text-center py-5">
          <i className="fa fa-inbox display-4 text-muted mb-3"></i>
          <p className="text-muted mb-0">No pending friend requests</p>
          <small className="text-muted">New requests will appear here</small>
        </div>
      ) : (
        <div className="friend-requests-list">
          {requests.map((request) => (
            <div key={request.id} className="friend-request-card mb-3">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="user-info d-flex align-items-center">
                    <div className="user-avatar me-3">
                      <i className="fa fa-user-circle display-6 text-primary"></i>
                    </div>
                    <div>
                      <h6 className="mb-1 fw-bold">{request.from.email}</h6>
                      <small className="text-muted">
                        <i className="fa fa-clock me-1"></i>
                        {request.createdAt &&
                          formatDate(request.createdAt.toDate())}
                      </small>
                    </div>
                  </div>

                  <div className="action-buttons">
                    <button
                      className="btn btn-success btn-sm me-2"
                      onClick={() => handleRespond(request.id, true)}
                      disabled={processingRequest === request.id}
                    >
                      {processingRequest === request.id ? (
                        <span
                          className="spinner-border spinner-border-sm me-1"
                          role="status"
                        ></span>
                      ) : (
                        <i className="fa fa-check me-1"></i>
                      )}
                      Accept
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRespond(request.id, false)}
                      disabled={processingRequest === request.id}
                    >
                      {processingRequest === request.id ? (
                        <span
                          className="spinner-border spinner-border-sm me-1"
                          role="status"
                        ></span>
                      ) : (
                        <i className="fa fa-times me-1"></i>
                      )}
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FriendRequests;
