import React, { useRef, useEffect } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import styles from "./BarGraph.module.css";

const BarGraph = ({ labels = [], values = [], scale = 1 }) => {
  const canvasRef = useRef(null);
  const { darkMode } = useTheme();

  useEffect(() => {
    if (!Array.isArray(labels) || !Array.isArray(values)) {
      console.error("Labels and values must be arrays.");
      return;
    }

    if (labels.length !== values.length) {
      console.error("Labels and values must have the same length.");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = 800 * scale;
    canvas.height = 600 * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = 80 * scale; // Adjusted padding for spacing
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;
    const barWidth = width / labels.length;

    const maxValue = Math.max(...values, 1); // Avoid divide by 0

    // Draw Y-axis and X-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.strokeStyle = darkMode ? "#ffffff" : "#000000"; // Axis color based on theme
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Y-axis labels and grid lines
    const ySteps = 5; // Number of grid lines on Y-axis
    const stepValue = maxValue / ySteps;
    const stepHeight = height / ySteps;

    ctx.font = `${16 * scale}px Arial`; // Larger font for readability
    ctx.textAlign = "right";
    for (let i = 0; i <= ySteps; i++) {
      const value = Math.round(i * stepValue);
      const y = canvas.height - padding - i * stepHeight;
      ctx.fillStyle = darkMode ? "#ffffff" : "#000000"; // Text color
      ctx.fillText(value, padding - 10 * scale, y + 5 * scale);

      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.strokeStyle = darkMode ? "#555555" : "#ccc"; // Grid color
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw bars and X-axis labels
    labels.forEach((label, index) => {
      const x = padding + index * barWidth;
      const barHeight = (values[index] / maxValue) * height;
      const y = canvas.height - padding - barHeight;

      // Draw bars
      ctx.fillStyle = darkMode ? "#17a2b8" : "#007bff"; // Bar color based on theme
      ctx.fillRect(x + 10 * scale, y, barWidth - 20 * scale, barHeight);

      // Draw X-axis labels
      ctx.fillStyle = darkMode ? "#ffffff" : "#000000"; // Text color
      ctx.textAlign = "center";
      ctx.font = `${16 * scale}px Arial`; // Larger font for labels
      ctx.fillText(
        label,
        x + barWidth / 2,
        canvas.height - padding + 30 * scale // Adjusted spacing for labels
      );
    });
  }, [labels, values, scale, darkMode]);

  return <canvas ref={canvasRef} className={styles.graphContainer} />;
};

export default BarGraph;
