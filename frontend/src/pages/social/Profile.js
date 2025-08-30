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
      console.log("Fetching player data for username:", username);

      try {
        // Try with exact case first, then try other case variations
        const originalUsername = username.trim();
        const normalizedUsername = originalUsername.toLowerCase();
        console.log("Original username for query:", originalUsername);
        console.log("Normalized username for query:", normalizedUsername);

        const playersRef = collection(db, "players");

        // For Kenny specifically, try to use the ID directly
        if (normalizedUsername === "kenny" || originalUsername === "Kenny") {
          console.log("Looking for Kenny - trying direct ID lookup first");
          const kennyRef = doc(db, "players", "YaICDMwfx1PTUHcKyzPbWLI4YL83");
          const kennyDoc = await getDoc(kennyRef);

          if (kennyDoc.exists()) {
            console.log("Found Kenny via direct ID lookup!");
            const playerDoc = {
              id: "YaICDMwfx1PTUHcKyzPbWLI4YL83",
              data: () => kennyDoc.data(),
            };
            const playerSnapshot = {
              empty: false,
              docs: [playerDoc],
            };
            console.log("Kenny's data:", kennyDoc.data());
          } else {
            console.log(
              "Kenny's direct ID lookup failed. Continuing with username search."
            );
          }
        }

        // First try with exact case
        console.log("Executing Firestore query for player with exact case...");
        const exactCaseQuery = query(
          playersRef,
          where("username", "==", originalUsername)
        );
        let playerSnapshot = await getDocs(exactCaseQuery);

        // If no results, try with lowercase
        if (playerSnapshot.empty) {
          console.log("No results with exact case. Trying lowercase...");
          const lowercaseQuery = query(
            playersRef,
            where("username", "==", normalizedUsername)
          );
          playerSnapshot = await getDocs(lowercaseQuery);

          // Try with capitalized first letter as third attempt
          if (playerSnapshot.empty && normalizedUsername.length > 0) {
            const capitalizedUsername =
              normalizedUsername.charAt(0).toUpperCase() +
              normalizedUsername.slice(1);
            console.log(
              "No results with lowercase. Trying capitalized:",
              capitalizedUsername
            );
            const capitalizedQuery = query(
              playersRef,
              where("username", "==", capitalizedUsername)
            );
            playerSnapshot = await getDocs(capitalizedQuery);
          }

          // Try with ALL CAPS as fourth attempt
          if (playerSnapshot.empty) {
            const allCapsUsername = originalUsername.toUpperCase();
            console.log("Still no results. Trying ALL CAPS:", allCapsUsername);
            const allCapsQuery = query(
              playersRef,
              where("username", "==", allCapsUsername)
            );
            playerSnapshot = await getDocs(allCapsQuery);
          }
        }
        console.log(
          "Query complete. Empty?",
          playerSnapshot.empty,
          "Number of docs:",
          playerSnapshot.docs.length
        );

        if (playerSnapshot.empty) {
          console.error(`Player "${username}" not found in database.`);

          // If we're specifically looking for Kenny, let's do a broader search to see what's in the database
          if (normalizedUsername === "kenny" || originalUsername === "Kenny") {
            console.log("Searching for any username containing 'kenny'...");
            // Get all players and filter client-side (not efficient but helpful for debugging)
            try {
              const allPlayersSnapshot = await getDocs(
                collection(db, "players")
              );
              const allPlayers = allPlayersSnapshot.docs.map((doc) => ({
                id: doc.id,
                username: doc.data().username,
              }));

              // Log any usernames containing "kenny" regardless of case
              const kennyMatches = allPlayers.filter(
                (player) =>
                  player.username &&
                  player.username.toLowerCase().includes("kenny")
              );

              console.log("Found potential matches for Kenny:", kennyMatches);
            } catch (err) {
              console.error("Error in broad Kenny search:", err);
            }
          }

          setError("Player not found.");
          setPlayerData(null);
          setAllGames([]);
          setRecentGames([]);
          setLoading(false);
          return;
        }

        const playerDoc = playerSnapshot.docs[0];
        const playerId = playerDoc.id;
        console.log("Found player with ID:", playerId);

        if (playerId === "YaICDMwfx1PTUHcKyzPbWLI4YL83") {
          console.log("Found Kenny's profile!");
        }

        const playerInfo = playerDoc.data();
        console.log("Player data retrieved:", playerInfo);
        setPlayerData(playerInfo);

        console.log("Attempting to fetch games for player ID:", playerId);
        const gamesRef = collection(db, "players", playerId, "games");
        const gamesQuery = query(gamesRef, orderBy("timestamp", "desc"));

        try {
          const gamesSnapshot = await getDocs(gamesQuery);
          console.log(
            "Games query complete. Empty?",
            gamesSnapshot.empty,
            "Number of games:",
            gamesSnapshot.size
          );

          if (!gamesSnapshot.empty) {
            const games = gamesSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            console.log("Retrieved games:", games.length);
            setAllGames(games);
            setRecentGames(games.slice(0, 5));
          } else {
            console.log("No games found for this player.");
            setAllGames([]);
            setRecentGames([]);
          }
        } catch (gameError) {
          console.error("Error fetching games:", gameError);
          setAllGames([]);
          setRecentGames([]);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        console.error("Error details:", err.code, err.message);
        setError(
          `Failed to fetch profile: ${err.message}. Please try again later.`
        );
      } finally {
        console.log(
          "Profile fetch process complete. Loading state set to false."
        );
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

  // Safely log the current user ID and add more detailed debugging
  console.log("Current user ID:", currentUser?.uid || "No user logged in");
  console.log("Profile being viewed:", username);
  console.log("Player data loaded:", playerData);

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
                  color="#22c55e"
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
                  color="#3b82f6"
                />
              </div>
              <div className="col-md-4">
                Losses by difficulty
                <BarGraph
                  labels={statsData.map((stat) => stat.label)}
                  values={statsData.map((stat) => stat.losses)}
                  title="Losses by Difficulty"
                  color="#ef4444"
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
