import React, { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import { db } from "../../config/firebase";
import { collection, query, orderBy, getDocs, where } from "firebase/firestore";
import { AuthContext } from "../../contexts/AuthContext";
import BarGraph from "../../components/graphs/BarGraph";
import LineGraph from "../../components/graphs/LineGraph";
import Loading from "../../components/loading/Loading";
import { useTheme } from "../../contexts/ThemeContext";

const difficultyLabels = [
  "very_easy",
  "Easy",
  "medium",
  "hard",
  "very_hard",
  "Expert",
];

const gameModeLabels = [
  "connect-4",
  "connect-5",
  "popout",
  "anti",
  "colour-switch",
];

const Stats = () => {
  const { currentUser } = useContext(AuthContext);
  const { darkMode } = useTheme();

  const [statsData, setStatsData] = useState([]);
  const [variantStats, setVariantStats] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [onlineStats, setOnlineStats] = useState({
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    avgGameDuration: 0,
    winsByType: {},
    recentGames: [],
    allGames: [],
  });

  const [trainingData, setTrainingData] = useState([]);
  const [trainingStats, setTrainingStats] = useState({
    totalCorrect: 0,
    totalWrong: 0,
    correctnessByMoves: {},
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Pagination and filtering for all games
  const [currentPage, setCurrentPage] = useState(1);
  const [gamesPerPage] = useState(15);
  const [gameFilter, setGameFilter] = useState("all"); // all, online, ai
  const [sortOrder, setSortOrder] = useState("desc"); // desc, asc

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

          const variants = gameModeLabels.map((mode) => {
            const wins = games.filter(
              (game) => game.result === "win" && game.gameMode === mode
            ).length;
            const losses = games.filter(
              (game) => game.result === "loss" && game.gameMode === mode
            ).length;

            return {
              variant: mode.replace("-", " ").toUpperCase(),
              wins,
              losses,
              ratio: losses === 0 ? wins : wins / losses,
            };
          });
          setVariantStats(variants);
        } else {
          setError("No games found.");
          setStatsData([]);
          setVariantStats([]);
          setGameHistory([]);
        }
      } catch (err) {
        console.error("Error fetching game history:", err);
        setError("Failed to fetch statistics. Please try again later.");
      }
    };

    const fetchOnlineGameStats = async () => {
      try {
        // Fetch completed online games where user participated
        const onlineGamesQuery = query(
          collection(db, "live-games"),
          where("players", "array-contains", currentUser.uid),
          where("status", "==", "completed")
        );

        const onlineGamesSnapshot = await getDocs(onlineGamesQuery);

        if (!onlineGamesSnapshot.empty) {
          const onlineGames = onlineGamesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Calculate statistics
          const totalGames = onlineGames.length;
          let wins = 0;
          let losses = 0;
          let draws = 0;
          const friendWinRates = {}; // Track wins/losses by opponent

          let totalDuration = 0;
          const recentGames = [];

          onlineGames.forEach((game) => {
            // Get opponent info
            const opponentId = game.players?.find(
              (id) => id !== currentUser.uid
            );
            const opponentName = game.playerNames
              ? Object.entries(game.playerNames).find(
                  ([id, name]) => id !== currentUser.uid
                )?.[1] || "Unknown"
              : "Unknown";

            console.log("Game data:", {
              gameId: game.id,
              players: game.players,
              playerNames: game.playerNames,
              opponentId,
              opponentName,
              winner: game.winner,
            }); // Debug log

            // Initialize friend stats if not exists
            if (opponentName !== "Unknown" && opponentId) {
              if (!friendWinRates[opponentName]) {
                friendWinRates[opponentName] = {
                  wins: 0,
                  losses: 0,
                  draws: 0,
                  total: 0,
                };
              }
            }

            // Determine if current user won, lost, or drew
            if (game.winner === "draw") {
              draws++;
              if (opponentName !== "Unknown" && opponentId) {
                friendWinRates[opponentName].draws++;
                friendWinRates[opponentName].total++;
              }
            } else if (game.winner === currentUser.uid) {
              wins++;
              if (opponentName !== "Unknown" && opponentId) {
                friendWinRates[opponentName].wins++;
                friendWinRates[opponentName].total++;
              }
            } else {
              losses++;
              if (opponentName !== "Unknown" && opponentId) {
                friendWinRates[opponentName].losses++;
                friendWinRates[opponentName].total++;
              }
            }

            // Calculate game duration if available
            if (game.createdAt && game.endedAt) {
              const duration = game.endedAt.toDate() - game.createdAt.toDate();
              totalDuration += duration;
            }

            // Add to recent games for display
            recentGames.push({
              id: game.id,
              opponent: opponentName,
              result:
                game.winner === "draw"
                  ? "draw"
                  : game.winner === currentUser.uid
                  ? "win"
                  : "loss",
              winType: game.winType || "connection",
              moves: game.movesString?.length || game.moves?.length || 0,
              endedAt: game.endedAt,
              gameCode: game.gameCode,
            });
          });

          // Calculate top friends by win rate (minimum 2 games played)
          console.log("Friend win rates data:", friendWinRates); // Debug log

          const topFriends = Object.entries(friendWinRates)
            .filter(([_, stats]) => stats.total >= 2) // Only friends with at least 2 games
            .map(([friend, stats]) => ({
              name: friend,
              winRate: ((stats.wins / stats.total) * 100).toFixed(1),
              gamesPlayed: stats.total,
              wins: stats.wins,
              losses: stats.losses,
              draws: stats.draws,
            }))
            .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate)) // Sort by win rate descending
            .slice(0, 5); // Top 5 friends

          console.log("Top friends calculated:", topFriends); // Debug log

          const winRate =
            totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : 0;
          const avgGameDuration =
            totalGames > 0
              ? Math.round(totalDuration / totalGames / 1000 / 60)
              : 0; // in minutes

          // Sort recent games by date
          recentGames.sort((a, b) => {
            if (!a.endedAt || !b.endedAt) return 0;
            return b.endedAt.toDate() - a.endedAt.toDate();
          });

          setOnlineStats({
            totalGames,
            wins,
            losses,
            draws,
            winRate: parseFloat(winRate),
            avgGameDuration,
            topFriends,
            recentGames: recentGames.slice(0, 10), // Keep only 10 most recent for summary
            allGames: recentGames, // Store all games for pagination
          });
        } else {
          setOnlineStats({
            totalGames: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            avgGameDuration: 0,
            topFriends: [],
            recentGames: [],
            allGames: [],
          });
        }
      } catch (err) {
        console.error("Error fetching online game stats:", err);
      }
    };

    // Fetch both types of data
    Promise.all([fetchGameHistory(), fetchOnlineGameStats()]).finally(() =>
      setLoading(false)
    );
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const fetchTrainingData = async () => {
      try {
        const trainingRef = collection(
          db,
          "players",
          currentUser.uid,
          "trainingSessions"
        );
        const trainingQuery = query(trainingRef, orderBy("timestamp", "desc"));
        const trainingSnapshot = await getDocs(trainingQuery);

        if (!trainingSnapshot.empty) {
          const trainingDocs = trainingSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setTrainingData(trainingDocs);

          const { totalCorrect, totalWrong, correctnessByMoves } =
            aggregateTrainingStats(trainingDocs);
          setTrainingStats({
            totalCorrect,
            totalWrong,
            correctnessByMoves,
          });
        }
      } catch (err) {
        console.error("Error fetching training data:", err);
      }
    };

    fetchTrainingData();
  }, [currentUser]);

  const aggregateTrainingStats = (trainingDocs) => {
    let totalCorrect = 0;
    let totalWrong = 0;
    const correctnessByMoves = {};

    trainingDocs.forEach((doc) => {
      const { result, moves } = doc;
      const moveCount = moves || 0;

      if (result === "correct") {
        totalCorrect++;
        if (!correctnessByMoves[moveCount]) {
          correctnessByMoves[moveCount] = { correct: 0, wrong: 0 };
        }
        correctnessByMoves[moveCount].correct++;
      } else if (result === "incorrect") {
        totalWrong++;
        if (!correctnessByMoves[moveCount]) {
          correctnessByMoves[moveCount] = { correct: 0, wrong: 0 };
        }
        correctnessByMoves[moveCount].wrong++;
      }
    });

    return { totalCorrect, totalWrong, correctnessByMoves };
  };

  const moveCounts = Object.keys(trainingStats.correctnessByMoves)
    .map(Number)
    .sort((a, b) => a - b);

  const correctCountsForMoves = moveCounts.map(
    (count) => trainingStats.correctnessByMoves[count].correct
  );
  const wrongCountsForMoves = moveCounts.map(
    (count) => trainingStats.correctnessByMoves[count].wrong
  );

  const correctRatiosForMoves = moveCounts.map((count) => {
    const { correct, wrong } = trainingStats.correctnessByMoves[count];
    return wrong === 0 ? correct : correct / wrong;
  });

  const sortedGameHistory = [...gameHistory].sort(
    (a, b) => a.timestamp.seconds - b.timestamp.seconds
  );

  const winLossCumulative = sortedGameHistory.reduce(
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

  // Combine all games for paginated view
  const getAllGames = () => {
    const aiGames = gameHistory.map((game) => ({
      ...game,
      gameType: "AI Game",
      opponent: game.difficulty
        ? game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1)
        : "N/A",
      date: new Date(game.timestamp.seconds * 1000),
      isOnline: false,
      moves: game.moves || 0,
      gameMode: game.gameMode || "connect-4",
    }));

    const onlineGames = onlineStats.allGames
      ? onlineStats.allGames.map((game) => ({
          ...game,
          gameType: "Online",
          opponent: game.opponent,
          date: game.endedAt ? new Date(game.endedAt.toDate()) : new Date(),
          isOnline: true,
          moves: game.movesString?.length || game.moves?.length || 0,
          gameMode: "Multiplayer",
        }))
      : [];

    return [...aiGames, ...onlineGames];
  };

  // Filter and sort games
  const getFilteredGames = () => {
    let allGames = getAllGames();

    // Apply filter
    if (gameFilter === "online") {
      allGames = allGames.filter((game) => game.isOnline);
    } else if (gameFilter === "ai") {
      allGames = allGames.filter((game) => !game.isOnline);
    }

    // Apply sort
    allGames.sort((a, b) => {
      if (sortOrder === "desc") {
        return b.date - a.date;
      } else {
        return a.date - b.date;
      }
    });

    return allGames;
  };

  // Pagination logic
  const filteredGames = getFilteredGames();
  const totalGames = filteredGames.length;
  const totalPages = Math.ceil(totalGames / gamesPerPage);
  const startIndex = (currentPage - 1) * gamesPerPage;
  const endIndex = startIndex + gamesPerPage;
  const currentGames = filteredGames.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleFilterChange = (filter) => {
    setGameFilter(filter);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleSortChange = (order) => {
    setSortOrder(order);
    setCurrentPage(1); // Reset to first page when sort changes
  };

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>Player Statistics</h2>
            <div className="d-flex gap-2"></div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <Loading />}

      {/* Quick Overview Cards */}
      {!loading && (onlineStats.totalGames > 0 || gameHistory.length > 0) && (
        <div className="row mb-4">
          <div className="col-md-3 col-sm-6 mb-3">
            <div
              className={`card text-center shadow-sm ${
                darkMode ? "bg-dark text-white border-secondary" : "bg-white"
              }`}
            >
              <div className="card-body">
                <h4 className="card-title text-primary">
                  {onlineStats.totalGames}
                </h4>
                <p
                  className={`card-text ${
                    darkMode ? "text-light" : "text-muted"
                  }`}
                >
                  Online Games
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6 mb-3">
            <div
              className={`card text-center shadow-sm ${
                darkMode ? "bg-dark text-white border-secondary" : "bg-white"
              }`}
            >
              <div className="card-body">
                <h4 className="card-title text-info">{gameHistory.length}</h4>
                <p
                  className={`card-text ${
                    darkMode ? "text-light" : "text-muted"
                  }`}
                >
                  vs AI Games
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6 mb-3">
            <div
              className={`card text-center shadow-sm ${
                darkMode ? "bg-dark text-white border-secondary" : "bg-white"
              }`}
            >
              <div className="card-body">
                <h4 className="card-title text-warning">
                  {onlineStats.winRate}%
                </h4>
                <p
                  className={`card-text ${
                    darkMode ? "text-light" : "text-muted"
                  }`}
                >
                  Online Win Rate
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6 mb-3">
            <div
              className={`card text-center shadow-sm ${
                darkMode ? "bg-dark text-white border-secondary" : "bg-white"
              }`}
            >
              <div className="card-body">
                <h4 className="card-title text-success">
                  {trainingStats.totalCorrect}
                </h4>
                <p
                  className={`card-text ${
                    darkMode ? "text-light" : "text-muted"
                  }`}
                >
                  Training Correct
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && dailyLabels.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <hr />
          <h4 className="text-center">
            Cumulative Win-to-Loss Ratio Over Time
          </h4>
          <LineGraph
            labels={dailyLabels}
            values={dailyRatios}
            color={"#20BF55"}
          />
        </div>
      )}


      {!loading && (
        <div className="accordion d-none d-md-block" id="statsAccordion">
          {/* Online Games Section - Hidden on mobile, visible on desktop */}
          <div className="accordion-item">
            <h2 className="accordion-header" id="headingOnline">
              <button
                className="accordion-button"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseOnline"
                aria-expanded="true"
                aria-controls="collapseOnline"
              >
                Online Multiplayer Games
              </button>
            </h2>
            <div
              id="collapseOnline"
              className="accordion-collapse collapse show"
              aria-labelledby="headingOnline"
              data-bs-parent="#statsAccordion"
            >
              <div className="accordion-body">
                {onlineStats.totalGames > 0 ? (
                  <>
                    {/* Summary Cards */}
                    <div className="row mb-4">
                      <div className="col-md-3 col-sm-6 mb-3">
                        <div
                          className={`card text-center ${
                            darkMode ? "bg-dark text-white" : "bg-light"
                          }`}
                        >
                          <div className="card-body">
                            <h5 className="card-title text-primary">
                              {onlineStats.totalGames}
                            </h5>
                            <p className="card-text">Total Games</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3 col-sm-6 mb-3">
                        <div
                          className={`card text-center ${
                            darkMode ? "bg-dark text-white" : "bg-light"
                          }`}
                        >
                          <div className="card-body">
                            <h5 className="card-title text-success">
                              {onlineStats.wins}
                            </h5>
                            <p className="card-text">Wins</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3 col-sm-6 mb-3">
                        <div
                          className={`card text-center ${
                            darkMode ? "bg-dark text-white" : "bg-light"
                          }`}
                        >
                          <div className="card-body">
                            <h5 className="card-title text-danger">
                              {onlineStats.losses}
                            </h5>
                            <p className="card-text">Losses</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3 col-sm-6 mb-3">
                        <div
                          className={`card text-center ${
                            darkMode ? "bg-dark text-white" : "bg-light"
                          }`}
                        >
                          <div className="card-body">
                            <h5 className="card-title text-warning">
                              {onlineStats.draws}
                            </h5>
                            <p className="card-text">Draws</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Stats */}
                    <div className="row mb-4">
                      <div className="col-md-6">
                        <div
                          className={`card ${
                            darkMode ? "bg-dark text-white" : "bg-light"
                          }`}
                        >
                          <div className="card-body">
                            <h6 className="card-title">Win Rate</h6>
                            <div className="progress mb-2">
                              <div
                                className="progress-bar bg-success"
                                role="progressbar"
                                style={{ width: `${onlineStats.winRate}%` }}
                                aria-valuenow={onlineStats.winRate}
                                aria-valuemin="0"
                                aria-valuemax="100"
                              ></div>
                            </div>
                            <small>{onlineStats.winRate}% win rate</small>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div
                          className={`card ${
                            darkMode ? "bg-dark text-white" : "bg-light"
                          }`}
                        >
                          <div className="card-body">
                            <h6 className="card-title">
                              Average Game Duration
                            </h6>
                            <h4 className="text-info">
                              {onlineStats.avgGameDuration} min
                            </h4>
                            <small>Average time per game</small>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Charts */}
                    <div className="row">
                      <div className="col-md-6">
                        <h5>Game Results</h5>
                        <BarGraph
                          labels={["Wins", "Losses", "Draws"]}
                          values={[
                            onlineStats.wins,
                            onlineStats.losses,
                            onlineStats.draws,
                          ]}
                          color="#20BF55"
                        />
                      </div>
                      <div className="col-md-6">
                        <h5>Top Friends by Win Rate</h5>
                        {onlineStats.topFriends &&
                        onlineStats.topFriends.length > 0 ? (
                          <div className="table-responsive">
                            <table
                              className={`table table-sm ${
                                darkMode ? "table-dark" : ""
                              }`}
                            >
                              <thead>
                                <tr>
                                  <th>Friend</th>
                                  <th>Win Rate</th>
                                  <th>Record</th>
                                </tr>
                              </thead>
                              <tbody>
                                {onlineStats.topFriends.map((friend, index) => (
                                  <tr key={friend.name}>
                                    <td>{friend.name}</td>
                                    <td>
                                      <span
                                        className={`fw-bold ${
                                          parseFloat(friend.winRate) >= 50
                                            ? "text-success"
                                            : "text-danger"
                                        }`}
                                      >
                                        {friend.winRate}%
                                      </span>
                                    </td>
                                    <td>
                                      <small
                                        className={`${
                                          darkMode ? "text-light" : "text-muted"
                                        }`}
                                      >
                                        {friend.wins}-{friend.losses}
                                        {friend.draws > 0
                                          ? `-${friend.draws}`
                                          : ""}
                                      </small>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-3">
                            <small className="text-muted">
                              Play at least 2 games with friends to see rankings
                            </small>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-5">
                    <i
                      className="bi bi-controller"
                      style={{ fontSize: "3rem", color: "#6c757d" }}
                    ></i>
                    <h5 className="mt-3 text-muted">No Online Games Played</h5>
                    <p className="text-muted">
                      Start playing online multiplayer games to see your
                      statistics here!
                    </p>
                    <Link to="/play/online" className="btn btn-primary">
                      <i className="bi bi-play-circle me-1"></i>
                      Play Online
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Single Player Games Section */}
          <div className="accordion-item">
            <h2 className="accordion-header" id="headingOriginal">
              <button
                className="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseOriginal"
                aria-expanded="false"
                aria-controls="collapseOriginal"
              >
                Single Player vs AI
              </button>
            </h2>
            <div
              id="collapseOriginal"
              className="accordion-collapse collapse"
              aria-labelledby="headingOriginal"
              data-bs-parent="#statsAccordion"
            >
              <div className="accordion-body">
                <div className="row">
                  <div className="col-md-4 col-sm-12">
                    <h4>Wins by Difficulty</h4>
                    <BarGraph
                      labels={statsData.map((data) => data.difficulty)}
                      values={statsData.map((data) => data.wins)}
                    />
                  </div>
                  <div className="col-md-4 col-sm-12">
                    <h4>Losses by Difficulty</h4>
                    <BarGraph
                      labels={statsData.map((data) => data.difficulty)}
                      values={statsData.map((data) => data.losses)}
                    />
                  </div>
                  <div className="col-md-4 col-sm-12">
                    <h4>Win-to-Loss Ratio by Difficulty</h4>
                    <BarGraph
                      labels={statsData.map((data) => data.difficulty)}
                      values={statsData.map((data) => data.ratio)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="accordion-item">
            <h2 className="accordion-header" id="headingVariants">
              <button
                className="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseVariants"
                aria-expanded="false"
                aria-controls="collapseVariants"
              >
                Game Variants
              </button>
            </h2>
            <div
              id="collapseVariants"
              className="accordion-collapse collapse"
              aria-labelledby="headingVariants"
              data-bs-parent="#statsAccordion"
            >
              <div className="accordion-body">
                <div className="row">
                  <div className="col-md-4 col-sm-12">
                    <h4>Wins by Variant</h4>
                    <BarGraph
                      labels={variantStats.map((data) => data.variant)}
                      values={variantStats.map((data) => data.wins)}
                    />
                  </div>
                  <div className="col-md-4 col-sm-12">
                    <h4>Losses by Variant</h4>
                    <BarGraph
                      labels={variantStats.map((data) => data.variant)}
                      values={variantStats.map((data) => data.losses)}
                    />
                  </div>
                  <div className="col-md-4 col-sm-12">
                    <h4>Win-to-Loss Ratio by Variant</h4>
                    <BarGraph
                      labels={variantStats.map((data) => data.variant)}
                      values={variantStats.map((data) => data.ratio)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="accordion-item">
            <h2 className="accordion-header" id="headingTraining">
              <button
                className="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseTraining"
                aria-expanded="false"
                aria-controls="collapseTraining"
              >
                Position Training
              </button>
            </h2>
            <div
              id="collapseTraining"
              className="accordion-collapse collapse"
              aria-labelledby="headingTraining"
              data-bs-parent="#statsAccordion"
            >
              <div className="accordion-body">
                {trainingData.length > 0 ? (
                  <>
                    <div className="row my-3">
                      <div className="col-md-6 col-sm-12 text-center">
                        <h4>Total Correct</h4>
                        <p style={{ fontSize: "1.5rem" }}>
                          {trainingStats.totalCorrect}
                        </p>
                      </div>
                      <div className="col-md-6 col-sm-12 text-center">
                        <h4>Total Wrong</h4>
                        <p style={{ fontSize: "1.5rem" }}>
                          {trainingStats.totalWrong}
                        </p>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-4 col-sm-12">
                        <h4>Correct by Moves</h4>
                        <BarGraph
                          labels={moveCounts}
                          values={correctCountsForMoves}
                          color="green"
                        />
                      </div>
                      <div className="col-md-4 col-sm-12">
                        <h4>Wrong by Moves</h4>
                        <BarGraph
                          labels={moveCounts}
                          values={wrongCountsForMoves}
                          color="red"
                        />
                      </div>
                      <div className="col-md-4 col-sm-12">
                        <h4>Win to Loss Ratio by Moves</h4>
                        <BarGraph
                          labels={moveCounts.map((count) => count.toString())}
                          values={correctRatiosForMoves}
                          color="blue"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <p>No training data available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading &&
        (gameHistory.length > 0 || onlineStats.recentGames.length > 0) && (
          <>
            <h3 className="mt-5 mb-3">All Game History</h3>

            {/* Filter and Sort Controls */}
            <div className="row mb-3">
              <div className="col-12 col-md-6 mb-2 mb-md-0">
                <div
                  className="btn-group w-100 w-md-auto"
                  role="group"
                  aria-label="Game type filter"
                >
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      gameFilter === "all"
                        ? "btn-primary"
                        : "btn-outline-primary"
                    }`}
                    onClick={() => handleFilterChange("all")}
                  >
                    All ({getAllGames().length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      gameFilter === "online"
                        ? "btn-primary"
                        : "btn-outline-primary"
                    }`}
                    onClick={() => handleFilterChange("online")}
                  >
                    Online ({getAllGames().filter((g) => g.isOnline).length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      gameFilter === "ai"
                        ? "btn-primary"
                        : "btn-outline-primary"
                    }`}
                    onClick={() => handleFilterChange("ai")}
                  >
                    vs AI ({getAllGames().filter((g) => !g.isOnline).length})
                  </button>
                </div>
              </div>
              {/* Sort controls - visible on desktop only */}
              <div className="col-md-6 text-end d-none d-md-block">
                <div className="btn-group" role="group" aria-label="Sort order">
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      sortOrder === "desc"
                        ? "btn-secondary"
                        : "btn-outline-secondary"
                    }`}
                    onClick={() => handleSortChange("desc")}
                  >
                    <i className="bi bi-sort-down me-1"></i>Newest First
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      sortOrder === "asc"
                        ? "btn-secondary"
                        : "btn-outline-secondary"
                    }`}
                    onClick={() => handleSortChange("asc")}
                  >
                    <i className="bi bi-sort-up me-1"></i>Oldest First
                  </button>
                </div>
              </div>
            </div>

            {/* Games Table */}
            <div className="table-responsive">
              <table
                className={`table table-striped table-hover ${
                  darkMode ? "table-dark" : ""
                } table-sm`}
              >
                {/* Desktop Headers */}
                <thead
                  className={`${
                    darkMode ? "table-dark" : "table-light"
                  } d-none d-md-table-header-group`}
                >
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Game Type</th>
                    <th scope="col">Opponent/Difficulty</th>
                    <th scope="col">Result</th>
                    <th scope="col">Moves</th>
                    <th scope="col">Game Mode</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>

                {/* Mobile Headers - Simplified */}
                <thead
                  className={`${
                    darkMode ? "table-dark" : "table-light"
                  } d-md-none`}
                >
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Opponent</th>
                    <th scope="col">Result</th>
                    <th scope="col">Review</th>
                  </tr>
                </thead>

                <tbody>
                  {currentGames.length > 0 ? (
                    currentGames.map((game, index) => (
                      <tr
                        key={
                          game.isOnline
                            ? `online-${game.id || startIndex + index}`
                            : `ai-${game.id}`
                        }
                      >
                        {/* Date - Visible on both desktop and mobile */}
                        <td className="p-2">
                          <small>
                            {game.date.toLocaleDateString()}
                            <span className="d-none d-md-block text-muted">
                              {game.date.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </small>
                        </td>

                        {/* Game Type - Desktop only */}
                        <td className="p-2 d-none d-md-table-cell">
                          <span
                            className={`badge ${
                              game.isOnline ? "bg-primary" : "bg-info"
                            }`}
                          >
                            {game.gameType}
                          </span>
                        </td>

                        {/* Opponent - Both desktop and mobile but styled differently */}
                        <td className="p-2">
                          <span className="d-md-none">
                            <small>
                              {game.opponent.length > 10
                                ? game.opponent.substring(0, 10) + "..."
                                : game.opponent}
                            </small>
                          </span>
                          <span className="d-none d-md-inline">
                            {game.opponent}
                          </span>
                        </td>

                        {/* Result - Both desktop and mobile */}
                        <td className="p-2">
                          <span
                            className={`badge ${
                              game.result === "win"
                                ? "bg-success"
                                : game.result === "loss"
                                ? "bg-danger"
                                : "bg-warning text-dark"
                            }`}
                          >
                            {game.result === "win"
                              ? "W"
                              : game.result === "loss"
                              ? "L"
                              : "D"}
                          </span>
                        </td>

                        {/* Moves - Desktop only */}
                        <td className="p-2 d-none d-md-table-cell">
                          {game.moves}
                        </td>

                        {/* Game Mode - Desktop only */}
                        <td className="p-2 d-none d-md-table-cell">
                          <small>
                            {game.isOnline
                              ? "Multiplayer"
                              : (game.gameMode || "")
                                  .replace("-", " ")
                                  .toUpperCase()}
                          </small>
                        </td>

                        {/* Action - Both desktop and mobile but styled differently */}
                        <td className="p-2">
                          {!game.isOnline ? (
                            <Link
                              to={`/review/${currentUser.uid}/${game.id}`}
                              className="btn btn-sm btn-outline-primary d-none d-md-inline-block"
                            >
                              <i className="bi bi-play-circle me-1"></i>
                              Review
                            </Link>
                          ) : (
                            <Link
                              to={`/review/online/${game.id}`}
                              className="btn btn-sm btn-outline-primary d-none d-md-inline-block"
                            >
                              <i className="bi bi-play-circle me-1"></i>
                              Review
                            </Link>
                          )}

                          {/* Mobile Review button - icon only */}
                          <Link
                            to={
                              !game.isOnline
                                ? `/review/${currentUser.uid}/${game.id}`
                                : `/review/online/${game.id}`
                            }
                            className="btn btn-sm btn-outline-primary p-1 d-md-none"
                          >
                            <i className="bi bi-play-circle"></i>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center py-4">
                        <i className="bi bi-search me-2"></i>
                        No games found for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Sort Controls - at the bottom */}
            <div className="d-md-none mt-3 mb-2">
              <div
                className="btn-group w-100"
                role="group"
                aria-label="Sort order"
              >
                <button
                  type="button"
                  className={`btn btn-sm ${
                    sortOrder === "desc"
                      ? "btn-secondary"
                      : "btn-outline-secondary"
                  }`}
                  onClick={() => handleSortChange("desc")}
                >
                  <i className="bi bi-sort-down me-1"></i>Newest First
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${
                    sortOrder === "asc"
                      ? "btn-secondary"
                      : "btn-outline-secondary"
                  }`}
                  onClick={() => handleSortChange("asc")}
                >
                  <i className="bi bi-sort-up me-1"></i>Oldest First
                </button>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <nav aria-label="Game history pagination">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mt-3">
                  <div className="text-muted text-center text-md-start mb-2 mb-md-0">
                    <small>
                      Showing {startIndex + 1} to{" "}
                      {Math.min(endIndex, totalGames)} of {totalGames} games
                    </small>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <i className="bi bi-chevron-left"></i>{" "}
                      <span className="d-none d-md-inline">Last</span>
                    </button>

                    <span className={`text px-2 px-md-3`}>
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <span className="d-none d-md-inline">Next</span>{" "}
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                </div>
              </nav>
            )}
          </>
        )}

      {!loading &&
        statsData.length === 0 &&
        gameHistory.length === 0 &&
        onlineStats.totalGames === 0 && (
          <div className="text-center py-5">
            <i
              className="bi bi-graph-up"
              style={{ fontSize: "4rem", color: "#6c757d" }}
            ></i>
            <h4 className="mt-3 text-muted">No Statistics Available</h4>
            <p className="text-muted">
              Start playing games to track your progress!
            </p>
            <div className="d-flex justify-content-center gap-2 mt-3">
              <Link to="/play/online" className="btn btn-primary">
                <i className="bi bi-controller me-1"></i>
                Play Online
              </Link>
              <Link to="/play/bot" className="btn btn-outline-primary">
                <i className="bi bi-robot me-1"></i>
                Play vs AI
              </Link>
              <Link to="/training" className="btn btn-outline-secondary">
                <i className="bi bi-puzzle me-1"></i>
                Practice
              </Link>
            </div>
          </div>
        )}
    </div>
  );
};

export default Stats;
