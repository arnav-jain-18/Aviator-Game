const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const balanceEl = document.getElementById("balance");
const betInput = document.getElementById("betInput");
const autoInput = document.getElementById("autoInput");
const autoToggle = document.getElementById("autoToggle");
const startBtn = document.getElementById("startBtn");
const cashBtn = document.getElementById("cashBtn");
const resetBtn = document.getElementById("resetBtn");
const messageEl = document.getElementById("message");
const historyEl = document.getElementById("history");

const C = {
  bg: "#0a0d18",
  panel: "#121626",
  white: "#f5f7ff",
  muted: "#969eb4",
  green: "#2adc87",
  red: "#f5485c",
  gold: "#ffc248",
  cyan: "#46beff",
  line: "#303852"
};

let balance = 10000;
let bet = 500;
let multiplier = 1;
let crashPoint = null;
let roundActive = false;
let cashedOut = false;
let crashed = false;
let gameOver = false;
let message = "Place your bet to start";
let history = [];

let planeX = 85;
let planeY = 390;
let flightTime = 0;
let lastTime = performance.now();

let autoEnabled = false;
let crashFall = false;
let crashFallTime = 0;

let bgScroll = 0;
let clouds = [
  [180, 170, .8, 1],
  [470, 145, .6, .8],
  [700, 230, 1.1, 1.2],
  [300, 360, .5, .7],
  [620, 410, .9, .9]
];

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function W() { return canvas.clientWidth; }
function H() { return canvas.clientHeight; }

function setMessage(msg) {
  message = msg;
  messageEl.textContent = msg;
}

function clampBet() {
  bet = Math.max(10, Math.min(bet, balance > 0 ? balance : 10));
  bet = Math.round(bet * 100) / 100;
  betInput.value = Number.isInteger(bet) ? bet : bet.toFixed(2);
}

function crashValue() {
  const r = Math.random();
  if (r < .04) return +(1.01 + Math.random() * .15).toFixed(2);
  if (r < .70) return +(1.10 + Math.random() * 2.90).toFixed(2);
  if (r < .95) return +(2.00 + Math.random() * 8.00).toFixed(2);
  return +(5.00 + Math.random() * 94.00).toFixed(2);
}

function startRound() {
  if (roundActive || gameOver) return;

  const value = parseFloat(betInput.value);
  if (Number.isFinite(value) && value > 0) bet = value;
  clampBet();

  if (bet <= 0 || bet > balance) {
    setMessage("Invalid bet amount");
    return;
  }

  balance -= bet;
  crashPoint = crashValue();
  multiplier = 1;
  flightTime = 0;
  planeX = 85;
  planeY = H() - 80;
  roundActive = true;
  cashedOut = false;
  crashed = false;
  crashFall = false;

  setMessage("Flying...");
  updateUI();
}

function cashOut() {
  if (!roundActive || cashedOut || crashed) return;

  const winnings = bet * multiplier;
  balance += winnings;
  cashedOut = true;

  addHistory(multiplier, true);
  setMessage(`Cashed out at ${multiplier.toFixed(2)}x — plane still flying`);
  updateUI();
}

function crash() {
  roundActive = false;
  crashed = true;
  crashFall = true;
  crashFallTime = 0;

  addHistory(crashPoint, false);
  setMessage(`CRASHED at ${crashPoint.toFixed(2)}x`);
  updateUI();
}

function resetGame() {
  balance = 10000;
  bet = 500;
  multiplier = 1;
  crashPoint = null;
  roundActive = false;
  cashedOut = false;
  crashed = false;
  gameOver = false;
  crashFall = false;
  crashFallTime = 0;
  flightTime = 0;
  planeX = 85;
  planeY = H() - 80;
  history = [];
  autoEnabled = false;
  autoToggle.className = "toggle off";
  autoToggle.textContent = "OFF";
  autoInput.value = "2.00";
  betInput.value = "500";
  setMessage("Place your bet to start");
  renderHistory();
  updateUI();
}

function addHistory(value, won) {
  history.unshift({ value, won });
  if (history.length > 8) history.pop();
  renderHistory();
}

function renderHistory() {
  historyEl.innerHTML = history.map(h =>
    `<span class="history-item ${h.won ? "win" : "loss"}">${h.value.toFixed(2)}x</span>`
  ).join("");
}

