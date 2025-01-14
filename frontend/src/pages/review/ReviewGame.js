import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db } from "../../config/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Board from "../../components/board/Board";
import { getBestMove } from "../../config/api";

const ReviewGame = () => {
  const { gameId, playerId } = useParams();
  const [board, setBoard] = useState(Array(6).fill(Array(7).fill(0)));
  const [moves, setMoves] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [precomputedBestMoves, setPrecomputedBestMoves] = useState([]);
  const [latestMove, setLatestMove] = useState(null);
  const [scores, setScores] = useState(Array(7).fill(null)); // Store scores for each column
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchGame = async () => {
      try {
        console.log("Fetching game data...");
        setLoading(true);
        const gameRef = doc(db, "players", playerId, "games", gameId);
        const gameSnap = await getDoc(gameRef);

        if (gameSnap.exists()) {
          const gameData = gameSnap.data();
          console.log("Game data fetched successfully:", gameData);

          const moves = gameData.moves
            .split("")
            .map((move) => parseInt(move, 10) - 1);
          setMoves(moves);

          if (gameData.bestMoves.length > 0) {
            console.log("Using precomputed best moves:", gameData.bestMoves);
            setPrecomputedBestMoves(gameData.bestMoves);
          } else {
            console.log("Best moves not precomputed. Precomputing now...");
            await precomputeBestMoves(moves, gameRef);
          }
        } else {
          setError("Game not found.");
        }
      } catch (err) {
        console.error("Error fetching game data:", err);
        setError("Failed to fetch game. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [gameId, playerId]);

  const precomputeBestMoves = async (moves, gameRef) => {
    setEvaluating(true);
    let tempBoard = Array(6)
      .fill(0)
      .map(() => Array(7).fill(0));
    const bestMoves = [];

    for (let i = 0; i < moves.length; i++) {
      const player = i % 2 === 0 ? 1 : -1;
      const opponent = -player;

      try {
        console.log(
          `Fetching best move for player ${opponent} at move index ${i}...`
        );
        const response = await getBestMove(tempBoard, opponent);
        console.log(`Best move fetched: ${response.data.best_move}`);
        bestMoves.push(response.data.best_move);
      } catch (err) {
        console.error(`Error fetching best move at move index ${i}:`, err);
        bestMoves.push(null);
      }

      tempBoard = applyMove(tempBoard, moves[i], player);
    }

    try {
      console.log("Saving precomputed best moves to Firestore:", bestMoves);
      await updateDoc(gameRef, { bestMoves });
      console.log("Best moves saved successfully.");
      setPrecomputedBestMoves(bestMoves);
    } catch (err) {
      console.error("Error saving best moves to Firestore:", err);
    }

    setEvaluating(false);
  };

  const applyMove = (board, column, player) => {
    const newBoard = board.map((row) => [...row]);
    let latestRow = null;

    for (let row = newBoard.length - 1; row >= 0; row--) {
      if (newBoard[row][column] === 0) {
        newBoard[row][column] = player;
        latestRow = row;
        break;
      }
    }

    setLatestMove({ row: latestRow, column });
    return newBoard;
  };

  const renderBoardAtMove = (moveIndex) => {
    let tempBoard = Array(6)
      .fill(0)
      .map(() => Array(7).fill(0));
    for (let i = 0; i <= moveIndex; i++) {
      const player = i % 2 === 0 ? 1 : -1;
      tempBoard = applyMove(tempBoard, moves[i], player);
    }
    setBoard(tempBoard);
    fetchColumnScores(tempBoard, currentMoveIndex % 2 === 0 ? 1 : -1);
  };

  const fetchColumnScores = async (board, currentPlayer) => {
    try {
      console.log("Fetching column scores...");
      const response = await getBestMove(board, currentPlayer);
      console.log(
        "Column scores fetched successfully:",
        response.data.column_scores
      );
      setScores(response.data.column_scores || Array(7).fill(null));
    } catch (err) {
      console.error("Error fetching column scores:", err);
      setScores(Array(7).fill(null));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowRight" && currentMoveIndex < moves.length - 1) {
      setCurrentMoveIndex((prevIndex) => {
        const newIndex = prevIndex + 1;
        renderBoardAtMove(newIndex);
        return newIndex;
      });
    } else if (e.key === "ArrowLeft" && currentMoveIndex > 0) {
      setCurrentMoveIndex((prevIndex) => {
        const newIndex = prevIndex - 1;
        renderBoardAtMove(newIndex);
        return newIndex;
      });
    }
  };

  useEffect(() => {
    if (moves.length > 0) {
      renderBoardAtMove(currentMoveIndex);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moves, currentMoveIndex]);

  if (loading) {
    return <p>Loading game...</p>;
  }

  if (error) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  if (evaluating) {
    return <p>Computing evaluation...</p>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Review Game</h2>
      <Board
        board={board}
        highlightedColumns={[precomputedBestMoves[currentMoveIndex]]}
        latestMove={latestMove}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "10px",
        }}
      >
        {scores.map((score, index) => (
          <div key={index} style={{ textAlign: "center" }}>
            <p>Column {index + 1}</p>
            <p>{score !== null ? score : "N/A"}</p>
          </div>
        ))}
      </div>
      <p>
        Best move for this turn:{" "}
        {precomputedBestMoves[currentMoveIndex] !== null
          ? precomputedBestMoves[currentMoveIndex] + 1
          : "Not available"}
      </p>
      <p>
        Move {currentMoveIndex + 1} of {moves.length}
      </p>
    </div>
  );
};

export default ReviewGame;
