import React, { useEffect, useState, useContext } from "react";
import { useParams, Link } from "react-router-dom";
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
import { AuthContext } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import Loading from "../../components/loading/Loading";

const difficultyLabels = [
  "very_Easy",
  "Easy",
  "Medium",
  "Hard",
  "very_hard",
  "Expert",
];

const Profile = () => {
  const { username } = useParams(); // Get username from URL
  const [playerData, setPlayerData] = useState(null);
  const [recentGames, setRecentGames] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const { currentUser } = useContext(AuthContext);
  const { darkMode } = useTheme();

  useEffect(() => {
    if (!username) {
      setError("No player specified.");
      setLoading(false);
      return;
    }

    const fetchPlayerData = async () => {
      setLoading(true);

      try {
        const normalizedUsername = username.trim().toLowerCase();
        const playersRef = collection(db, "players");
        const playerQuery = query(
          playersRef,
          where("username", "==", normalizedUsername)
        );
        const playerSnapshot = await getDocs(playerQuery);

        if (playerSnapshot.empty) {
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
        } else {
          setRecentGames([]);
        }
      } catch (err) {
        setError("Failed to fetch profile. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [username]);

  const getStats = () => {
    if (!recentGames || recentGames.length === 0) return [];

    return difficultyLabels.map((label) => {
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
  };

  const statsData = getStats();

  return (
    <div
      className={`container mt-4 ${darkMode ? "bg-dark text-white" : ""}`}
      style={{
        minHeight: "100vh",
        padding: "20px",
      }}
    >
      <div className="text-center mb-4">
        <h2>
          {username} {username === currentUser?.displayName && "(You)"}
        </h2>
      </div>
      {error && <p className="text-danger">{error}</p>}
      {loading && <Loading />}

      {!loading && playerData && (
        <>
          <div className="text-center mb-4">
            <AddFriend targetUsername={username} />
          </div>

          <div className="mb-4">
            <h3>Recent Games</h3>
            {recentGames.length > 0 ? (
              <div className="table-responsive">
                <table
                  className={`table table-striped table-hover ${
                    darkMode ? "table-dark" : ""
                  }`}
                >
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Result</th>
                      <th>Difficulty</th>
                      <th>Gamemode</th>
                      <th>Moves</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentGames.map((game, idx) => (
                      <tr key={idx}>
                        <td>
                          {new Date(
                            game.timestamp.seconds * 1000
                          ).toLocaleString()}
                        </td>
                        <td
                          className={
                            game.result === "win"
                              ? "text-success"
                              : game.result === "draw"
                              ? "text-warning"
                              : "text-danger"
                          }
                        >
                          {game.result.charAt(0).toUpperCase() +
                            game.result.slice(1)}
                        </td>
                        <td>{game.difficulty || "N/A"}</td>
                        <td>{game.gameMode || "N/A"}</td>
                        <td>{game.moves || "No moves"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No recent games.</p>
            )}
          </div>

          <div className="mb-4">
            <h3>Wins and Losses by Difficulty</h3>
            <div className="row">
              <div className="col-md-6">
                <BarGraph
                  labels={statsData.map((stat) => stat.label)}
                  values={statsData.map((stat) => stat.wins)}
                  title="Wins by Difficulty"
                  color="green"
                />
              </div>
              <div className="col-md-6">
                <BarGraph
                  labels={statsData.map((stat) => stat.label)}
                  values={statsData.map((stat) => stat.losses)}
                  title="Losses by Difficulty"
                  color="red"
                />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h3>Win-to-Loss Ratio</h3>
            <LineGraph
              labels={statsData.map((stat) => stat.label)}
              values={statsData.map((stat) =>
                stat.losses === 0 ? stat.wins : stat.wins / stat.losses
              )}
              title="Win-to-Loss Ratio by Difficulty"
              color="blue"
            />
          </div>
        </>
      )}

      {username === currentUser?.displayName && (
        <div className="text-center mt-4">
          <Link to="/settings" className="btn btn-primary">
            Profile Settings
          </Link>
        </div>
      )}
    </div>
  );
};

export default Profile;
