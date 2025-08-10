import React, { useRef, useEffect, useState } from "react";
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

const LineGraph = ({ labels = [], values = [], scale = 1, color }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const { darkMode } = useTheme();
  const [animationProgress, setAnimationProgress] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });
  const [hoveredPoint, setHoveredPoint] = useState(null);

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
    const duration = 1500; // 1.5 second animation

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setAnimationProgress(easeProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [values, labels]);

  // Mouse interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const padding = Math.max(50, dimensions.width * 0.08);
      const width = dimensions.width - padding * 2;

      if (values.length > 1) {
        const closestIndex = Math.round(
          ((x - padding) / width) * (values.length - 1)
        );
        if (closestIndex >= 0 && closestIndex < values.length) {
          setHoveredPoint(closestIndex);
        } else {
          setHoveredPoint(null);
        }
      }
    };

    const handleMouseLeave = () => {
      setHoveredPoint(null);
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [dimensions, values]);

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

    const padding = Math.max(50, dimensions.width * 0.08);
    const width = dimensions.width - padding * 2;
    const height = dimensions.height - padding * 2;

    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const valueRange = maxValue - minValue || 1;

    // Enhanced grid
    ctx.strokeStyle = darkMode ? "#333" : "#f0f0f0";
    ctx.lineWidth = 1;

    const ySteps = 5;
    const stepHeight = height / ySteps;

    // Horizontal grid lines
    for (let i = 0; i <= ySteps; i++) {
      const y = padding + i * stepHeight;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(dimensions.width - padding, y);
      ctx.stroke();
    }

    // Vertical grid lines
    if (values.length > 1) {
      const verticalSteps = Math.min(values.length - 1, 6);
      for (let i = 0; i <= verticalSteps; i++) {
        const x = padding + (i * width) / verticalSteps;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, dimensions.height - padding);
        ctx.stroke();
      }
    }

    // Y-axis labels
    ctx.font = `${Math.max(
      11,
      dimensions.width * 0.028
    )}px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = darkMode ? "#aaa" : "#666";

    for (let i = 0; i <= ySteps; i++) {
      const value = maxValue - (i * valueRange) / ySteps;
      const formattedValue =
        value % 1 === 0 ? value.toString() : value.toFixed(1);
      const y = padding + i * stepHeight;
      ctx.fillText(formattedValue, padding - 10, y + 4);
    }

    // Gradient fill under the line
    if (values.length > 1) {
      const gradient = ctx.createLinearGradient(
        0,
        padding,
        0,
        dimensions.height - padding
      );
      const lineColor = color || (darkMode ? "#17a2b8" : "#007bff");

      // Helper function to add transparency to hex color
      const addTransparency = (hexColor, alpha) => {
        if (!hexColor || typeof hexColor !== "string") return "rgba(0,0,0,0)";

        let hex = hexColor.replace("#", "");
        if (hex.length === 3) {
          hex = hex
            .split("")
            .map((char) => char + char)
            .join("");
        }

        if (hex.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(hex)) {
          return hexColor; // Return original if invalid
        }

        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };

      gradient.addColorStop(0, addTransparency(lineColor, 0.25)); // 25% opacity
      gradient.addColorStop(1, addTransparency(lineColor, 0)); // 0% opacity

      ctx.beginPath();
      values.forEach((value, index) => {
        const x = padding + (index * width) / (values.length - 1);
        const animatedValue = minValue + (value - minValue) * animationProgress;
        const y =
          dimensions.height -
          padding -
          ((animatedValue - minValue) / valueRange) * height;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      // Close the path for gradient fill
      const lastX =
        padding + ((values.length - 1) * width) / (values.length - 1);
      ctx.lineTo(lastX, dimensions.height - padding);
      ctx.lineTo(padding, dimensions.height - padding);
      ctx.closePath();

      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Enhanced line with smooth curves
    if (values.length > 1) {
      ctx.beginPath();

      values.forEach((value, index) => {
        const x = padding + (index * width) / (values.length - 1);
        const animatedValue = minValue + (value - minValue) * animationProgress;
        const y =
          dimensions.height -
          padding -
          ((animatedValue - minValue) / valueRange) * height;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          // Smooth curve using quadratic curves
          const prevX = padding + ((index - 1) * width) / (values.length - 1);
          const prevAnimatedValue =
            minValue + (values[index - 1] - minValue) * animationProgress;
          const prevY =
            dimensions.height -
            padding -
            ((prevAnimatedValue - minValue) / valueRange) * height;

          const cpX = (prevX + x) / 2;
          ctx.quadraticCurveTo(cpX, prevY, x, y);
        }
      });

      ctx.strokeStyle = color || (darkMode ? "#17a2b8" : "#007bff");
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    // Enhanced data points
    values.forEach((value, index) => {
      const x = padding + (index * width) / (values.length - 1);
      const animatedValue = minValue + (value - minValue) * animationProgress;
      const y =
        dimensions.height -
        padding -
        ((animatedValue - minValue) / valueRange) * height;

      const isHovered = hoveredPoint === index;
      const pointRadius = isHovered ? 6 : 4;

      // Point shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;

      // Outer circle
      ctx.fillStyle = color || (darkMode ? "#17a2b8" : "#007bff");
      ctx.beginPath();
      ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
      ctx.fill();

      // Inner circle
      ctx.fillStyle = darkMode ? "#1f2937" : "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, pointRadius - 2, 0, 2 * Math.PI);
      ctx.fill();

      ctx.shadowColor = "transparent";

      // Tooltip on hover
      if (isHovered) {
        ctx.fillStyle = darkMode ? "#374151" : "#ffffff";
        ctx.strokeStyle = darkMode ? "#6b7280" : "#e5e7eb";
        ctx.lineWidth = 1;

        const tooltipText = `${labels[index]}: ${value}`;
        ctx.font = `12px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;
        const textWidth = ctx.measureText(tooltipText).width;

        const tooltipX = Math.max(
          10,
          Math.min(x - textWidth / 2, dimensions.width - textWidth - 10)
        );
        const tooltipY = y - 30;

        // Tooltip background
        roundRect(ctx, tooltipX - 8, tooltipY - 18, textWidth + 16, 24, 4);
        ctx.fill();
        ctx.stroke();

        // Tooltip text
        ctx.fillStyle = darkMode ? "#ffffff" : "#000000";
        ctx.textAlign = "center";
        ctx.fillText(tooltipText, tooltipX + textWidth / 2, tooltipY - 4);
      }
    });

    // X-axis labels
    const selectedIndices =
      labels.length > 6
        ? getSelectedIndices(labels.length, 5)
        : [...Array(labels.length).keys()];

    ctx.fillStyle = darkMode ? "#aaa" : "#666";
    ctx.textAlign = "center";
    ctx.font = `${Math.max(
      10,
      dimensions.width * 0.025
    )}px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;

    selectedIndices.forEach((index) => {
      const x = padding + (index * width) / (labels.length - 1);
      const truncatedLabel =
        labels[index].length > 8
          ? labels[index].substring(0, 6) + "..."
          : labels[index];
      ctx.fillText(truncatedLabel, x, dimensions.height - padding + 18);
    });
  }, [
    labels,
    values,
    darkMode,
    animationProgress,
    dimensions,
    hoveredPoint,
    color,
  ]);

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

  return (
    <div ref={containerRef} className={styles.graphContainer}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
};

export default LineGraph;
