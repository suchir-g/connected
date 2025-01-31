import React, { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../../config/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { AuthContext } from "../../contexts/AuthContext";
import BarGraph from "../../components/graphs/BarGraph";
import LineGraph from "../../components/graphs/LineGraph";
import "bootstrap/dist/css/bootstrap.min.css";

import FriendRequests from "../../components/friends/FriendRequests";
import FriendsList from "../../components/friends/FriendsList";
import Loading from "../../components/loading/Loading";
import { useTheme } from "../../contexts/ThemeContext";

const difficultyLevels = [
  "very_easy",
  "easy",
  "medium",
  "hard",
  "very_hard",
  "expert",
];

const MOVE_LENGTH_THRESHOLD = 20; // this is a constant for long and short moves

const Dashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [recentGames, setRecentGames] = useState([]);
  const [winLossData, setWinLossData] = useState([]);
  const [dailyLabels, setDailyLabels] = useState([]);
  const [dailyRatios, setDailyRatios] = useState([]);
  const [totalGamesCount, setTotalGamesCount] = useState(0);
  const [averageMoveLength, setAverageMoveLength] = useState(0);
  const [recommendedDifficulty, setRecommendedDifficulty] =
    useState("very_easy");
  const [loading, setLoading] = useState(true);

  const darkMode = useTheme().darkMode;
  console.log("DARK MODE:", darkMode);
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) return;

      try {
        const gamesRef = collection(db, "players", currentUser.uid, "games");
        const gamesQuery = query(gamesRef, orderBy("timestamp", "desc"));
        const gamesSnapshot = await getDocs(gamesQuery);

        const games = gamesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const totalGamesCount = games.length;
        setRecentGames(games.slice(0, 5));
        setTotalGamesCount(totalGamesCount);

        const winCount = games.filter((game) => game.result === "win").length;
        const lossCount = games.filter((game) => game.result === "loss").length;
        setWinLossData([winCount, lossCount]);

        const cumulativeData = games.reduce(
          (acc, game) => {
            const date = new Date(game.timestamp.seconds * 1000)
              .toISOString()
              .split("T")[0];
            const isWin = game.result === "win";
            const isLoss = game.result === "loss";

            if (!acc.dailyStats[date]) {
              acc.dailyStats[date] = { wins: 0, losses: 0 };
            }
            if (isWin) acc.dailyStats[date].wins += 1;
            if (isLoss) acc.dailyStats[date].losses += 1;

            return acc;
          },
          { dailyStats: {} }
        );

        const dailyLabels = Object.keys(cumulativeData.dailyStats).sort();
        const dailyRatios = dailyLabels.map((date) => {
          const { wins, losses } = cumulativeData.dailyStats[date];
          return losses === 0 ? wins : wins / losses;
        });

        setDailyLabels(dailyLabels);
        setDailyRatios(dailyRatios);

        const last20Games = games.slice(0, 20);
        const totalMoves = last20Games.reduce(
          (sum, game) => sum + (game.moves || 0),
          0
        );
        const averageMoveLength =
          last20Games.length > 0 ? totalMoves / last20Games.length : 0;
        setAverageMoveLength(averageMoveLength);

        let lastSuccessfulDifficulty = "very_easy";
        let nextRecommendedDifficulty = "very_easy";

        for (let i = difficultyLevels.length - 1; i >= 0; i--) {
          const difficulty = difficultyLevels[i];
          const recentGamesOnDifficulty = games
            .filter((game) => game.difficulty === difficulty)
            .slice(0, 5);

          const wins = recentGamesOnDifficulty.filter(
            (game) => game.result === "win"
          ).length;

          if (wins >= 4) {
            lastSuccessfulDifficulty = difficulty;

            if (i < difficultyLevels.length - 1) {
              nextRecommendedDifficulty = difficultyLevels[i + 1];
            } else {
              nextRecommendedDifficulty = difficulty;
            }

            break;
          }
        }

        setRecommendedDifficulty(nextRecommendedDifficulty);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentUser]);

  return (
    <div className="container-fluid mt-4 px-3">
      <h1 className="text-center mb-4">Dashboard</h1>

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <button
                className="btn btn-primary w-100"
                onClick={() => navigate("/play/local")}
              >
                Play Local
              </button>
            </div>
            <div className="col-md-6">
              <button
                className="btn btn-success w-100"
                onClick={() =>
                  navigate(`/play/bot?difficulty=${recommendedDifficulty}`)
                }
              >
                Play Bot - Recommended Difficulty: {recommendedDifficulty}
              </button>
            </div>
          </div>

          {averageMoveLength > MOVE_LENGTH_THRESHOLD ? (
            <div className="row g-3 mb-4">
              <div className="col-md-12">
                <button
                  className="btn btn-warning w-100"
                  onClick={() => navigate("/trainer?type=late")}
                >
                  Practice Late Game Positions
                </button>
              </div>
            </div>
          ) : (
            <div className="row g-3 mb-4">
              <div className="col-md-12">
                <button
                  className="btn btn-warning w-100"
                  onClick={() => navigate("/trainer?type=early")}
                >
                  Practice Early Game Positions
                </button>
              </div>
            </div>
          )}

          <div className="row g-3 mb-4">
            <div className="col-lg-6 col-md-12">
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-body text-center">
                  <h5 className="card-title">Total Games Played</h5>
                  <p className="card-text fs-2">{totalGamesCount}</p>
                </div>
              </div>
            </div>
            <div className="col-lg-6 col-md-12">
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-body text-center">
                  <h5 className="card-title">Win/Loss Ratio</h5>
                  <p className="card-text fs-2">
                    {winLossData[1] === 0
                      ? winLossData[0]
                      : (winLossData[0] / winLossData[1]).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-lg-6 col-md-12">
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-body">
                  <h5 className="card-title text-center">Daily Win Ratio</h5>
                  <div className="graph-container">
                    <LineGraph
                      labels={dailyLabels}
                      values={dailyRatios}
                      scale={0.5}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-6 col-md-12">
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-body">
                  <h5 className="card-title text-center">Wins vs Losses</h5>
                  <div className="graph-container">
                    <BarGraph
                      labels={["Wins", "Losses"]}
                      values={winLossData}
                      scale={0.5}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-12">
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-body">
                  <h5 className="card-title">Recent Games</h5>
                  {recentGames.length > 0 ? (
                    <div className="table-responsive">
                      <table
                        className={`table table-striped ${
                          darkMode ? "table-dark" : "table-light"
                        }`}
                      >
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
                          {recentGames.map((game) => (
                            <tr key={game.id}>
                              <td>
                                {new Date(
                                  game.timestamp.seconds * 1000
                                ).toLocaleString()}
                              </td>
                              <td
                                className={
                                  game.result === "win"
                                    ? "text-success"
                                    : game.result === "loss"
                                    ? "text-danger"
                                    : ""
                                }
                              >
                                {game.result.toUpperCase()}
                              </td>
                              <td>
                                {game.difficulty.charAt(0).toUpperCase() +
                                  game.difficulty.slice(1)}
                              </td>
                              <td>{game.moves}</td>
                              <td>
                                <Link
                                  className="btn btn-primary btn-sm"
                                  to={`/review/${currentUser.uid}/${game.id}`}
                                >
                                  Review
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center">No recent games available.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <FriendsList />
      <FriendRequests />
    </div>
  );
};

export default Dashboard;
