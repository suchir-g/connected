import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useTheme } from "../../contexts/ThemeContext";

const ToggleThemeButton = () => {
  const { darkMode, toggleTheme } = useTheme();

  return (
    <div className="text-center">
      <div className="form-check form-switch d-flex justify-content-center">
        <input
          className="form-check-input"
          type="checkbox"
          id="toggleTheme"
          checked={darkMode}
          onChange={toggleTheme}
        />
        <label className="form-check-label ms-2" htmlFor="toggleTheme">
        {darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        </label>
      </div>
    </div>
  );
};

export default ToggleThemeButton;
