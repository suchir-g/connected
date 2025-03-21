import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Board from "../../components/board/Board";
import { getBestMove, generateRandomBoard } from "../../config/api";
import {
  checkWinner,
  isDrawCondition,
  applyMove,
} from "../../utilities/gameState";
import { auth, db } from "../../config/firebase";
import { doc, collection, addDoc } from "firebase/firestore";

const GAME_MODES = ["connect-4", "popout"];

const PositionTrainer = () => {
  const [gameMode, setGameMode] = useState("connect-4");
  const [difficulty, setDifficulty] = useState("very_hard");
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(7);
  const [actionMode, setActionMode] = useState("place");
  const [board, setBoard] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [trainingType, setTrainingType] = useState("early");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [moveMade, setMoveMade] = useState(false);
  const [userMove, setUserMove] = useState(null);
  const [aiBestMove, setAiBestMove] = useState(null);

  const [randomMoves, setRandomMoves] = useState(0);

  const movesRef = useRef("");

  const [searchParams] = useSearchParams();
  const [currentPlayer, setCurrentPlayer] = useState(1);

  const setDefaultGrid = useCallback((mode) => {
    setRows(6);
    setCols(7);
    setActionMode("place");
  }, []);

  const recordTrainingResult = useCallback(
    async (isCorrect, userMoveIndex, aiMove) => {
      if (!auth.currentUser) {
        console.error("User not authenticated");
        return;
      }

      try {
        let resultString;
        if (isCorrect === true) {
          resultString = "correct";
        } else if (isCorrect === false) {
          resultString = "incorrect";
        } else {
          resultString = "draw";
        }

        const bestMoveStored = aiMove !== null ? aiMove : null;

        const trainingData = {
          timestamp: new Date(),
          gameMode,
          result: resultString,
          moves: randomMoves,
          aiBestMove: bestMoveStored,
        };

        const trainingSubCollection = collection(
          doc(db, "players", auth.currentUser.uid),
          "trainingSessions"
        );
        await addDoc(trainingSubCollection, trainingData);
      } catch (err) {
        console.error("Error recording training result:", err);
      }
    },
    [gameMode, randomMoves]
  );

  const handlePlayerMove = useCallback(
    async (column) => {
      if (loading || error || moveMade) return;

      try {
        if (board[0][column] !== 0) {
          setFeedback(`Column ${column + 1} is full. Choose another column.`);
          return;
        }

        const oldBoard = board;

        const updatedBoard = applyMove(
          board,
          column,
          1,
          gameMode,
          rows,
          cols,
          actionMode
        );
        setBoard(updatedBoard);
        setFeedback("");

        const moveNotation =
          actionMode === "place" ? `${column + 1}` : `-${column + 1}`;
        movesRef.current += moveNotation;

        setMoveMade(true);
        setUserMove(column);

        if (checkWinner(updatedBoard, 1, gameMode)) {
          setFeedback("Congratulations! You win!");
          await recordTrainingResult(true, column, null);
          return;
        }
        if (isDrawCondition(updatedBoard)) {
          setFeedback("It's a draw!");
          await recordTrainingResult(null, column, null);
          return;
        }

        setLoading(true);
        const aiMoveResponse = await getBestMove(
          oldBoard,
          -1,
          gameMode,
          difficulty
        );

        if (
          aiMoveResponse.data &&
          typeof aiMoveResponse.data.best_move === "number"
        ) {
          const aiMoveVal = aiMoveResponse.data.best_move;
          setAiBestMove(aiMoveVal);

          let aiMoveAction = "place";
          let aiMoveColumn = aiMoveVal;
          if (aiMoveVal < 0) {
            aiMoveAction = "popout";
            aiMoveColumn = -aiMoveVal;
          }

          if (actionMode === aiMoveAction && aiMoveColumn === column) {
            setFeedback("Well done! You chose the best move!");
            await recordTrainingResult(true, column, aiMoveVal);
          } else {
            let bestMoveDescription = "";
            if (aiMoveAction === "place") {
              bestMoveDescription = `place in column ${aiMoveColumn + 1}`;
            } else {
              bestMoveDescription = `popout from column ${aiMoveColumn + 1}`;
            }

            setFeedback(
              `Wrong move. You chose to ${actionMode} column ${
                column + 1
              }, but the best move was to ${bestMoveDescription}.`
            );
            await recordTrainingResult(false, column, aiMoveVal);
          }
        } else {
          throw new Error("Invalid AI move data from API.");
        }
      } catch (err) {
        console.error("Error during player move:", err);
        setError(
          "An error occurred while processing your move. Please try again."
        );
      } finally {
        setLoading(false);
      }
    },
    [
      loading,
      error,
      moveMade,
      board,
      actionMode,
      gameMode,
      rows,
      cols,
      difficulty,
      recordTrainingResult,
    ]
  );

  const generateTrainingPosition = useCallback(
    async (type) => {
      setLoading(true);
      setError(null);
      setFeedback("");
      setMoveMade(false);
      setUserMove(null);
      setAiBestMove(null);
      movesRef.current = "";

      try {
        let moveCount;
        if (type === "early") {
          const evenMovesEarly = [4, 6, 8, 10];
          moveCount =
            evenMovesEarly[Math.floor(Math.random() * evenMovesEarly.length)];
        } else {
          const evenMovesLate = [20, 22, 24, 26, 30];
          moveCount =
            evenMovesLate[Math.floor(Math.random() * evenMovesLate.length)];
        }

        console.log(`Generating ${type} game position with ${moveCount} moves`);

        const response = await generateRandomBoard(
          moveCount,
          gameMode,
          difficulty
        );
        console.log("API Response for Board Generation:", response.data);

        if (response.data && Array.isArray(response.data.board)) {
          const formattedBoard = response.data.board.map((row) => [...row]);
          setBoard(formattedBoard);
          setFeedback("");
          setCurrentPlayer(1);

          setRandomMoves(moveCount);
        } else {
          throw new Error("Invalid board data from API.");
        }
      } catch (err) {
        console.error("Error generating training position:", err);
        setError("Failed to generate training position. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [gameMode, difficulty]
  );

  useEffect(() => {
    const queryMode = searchParams.get("mode");
    const type = searchParams.get("type") || "early";

    if (GAME_MODES.includes(queryMode)) {
      setGameMode(queryMode);
      setDefaultGrid(queryMode);
    } else {
      setGameMode("connect-4");
      setDefaultGrid("connect-4");
    }

    setTrainingType(type);
    generateTrainingPosition(type);
  }, [searchParams, setDefaultGrid, generateTrainingPosition]);

  const handleGameModeChange = (event) => {
    const selectedMode = event.target.value;
    setGameMode(selectedMode);
    setDefaultGrid(selectedMode);
    setActionMode("place");
    generateTrainingPosition(trainingType);
  };

  const handleTrainingTypeChange = (type) => {
    setTrainingType(type);
    generateTrainingPosition(type);
  };

  return (
    <div
      className="container mt-4 text-center"
      style={{ minHeight: "100vh", padding: "20px" }}
    >
      {error && <div className="alert alert-danger w-100">{error}</div>}

      <h1 className="my-4">Position Trainer</h1>

      <div className="row mb-4">
        <div className="col d-flex justify-content-center">
          {["early", "late"].map((type) => (
            <button
              key={type}
              className={`btn btn-${
                trainingType === type ? "primary" : "secondary"
              } me-2`}
              onClick={() => handleTrainingTypeChange(type)}
              disabled={loading || moveMade}
            >
              {type === "early" ? "Early Game Training" : "Late Game Training"}
            </button>
          ))}
        </div>
      </div>

      <p>{userMove === null && "Make your move by clicking on a column."}</p>

      <div style={{ position: "relative", display: "inline-block" }}>
        <Board
          rows={rows}
          cols={cols}
          board={board}
          highlightedColumns={[]}
          onColumnClick={handlePlayerMove}
          disabled={moveMade || loading}
        />
      </div>

      <p className="mt-3">{feedback}</p>

      <div className="row mt-4">
        <div className="col d-flex justify-content-center flex-wrap">
          <div className="me-3 mb-2">
            <label htmlFor="gameMode" className="me-2">
              Game Mode:
            </label>
            <select
              id="gameMode"
              value={gameMode}
              onChange={handleGameModeChange}
              className="form-select w-auto"
              disabled={moveMade}
            >
              {GAME_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode
                    .split("-")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")}
                </option>
              ))}
            </select>
          </div>

          {gameMode === "popout" && (
            <div className="me-3 mb-2">
              <label htmlFor="actionMode" className="me-2">
                Action Mode:
              </label>
              <select
                id="actionMode"
                value={actionMode}
                onChange={(e) => setActionMode(e.target.value)}
                className="form-select w-auto"
                disabled={moveMade}
              >
                <option value="place">Place</option>
                <option value="popout">Popout</option>
              </select>
            </div>
          )}

          <div className="mb-2">
            <button
              className="btn btn-secondary"
              onClick={() => generateTrainingPosition(trainingType)}
              disabled={loading}
            >
              Reset Training Position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PositionTrainer;
