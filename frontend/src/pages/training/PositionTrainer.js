import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Board from "../../components/board/Board";
import { getBestMove, generateRandomBoard } from "../../config/api";

const PositionTrainer = () => {
  const [board, setBoard] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [trainingType, setTrainingType] = useState("early");
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const generateTrainingPosition = async (type) => {
    setLoading(true);
    setTrainingType(type);
    try {
      const randomMoves =
        type === "early"
          ? 6 + Math.floor(Math.random() * 4)
          : 20 + Math.floor(Math.random() * 5);

      console.log(`Generating ${type} game position with ${randomMoves} moves`);

      const response = await generateRandomBoard(randomMoves);
      console.log("API Response for Board Generation:", response.data);

      if (response.data && response.data.board) {
        setBoard(response.data.board);
        setFeedback("");

        const player = randomMoves % 2 === 0 ? 1 : -1;
        setCurrentPlayer(player);
      } else {
        throw new Error("invalid board data from API.");
      }
    } catch (error) {
      setFeedback("Failed to generate training position. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const type = searchParams.get("type") || "early";
    setTrainingType(type);

    generateTrainingPosition(type);
  }, [searchParams]);

  const handlePlayerMove = async (column) => {
    try {
      const expertMove = await getBestMove(board, currentPlayer);
      if (column === expertMove.data.best_move) {
        setFeedback(`Well done! Right column!`);
      } else {
        setFeedback(
          `WRONG. You chose column ${column + 1} - best move was column ${
            expertMove.data.best_move + 1
          }.`
        );
      }
    } catch (error) {
      console.error("Error evaluating move:", error);
      setFeedback("Failed to evaluate your move. Please try again.");
    }
  };

  return (
    <div className="container mt-4" style={{minHeight: "100vh"}}>
      <h1 className="text-center">
        {trainingType === "early" ? "Early Game Trainer" : "Late Game Trainer"}
      </h1>

      {loading ? (
        <p className="text-center">Loading training position...</p>
      ) : (
        <>
          <p className="text-center">
            {currentPlayer === 1 ? (
              <span style={{ color: "red" }}> Player 1's Move (Red)</span>
            ) : (
              <span style={{ color: "gold" }}> Player 2's Move (Yellow)</span>
            )}
          </p>

          <Board board={board} onColumnClick={handlePlayerMove} />
          <p className="text-center mt-3">{feedback}</p>
          <div className="d-flex justify-content-center mt-4">
            <button
              className="btn btn-primary me-3"
              onClick={() => generateTrainingPosition("early")}
            >
              Early Game Training
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => generateTrainingPosition("late")}
            >
              Late Game Training
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PositionTrainer;
