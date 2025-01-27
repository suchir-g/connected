import React, { useRef, useEffect } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import styles from "./LineGraph.module.css";

// helper function to get 5 equally spaced indices
const getSelectedIndices = (length, count) => {
  if (count >= length) return [...Array(length).keys()];
  const step = (length - 1) / (count - 1);
  const indices = [];
  for (let i = 0; i < count; i++) {
    let idx = Math.round(i * step);
    if (idx < 0) idx = 0;
    if (idx >= length) idx = length - 1;
    indices.push(idx);
  }
  return Array.from(new Set(indices));
};

const LineGraph = ({ labels = [], values = [], scale = 1 }) => {
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

    const padding = 50 * scale;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    const maxValue = Math.max(...values, 1); // Prevent division by zero

    // draw x-axis and y-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.strokeStyle = darkMode ? "#ffffff" : "#000000";
    ctx.lineWidth = 2;
    ctx.stroke();

    const ySteps = 5;
    const stepValue = maxValue / ySteps;
    const stepHeight = height / ySteps;

    ctx.font = `${16 * scale}px Arial`;
    ctx.textAlign = "right";
    ctx.fillStyle = darkMode ? "#ffffff" : "#000000";

    for (let i = 0; i <= ySteps; i++) {
      const value = Math.round(i * stepValue);
      const y = canvas.height - padding - i * stepHeight;
      ctx.fillText(value, padding - 10 * scale, y + 5 * scale);

      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.strokeStyle = darkMode ? "#555555" : "#ccc";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // determine which equally spaced indices to label
    const selectedIndices =
      labels.length > 5
        ? getSelectedIndices(labels.length, 5)
        : [...Array(labels.length).keys()];

    ctx.beginPath();
    ctx.moveTo(
      padding,
      canvas.height - padding - (values[0] / maxValue) * height
    );
    values.forEach((value, index) => {
      const x = padding + (index * width) / (labels.length - 1);
      const y = canvas.height - padding - (value / maxValue) * height;
      ctx.lineTo(x, y);
    });
    ctx.strokeStyle = darkMode ? "#17a2b8" : "#007bff";
    ctx.lineWidth = 2;
    ctx.stroke();

    values.forEach((value, index) => {
      const x = padding + (index * width) / (labels.length - 1);
      const y = canvas.height - padding - (value / maxValue) * height;

      ctx.fillStyle = darkMode ? "#ffffff" : "#000000";
      ctx.beginPath();
      ctx.arc(x, y, 5 * scale, 0, 2 * Math.PI);
      ctx.fill();

      if (selectedIndices.includes(index)) {
        ctx.fillStyle = darkMode ? "#ffffff" : "#000000";
        ctx.textAlign = "center";
        ctx.font = `${12 * scale}px Arial`;
        ctx.fillText(labels[index], x, canvas.height - padding + 20 * scale);
      }
    });
  }, [labels, values, scale, darkMode]);

  return <canvas ref={canvasRef} className={styles.graphContainer} />;
};

export default LineGraph;
