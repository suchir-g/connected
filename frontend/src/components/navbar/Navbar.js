import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const Navbar = () => {
  const { currentUser, userData } = useAuth();

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">
          Connected
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/">
                Home
              </Link>
            </li>
            {currentUser ? (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/dashboard">
                    Dashboard
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/play/local">
                    Play Local
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/play/bot">
                    Play Bot
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/stats">
                    Stats
                  </Link>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">
                    Login
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/register">
                    Register
                  </Link>
                </li>
              </>
            )}
          </ul>

          {currentUser && (
            <ul className="navbar-nav ms-auto">
              {userData ? (
                <li className="nav-item">
                  <Link
                    className="nav-link"
                    to={`/player/${userData.username}`}
                  >
                    <i className="bi bi-person-circle fs-4"></i>
                  </Link>
                </li>
              ) : (
                <li className="nav-item">
                  <span className="nav-link disabled">Loading...</span>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
