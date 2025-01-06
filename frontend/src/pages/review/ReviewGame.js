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
  const [loading, setLoading] = useState(true); 
  const [evaluating, setEvaluating] = useState(false); 
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchGame = async () => {
      try {
        setLoading(true);
        const gameRef = doc(db, "players", playerId, "games", gameId);
        const gameSnap = await getDoc(gameRef);

        if (gameSnap.exists()) {
          const gameData = gameSnap.data();
          const moves = gameData.moves
            .split("")
            .map((move) => parseInt(move, 10) - 1); 
          setMoves(moves);

          if (gameData.bestMoves.length > 0) {
            // use precomputed best moves if available
            setPrecomputedBestMoves(gameData.bestMoves);
          } else {
            // compute and save best moves if not available
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
        const response = await getBestMove(tempBoard, opponent);
        bestMoves.push(response.data.best_move);
      } catch (err) {
        console.error("Error precomputing best move:", err);
        bestMoves.push(null); 
      }

      tempBoard = applyMove(tempBoard, moves[i], player);
    }

    try {
      console.log("Updating best moves in Firestore:", bestMoves);
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
      <p>
        best move for this turn:{" "}
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
