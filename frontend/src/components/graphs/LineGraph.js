import React, { useRef, useEffect } from "react";

const LineGraph = ({ labels = [], values = [], scale = 1 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!Array.isArray(labels) || !Array.isArray(values)) {
      console.error("Invalid labels or values provided to LineGraph.");
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

    const maxValue = Math.max(...values, 1);
    const yStep = height / maxValue;
    const xStep = width / (values.length - 1 || 1);

    ctx.beginPath();
    ctx.moveTo(padding, padding); // TOP LEFT
    ctx.lineTo(padding, canvas.height - padding); // BOTTOM LEFT
    ctx.lineTo(canvas.width - padding, canvas.height - padding); //BOTTOM RIGHT
    ctx.stroke();

    const yTicks = 5;
    const yIncrement = maxValue / yTicks;

    for (let i = 0; i <= yTicks; i++) {
      const value = Math.round(i * yIncrement);
      const y = canvas.height - padding - i * (height / yTicks);

      ctx.strokeStyle = "#ccc";
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();

      ctx.fillStyle = "black";
      ctx.font = `${12 * scale}px Arial`;
      ctx.fillText(value, padding - 40 * scale, y + 5 * scale);
    }

    ctx.beginPath();
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2 * scale;

    values.forEach((value, index) => {
      const x = padding + index * xStep;
      const y = canvas.height - padding - value * yStep;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    values.forEach((value, index) => {
      const x = padding + index * xStep;
      const y = canvas.height - padding - value * yStep;

      ctx.beginPath();
      ctx.arc(x, y, 5 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();

      ctx.fillStyle = "black";
      ctx.font = `${12 * scale}px Arial`;
      ctx.fillText(value.toFixed(2), x - 10 * scale, y - 10 * scale);
    });

    labels.forEach((label, index) => {
      const x = padding + index * xStep;

      ctx.fillStyle = "black";
      ctx.textAlign = "center";
      ctx.font = `${12 * scale}px Arial`;
      ctx.fillText(label, x, canvas.height - padding + 20 * scale);
    });
  }, [labels, values, scale]);

  return <canvas ref={canvasRef} style={{ border: "1px solid black" }} />;
};

export default LineGraph;
