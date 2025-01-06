import React, { useRef, useEffect } from "react";

const BarGraph = ({ labels = [], values = [], scale = 1 }) => {
  const canvasRef = useRef(null);

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
    ctx.stroke();

    const yStep = maxValue / 5; 
    for (let i = 0; i <= maxValue; i += yStep) {
      const y = canvas.height - padding - (i / maxValue) * height;
      ctx.fillText(Math.round(i), padding - 30 * scale, y + 5 * scale);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.strokeStyle = "#ccc";
      ctx.stroke();
    }

    values.forEach((value, index) => {
      const x = padding + index * barWidth;
      const barHeight = (value / maxValue) * height;
      const y = canvas.height - padding - barHeight;

      ctx.fillStyle = "blue";
      ctx.fillRect(x + 5 * scale, y, barWidth - 10 * scale, barHeight);

      ctx.fillStyle = "black";
      ctx.textAlign = "center";
      ctx.font = `${12 * scale}px Arial`;
      ctx.fillText(
        labels[index],
        x + barWidth / 2,
        canvas.height - padding + 20 * scale
      );
    });
  }, [labels, values, scale]);

  return <canvas ref={canvasRef} style={{ border: "1px solid black" }} />;
};

export default BarGraph;
