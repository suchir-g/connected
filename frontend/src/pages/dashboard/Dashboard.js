import React, { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../../config/firebase";
import { collection, query, orderBy, getDocs, where } from "firebase/firestore";
import { AuthContext } from "../../contexts/AuthContext";
import BarGraph from "../../components/graphs/BarGraph";
import LineGraph from "../../components/graphs/LineGraph";
import "bootstrap/dist/css/bootstrap.min.css";

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

const MOVE_LENGTH_THRESHOLD = 20;

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
  const [onlineGamesCount, setOnlineGamesCount] = useState(0);
  const [onlineWinLossData, setOnlineWinLossData] = useState([0, 0]);
  const [recentOnlineGames, setRecentOnlineGames] = useState([]);
  const [loading, setLoading] = useState(true);

  const { darkMode } = useTheme();

  const computeWeightedWinRate = (gamesForDiff) => {
    const n = gamesForDiff.length;
    if (n === 0) return 0;

    let totalWeightedWins = 0;
    let totalWeight = 0;

    for (let i = 0; i < n; i++) {
      const weight = n - i;
      const isWin = gamesForDiff[i].result === "win" ? 1 : 0;
      totalWeightedWins += weight * isWin;
      totalWeight += weight;
    }

    return totalWeightedWins / totalWeight;
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) return;

      try {
        // Fetch bot games
        const gamesRef = collection(db, "players", currentUser.uid, "games");
        const gamesQuery = query(gamesRef, orderBy("timestamp", "desc"));
        const gamesSnapshot = await getDocs(gamesQuery);

        const games = gamesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const totalGamesCount = games.length;
        setTotalGamesCount(totalGamesCount);

        setRecentGames(games.slice(0, 5));

        const winCount = games.filter((game) => game.result === "win").length;
        const lossCount = games.filter((game) => game.result === "loss").length;
        setWinLossData([winCount, lossCount]);

        // Fetch online games (using same logic as Stats.js)
        const onlineGamesQuery = query(
          collection(db, "live-games"),
          where("players", "array-contains", currentUser.uid),
          where("status", "==", "completed")
        );
        const onlineGamesSnapshot = await getDocs(onlineGamesQuery);

        const onlineGames = onlineGamesSnapshot.docs
          .map((doc) => {
            const data = doc.data();

            // Get opponent info
            const opponentId = data.players?.find(
              (id) => id !== currentUser.uid
            );
            const opponentName = data.playerNames
              ? Object.entries(data.playerNames).find(
                  ([id, name]) => id !== currentUser.uid
                )?.[1] || "Unknown"
              : "Unknown";

            // Determine result
            let result;
            if (data.winner === "draw") {
              result = "draw";
            } else if (data.winner === currentUser.uid) {
              result = "win";
            } else {
              result = "loss";
            }

            return {
              id: doc.id,
              result: result,
              timestamp: data.endedAt || data.createdAt,
              moves: data.moves ? data.moves.length : 0,
              winType: data.winType || "connection",
              opponent: opponentName,
              endedAt: data.endedAt,
              ...data,
            };
          })
          .sort((a, b) => {
            const aDate = a.endedAt ? a.endedAt.toDate() : new Date(0);
            const bDate = b.endedAt ? b.endedAt.toDate() : new Date(0);
            return bDate - aDate;
          });

        setOnlineGamesCount(onlineGames.length);
        setRecentOnlineGames(onlineGames.slice(0, 5));

        const onlineWins = onlineGames.filter(
          (game) => game.result === "win"
        ).length;
        const onlineLosses = onlineGames.filter(
          (game) => game.result === "loss"
        ).length;
        const onlineDraws = onlineGames.filter(
          (game) => game.result === "draw"
        ).length;
        setOnlineWinLossData([onlineWins, onlineLosses]);

        const cumulativeData = games.reduce(
          (acc, game) => {
            const date = new Date(game.timestamp.seconds * 1000)
              .toISOString()
              .split("T")[0];
            if (!acc.dailyStats[date]) {
              acc.dailyStats[date] = { wins: 0, losses: 0 };
            }
            if (game.result === "win") acc.dailyStats[date].wins += 1;
            if (game.result === "loss") acc.dailyStats[date].losses += 1;
            return acc;
          },
          { dailyStats: {} }
        );

        const dailyLabels = Object.keys(cumulativeData.dailyStats).sort();

        let runningWins = 0;
        let runningLosses = 0;
        const dailyCumulativeRatios = dailyLabels.map((date) => {
          const { wins, losses } = cumulativeData.dailyStats[date];
          runningWins += wins;
          runningLosses += losses;

          return runningLosses === 0
            ? runningWins
            : runningWins / runningLosses;
        });

        setDailyLabels(dailyLabels);
        setDailyRatios(dailyCumulativeRatios);

        const last20Games = games.slice(0, 20);
        const totalMoves = last20Games.reduce(
          (sum, game) => sum + (game.moves || 0),
          0
        );
        const averageMoveLength =
          last20Games.length > 0 ? totalMoves / last20Games.length : 0;
        setAverageMoveLength(averageMoveLength);

        const threshold = 0.8;
        let highestSuccessfulDifficultyIndex = 0;

        for (let i = 0; i < difficultyLevels.length; i++) {
          const difficulty = difficultyLevels[i];
          const recentGamesForDiff = games
            .filter((g) => g.difficulty === difficulty)
            .slice(0, 20);

          const weightedWinRate = computeWeightedWinRate(recentGamesForDiff);

          if (weightedWinRate >= threshold && recentGamesForDiff.length > 0) {
            highestSuccessfulDifficultyIndex = i;
          }
        }

        if (highestSuccessfulDifficultyIndex < difficultyLevels.length - 1) {
          setRecommendedDifficulty(
            difficultyLevels[highestSuccessfulDifficultyIndex + 1]
          );
        } else {
          setRecommendedDifficulty(
            difficultyLevels[highestSuccessfulDifficultyIndex]
          );
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentUser]);

  return (
    <div className="container-fluid mt-3 px-3 px-md-4">
      <h1 className="text-center mb-3 h3">Dashboard</h1>

      {loading ? (
        <Loading />
      ) : (
        <>
          {/* Play buttons - Stack on mobile */}
          <div className="row g-2 mb-3">
            <div className="col-12 col-md-4">
              <button
                className="btn btn-secondary w-100 btn-sm"
                onClick={() => navigate("/play/local")}
              >
                Play Local
              </button>
            </div>
            <div className="col-12 col-md-4">
              <button
                className="btn btn-info w-100 btn-sm"
                onClick={() => navigate("/play/online")}
              >
                Play Online
              </button>
            </div>
            <div className="col-12 col-md-4">
              <button
                className="btn btn-success w-100 btn-sm"
                onClick={() =>
                  navigate(`/play/bot?difficulty=${recommendedDifficulty}`)
                }
              >
                <span className="d-none d-md-inline">
                  Play Bot - Recommended Difficulty:{" "}
                </span>
                <span className="d-md-none">Play Bot - </span>
                {recommendedDifficulty.replace("_", " ")}
              </button>
            </div>
          </div>

          {/* Training button */}
          {averageMoveLength > MOVE_LENGTH_THRESHOLD ? (
            <div className="row g-2 mb-3">
              <div className="col-12">
                <button
                  className="btn btn-warning w-100 btn-sm"
                  onClick={() => navigate("/trainer?type=late")}
                >
                  Practice Late Game Positions
                </button>
              </div>
            </div>
          ) : (
            <div className="row g-2 mb-3">
              <div className="col-12">
                <button
                  className="btn btn-warning w-100 btn-sm"
                  onClick={() => navigate("/trainer?type=early")}
                >
                  Practice Early Game Positions
                </button>
              </div>
            </div>
          )}

          {/* Stats cards - 2x2 on mobile, 4 across on desktop */}
          <div className="row g-2 mb-3">
            <div className="col-6 col-lg-3">
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-body text-center p-2">
                  <h6 className="card-title mb-1 small">Bot Games</h6>
                  <p className="card-text fs-4 mb-0">{totalGamesCount}</p>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-body text-center p-2">
                  <h6 className="card-title mb-1 small">Bot W/L Ratio</h6>
                  <p className="card-text fs-4 mb-0">
                    {winLossData[1] === 0
                      ? winLossData[0]
                      : (winLossData[0] / winLossData[1]).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-body text-center p-2">
                  <h6 className="card-title mb-1 small">Online Games</h6>
                  <p className="card-text fs-4 mb-0">{onlineGamesCount}</p>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-body text-center p-2">
                  <h6 className="card-title mb-1 small">Online W/L Ratio</h6>
                  <p className="card-text fs-4 mb-0">
                    {onlineWinLossData[1] === 0
                      ? onlineWinLossData[0]
                      : (onlineWinLossData[0] / onlineWinLossData[1]).toFixed(
                          2
                        )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts - Hidden on mobile, visible on desktop */}
          <div className="row g-2 mb-3 d-none d-lg-flex">
            <div className="col-lg-4">
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-body p-2">
                  <h6 className="card-title text-center mb-2 small">
                    Daily Win Ratio (Bot)
                  </h6>
                  <div className="graph-container">
                    <LineGraph
                      labels={dailyLabels}
                      values={dailyRatios}
                      scale={0.3}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-body p-2">
                  <h6 className="card-title text-center mb-2 small">
                    Bot: Wins vs Losses
                  </h6>
                  <div className="graph-container">
                    <BarGraph
                      labels={["Wins", "Losses"]}
                      values={winLossData}
                      scale={0.3}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="card" style={{ border: "1px solid #808080" }}>
                <div className="card-body p-2">
                  <h6 className="card-title text-center mb-2 small">
                    Online: Wins vs Losses
                  </h6>
                  <div className="graph-container">
                    <BarGraph
                      labels={["Wins", "Losses"]}
                      values={onlineWinLossData}
                      scale={0.3}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent games - Circles on mobile, tables on desktop */}
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <div
                className="card h-100"
                style={{ border: "1px solid #808080" }}
              >
                <div className="card-body p-3">
                  <h6 className="card-title mb-3">Recent Bot Games</h6>

                  {/* Mobile view - circles */}
                  <div className="d-md-none">
                    {recentGames.length > 0 ? (
                      <div className="d-flex justify-content-center gap-2 flex-wrap">
                        {recentGames.map((game) => (
                          <div
                            key={game.id}
                            className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white"
                            style={{
                              width: "50px",
                              height: "50px",
                              backgroundColor:
                                game.result === "win"
                                  ? "#28a745"
                                  : game.result === "loss"
                                  ? "#dc3545"
                                  : "#ffc107",
                              fontSize: "16px",
                            }}
                            title={`${game.result.toUpperCase()} vs ${
                              game.difficulty
                            } on ${new Date(
                              game.timestamp.seconds * 1000
                            ).toLocaleDateString()}`}
                          >
                            {game.result === "win"
                              ? "W"
                              : game.result === "loss"
                              ? "L"
                              : "D"}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted mb-0 text-center">
                        No recent bot games available.
                      </p>
                    )}
                  </div>

                  {/* Desktop view - table */}
                  <div className="d-none d-md-block">
                    {recentGames.length > 0 ? (
                      <div className="table-responsive">
                        <table
                          className={`table table-striped table-sm ${
                            darkMode ? "table-dark" : "table-light"
                          }`}
                        >
                          <thead>
                            <tr>
                              <th className="small">Date</th>
                              <th className="small">Result</th>
                              <th className="small">Difficulty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentGames.map((game) => (
                              <tr key={game.id}>
                                <td className="small">
                                  {new Date(
                                    game.timestamp.seconds * 1000
                                  ).toLocaleDateString()}
                                </td>
                                <td
                                  className={`small ${
                                    game.result === "win"
                                      ? "text-success"
                                      : game.result === "loss"
                                      ? "text-danger"
                                      : ""
                                  }`}
                                >
                                  {game.result.toUpperCase()}
                                </td>
                                <td className="small">
                                  {game.difficulty.charAt(0).toUpperCase() +
                                    game.difficulty.slice(1)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted mb-0 text-center">
                        No recent bot games available.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div
                className="card h-100"
                style={{ border: "1px solid #808080" }}
              >
                <div className="card-body p-3">
                  <h6 className="card-title mb-3">Recent Online Games</h6>

                  {/* Mobile view - circles */}
                  <div className="d-md-none">
                    {recentOnlineGames.length > 0 ? (
                      <div className="d-flex justify-content-center gap-2 flex-wrap">
                        {recentOnlineGames.map((game) => (
                          <Link
                            to={`/review/online/${game.id}`}
                            key={game.id}
                            className="text-decoration-none"
                          >
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white"
                              style={{
                                width: "50px",
                                height: "50px",
                                backgroundColor:
                                  game.result === "win"
                                    ? "#28a745"
                                    : game.result === "loss"
                                    ? "#dc3545"
                                    : "#ffc107",
                                fontSize: "16px",
                              }}
                              title={`${game.result.toUpperCase()} vs ${
                                game.opponent
                              } on ${
                                game.endedAt?.toDate
                                  ? game.endedAt.toDate().toLocaleDateString()
                                  : "Unknown date"
                              }`}
                            >
                              {game.result === "win"
                                ? "W"
                                : game.result === "loss"
                                ? "L"
                                : "D"}
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted mb-0 text-center">
                        No recent online games available.
                      </p>
                    )}
                  </div>

                  {/* Desktop view - table */}
                  <div className="d-none d-md-block">
                    {recentOnlineGames.length > 0 ? (
                      <div className="table-responsive">
                        <table
                          className={`table table-striped table-sm ${
                            darkMode ? "table-dark" : "table-light"
                          }`}
                        >
                          <thead>
                            <tr>
                              <th className="small">Date</th>
                              <th className="small">Result</th>
                              <th className="small">Opponent</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentOnlineGames.map((game) => (
                              <tr key={game.id}>
                                <td className="small">
                                  {game.endedAt?.toDate
                                    ? game.endedAt.toDate().toLocaleDateString()
                                    : game.timestamp?.toDate
                                    ? game.timestamp
                                        .toDate()
                                        .toLocaleDateString()
                                    : "Unknown"}
                                </td>
                                <td
                                  className={`small ${
                                    game.result === "win"
                                      ? "text-success"
                                      : game.result === "loss"
                                      ? "text-danger"
                                      : "text-warning"
                                  }`}
                                >
                                  <Link
                                    to={`/review/online/${game.id}`}
                                    className="text-decoration-none"
                                  >
                                    {game.result.toUpperCase()}
                                  </Link>
                                </td>
                                <td className="small">{game.opponent}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted mb-0 text-center">
                        No recent online games available.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