function updateUI() {
  balanceEl.textContent = balance.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  cashBtn.disabled = !roundActive || cashedOut;
  startBtn.disabled = roundActive || gameOver;
  startBtn.textContent = roundActive ? "ROUND RUNNING" : "PLACE BET";
  cashBtn.textContent = cashedOut ? "CASHED OUT" : "CASH OUT";
}

function drawBackground(dt) {
  const w = W(), h = H();

  bgScroll = (bgScroll + (20 + Math.min(multiplier, 100) * 2.5) * dt) % 360;

  ctx.fillStyle = C.panel;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 9; i++) {
    const shade = 12 + i * 2;
    ctx.fillStyle = `rgb(${shade}, ${shade + 3}, ${shade + 20})`;
    ctx.fillRect(0, i * h / 9, w, h / 9 + 2);
  }

  // Subtle moving circular arcs — never a crash trail.
  const cx = w * .53;
  const cy = h * .57;
  ctx.strokeStyle = "#1f2236";
  ctx.lineWidth = 2;

  for (const r of [90, 150, 215, 285, 360]) {
    ctx.beginPath();
    ctx.arc(cx - bgScroll * .25, cy, r, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }

  for (let i = 0; i < 20; i++) {
    const x = (i * 79 + bgScroll * (1 + Math.min(multiplier, 50) * .02)) % w;
    const y = 25 + ((i * 43) % Math.max(50, h - 50));
    ctx.fillStyle = "#3a415c";
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFlightCurve() {
  if (!roundActive || crashed) return;

  const w = W(), h = H();
  const startX = 5;
  const startY = h - 28;

  // Jet nose is the END of the curve, so the curve follows the jet.
  const jetX = Math.max(startX + 5, Math.min(w - 5, planeX + 55));
  const jetY = planeY;

  const c1x = startX + Math.max(95, (jetX - startX) * .28);
  const c1y = startY - 2;
  const c2x = jetX - Math.max(75, (jetX - startX) * .24);
  const c2y = jetY + Math.max(25, (startY - jetY) * .28);

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(c1x, c1y, c2x, c2y, jetX, jetY);

  ctx.strokeStyle = "rgba(95,70,25,.65)";
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(c1x, c1y, c2x, c2y, jetX, jetY);
  ctx.strokeStyle = "#ffb723";
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(Math.max(startX, jetX - 115), jetY + 20);
  ctx.bezierCurveTo(
    Math.max(startX, jetX - 80), jetY + 10,
    jetX - 30, jetY + 4,
    jetX, jetY
  );
  ctx.strokeStyle = "#ffdc55";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawJet() {
  const x = planeX;
  const y = planeY;
  const body = crashed ? C.red : C.gold;
  const dark = crashed ? "#782630" : "#694614";
  const glass = "#37beeF";

  ctx.save();
  ctx.translate(x, y);

  if (!crashed) {
    ctx.fillStyle = "#ff9f25";
    ctx.beginPath();
    ctx.moveTo(-8, -5);
    ctx.lineTo(-38, 0);
    ctx.lineTo(-8, 5);
    ctx.fill();

    ctx.fillStyle = "#ffe06a";
    ctx.beginPath();
    ctx.moveTo(-7, -3);
    ctx.lineTo(-25, 0);
    ctx.lineTo(-7, 3);
    ctx.fill();
  }

  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(35, 0, 39, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(37, 0, 36, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(62, -9);
  ctx.lineTo(92, 0);
  ctx.lineTo(62, 9);
  ctx.fill();

  // Wings
  ctx.beginPath();
  ctx.moveTo(25, -5);
  ctx.lineTo(2, -43);
  ctx.lineTo(20, -39);
  ctx.lineTo(46, -7);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(25, 5);
  ctx.lineTo(2, 43);
  ctx.lineTo(20, 39);
  ctx.lineTo(46, 7);
  ctx.fill();

  // Tail
  ctx.beginPath();
  ctx.moveTo(8, -5);
  ctx.lineTo(-12, -28);
  ctx.lineTo(7, -22);
  ctx.lineTo(22, -5);
  ctx.fill();

  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(43, -7);
  ctx.lineTo(58, -5);
  ctx.lineTo(66, -1);
  ctx.lineTo(47, -2);
  ctx.fill();

  ctx.strokeStyle = C.white;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, -6);
  ctx.lineTo(59, -4);
  ctx.stroke();

  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(21, -13, 11, 3.5, 0, 0, Math.PI * 2);
  ctx.ellipse(21, 13, 11, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = C.cyan;
  ctx.beginPath();
  ctx.arc(68, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawMultiplier() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 68px Arial";
  ctx.fillStyle = crashed ? C.red : C.white;
  ctx.fillText(`x${multiplier.toFixed(2)}`, W() / 2, 110);

  ctx.font = "800 28px Arial";
  ctx.fillStyle = crashed ? C.red : roundActive ? C.cyan : C.muted;
  ctx.fillText(
    crashed ? "CRASHED" : cashedOut ? "CASHED OUT • STILL FLYING" : roundActive ? "FLYING" : "READY",
    W() / 2, 175
  );
}

function drawCrashDive(dt) {
  if (!crashFall) return;

  crashFallTime += dt;
  const velocity = 850 + crashFallTime * crashFallTime * 1900;
  planeX += 35 * dt;
  planeY += velocity * dt;

  if (planeY >= H() + 45) {
    planeY = H() + 45;
    crashFall = false;
  }
}

function update(dt) {
  if (roundActive) {
    flightTime += dt;

    multiplier += dt * (0.35 + multiplier * 0.12);

    const speedFactor = Math.min(multiplier, 100);
    const horizontalSpeed = 120 + Math.pow(speedFactor, 1.18) * 30;
    planeX += horizontalSpeed * dt;

    const progress = Math.min(1, flightTime / 9.5);
    const climb = 1 - Math.pow(1 - progress, 1.65);

    const targetY =
      (H() - 80) -
      climb * (H() * .72) -
      Math.min(38, Math.max(0, speedFactor - 2) * .65);

    planeY += (targetY - planeY) * Math.min(1, dt * 8.5);
    planeY += Math.sin(flightTime * (6 + speedFactor * .035)) * .65;

    planeY = Math.max(75, Math.min(H() - 55, planeY));

    if (planeX > W() + 40) {
      planeX = 75;
      planeY = H() - 80;
      flightTime = 0;
    }

    if (autoEnabled && !cashedOut && multiplier >= parseFloat(autoInput.value || "2")) {
      cashOut();
    }

    if (multiplier >= crashPoint) {
      multiplier = crashPoint;
      crash();
    }

    if (balance <= 0 && !roundActive) gameOver = true;
  }

  drawCrashDive(dt);
}

function render(dt) {
  ctx.clearRect(0, 0, W(), H());
  drawBackground(dt);
  drawFlightCurve();
  drawMultiplier();
  drawJet();
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, .05);
  lastTime = now;

  update(dt);
  render(dt);
  requestAnimationFrame(loop);
}

autoToggle.addEventListener("click", () => {
  autoEnabled = !autoEnabled;
  autoToggle.className = `toggle ${autoEnabled ? "on" : "off"}`;
  autoToggle.textContent = autoEnabled ? "ON" : "OFF";
  setMessage(autoEnabled
    ? `Auto cash-out ON at ${parseFloat(autoInput.value || 2).toFixed(2)}x`
    : "Auto cash-out OFF");
});

autoInput.addEventListener("change", () => {
  let v = parseFloat(autoInput.value);
  if (!Number.isFinite(v)) v = 2;
  v = Math.max(1.01, Math.min(99.99, v));
  autoInput.value = v.toFixed(2);
});

betInput.addEventListener("change", () => {
  let v = parseFloat(betInput.value);
  if (!Number.isFinite(v)) v = 500;
  bet = v;
  clampBet();
});

document.getElementById("betMinus").addEventListener("click", () => {
  if (!roundActive) {
    bet -= 100;
    clampBet();
  }
});

document.getElementById("betPlus").addEventListener("click", () => {
  if (!roundActive) {
    bet += 100;
    clampBet();
  }
});

startBtn.addEventListener("click", startRound);
cashBtn.addEventListener("click", cashOut);
resetBtn.addEventListener("click", resetGame);

document.addEventListener("keydown", e => {
  if (e.code === "Space") {
    e.preventDefault();
    startRound();
  } else if (e.key.toLowerCase() === "c") {
    cashOut();
  } else if (e.key.toLowerCase() === "r") {
    resetGame();
  } else if (e.key.toLowerCase() === "a" && !roundActive && document.activeElement !== autoInput && document.activeElement !== betInput) {
    const step = e.shiftKey ? -.5 : .5;
    let v = parseFloat(autoInput.value || "2") + step;
    v = Math.max(1.01, Math.min(99.99, v));
    autoInput.value = v.toFixed(2);
    setMessage(`Auto cash-out set to ${v.toFixed(2)}x`);
  }
});

updateUI();
renderHistory();
requestAnimationFrame(loop);
