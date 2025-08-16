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
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Link } from "react-router-dom";
import "./Friends.css";

const FriendRecommendations = () => {
  const { currentUser } = useAuth();
  const { darkMode } = useTheme();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!currentUser) return;

      setLoading(true);
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

        const mutualFriendsCount = {};
        const friendsOfFriends = new Set();

        for (let friendId of friendIds) {
          const friendFriendsRef = collection(db, "friends");
          const q3 = query(
            friendFriendsRef,
            where("user1", "==", friendId),
            where("status", "==", "accepted")
          );
          const q4 = query(
            friendFriendsRef,
            where("user2", "==", friendId),
            where("status", "==", "accepted")
          );

          const [snapshot3, snapshot4] = await Promise.all([
            getDocs(q3),
            getDocs(q4),
          ]);

          snapshot3.forEach((doc) => {
            const friendOfFriendId = doc.data().user2;
            if (
              friendOfFriendId !== currentUser.uid &&
              !friendIds.has(friendOfFriendId)
            ) {
              friendsOfFriends.add(friendOfFriendId);
              mutualFriendsCount[friendOfFriendId] =
                (mutualFriendsCount[friendOfFriendId] || 0) + 1;
            }
          });

          snapshot4.forEach((doc) => {
            const friendOfFriendId = doc.data().user1;
            if (
              friendOfFriendId !== currentUser.uid &&
              !friendIds.has(friendOfFriendId)
            ) {
              friendsOfFriends.add(friendOfFriendId);
              mutualFriendsCount[friendOfFriendId] =
                (mutualFriendsCount[friendOfFriendId] || 0) + 1;
            }
          });
        }

        const friendsData = await Promise.all(
          Array.from(friendsOfFriends).map(async (id) => {
            const friendDocRef = doc(db, "players", id);
            const friendDoc = await getDoc(friendDocRef);
            return friendDoc.exists()
              ? {
                  uid: id,
                  ...friendDoc.data(),
                  mutualFriends: mutualFriendsCount[id],
                }
              : null;
          })
        );

        const filteredFriendsData = friendsData.filter(Boolean);
        filteredFriendsData.sort((a, b) => b.mutualFriends - a.mutualFriends);

        setRecommendations(filteredFriendsData.slice(0, 5));
      } catch (err) {
        console.error("Error fetching friend recommendations:", err);
        setError("Failed to load friend recommendations.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [currentUser]);

  return (
    <div
      className={`friend-recommendations-container ${darkMode ? "dark" : ""}`}
    >
      <div className="friend-recommendations-header">
        <h4 className="mb-3 text-center">
          <i className="fa fa-users me-2"></i>
          Suggested Friends
        </h4>
        {error && <div className="alert alert-danger text-center">{error}</div>}
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="empty-state text-center py-5">
          <i className="fa fa-user-friends display-4 text-muted mb-3"></i>
          <p className="text-muted mb-0">No friend suggestions at the moment</p>
          <small className="text-muted">
            Check back later for new recommendations
          </small>
        </div>
      ) : (
        <div className="recommendations-list">
          {recommendations.map((recommendation) => (
            <div key={recommendation.uid} className="recommendation-card mb-3">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="user-info d-flex align-items-center">
                    <div className="user-avatar me-3">
                      <i className="fa fa-user-circle display-6 text-info"></i>
                    </div>
                    <div>
                      <h6 className="mb-1 fw-bold">
                        {recommendation.username}
                      </h6>
                      <small className="text-muted">
                        <i className="fa fa-users me-1"></i>
                        {recommendation.mutualFriends} mutual friend
                        {recommendation.mutualFriends !== 1 ? "s" : ""}
                      </small>
                      {recommendation.bio && (
                        <p className="mb-0 mt-1 text-muted small">
                          {recommendation.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="action-buttons">
                    <Link
                      to={`/player/${recommendation.username}`}
                      className="btn btn-primary btn-sm"
                    >
                      <i className="fa fa-eye me-1"></i>
                      View Profile
                    </Link>
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

export default FriendRecommendations;
