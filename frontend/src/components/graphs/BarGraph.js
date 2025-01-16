import React, { useRef, useEffect } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import styles from "./BarGraph.module.css";
const BarGraph = ({ labels = [], values = [], scale = 1 }) => {
  const canvasRef = useRef(null);
  const { darkMode } = useTheme();

  useEffect(() => {
    if (!Array.isArray(labels) || !Array.isArray(values)) {
      console.error("Things provided aren't arrays");
      return;
    }

    if (labels.length !== values.length) {
      console.error("Things provided aren't the same length");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = 800 * scale;
    canvas.height = 600 * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = 50 * scale;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;
    const barWidth = width / labels.length;

    const maxValue = Math.max(...values, 1); // can't divide by 0

    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.strokeStyle = darkMode ? "#ffffff" : "#000000"; // Adjust axis color based on theme
    ctx.stroke();

    const yStep = maxValue / 5;
    for (let i = 0; i <= maxValue; i += yStep) {
      const y = canvas.height - padding - (i / maxValue) * height;
      ctx.fillStyle = darkMode ? "#ffffff" : "#000000"; // Adjust text color based on theme
      ctx.fillText(Math.round(i), padding - 30 * scale, y + 5 * scale);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.strokeStyle = darkMode ? "#555555" : "#ccc"; // Adjust grid line color based on theme
      ctx.stroke();
    }

    values.forEach((value, index) => {
      const x = padding + index * barWidth;
      const barHeight = (value / maxValue) * height;
      const y = canvas.height - padding - barHeight;

      ctx.fillStyle = darkMode ? "#17a2b8" : "#007bff"; // Adjust bar color based on theme
      ctx.fillRect(x + 5 * scale, y, barWidth - 10 * scale, barHeight);

      ctx.fillStyle = darkMode ? "#ffffff" : "#000000"; // Adjust text color based on theme
      ctx.textAlign = "center";
      ctx.font = `${12 * scale}px Arial`;
      ctx.fillText(
        labels[index],
        x + barWidth / 2,
        canvas.height - padding + 20 * scale
      );
    });
  }, [labels, values, scale, darkMode]);

  return <canvas ref={canvasRef} className={styles.graphContainer} />;
};

export default BarGraph;
