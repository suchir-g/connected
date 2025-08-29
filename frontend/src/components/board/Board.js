import "./Board.css";
import { useState, useEffect, useRef } from "react";

const Board = ({
  rows = 6, // default to 6 rows
  cols = 7, // default to 7 columns
  board = Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => 0)), // default to 6x7 empty board
  highlightedColumns = [],
  latestMove = null,
  onColumnClick,
}) => {
  // Track the previous board state to identify new pieces for animation
  const [prevBoard, setPrevBoard] = useState(null);
  const [animatingPieces, setAnimatingPieces] = useState({});
  const firstRender = useRef(true);

  // Function to play enhanced drop sound
  const playDropSound = () => {
    try {
      // Create a Web Audio context
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Create oscillator for the main "click" sound
      const clickOscillator = audioContext.createOscillator();
      const clickGain = audioContext.createGain();

      // Create oscillator for the "bounce" sound
      const bounceOscillator = audioContext.createOscillator();
      const bounceGain = audioContext.createGain();

      // Configure the initial click sound (higher pitch)
      clickOscillator.type = "sine";
      clickOscillator.frequency.setValueAtTime(520, audioContext.currentTime);
      clickOscillator.frequency.exponentialRampToValueAtTime(
        180,
        audioContext.currentTime + 0.15
      );

      clickGain.gain.setValueAtTime(0.2, audioContext.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.15
      );

      // Configure the bounce sound (lower pitch, slightly delayed)
      bounceOscillator.type = "sine";
      bounceOscillator.frequency.setValueAtTime(
        300,
        audioContext.currentTime + 0.15
      );
      bounceOscillator.frequency.exponentialRampToValueAtTime(
        120,
        audioContext.currentTime + 0.3
      );

      bounceGain.gain.setValueAtTime(0, audioContext.currentTime);
      bounceGain.gain.linearRampToValueAtTime(
        0.15,
        audioContext.currentTime + 0.15
      );
      bounceGain.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.4
      );

      // Connect and play the sounds
      clickOscillator.connect(clickGain);
      clickGain.connect(audioContext.destination);

      bounceOscillator.connect(bounceGain);
      bounceGain.connect(audioContext.destination);

      clickOscillator.start();
      bounceOscillator.start();

      clickOscillator.stop(audioContext.currentTime + 0.2);
      bounceOscillator.stop(audioContext.currentTime + 0.4);
    } catch (error) {
      // Silently fail if audio isn't supported
      console.log("Audio not supported:", error);
    }
  };

  useEffect(() => {
    // Skip animation on first render
    if (firstRender.current) {
      firstRender.current = false;
      setPrevBoard([...board.map((row) => [...row])]);
      return;
    }

    // Find new pieces to animate
    if (prevBoard) {
      const newAnimatingPieces = {};
      let hasNewPiece = false;

      // First clear previous animations to prevent conflicts
      setAnimatingPieces({});

      // Wait a tiny bit to ensure the DOM has cleared the previous animation classes
      setTimeout(() => {
        for (let col = 0; col < cols; col++) {
          for (let row = 0; row < rows; row++) {
            // If this position is now filled but was empty before
            if (board[row][col] !== 0 && prevBoard[row][col] === 0) {
              hasNewPiece = true;
              const key = `${row}-${col}`;
              newAnimatingPieces[key] = {
                row,
                col,
                player: board[row][col],
              };
            }
          }
        }

        if (hasNewPiece) {
          // Play drop sound when new piece is added
          playDropSound();
          // Set the animating pieces
          setAnimatingPieces(newAnimatingPieces);

          // Clear animation flags after animation duration
          setTimeout(() => {
            setAnimatingPieces({});
          }, 700); // Slightly longer than animation duration (600ms) to ensure completion
        }
      }, 10); // Small delay to ensure DOM updates
    }

    setPrevBoard([...board.map((row) => [...row])]);
  }, [board, rows, cols]);

  console.log("Board props:", {
    rows,
    cols,
    board,
    highlightedColumns,
    latestMove,
    onColumnClick,
  });

  // if the board hasn't loaded render a small loading board component

  if (
    !Array.isArray(board) ||
    board.length !== rows ||
    !board.every((row) => Array.isArray(row) && row.length === cols)
  ) {
    return <div className="board-loading">LOADING BOARD...</div>;
  }

  return (
    <div className="board">
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="board-row">
          {row.map((cell, colIndex) => {
            const isHighlighted = highlightedColumns.some((highlighted) => {
              // since popout moves are negative values, deal with the highlighted seperatley
              if (highlighted < 0) {
                return Math.abs(highlighted) - 1 === colIndex;
              }
              return highlighted === colIndex;
            });

            const isPopoutMove = highlightedColumns.includes(-(colIndex + 1));

            // determine if this cell is the latest move
            const isLatestMove =
              latestMove &&
              latestMove.row === rowIndex &&
              latestMove.column === colIndex;

            // apply appropriate cell classes
            let cellClass = "cell";
            if (cell === 1) cellClass += " player1";
            else if (cell === -1) cellClass += " player2";

            if (isHighlighted) {
              cellClass += isPopoutMove
                ? " popout-highlighted"
                : " highlighted";
            }
            if (isLatestMove) cellClass += " latest-move";

            return (
              <div
                key={colIndex}
                className={cellClass}
                onClick={() => onColumnClick && onColumnClick(colIndex)}
                style={{ cursor: onColumnClick ? "pointer" : "default" }}
              >
                {cell === 1 && (
                  <div
                    key={`piece-${rowIndex}-${colIndex}-${Date.now()}`}
                    className={`piece player1-piece ${
                      animatingPieces[`${rowIndex}-${colIndex}`]
                        ? "dropping"
                        : ""
                    }`}
                    style={
                      animatingPieces[`${rowIndex}-${colIndex}`]
                        ? {}
                        : { top: 0, visibility: "visible" }
                    }
                  />
                )}
                {cell === -1 && (
                  <div
                    key={`piece-${rowIndex}-${colIndex}-${Date.now()}`}
                    className={`piece player2-piece ${
                      animatingPieces[`${rowIndex}-${colIndex}`]
                        ? "dropping"
                        : ""
                    }`}
                    style={
                      animatingPieces[`${rowIndex}-${colIndex}`]
                        ? {}
                        : { top: 0, visibility: "visible" }
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default Board;
