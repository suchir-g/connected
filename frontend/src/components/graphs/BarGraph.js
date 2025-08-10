import React, { useRef, useEffect, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import styles from "./BarGraph.module.css";

const BarGraph = ({ labels = [], values = [], scale = 1, color }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const { darkMode } = useTheme();
  const [animationProgress, setAnimationProgress] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

  // Responsive canvas sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.min(rect.width || 400, 600),
          height: Math.min((rect.width || 400) * 0.75, 400),
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Animation effect
  useEffect(() => {
    if (values.length === 0) return;

    setAnimationProgress(0);
    const startTime = Date.now();
    const duration = 1000; // 1 second animation

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAnimationProgress(progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [values, labels]);

  useEffect(() => {
    if (!Array.isArray(labels) || !Array.isArray(values)) {
      console.error("Labels and values must be arrays.");
      return;
    }

    if (labels.length !== values.length) {
      console.error("Labels and values must have the same length.");
      return;
    }

    if (values.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // High DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    canvas.style.width = dimensions.width + "px";
    canvas.style.height = dimensions.height + "px";

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const padding = Math.max(60, dimensions.width * 0.1);
    const width = dimensions.width - padding * 2;
    const height = dimensions.height - padding * 2;
    const barWidth = width / labels.length;

    const maxValue = Math.max(...values, 1);

    // Enhanced grid and axes
    ctx.strokeStyle = darkMode ? "#444" : "#e0e0e0";
    ctx.lineWidth = 1;

    // Horizontal grid lines
    const ySteps = 5;
    const stepValue = maxValue / ySteps;
    const stepHeight = height / ySteps;

    for (let i = 0; i <= ySteps; i++) {
      const y = dimensions.height - padding - i * stepHeight;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(dimensions.width - padding, y);
      ctx.stroke();
    }

    // Y-axis labels with better formatting
    ctx.font = `${Math.max(
      12,
      dimensions.width * 0.03
    )}px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = darkMode ? "#bbb" : "#666";

    for (let i = 0; i <= ySteps; i++) {
      const value = i * stepValue;
      const formattedValue =
        value % 1 === 0 ? value.toString() : value.toFixed(1);
      const y = dimensions.height - padding - i * stepHeight;
      ctx.fillText(formattedValue, padding - 10, y + 4);
    }

    // Enhanced bars with gradients and animations
    labels.forEach((label, index) => {
      const x = padding + index * barWidth;
      const animatedValue = values[index] * animationProgress;
      const barHeight = (animatedValue / maxValue) * height;
      const y = dimensions.height - padding - barHeight;

      // Create gradient for bars
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      const barColor = color || (darkMode ? "#17a2b8" : "#007bff");

      // Parse color for gradient (assuming hex format)
      const lighterColor = adjustBrightness(barColor, 20);
      const darkerColor = adjustBrightness(barColor, -10);

      gradient.addColorStop(0, lighterColor);
      gradient.addColorStop(1, darkerColor);

      // Bar with rounded corners
      const barInnerWidth = barWidth - 20;
      const barX = x + 10;
      const radius = Math.min(4, barInnerWidth / 4);

      ctx.fillStyle = gradient;
      roundRect(ctx, barX, y, barInnerWidth, barHeight, radius);
      ctx.fill();

      // Add subtle border
      ctx.strokeStyle = darkerColor;
      ctx.lineWidth = 1;
      roundRect(ctx, barX, y, barInnerWidth, barHeight, radius);
      ctx.stroke();

      // Value labels on top of bars
      if (barHeight > 20) {
        ctx.fillStyle = darkMode ? "#fff" : "#fff";
        ctx.textAlign = "center";
        ctx.font = `bold ${Math.max(
          10,
          dimensions.width * 0.025
        )}px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;
        const displayValue =
          values[index] % 1 === 0
            ? values[index].toString()
            : values[index].toFixed(1);
        ctx.fillText(displayValue, x + barWidth / 2, y - 8);
      }
    });

    // X-axis labels with better spacing
    ctx.fillStyle = darkMode ? "#bbb" : "#666";
    ctx.textAlign = "center";
    ctx.font = `${Math.max(
      11,
      dimensions.width * 0.028
    )}px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;

    labels.forEach((label, index) => {
      const x = padding + index * barWidth;
      const truncatedLabel =
        label.length > 8 ? label.substring(0, 8) + "..." : label;
      ctx.fillText(
        truncatedLabel,
        x + barWidth / 2,
        dimensions.height - padding + 20
      );
    });
  }, [labels, values, scale, darkMode, animationProgress, dimensions]);

  // Helper function for rounded rectangles
  const roundRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // Helper function to adjust color brightness
  const adjustBrightness = (hexColor, percent) => {
    // Ensure we have a valid hex color
    if (!hexColor || typeof hexColor !== "string") {
      return hexColor || "#000000";
    }

    let hex = hexColor.replace("#", "");

    // Handle 3-character hex codes (e.g., #fff -> #ffffff)
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
    }

    // Validate hex format
    if (hex.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(hex)) {
      console.warn("Invalid hex color:", hexColor);
      return hexColor; // Return original if invalid
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const newR = Math.max(0, Math.min(255, r + (r * percent) / 100));
    const newG = Math.max(0, Math.min(255, g + (g * percent) / 100));
    const newB = Math.max(0, Math.min(255, b + (b * percent) / 100));

    return `rgb(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)})`;
  };

  return (
    <div ref={containerRef} className={styles.graphContainer}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
};

export default BarGraph;
