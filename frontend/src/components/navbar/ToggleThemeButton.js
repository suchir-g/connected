import React from 'react';
import styles from './ToggleThemeButton.module.css';
import { useTheme } from '../../contexts/ThemeContext';

const ToggleThemeButton = () => {
  const { darkMode, toggleTheme } = useTheme();

  return (
    <label className={styles.switch}>
      <input
        type="checkbox"
        checked={darkMode}
        onChange={toggleTheme}
      />
      <span className={`${styles.slider} ${styles.round}`}>
        {darkMode ? <span className={styles.icon}>🌙</span> : <span className={styles.icon}>🌞</span>}
      </span>
    </label>
  );
};

export default ToggleThemeButton;