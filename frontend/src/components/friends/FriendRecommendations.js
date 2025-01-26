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
import { Link } from "react-router-dom";

const FriendRecommendations = () => {
  const { currentUser } = useAuth();
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    const fetchRecommendations = async () => {
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

        for (let i = 0; i < filteredFriendsData.length - 1; i++) {
          for (let j = 0; j < filteredFriendsData.length - i - 1; j++) {
            if (
              filteredFriendsData[j].mutualFriends <
              filteredFriendsData[j + 1].mutualFriends
            ) {
              const temp = filteredFriendsData[j];
              filteredFriendsData[j] = filteredFriendsData[j + 1];
              filteredFriendsData[j + 1] = temp;
            }
          }
        }

        setRecommendations(filteredFriendsData.slice(0, 5)); // limit to top 5 recommendations
      } catch (err) {
        console.error("Error fetching friend recommendations:", err);
      }
    };

    fetchRecommendations();
  }, [currentUser]);

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Friend Recommendations</h2>
      <div className="row">
        {recommendations.map((recommendation, index) => (
          <div key={index} className="col-12 mb-3">
            <div className="card w-100 border-secondary">
              <div className="card-body d-flex flex-column">
                <h5 className="card-title">{recommendation.username}</h5>
                <p className="card-text">{recommendation.bio}</p>
                <Link
                  to={`/player/${recommendation.username}`}
                  className="btn btn-primary mt-auto"
                >
                  View Profile
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FriendRecommendations;
