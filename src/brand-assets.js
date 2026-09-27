function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawMark(context, icon, x, y, size, color, initial) {
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = Math.max(3, size * 0.085);
  context.lineCap = "round";
  context.lineJoin = "round";
  if (icon === "radio") {
    context.beginPath();
    context.arc(x, y, size * 0.08, 0, Math.PI * 2);
    context.fill();
    for (const radius of [0.24, 0.43]) {
      context.beginPath();
      context.arc(x, y, size * radius, -0.78, 0.78);
      context.stroke();
      context.beginPath();
      context.arc(x, y, size * radius, Math.PI - 0.78, Math.PI + 0.78);
      context.stroke();
    }
  } else if (icon === "shield") {
    context.beginPath();
    context.moveTo(x, y - size * 0.45);
    context.lineTo(x + size * 0.36, y - size * 0.29);
    context.lineTo(x + size * 0.3, y + size * 0.19);
    context.quadraticCurveTo(x, y + size * 0.5, x, y + size * 0.5);
    context.quadraticCurveTo(
      x,
      y + size * 0.5,
      x - size * 0.3,
      y + size * 0.19,
    );
    context.lineTo(x - size * 0.36, y - size * 0.29);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(x - size * 0.14, y);
    context.lineTo(x - size * 0.02, y + size * 0.13);
    context.lineTo(x + size * 0.18, y - size * 0.12);
    context.stroke();
  } else if (icon === "none") {
    context.font = `700 ${size * 0.72}px Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(initial, x, y + size * 0.03);
  } else {
    context.beginPath();
    context.moveTo(x - size * 0.46, y + size * 0.05);
    context.lineTo(x - size * 0.24, y + size * 0.05);
    context.lineTo(x - size * 0.12, y - size * 0.38);
    context.lineTo(x + size * 0.05, y + size * 0.38);
    context.lineTo(x + size * 0.18, y - size * 0.1);
    context.lineTo(x + size * 0.28, y + size * 0.05);
    context.lineTo(x + size * 0.46, y + size * 0.05);
    context.stroke();
  }
  context.restore();
}

function fitText(context, value, maxWidth, startSize, minSize = 34) {
  let size = startSize;
  do {
    context.font = `800 ${size}px Inter, Arial, sans-serif`;
    if (context.measureText(value).width <= maxWidth) return size;
    size -= 2;
  } while (size >= minSize);
  return minSize;
}

function drawWrappedText(context, value, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(value || "")
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.join(" ").length < words.join(" ").length && lines.length) {
    let last = lines.at(-1);
    while (last && context.measureText(`${last}…`).width > maxWidth)
      last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trim()}…`;
  }
  lines.forEach((text, index) =>
    context.fillText(text, x, y + index * lineHeight),
  );
}

function canvas(width, height) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  return element;
}

export function generateBrandAssets(settings) {
  const accent = settings.accent_color || "#21ab75";
  const light = settings.theme === "light";
  const page = light ? "#f4f7f5" : "#101214";
  const surface = light ? "#ffffff" : "#1b1e21";
  const ink = light ? "#172b26" : "#f4f5f6";
  const muted = light ? "#667870" : "#a8aeb4";
  const border = light ? "#dfe8e2" : "#353a40";
  const siteName = String(settings.site_name || "Pingward").trim();
  const description = String(
    settings.site_description || "A clear view of every service.",
  ).trim();
  const initial = siteName.match(/[a-z0-9]/i)?.[0]?.toUpperCase() || "P";

  const og = canvas(1200, 630);
  const context = og.getContext("2d");
  context.fillStyle = page;
  context.fillRect(0, 0, og.width, og.height);
  const glow = context.createRadialGradient(1040, 20, 0, 1040, 20, 520);
  glow.addColorStop(0, `${accent}55`);
  glow.addColorStop(1, `${accent}00`);
  context.fillStyle = glow;
  context.fillRect(0, 0, og.width, og.height);

  roundedRect(context, 54, 48, 1092, 534, 30);
  context.fillStyle = surface;
  context.fill();
  context.strokeStyle = border;
  context.lineWidth = 2;
  context.stroke();

  roundedRect(context, 94, 88, 72, 72, 20);
  context.fillStyle = accent;
  context.fill();
  drawMark(context, settings.brand_icon, 130, 124, 42, "#ffffff", initial);
  context.fillStyle = ink;
  context.font = "800 26px Inter, Arial, sans-serif";
  context.textBaseline = "middle";
  context.fillText(siteName, 188, 124, 700);

  context.textBaseline = "alphabetic";
  const titleSize = fitText(context, siteName, 930, 68);
  context.font = `800 ${titleSize}px Inter, Arial, sans-serif`;
  context.fillStyle = ink;
  context.fillText(siteName, 94, 286, 930);
  context.font = "400 28px Inter, Arial, sans-serif";
  context.fillStyle = muted;
  drawWrappedText(context, description, 94, 344, 880, 40, 2);

  roundedRect(context, 94, 474, 284, 56, 28);
  context.fillStyle = `${accent}22`;
  context.fill();
  context.strokeStyle = `${accent}66`;
  context.stroke();
  context.beginPath();
  context.arc(126, 502, 7, 0, Math.PI * 2);
  context.fillStyle = accent;
  context.fill();
  context.font = "700 20px Inter, Arial, sans-serif";
  context.fillStyle = ink;
  context.fillText("Live service status", 148, 509);
  context.font = "600 18px Inter, Arial, sans-serif";
  context.fillStyle = muted;
  context.textAlign = "right";
  context.fillText("Powered by Pingward", 1106, 508);

  const favicon = canvas(128, 128);
  const faviconContext = favicon.getContext("2d");
  faviconContext.fillStyle = accent;
  roundedRect(faviconContext, 0, 0, 128, 128, 28);
  faviconContext.fill();
  drawMark(faviconContext, settings.brand_icon, 64, 64, 72, "#ffffff", initial);

  return {
    og_image: og.toDataURL("image/png"),
    favicon: favicon.toDataURL("image/png"),
  };
}
