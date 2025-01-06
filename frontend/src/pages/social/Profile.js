import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import BarGraph from "../../components/graphs/BarGraph";
import LineGraph from "../../components/graphs/LineGraph";
import AddFriend from "../../components/friends/AddFriend";
import FriendRequests from "../../components/friends/FriendRequests";
import FriendsList from "../../components/friends/FriendsList";

const difficultyLabels = [
  "very_Easy",
  "Easy",
  "Medium",
  "Hard",
  "very_hard",
  "Expert",
];

const Profile = () => {
  const { username } = useParams(); // get username from URL
  const [playerData, setPlayerData] = useState(null);
  const [recentGames, setRecentGames] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) {
      setError("No player specified.");
      setLoading(false);
      return;
    }

    const fetchPlayerData = async () => {
      setLoading(true); 
      console.log("Fetching player data for:", username);

      try {
        const normalizedUsername = username.trim().toLowerCase();
        const playersRef = collection(db, "players");
        const playerQuery = query(
          playersRef,
          where("username", "==", normalizedUsername)
        );
        const playerSnapshot = await getDocs(playerQuery);

        if (playerSnapshot.empty) {
          console.error("player not found:", username);
          setError("Player not found.");
          setPlayerData(null);
          setRecentGames([]);
          setLoading(false);
          return;
        }

        const playerDoc = playerSnapshot.docs[0];
        const playerId = playerDoc.id;
        const playerInfo = playerDoc.data();
        setPlayerData(playerInfo);
        console.log("Player data fetched:", playerInfo);

        const gamesRef = collection(db, "players", playerId, "games");
        const gamesQuery = query(
          gamesRef,
          orderBy("timestamp", "desc"),
          limit(5)
        );
        const gamesSnapshot = await getDocs(gamesQuery);

        if (!gamesSnapshot.empty) {
          const games = gamesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setRecentGames(games);
          console.log("Recent games fetched:", games);
        } else {
          console.log("No games found for player:", username);
          setRecentGames([]);
        }
      } catch (err) {
        console.error("Error fetching player data:", err);
        setError("Failed to fetch profile. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [username]);

  const getStats = () => {
    if (!recentGames || recentGames.length === 0) {
      console.log("No recent games available for stats calculation.");
      return [];
    }

    const stats = difficultyLabels.map((label) => {
      const wins = recentGames.filter(
        (game) =>
          game.result === "win" && game.difficulty === label.toLowerCase()
      ).length;
      const losses = recentGames.filter(
        (game) =>
          game.result === "loss" && game.difficulty === label.toLowerCase()
      ).length;
      return { label, wins, losses };
    });

    console.log("Stats calculated:", stats);
    return stats;
  };

  const statsData = getStats();

  return (
    <div style={{ padding: "20px" }}>
      <h2>Player Profile: {username}</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading profile...</p>}

      {!loading && playerData && (
        <>
          <p>
            <strong>Username:</strong> {playerData.username}
          </p>
          <p>
            <strong>Email:</strong> {playerData.email}
          </p>

          <h3>Recent Games</h3>
          {recentGames.length > 0 ? (
            <table border="1" cellPadding="10">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Result</th>
                  <th>Difficulty</th>
                  <th>Moves</th>
                </tr>
              </thead>
              <tbody>
                {recentGames.map((game, idx) => (
                  <tr key={idx}>
                    <td>
                      {new Date(game.timestamp.seconds * 1000).toLocaleString()}
                    </td>
                    <td>{game.result}</td>
                    <td>{game.difficulty}</td>
                    <td>{game.moves}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No recent games.</p>
          )}

          <h3>Wins and Losses by Difficulty</h3>
          <BarGraph
            labels={statsData.map((stat) => stat.label)}
            values={statsData.map((stat) => stat.wins)}
            title="Wins by Difficulty"
            color="green"
          />
          <BarGraph
            labels={statsData.map((stat) => stat.label)}
            values={statsData.map((stat) => stat.losses)}
            title="Losses by Difficulty"
            color="red"
          />

          <h3>Win-to-Loss Ratio</h3>
          <LineGraph
            labels={statsData.map((stat) => stat.label)}
            values={statsData.map((stat) =>
              stat.losses === 0 ? stat.wins : stat.wins / stat.losses
            )}
            title="Win-to-Loss Ratio by Difficulty"
            color="blue"
          />

          <AddFriend targetUsername={username} />
          <FriendRequests />
          <FriendsList />
        </>
      )}
    </div>
  );
};

export default Profile;
