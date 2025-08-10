import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import InviteDropdown from "../invites/InviteDropdown";
import InviteNotifications from "../invites/InviteNotifications";
import styles from "./Navbar.module.css";

const Navbar = () => {
  const { currentUser, userData } = useAuth();
  const { darkMode } = useTheme();

  return (
    <nav
      className={`navbar navbar-expand-lg ${
        darkMode ? "navbar-dark bg-dark" : "navbar-light bg-light"
      } ${styles.navbar}`}
    >
      <div className="container-fluid">
        <NavLink
          className={`navbar-brand fw-bold ${styles.navLink}`}
          to={currentUser ? "/dashboard" : "/"}
          style={{ letterSpacing: "2px" }}
        >
          <span style={{ color: darkMode ? "#ffffff" : "#000000" }}>
            CONNECTED
          </span>
        </NavLink>

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
                        to="/play/online"
                      >
                        Play Online
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

                <li className="nav-item">
                  <NavLink className={`nav-link ${styles.navLink}`} to="/stats">
                    Stats
                  </NavLink>
                </li>

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
                <li className="nav-item">
                  <NavLink
                    className={`nav-link ${styles.navLink}`}
                    to="/play/online"
                  >
                    Play Online
                  </NavLink>
                </li>

                <li className="nav-item">
                  <NavLink className={`nav-link ${styles.navLink}`} to="/login">
                    Login
                  </NavLink>
                </li>

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

          {currentUser && (
            <ul className="navbar-nav ms-auto">
              <InviteDropdown />
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

        {/* Global invite notifications */}
        <InviteNotifications />
      </div>
    </nav>
  );
};

export default Navbar;
