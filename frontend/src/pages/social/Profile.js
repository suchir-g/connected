import React, { useEffect, useState, useContext } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import BarGraph from "../../components/graphs/BarGraph";
import AddFriend from "../../components/friends/AddFriend";
import { AuthContext } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import Loading from "../../components/loading/Loading";

const difficultyLabels = [
  "very_easy",
  "easy",
  "medium",
  "hard",
  "very_hard",
  "expert",
];

const Profile = () => {
  const { username } = useParams(); 
  const [playerData, setPlayerData] = useState(null);
  const [allGames, setAllGames] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
  const [currentUsername, setCurrentUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const { currentUser } = useContext(AuthContext);
  const { darkMode } = useTheme();

  useEffect(() => {
    const fetchCurrentUserUsername = async () => {
      try {
        if (currentUser?.uid) {
          const userDocRef = doc(db, "players", currentUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setCurrentUsername(data.username || "");
          } else {
            setError("No user document found in 'players' for this UID.");
          }
        } else {
          setError("No authenticated user found.");
        }
      } catch (err) {
        console.error("Error fetching current user's username:", err);
        setError("Failed to fetch current user information.");
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUserUsername();
  }, [currentUser]);

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
          setAllGames([]);
          setRecentGames([]);
          setLoading(false);
          return;
        }

        const playerDoc = playerSnapshot.docs[0];
        const playerId = playerDoc.id;
        const playerInfo = playerDoc.data();
        setPlayerData(playerInfo);

        const gamesRef = collection(db, "players", playerId, "games");
        const gamesQuery = query(gamesRef, orderBy("timestamp", "desc"));
        const gamesSnapshot = await getDocs(gamesQuery);

        if (!gamesSnapshot.empty) {
          const games = gamesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setAllGames(games);
          setRecentGames(games.slice(0, 5));
        } else {
          setAllGames([]);
          setRecentGames([]);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to fetch profile. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [username]);

  const getStats = () => {
    if (!allGames || allGames.length === 0) return [];

    return difficultyLabels.map((label) => {
      const normalizedLabel = label.toLowerCase();
      const wins = allGames.filter(
        (game) => game.result === "win" && game.difficulty === normalizedLabel
      ).length;
      const losses = allGames.filter(
        (game) => game.result === "loss" && game.difficulty === normalizedLabel
      ).length;
      return { label, wins, losses };
    });
  };

  const statsData = getStats();
  console.log(currentUser.uid);
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
          {username} {username === currentUsername && "(You)"}
        </h2>
      </div>
      {error && <p className="text-danger">{error}</p>}
      {loading && <Loading />}

      {!loading && playerData && (
        <>
          <div className="text-center mb-4">
            {username !== currentUsername ? (
              <AddFriend targetUsername={username} />
            ) : (
              <Link className="btn btn-secondary" to="/settings">
                Settings
              </Link>
            )}
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
                      <th>No. Moves</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentGames.map((game, idx) => (
                      <tr key={game.id || idx}>
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
                        <td>
                          {game.difficulty
                            ? game.difficulty
                                .split("_")
                                .map(
                                  (word) =>
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                )
                                .join(" ")
                            : "N/A"}
                        </td>
                        <td>{game.gameMode || "N/A"}</td>
                        <td>{game.moves.length || "N/A"}</td>
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
            <h3>Performance Metrics</h3>
            <div className="row">
              <div className="col-md-4">
                Wins by difficulty
                <BarGraph
                  labels={statsData.map((stat) => stat.label)}
                  values={statsData.map((stat) => stat.wins)}
                  title="Wins by Difficulty"
                  color="green"
                />
              </div>
              <div className="col-md-4">
                Win To Loss Ratios
                <BarGraph
                  labels={statsData.map((stat) => stat.label)}
                  values={statsData.map((stat) =>
                    stat.losses === 0
                      ? stat.wins
                      : parseFloat((stat.wins / stat.losses).toFixed(2))
                  )}
                  title="Win-to-Loss Ratio"
                  color="blue"
                />
              </div>
              <div className="col-md-4">
                Losses by difficulty
                <BarGraph
                  labels={statsData.map((stat) => stat.label)}
                  values={statsData.map((stat) => stat.losses)}
                  title="Losses by Difficulty"
                  color="red"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Profile;
