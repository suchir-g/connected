import React, { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import { db } from "../../config/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { AuthContext } from "../../contexts/AuthContext";
import BarGraph from "../../components/graphs/BarGraph";
import LineGraph from "../../components/graphs/LineGraph";

const difficultyLabels = [
  "very_easy",
  "Easy",
  "Medium",
  "Hard",
  "very_hard",
  "Expert",
];

const Stats = () => {
  const { currentUser } = useContext(AuthContext);
  const [statsData, setStatsData] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setError("User not authenticated.");
      setLoading(false);
      return;
    }

    const fetchGameHistory = async () => {
      try {
        const gamesRef = collection(db, "players", currentUser.uid, "games");
        const gamesQuery = query(gamesRef, orderBy("timestamp", "desc"));
        const gamesSnapshot = await getDocs(gamesQuery);

        if (!gamesSnapshot.empty) {
          const games = gamesSnapshot.docs.map((doc) => ({
            id: doc.id, 
            ...doc.data(),
          }));
          setGameHistory(games);

          const stats = difficultyLabels.map((label) => {
            const wins = games.filter(
              (game) =>
                game.result === "win" && game.difficulty === label.toLowerCase()
            ).length;
            const losses = games.filter(
              (game) =>
                game.result === "loss" &&
                game.difficulty === label.toLowerCase()
            ).length;

            return {
              difficulty: label,
              wins,
              losses,
              ratio: losses === 0 ? wins : wins / losses,
            };
          });

          setStatsData(stats);
        } else {
          setError("No games found.");
          setStatsData([]);
          setGameHistory([]);
        }
      } catch (err) {
        console.error("Error fetching game history:", err);
        setError("Failed to fetch statistics. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchGameHistory();
  }, [currentUser]);

  const winLossCumulative = gameHistory.reduce(
    (acc, game) => {
      const date = new Date(game.timestamp.seconds * 1000) 
        .toISOString()
        .split("T")[0]; 
      const isWin = game.result === "win";
      const isLoss = game.result === "loss";

      if (!acc.dailyStats[date]) {
        acc.dailyStats[date] = {
          wins: acc.cumulative.wins,
          losses: acc.cumulative.losses,
        };
      }

      if (isWin) acc.dailyStats[date].wins += 1;
      if (isLoss) acc.dailyStats[date].losses += 1;

      acc.cumulative.wins += isWin ? 1 : 0;
      acc.cumulative.losses += isLoss ? 1 : 0;

      return acc;
    },
    {
      dailyStats: {},
      cumulative: { wins: 0, losses: 0 },
    }
  );

  const dailyLabels = Object.keys(winLossCumulative.dailyStats).sort(); 
  const dailyRatios = dailyLabels.map((date) => {
    const { wins, losses } = winLossCumulative.dailyStats[date];
    return losses === 0 ? wins : wins / losses; 
  });

  return (
    <div style={{ padding: "20px" }}>
      <h2>Statistics</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading statistics...</p>}

      {!loading && statsData.length > 0 && (
        <>
          <h3>Wins by Difficulty</h3>
          <BarGraph
            labels={statsData.map((data) => data.difficulty)}
            values={statsData.map((data) => data.wins)}
          />

          <h3>Losses by Difficulty</h3>
          <BarGraph
            labels={statsData.map((data) => data.difficulty)}
            values={statsData.map((data) => data.losses)}
          />

          <h3>Win-to-Loss Ratio by Difficulty</h3>
          <BarGraph
            labels={statsData.map((data) => data.difficulty)}
            values={statsData.map((data) => data.ratio)}
          />
        </>
      )}

      {!loading && dailyLabels.length > 0 && (
        <>
          <h3>Cumulative Win-to-Loss Ratio Over Time (Per Day)</h3>
          <LineGraph labels={dailyLabels} values={dailyRatios} />
        </>
      )}

      {!loading && gameHistory.length > 0 && (
        <>
          <h3>Game History</h3>
          <table border="1" cellPadding="10" cellSpacing="0">
            <thead>
              <tr>
                <th>Date</th>
                <th>Result</th>
                <th>Difficulty</th>
                <th>Moves</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {gameHistory.map((game, index) => (
                <tr key={index}>
                  <td>
                    {new Date(game.timestamp.seconds * 1000).toLocaleString()}
                  </td>
                  <td>{game.result}</td>
                  <td>{game.difficulty}</td>
                  <td>{game.moves}</td>
                  <td>
                    <Link to={`/review/${currentUser.uid}/${game.id}`}>
                      Review Game
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!loading && statsData.length === 0 && gameHistory.length === 0 && (
        <p>No statistics available. Play a game to start tracking!</p>
      )}
    </div>
  );
};

export default Stats;
  