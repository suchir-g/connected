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
      <h2 className="md-2">Statistics</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading statistics...</p>}

      {!loading && statsData.length > 0 && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
            <div style={{ flex: "1 1 30%" }}>
              <h4>Wins by Difficulty</h4>
              <BarGraph
                labels={statsData.map((data) => data.difficulty)}
                values={statsData.map((data) => data.wins)}
              />
            </div>
            <div style={{ flex: "1 1 30%" }}>
              <h4>Losses by Difficulty</h4>
              <BarGraph
                labels={statsData.map((data) => data.difficulty)}
                values={statsData.map((data) => data.losses)}
              />
            </div>
            <div style={{ flex: "1 1 30%" }}>
              <h4>Win-to-Loss Ratio by Difficulty</h4>
              <BarGraph
                labels={statsData.map((data) => data.difficulty)}
                values={statsData.map((data) => data.ratio)}
              />
            </div>
          </div>
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
          <table border="1" cellPadding="10" cellSpacing="0" className="table" style={{ width: "100%", borderCollapse: "collapse", color: "inherit" }}>
            <thead style={{color:"inherit"}}>
              <tr style={{color:"inherit"}}>
                <th style={{color:"inherit"}}>Date</th>
                <th style={{color:"inherit"}}>Result</th>
                <th style={{color:"inherit"}}>Difficulty</th>
                <th style={{color:"inherit"}}>Moves</th>
                <th style={{color:"inherit"}}>Action</th>
              </tr>
            </thead>
            <tbody style={{color:"inherit"}}>
              {gameHistory.map((game, index) => (
                <tr key={index} style={{color:"inherit"}}>
                  <td style={{color:"inherit"}}>
                    {new Date(game.timestamp.seconds * 1000).toLocaleString()}
                  </td>
                  <td style={{color:"inherit"}}>{game.result}</td>
                  <td style={{color:"inherit"}}>{game.difficulty}</td>
                  <td style={{color:"inherit"}}>{game.moves}</td>
                  <td style={{color:"inherit"}}>
                    <Link to={`/review/${currentUser.uid}/${game.id}`} style={{color:"inherit"}}>
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
  