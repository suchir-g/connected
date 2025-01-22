import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import styles from "./Navbar.module.css";

const Navbar = () => {
  const { currentUser, userData } = useAuth();
  const { darkMode } = useTheme();

  return (
    <nav
      className={`navbar navbar-expand-lg navbar-dark bg-dark ${styles["navbar-dark-theme"]}`}
    >
      <div className="container-fluid">
        <NavLink className={`navbar-brand fw-bold ${styles.navLink}`} to="/dashboard">
          CONNECTED
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
                    className={`dropdown-menu dropdown-menu-dark ${styles["dropdown-menu"]}`}
                    aria-labelledby="navbarDropdown"
                  >
                    <li>
                      <NavLink
                        className={`dropdown-item ${styles.navLink}`}
                        to="/play/local"
                        activeClassName={styles.active}
                      >
                        Play Local
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        className={`dropdown-item ${styles.navLink}`}
                        to="/play/bot"
                        activeClassName={styles.active}
                      >
                        Play Bot
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        className={`dropdown-item ${styles.navLink}`}
                        to="/play/variants/bot"
                        activeClassName={styles.active}
                      >
                        Play Variants
                      </NavLink>
                    </li>
                  </ul>
                </li>
                <li className="nav-item">
                  <NavLink
                    className={`nav-link ${styles.navLink}`}
                    to="/stats"
                    activeClassName={styles.active}
                  >
                    Stats
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink
                    className={`nav-link ${styles.navLink}`}
                    to="/social"
                    activeClassName={styles.active}
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
                    to="/login"
                    activeClassName={styles.active}
                  >
                    Login
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink
                    className={`nav-link ${styles.navLink}`}
                    to="/register"
                    activeClassName={styles.active}
                  >
                    Register
                  </NavLink>
                </li>
              </>
            )}
          </ul>

          {currentUser && (
            <ul className="navbar-nav ms-auto">
              {userData ? (
                <li className="nav-item">
                  <NavLink
                    className={`nav-link ${styles.navLink}`}
                    to={`/player/${userData.username}`}
                    activeClassName={styles.active}
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
