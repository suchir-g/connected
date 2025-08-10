import React from "react";

const PlayerStatus = ({
  playerId,
  playerName,
  color,
  isCurrentPlayer,
  isMe,
  darkMode,
  isOnline = true,
}) => {
  const getColorClass = (playerColor) => {
    return playerColor === "red" ? "text-danger" : "text-warning";
  };

  const getStatusBadge = () => {
    if (isCurrentPlayer) {
      return <span className="badge bg-success ms-2">Your Turn</span>;
    }
    if (!isOnline) {
      return <span className="badge bg-secondary ms-2">Offline</span>;
    }
    return <span className="badge bg-light text-dark ms-2">Waiting</span>;
  };

  return (
    <div
      className={`card h-100 ${
        darkMode ? "bg-dark text-white border-secondary" : "bg-light"
      }`}
    >
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            {/* Player Color Indicator */}
            <div
              className={`rounded-circle me-3`}
              style={{
                width: "24px",
                height: "24px",
                backgroundColor: color === "red" ? "#dc3545" : "#ffc107",
                border: "2px solid #fff",
                boxShadow: "0 0 0 1px #dee2e6",
              }}
            ></div>

            {/* Player Info */}
            <div>
              <h6 className={`mb-0 ${getColorClass(color)}`}>
                {playerName}
                {isMe && <small className="text-muted ms-1">(You)</small>}
              </h6>
              <small className="text-muted">Playing as {color}</small>
            </div>
          </div>

          {/* Status Badge */}
          <div>{getStatusBadge()}</div>
        </div>

        {/* Connection Status */}
        <div className="mt-2">
          <small
            className={`d-flex align-items-center ${
              isOnline ? "text-success" : "text-danger"
            }`}
          >
            <span
              className={`rounded-circle me-1`}
              style={{
                width: "8px",
                height: "8px",
                backgroundColor: isOnline ? "#28a745" : "#dc3545",
              }}
            ></span>
            {isOnline ? "Online" : "Offline"}
          </small>
        </div>
      </div>
    </div>
  );
};

export default PlayerStatus;
