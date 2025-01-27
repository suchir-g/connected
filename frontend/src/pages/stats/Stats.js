import React, { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import { db } from "../../config/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
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

  const [trainingData, setTrainingData] = useState([]);
  const [trainingStats, setTrainingStats] = useState({
    totalCorrect: 0,
    totalWrong: 0,
    correctnessByMoves: {}, 
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentData = gameHistory.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(gameHistory.length / itemsPerPage);

  const handlePageChange = (page) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

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
      } finally {
        setLoading(false);
      }
    };

    fetchGameHistory();
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
    <div className="container mt-4">
      <h2 className="text-center">Statistics</h2>
      {error && <p className="text-danger">{error}</p>}
      {loading && <Loading />}

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
          <LineGraph labels={dailyLabels} values={dailyRatios} />
        </div>
      )}

      {!loading && (
        <div className="accordion" id="statsAccordion">
          <div className="accordion-item">
            <h2 className="accordion-header" id="headingOriginal">
              <button
                className="accordion-button"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseOriginal"
                aria-expanded="true"
                aria-controls="collapseOriginal"
              >
                Original
              </button>
            </h2>
            <div
              id="collapseOriginal"
              className="accordion-collapse collapse show"
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
                className="accordion-button"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseVariants"
                aria-expanded="true"
                aria-controls="collapseVariants"
              >
                Variants
              </button>
            </h2>
            <div
              id="collapseVariants"
              className="accordion-collapse collapse show"
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
                className="accordion-button"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseTraining"
                aria-expanded="true"
                aria-controls="collapseTraining"
              >
                Training
              </button>
            </h2>
            <div
              id="collapseTraining"
              className="accordion-collapse collapse show"
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

      {!loading && gameHistory.length > 0 && (
        <>
          <h3 className="mt-5 mb-3">Game History</h3>
          <div className="table-responsive">
            <table
              className={`table table-striped table-hover ${
                darkMode ? "table-dark" : ""
              }`}
            >
              <thead className={darkMode ? "table-dark" : "table-light"}>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Result</th>
                  <th scope="col">Difficulty</th>
                  <th scope="col">Moves</th>
                  <th scope="col">Game Mode</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((game) => (
                  <tr key={game.id}>
                    <td>
                      {new Date(game.timestamp.seconds * 1000).toLocaleString()}
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
                      {game.result.charAt(0).toUpperCase() +
                        game.result.slice(1)}
                    </td>
                    <td>
                      {game.difficulty
                        ? game.difficulty.charAt(0).toUpperCase() +
                          game.difficulty.slice(1)
                        : "N/A"}
                    </td>
                    <td>{game.moves}</td>
                    <td>
                      {(game.gameMode || "").replace("-", " ").toUpperCase()}
                    </td>
                    <td>
                      <Link to={`/review/${currentUser.uid}/${game.id}`}>
                        Review Game
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-center my-3">
            <button
              className="btn btn-primary me-2"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="align-self-center">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn btn-primary ms-2"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}

      {!loading && statsData.length === 0 && gameHistory.length === 0 && (
        <p>No statistics available. Play a game to start tracking!</p>
      )}
    </div>
  );
};

export default Stats;
