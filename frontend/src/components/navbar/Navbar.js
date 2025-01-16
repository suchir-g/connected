import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from '../../contexts/ThemeContext';

const Navbar = () => {
  const { currentUser, userData } = useAuth();
  const { darkMode } = useTheme();

  return (
    <nav className={`navbar navbar-expand-lg navbar-dark bg-dark`}>
      <div className="container-fluid">
        <Link className="navbar-brand" to="/dashboard">
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
            {currentUser ? (
              <>
                <li className="nav-item dropdown">
                  <span
                    className="nav-link dropdown-toggle"
                    id="navbarDropdown"
                    role="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    Play
                  </span>
                  <ul
                    className="dropdown-menu"
                    aria-labelledby="navbarDropdown"
                  >
                    <li>
                      <Link className="dropdown-item" to="/play/local">
                        Play Local
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item" to="/play/bot">
                        Play Bot
                      </Link>
                    </li>
                  </ul>
                </li>
                <li className="nav-item">
                  <Link className="nav-link text-muted" to="/stats">
                    Stats
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link text-muted" to="/social">
                    Social
                  </Link>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link text-muted" to="/login">
                    Login
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link text-muted" to="/register">
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
                    className="nav-link text-muted"
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
