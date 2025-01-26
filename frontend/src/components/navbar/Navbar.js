import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import styles from "./Navbar.module.css";

const Navbar = () => {
  const { currentUser, userData } = useAuth(); // Access `currentUser` and `userData` from AuthContext
  const { darkMode } = useTheme(); // Access `darkMode` from ThemeContext

  return (
    <nav
      className={`navbar navbar-expand-lg ${
        darkMode ? "navbar-dark bg-dark" : "navbar-light bg-light"
      } ${styles.navbar}`}
    >
      <div className="container-fluid">
        {/* Brand */}
        <NavLink
          className={`navbar-brand fw-bold ${styles.navLink}`}
          to={currentUser ? "/dashboard" : "/"}
        >
          <span style={{ color: darkMode ? "#ffffff" : "#000000" }}>
            CONNECTED
          </span>
        </NavLink>

        {/* Toggler Button */}
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

        {/* Navbar Links */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            {currentUser ? (
              <>
                {/* Dropdown for Play */}
                <li className="nav-item dropdown">
                  <span
                    className={`nav-link dropdown-toggle ${styles.navLink}`}
                    id="navbarDropdown"
                    role="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    Play
                  </span>
                  <ul
                    className={`dropdown-menu ${
                      darkMode ? "dropdown-menu-dark" : ""
                    } ${styles.dropdownMenu}`}
                    aria-labelledby="navbarDropdown"
                  >
                    <li>
                      <NavLink
                        className={`dropdown-item ${styles.navLink}`}
                        to="/play/local"
                      >
                        Play Local
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        className={`dropdown-item ${styles.navLink}`}
                        to="/play/bot"
                      >
                        Play Bot
                      </NavLink>
                    </li>
                  </ul>
                </li>

                {/* Stats Link */}
                <li className="nav-item">
                  <NavLink className={`nav-link ${styles.navLink}`} to="/stats">
                    Stats
                  </NavLink>
                </li>

                {/* Social Link */}
                <li className="nav-item">
                  <NavLink
                    className={`nav-link ${styles.navLink}`}
                    to="/social"
                  >
                    Social
                  </NavLink>
                </li>
              </>
            ) : (
              <>
                {/* Login Link */}
                <li className="nav-item">
                  <NavLink className={`nav-link ${styles.navLink}`} to="/login">
                    Login
                  </NavLink>
                </li>

                {/* Register Link */}
                <li className="nav-item">
                  <NavLink
                    className={`nav-link ${styles.navLink}`}
                    to="/register"
                  >
                    Register
                  </NavLink>
                </li>
              </>
            )}
          </ul>

          {/* User Profile or Loading Indicator */}
          {currentUser && (
            <ul className="navbar-nav ms-auto">
              {userData ? (
                <li className="nav-item">
                  <NavLink
                    className={`nav-link ${styles.navLink}`}
                    to={`/player/${userData.username}`}
                  >
                    <i className="bi bi-person-circle fs-4"></i>
                  </NavLink>
                </li>
              ) : (
                <li className="nav-item">
                  <span className={`nav-link disabled ${styles.navLink}`}>
                    Loading...
                  </span>
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
