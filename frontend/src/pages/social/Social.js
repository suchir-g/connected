import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

function Social() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendingInvite, setSendingInvite] = useState(null);
  const [mutualFriendsCount, setMutualFriendsCount] = useState({});
  const { currentUser, userData } = useAuth();
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  // Load friends on component mount
  useEffect(() => {
    if (currentUser) {
      fetchFriends();
      fetchFriendRequests();
    }
  }, [currentUser]);

  // Fetch recommendations after friends are loaded
  useEffect(() => {
    if (currentUser && !friendsLoading) {
      fetchRecommendations();
    }
  }, [currentUser, friends, friendsLoading]);

  // Auto-search as user types with debounce
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm.trim()) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delayedSearch);
  }, [searchTerm, currentUser]);

  const fetchFriends = async () => {
    if (!currentUser) return;

    setFriendsLoading(true);
    try {
      const friendsRef = collection(db, "friends");
      const q1 = query(
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
        getDocs(q1),
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

      setFriends(friendsData.filter(Boolean));
    } catch (err) {
      console.error("Error fetching friends:", err);
    }
    setFriendsLoading(false);
  };

  const fetchFriendRequests = async () => {
    if (!currentUser) return;

    setRequestsLoading(true);
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
        const requesterDoc = await getDoc(doc(db, "players", requesterId));

        if (requesterDoc.exists()) {
          const requester = requesterDoc.data();
          incomingRequests.push({
            id: docSnap.id,
            from: data.from,
            createdAt: data.createdAt,
            requestId: docSnap.id,
            username: requester.username,
            displayName: requester.displayName || requester.username,
            email: requester.email,
          });
        }
      }

      setFriendRequests(incomingRequests);
    } catch (err) {
      console.error("Error fetching friend requests:", err);
    }
    setRequestsLoading(false);
  };

  const fetchRecommendations = async () => {
    if (!currentUser) return;

    setRecommendationsLoading(true);
    try {
      // Get all friends first
      if (friends.length === 0) {
        setRecommendations([]);
        setRecommendationsLoading(false);
        return;
      }

      // BFS to find friends of friends
      const friendOfFriendsMap = new Map(); // userId -> count of mutual connections
      const visitedUsers = new Set([currentUser.uid]);
      const myFriendIds = new Set(friends.map((friend) => friend.uid));

      // Add my direct friends to visited to exclude them from recommendations
      myFriendIds.forEach((friendId) => visitedUsers.add(friendId));

      // For each of my friends, get their friends (BFS level 2)
      for (const friend of friends) {
        try {
          const friendsRef = collection(db, "friends");

          // Get friend's friends where they are user1
          const q1 = query(
            friendsRef,
            where("status", "==", "accepted"),
            where("user1", "==", friend.uid)
          );

          // Get friend's friends where they are user2
          const q2 = query(
            friendsRef,
            where("status", "==", "accepted"),
            where("user2", "==", friend.uid)
          );

          const [snapshot1, snapshot2] = await Promise.all([
            getDocs(q1),
            getDocs(q2),
          ]);

          const friendsFriends = new Set();

          snapshot1.forEach((doc) => {
            const friendOfFriendId = doc.data().user2;
            if (!visitedUsers.has(friendOfFriendId)) {
              friendsFriends.add(friendOfFriendId);
            }
          });

          snapshot2.forEach((doc) => {
            const friendOfFriendId = doc.data().user1;
            if (!visitedUsers.has(friendOfFriendId)) {
              friendsFriends.add(friendOfFriendId);
            }
          });

          // Count mutual connections for each friend of friend
          friendsFriends.forEach((friendOfFriendId) => {
            const currentCount = friendOfFriendsMap.get(friendOfFriendId) || 0;
            friendOfFriendsMap.set(friendOfFriendId, currentCount + 1);
          });
        } catch (error) {
          console.error(`Error fetching friends for ${friend.uid}:`, error);
        }
      }

      // Convert map to array and sort by mutual connection count (descending)
      const recommendations = Array.from(friendOfFriendsMap.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by mutual connection count
        .slice(0, 8); // Get top 8 recommendations

      // Fetch user data for recommendations
      const recommendationsData = await Promise.all(
        recommendations.map(async ([userId, mutualCount]) => {
          try {
            const userDoc = await getDoc(doc(db, "players", userId));
            if (userDoc.exists()) {
              return {
                uid: userId,
                mutualConnections: mutualCount,
                ...userDoc.data(),
              };
            }
            return null;
          } catch (error) {
            console.error(`Error fetching user data for ${userId}:`, error);
            return null;
          }
        })
      );

      const validRecommendations = recommendationsData
        .filter(Boolean)
        .slice(0, 5);
      setRecommendations(validRecommendations);

      // Set mutual friends count (using the BFS calculated mutual connections)
      const mutualCounts = {};
      validRecommendations.forEach((user) => {
        mutualCounts[user.uid] = user.mutualConnections;
      });
      setMutualFriendsCount(mutualCounts);
    } catch (err) {
      console.error("Error fetching friend recommendations:", err);
    }
    setRecommendationsLoading(false);
  };

  const searchUsers = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const usersRef = collection(db, "players");
      const querySnapshot = await getDocs(usersRef);

      const users = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (doc.id !== currentUser?.uid) {
          const username = userData.username || "";
          const displayName = userData.displayName || "";

          if (
            username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            displayName.toLowerCase().includes(searchTerm.toLowerCase())
          ) {
            users.push({ id: doc.id, uid: doc.id, ...userData });
          }
        }
      });

      setSearchResults(users);
    } catch (err) {
      console.error("Error searching users:", err);
      setError("Failed to search users");
    }

    setLoading(false);
  };

  const sendFriendRequest = async (targetUserId, targetUserData) => {
    try {
      // Check if request already exists
      const existingQuery = query(
        collection(db, "friends"),
        where("from.uid", "==", currentUser.uid),
        where("to.uid", "==", targetUserId),
        where("status", "==", "pending")
      );
      const existing = await getDocs(existingQuery);

      if (!existing.empty) {
        alert("Friend request already sent!");
        return;
      }

      await addDoc(collection(db, "friends"), {
        from: {
          uid: currentUser.uid,
          username: userData?.username || currentUser.email,
          displayName:
            userData?.displayName || userData?.username || currentUser.email,
        },
        to: {
          uid: targetUserId,
          username: targetUserData.username || targetUserData.email,
          displayName:
            targetUserData.displayName ||
            targetUserData.username ||
            targetUserData.email,
        },
        status: "pending",
        createdAt: serverTimestamp(),
      });

      alert("Friend request sent!");
      setSearchResults(
        searchResults.filter((user) => user.uid !== targetUserId)
      );
      setRecommendations(
        recommendations.filter((user) => user.uid !== targetUserId)
      );
    } catch (err) {
      console.error("Error sending friend request:", err);
      setError("Failed to send friend request");
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      // Get the original request data
      const requestDoc = doc(db, "friends", requestId);
      const requestSnapshot = await getDoc(requestDoc);

      if (!requestSnapshot.exists()) {
        alert("Friend request not found.");
        return;
      }

      const requestData = requestSnapshot.data();

      // Delete the old request document
      await deleteDoc(requestDoc);

      // Create a new friend relationship with the correct structure
      await addDoc(collection(db, "friends"), {
        user1: requestData.from.uid,
        user2: requestData.to.uid,
        status: "accepted",
        createdAt: serverTimestamp(),
        acceptedAt: serverTimestamp(),
        // Keep original request data for reference
        originalRequest: {
          from: requestData.from,
          to: requestData.to,
          requestedAt: requestData.createdAt,
        },
      });

      // Update local state
      setFriendRequests(friendRequests.filter((req) => req.id !== requestId));

      // Refresh friends list
      fetchFriends();

      alert("Friend request accepted!");
    } catch (err) {
      console.error("Error accepting friend request:", err);
      alert("Failed to accept friend request. Please try again.");
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      // Simply delete the request document - no need to keep rejected requests
      const requestDoc = doc(db, "friends", requestId);
      await deleteDoc(requestDoc);

      setFriendRequests(friendRequests.filter((req) => req.id !== requestId));

      alert("Friend request rejected.");
    } catch (err) {
      console.error("Error rejecting friend request:", err);
      alert("Failed to reject friend request. Please try again.");
    }
  };

  const sendGameInvite = async (friendId, friendUsername) => {
    if (!currentUser || !userData) return;

    setSendingInvite(friendId);
    try {
      // Create a new game
      const gameDoc = await addDoc(collection(db, "live-games"), {
        players: [currentUser.uid],
        playerNames: { [currentUser.uid]: userData.username },
        playerColors: { [currentUser.uid]: "red" },
        board: Array(42).fill(0),
        currentPlayer: "red",
        currentPlayerId: currentUser.uid,
        status: "waiting",
        gameMode: "standard",
        isPrivate: true, // Private game for invited friend
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
      });

      // Send the invite
      await addDoc(collection(db, "game-invites"), {
        inviterId: currentUser.uid,
        inviterName: userData.username,
        inviteeId: friendId,
        inviteeName: friendUsername,
        gameId: gameDoc.id,
        gameMode: "standard",
        status: "pending",
        createdAt: serverTimestamp(),
      });

      alert(`Game invite sent to ${friendUsername}!`);
    } catch (error) {
      console.error("Error sending game invite:", error);
      alert("Failed to send game invite. Please try again.");
    } finally {
      setSendingInvite(null);
    }
  };

  // Function to calculate mutual friends count
  const getMutualFriendsCount = async (userId) => {
    if (!currentUser || friends.length === 0) return 0;

    try {
      const friendsRef = collection(db, "friends");

      // Get user's friends where they are user1
      const q1 = query(
        friendsRef,
        where("status", "==", "accepted"),
        where("user1", "==", userId)
      );

      // Get user's friends where they are user2
      const q2 = query(
        friendsRef,
        where("status", "==", "accepted"),
        where("user2", "==", userId)
      );

      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2),
      ]);

      const userFriendIds = new Set();

      snapshot1.forEach((doc) => {
        userFriendIds.add(doc.data().user2);
      });

      snapshot2.forEach((doc) => {
        userFriendIds.add(doc.data().user1);
      });

      // Count mutual friends
      const myFriendIds = new Set(friends.map((friend) => friend.uid));
      const mutualCount = [...userFriendIds].filter((id) =>
        myFriendIds.has(id)
      ).length;

      return mutualCount;
    } catch (error) {
      console.error("Error calculating mutual friends:", error);
      return 0;
    }
  };

  return (
    <div
      className={`container-fluid mt-4 ${
        darkMode ? "text-white" : "text-dark"
      }`}
      style={{
        minHeight: "100vh",
        backgroundColor: darkMode ? "#1a1a1a" : "#f8f9fa",
      }}
    >
      <div className="container">
        <div className="row">
          <div className="col-12">
            <h1 className="mb-5 text-center fw-bold">
              <i className="fas fa-users me-3 text-primary"></i>
              Social
            </h1>
          </div>
        </div>

        {/* Search Section */}
        <div className="row mb-5">
          <div className="col-12">
            <div className="text-center mb-4">
              <h3 className="fw-normal">
                <i className="fas fa-search me-2"></i>
                Find Friends
              </h3>
            </div>

            <div className="row justify-content-center">
              <div className="col-lg-8 col-md-10">
                <div className="position-relative">
                  <input
                    type="text"
                    className={`form-control form-control-lg rounded-pill px-4 ${
                      darkMode
                        ? "bg-dark text-white border-secondary"
                        : "border-2"
                    }`}
                    placeholder="Search by username or display name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingRight: loading ? "50px" : "20px" }}
                  />
                  {loading && (
                    <div className="position-absolute top-50 end-0 translate-middle-y me-3">
                      <div
                        className="spinner-border spinner-border-sm text-primary"
                        role="status"
                      >
                        <span className="visually-hidden">Searching...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="row justify-content-center mt-4">
                <div className="col-lg-8 col-md-10">
                  <div
                    className="alert alert-danger text-center border-0 rounded-pill"
                    role="alert"
                  >
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    {error}
                  </div>
                </div>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="mt-5">
                <div className="text-center mb-4">
                  <h5 className="fw-normal">
                    <i className="fas fa-user-friends me-2"></i>
                    Search Results
                  </h5>
                </div>
                <div className="row g-3 justify-content-center">
                  {searchResults.slice(0, 6).map((user) => (
                    <div key={user.uid} className="col-lg-4 col-md-6">
                      <div
                        className={`p-4 rounded-4 border-0 h-100 ${
                          darkMode ? "bg-dark" : "bg-white"
                        }`}
                        style={{
                          boxShadow: darkMode
                            ? "0 4px 6px rgba(0,0,0,0.3)"
                            : "0 4px 6px rgba(0,0,0,0.1)",
                          transition: "all 0.3s ease",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="flex-grow-1">
                            <h6 className="mb-0 fw-semibold">
                              <i className="fas fa-user me-2 text-primary"></i>
                              <Link
                                to={`/player/${user.username}`}
                                className="text-decoration-none"
                                style={{ color: "inherit" }}
                              >
                                {user.displayName ||
                                  user.username ||
                                  "Unknown User"}
                              </Link>
                            </h6>
                          </div>
                          <button
                            className="btn btn-sm btn-success rounded-pill px-3"
                            onClick={() => sendFriendRequest(user.uid, user)}
                          >
                            <i className="fas fa-user-plus me-1"></i>
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {searchResults.length > 6 && (
                  <div className="text-center mt-4">
                    <small
                      className={`${darkMode ? "text-light" : "text-muted"}`}
                    >
                      Showing top 6 of {searchResults.length} results
                    </small>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Full-width no results alert */}
        {searchTerm && searchResults.length === 0 && !loading && (
          <div className="row justify-content-center mb-5">
            <div className="col-lg-8 col-md-10">
              <div className="alert alert-info text-center border-0 rounded-pill w-100">
                <i className="fas fa-search me-2"></i>
                No users found with the name "{searchTerm}".
              </div>
            </div>
          </div>
        )}

        {/* Friends sections */}
        <div className="row g-5">
          {/* Friends List */}
          <div className="col-lg-4 col-md-6">
            <div className="text-center mb-4">
              <h4 className="fw-semibold">
                <i className="fas fa-heart me-2 text-danger"></i>
                Friends ({friends.length})
              </h4>
            </div>
            {friendsLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3 mb-0">Loading friends...</p>
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-user-friends fa-4x text-muted mb-4"></i>
                <p className="text-muted mb-0 fs-6">
                  No friends yet. Search for users to add as friends!
                </p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {friends.map((friend) => (
                  <div
                    key={friend.uid}
                    className={`p-3 rounded-4 border-0 ${
                      darkMode ? "bg-dark" : "bg-white"
                    }`}
                    style={{
                      boxShadow: darkMode
                        ? "0 2px 4px rgba(0,0,0,0.3)"
                        : "0 2px 4px rgba(0,0,0,0.1)",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="flex-grow-1">
                        <h6 className="mb-0 fw-semibold">
                          <i className="fas fa-user me-2 text-primary"></i>
                          <Link
                            to={`/player/${friend.username}`}
                            className="text-decoration-none"
                            style={{ color: "inherit" }}
                          >
                            {friend.displayName ||
                              friend.username ||
                              "Unknown User"}
                          </Link>
                        </h6>
                      </div>
                      <button
                        className="btn btn-sm btn-outline-success rounded-pill px-3"
                        onClick={() =>
                          sendGameInvite(
                            friend.uid,
                            friend.displayName || friend.username
                          )
                        }
                        disabled={sendingInvite === friend.uid}
                      >
                        {sendingInvite === friend.uid ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-1"
                              role="status"
                              aria-hidden="true"
                            ></span>
                            Sending...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-gamepad me-1"></i>
                            Invite
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Friend Requests */}
          <div className="col-lg-4 col-md-6">
            <div className="text-center mb-4">
              <h4 className="fw-semibold">
                <i className="fas fa-user-clock me-2 text-warning"></i>
                Friend Requests ({friendRequests.length})
              </h4>
            </div>
            {requestsLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3 mb-0">Loading requests...</p>
              </div>
            ) : friendRequests.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-inbox fa-4x text-muted mb-4"></i>
                <p className="text-muted mb-0 fs-6">
                  No pending friend requests.
                </p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {friendRequests.map((request) => (
                  <div
                    key={request.id}
                    className={`p-3 rounded-4 border-0 ${
                      darkMode ? "bg-dark" : "bg-white"
                    }`}
                    style={{
                      boxShadow: darkMode
                        ? "0 2px 4px rgba(0,0,0,0.3)"
                        : "0 2px 4px rgba(0,0,0,0.1)",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="flex-grow-1">
                        <h6 className="mb-0 fw-semibold">
                          <i className="fas fa-user me-2 text-primary"></i>
                          <Link
                            to={`/player/${request.username}`}
                            className="text-decoration-none"
                            style={{ color: "inherit" }}
                          >
                            {request.displayName ||
                              request.username ||
                              "Unknown User"}
                          </Link>
                        </h6>
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-success rounded-pill px-3"
                          onClick={() => acceptRequest(request.id)}
                          title="Accept Request"
                        >
                          <i className="fas fa-check me-1"></i>
                          Accept
                        </button>
                        <button
                          className="btn btn-sm btn-danger rounded-pill px-3"
                          onClick={() => rejectRequest(request.id)}
                          title="Reject Request"
                        >
                          <i className="fas fa-times me-1"></i>
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="col-lg-4 col-md-12">
            <div className="text-center mb-4">
              <h4 className="fw-semibold">
                <i className="fas fa-users me-2 text-info"></i>
                Friend Recommendations
              </h4>
            </div>
            {recommendationsLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3 mb-0">Finding friend recommendations...</p>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-user-friends fa-4x text-muted mb-4"></i>
                <p className="text-muted mb-0 fs-6">
                  No friend recommendations available. Add more friends to get
                  suggestions!
                </p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {recommendations.map((user) => (
                  <div
                    key={user.uid}
                    className={`p-3 rounded-4 border-0 ${
                      darkMode ? "bg-dark" : "bg-white"
                    }`}
                    style={{
                      boxShadow: darkMode
                        ? "0 2px 4px rgba(0,0,0,0.3)"
                        : "0 2px 4px rgba(0,0,0,0.1)",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="flex-grow-1">
                        <h6 className="mb-1 fw-semibold">
                          <i className="fas fa-user me-2 text-primary"></i>
                          <Link
                            to={`/player/${user.username}`}
                            className="text-decoration-none"
                            style={{ color: "inherit" }}
                          >
                            {user.displayName ||
                              user.username ||
                              "Unknown User"}
                          </Link>
                        </h6>
                        <small
                          className={`${
                            darkMode ? "text-light" : "text-muted"
                          }`}
                        >
                          <i className="fas fa-link me-1"></i>
                          {mutualFriendsCount[user.uid] || 0} mutual connection
                          {(mutualFriendsCount[user.uid] || 0) !== 1 ? "s" : ""}
                        </small>
                      </div>
                      <button
                        className="btn btn-sm btn-outline-primary rounded-pill px-3"
                        onClick={() => sendFriendRequest(user.uid, user)}
                      >
                        <i className="fas fa-user-plus me-1"></i>
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Social;
