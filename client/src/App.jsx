import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://neon-heist-server.onrender.com");

function App() {
  const [connected, setConnected] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [currentRoom, setCurrentRoom] = useState(null);
  const [error, setError] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [gameTime, setGameTime] = useState(60);
  const [gameOver, setGameOver] = useState(false);
  const [finalScores, setFinalScores] = useState(null);
  const [copied, setCopied] = useState(false);
  const [heistMessage, setHeistMessage] = useState("");
  const [rematchReady, setRematchReady] = useState(false);
  const [scorePopup, setScorePopup] = useState(null);
  const [homeMode, setHomeMode] = useState(null);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to Neon Heist server!");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server!");
      setConnected(false);
    });

    socket.on("room:update", (room) => {
  console.log("Room updated:", room);

  setCurrentRoom(room);
  setError("");

  if (room.status === "playing") {
    setGameStarted(true);
  }
});

    socket.on("game:start", ({ startAt, gameEndAt }) => {
  console.log("Game starting at:", startAt);

  setGameOver(false);
  setFinalScores(null);
  setRematchReady(false);
  setError("");

  let gameTimer;

  const updateCountdown = () => {
    const remaining = startAt - Date.now();

    if (remaining <= 0) {
      setCountdown(null);
      setGameStarted(true);
      setGameTime(60);

    // Start the 60-second timer only after countdown reaches 0
const actualGameEndAt = startAt + 60000;

gameTimer = setInterval(() => {
  const gameRemaining = Math.max(
    0,
    Math.ceil((actualGameEndAt - Date.now()) / 1000)
  );

  setGameTime(gameRemaining);

  if (gameRemaining <= 0) {
    clearInterval(gameTimer);
  }
}, 250);
      return true;
    }

    setCountdown(Math.ceil(remaining / 1000));
    return false;
  };

  if (updateCountdown()) {
    return;
  }

  const countdownTimer = setInterval(() => {
    if (updateCountdown()) {
      clearInterval(countdownTimer);
    }
  }, 100);

  return () => {
    clearInterval(countdownTimer);

    if (gameTimer) {
      clearInterval(gameTimer);
    }
  };
});

    socket.on("room:error", (message) => {
      setError(message);
    });
    socket.on("game:over", ({ scores }) => {
  console.log("Game Over:", scores);

  setFinalScores(scores);
  setGameOver(true);
});
socket.on("crystal:collected", ({ playerId, points }) => {
  if (playerId !== socket.id) return;

  setScorePopup(`+${points}`);

  setTimeout(() => {
    setScorePopup(null);
  }, 800);
});
socket.on("room:rematch", () => {
  console.log("Rematch started");

  setRematchReady(false);
  setGameOver(false);
  setFinalScores(null);
  setGameStarted(false);
  setCountdown(null);
  setGameTime(0);
  setError("");
});
socket.on("heist", ({ thief, victim, amount, blocked }) => {
  if (blocked) {
    setHeistMessage(`🛡️ ${victim} is protected!`);
  } else {
    setHeistMessage(
      `🕵️ ${thief} stole ${amount} points from ${victim}!`
    );
  }

  setTimeout(() => {
    setHeistMessage("");
  }, 2000);
});

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("room:update");
      socket.off("game:start");
      socket.off("room:error");
      socket.off("game:over");
      socket.off("room:rematch");
      socket.off("heist");
      socket.off("crystal:collected");
    };
  }, []);

  function createGame() {
    setError("");
    socket.emit("room:create", playerName);
  }

  function joinGame() {
    setError("");

    socket.emit("room:join", {
      roomCode,
      playerName,
    });
  }

  function startGame() {
    setError("");
    socket.emit("room:start");
  }

  function copyRoomCode() {
  navigator.clipboard.writeText(currentRoom.roomCode);
  setCopied(true);

  setTimeout(() => {
    setCopied(false);
  }, 1500);
}

  // =========================
  // GAME SCREEN
  // =========================

  if (gameStarted) {
  if (gameOver) {
    return (
      <div className="game-over">
        <h1>🏆 GAME OVER</h1>
        <h2>Final Scores</h2>

        {finalScores &&
  Object.entries(finalScores)
    .sort(([, a], [, b]) => b - a)
    .map(([playerId, score], index, sortedScores) => {
      const uniqueScores = [
        ...new Set(sortedScores.map(([, playerScore]) => playerScore))
      ];

      const rank = uniqueScores.indexOf(score) + 1;

      const medal =
        rank === 1
          ? "🥇"
          : rank === 2
          ? "🥈"
          : rank === 3
          ? "🥉"
          : `#${rank}`;

      return (
        <div className="final-score" key={playerId}>
          <span>{medal}</span>

          <span>
            {currentRoom?.players.find(
              (p) => p.id === playerId
            )?.name || "Player"}
          </span>

          <strong>{score}</strong>
        </div>
      );
    })}

        <button
  onClick={() => {
    setRematchReady(true);
    socket.emit("room:rematch");
  }}
  disabled={rematchReady}
>
  {rematchReady
    ? "✅ READY — WAITING FOR OTHERS"
    : "🔄 READY FOR REMATCH"}
</button>

<div style={{ marginTop: "15px" }}>
  {Object.values(currentRoom?.rematchReady || {}).filter(Boolean).length}
  {" / "}
  {currentRoom?.players?.length || 0}
  {" PLAYERS READY"}
</div>

      </div>
    );
  }

  return (
  <GameArena
    room={currentRoom}
    gameTime={gameTime}
    heistMessage={heistMessage}
    scorePopup={scorePopup}
  />
);
}

  // =========================
  // COUNTDOWN
  // =========================

  if (countdown !== null) {
    return (
      <div className="app">
        <HeistBackground />
        <h1>🎮 Neon Heist</h1>

        <div className="connection">
          🟢 Connected to server
        </div>

        <div className="countdown-screen">
  <p>{countdown === 1 ? "⚡ HEIST!" : "GET READY!"}</p>

  <div className="countdown">
    {countdown}
  </div>

  <span>Prepare yourself...</span>
</div>
      </div>
    );
  }

  // =========================
  // LOBBY
  // =========================

  if (currentRoom) {
    return (
      <div className="app">
        <HeistBackground />
        <h1>🎮 Neon Heist</h1>

        <div className="connection">
          🟢 Connected to server
        </div>

        <div className="room-card">
          <h2>Game Lobby</h2>

          <p>Room Code</p>

<div className="room-code-container">
  <div className="room-code">
    {currentRoom.roomCode}
  </div>

  <button onClick={copyRoomCode} className="copy-button">
    {copied ? "✅ COPIED" : "📋 COPY CODE"}
  </button>
</div>

          <p>
            Share this code with your friends.
          </p>

          <h3>
            Players ({currentRoom.players.length}/8)
          </h3>

          <div className="players">
            {currentRoom.players.map((player) => (
              <div
                className="player"
                key={player.id}
              >
                <span>
                  👤 {player.name}
                </span>

                {player.id === currentRoom.hostId && (
                  <span> 👑 Host</span>
                )}
              </div>
            ))}
          </div>

          {currentRoom.hostId === socket.id && (
            <button
              onClick={startGame}
              disabled={currentRoom.players.length < 2}
            >
              🚀 START GAME
            </button>
          )}

          {currentRoom.players.length < 2 && (
            <p>
              Waiting for another player...
            </p>
          )}

          {error && (
            <div className="error">
              ❌ {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================
  // HOME
  // =========================

  return (
    <div className="app">
      <HeistBackground />
      <h1>🎮 Neon Heist</h1>

      <div className="connection">
        {connected ? (
          <>🟢 Connected to server</>
        ) : (
          <>🔴 Connecting...</>
        )}
      </div>

      <div className="menu-card">
  <h2>Enter your name</h2>

  <input
    type="text"
    placeholder="Your name"
    value={playerName}
    onChange={(e) => setPlayerName(e.target.value)}
    maxLength={20}
  />

  {homeMode === null && (
    <>
      <button
        onClick={createGame}
        disabled={!playerName.trim()}
      >
        🎮 CREATE GAME
      </button>

      <button
        onClick={() => setHomeMode("join")}
        disabled={!playerName.trim()}
      >
        🔗 JOIN GAME
      </button>
    </>
  )}

  {homeMode === "join" && (
    <>
      <input
        type="text"
        placeholder="Room code"
        value={roomCode}
        onChange={(e) =>
          setRoomCode(e.target.value.toUpperCase())
        }
        maxLength={6}
      />

      <button
        onClick={joinGame}
        disabled={
          !playerName.trim() ||
          roomCode.length !== 6
        }
      >
        🔗 JOIN GAME
      </button>

      <button
        onClick={() => {
          setHomeMode(null);
          setRoomCode("");
        }}
      >
        ← BACK
      </button>
    </>
  )}

  {error && (
    <div className="menu-error">
      ❌ {error}
    </div>
  )}
</div>
    </div>
    );
}
// ========================================
// GAME ARENA COMPONENT
// ========================================

function GameArena({ room, gameTime, heistMessage, scorePopup }) {
  const [canHeist, setCanHeist] = useState(false);
  const canvasRef = useRef(null);

  const myScore =
  room?.scores?.[socket.id] || 0;

  const keysRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  });
useEffect(() => {
  const checkHeistRange = () => {
    if (!room || room.status !== "playing") {
      setCanHeist(false);
      return;
    }

    const me = room.players.find(
      (player) => player.id === socket.id
    );

    if (!me) {
      setCanHeist(false);
      return;
    }

    const HEIST_DISTANCE = 60;
    const HEIST_AMOUNT = 20;

    const nearbyPlayer = room.players.find((target) => {
      if (target.id === me.id) return false;

      const distance = Math.sqrt(
        Math.pow(me.x - target.x, 2) +
        Math.pow(me.y - target.y, 2)
      );

      if (distance > HEIST_DISTANCE) return false;

return true;
    });

    setCanHeist(!!nearbyPlayer);
  };

  const interval = setInterval(checkHeistRange, 100);

  return () => clearInterval(interval);
}, [room]);

  // =========================
  // KEYBOARD MOVEMENT
  // =========================

  useEffect(() => {

    function handleKeyDown(event) {

      const key = event.key.toLowerCase();
      if (key === "e") {
  socket.emit("player:heist");
}

      if (
        key === "w" ||
        key === "arrowup"
      ) {
        keysRef.current.up = true;
      }

      if (
        key === "s" ||
        key === "arrowdown"
      ) {
        keysRef.current.down = true;
      }

      if (
        key === "a" ||
        key === "arrowleft"
      ) {
        keysRef.current.left = true;
      }

      if (
        key === "d" ||
        key === "arrowright"
      ) {
        keysRef.current.right = true;
      }
    }


    function handleKeyUp(event) {
  const code = event.code;

  if (
    code === "KeyW" ||
    code === "ArrowUp"
  ) {
    keysRef.current.up = false;
  }

  if (
    code === "KeyS" ||
    code === "ArrowDown"
  ) {
    keysRef.current.down = false;
  }

  if (
    code === "KeyA" ||
    code === "ArrowLeft"
  ) {
    keysRef.current.left = false;
  }

  if (
    code === "KeyD" ||
    code === "ArrowRight"
  ) {
    keysRef.current.right = false;
  }
}


    document.addEventListener(
  "keydown",
  handleKeyDown
);

document.addEventListener(
  "keyup",
  handleKeyUp
);


    // Send movement to server repeatedly
    const movementInterval = setInterval(() => {

      let dx = 0;
      let dy = 0;


      if (keysRef.current.up) {
        dy -= 1;
      }

      if (keysRef.current.down) {
        dy += 1;
      }

      if (keysRef.current.left) {
        dx -= 1;
      }

      if (keysRef.current.right) {
        dx += 1;
      }


      // Nothing pressed
      if (dx === 0 && dy === 0) {
        return;
      }


      // Normalize diagonal movement
      if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
      }


      socket.emit("player:move", {
        dx,
        dy,
      });

    }, 30);


    return () => {

      document.removeEventListener(
  "keydown",
  handleKeyDown
);

document.removeEventListener(
  "keyup",
  handleKeyUp
);

      clearInterval(movementInterval);

    };

  }, []);
    useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !room) return;

    const ctx = canvas.getContext("2d");

    // Canvas size
    canvas.width = 900;
    canvas.height = 550;

    // Clear screen
    ctx.fillStyle = "#090b14";
    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Draw grid
    ctx.strokeStyle = "#1c2340";
    ctx.lineWidth = 1;

    for (let x = 0; x <= canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw crystals
    // Draw server-controlled crystals
if (room.crystals) {

  room.crystals.forEach((crystal) => {

    drawCrystal(
      ctx,
      crystal.x,
      crystal.y
    );

  });
}
// =========================
// DRAW POWER-UPS
// =========================
room.powerUps?.forEach((powerUp) => {
  if (powerUp.type === "speed") {
    ctx.save();

    // Glow
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 20;

    // Outer circle
    ctx.beginPath();
    ctx.arc(powerUp.x, powerUp.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = "#071a12";
    ctx.fill();

    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Lightning symbol
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚡", powerUp.x, powerUp.y);

    ctx.restore();
  }

  // =========================
  // DOUBLE POINTS POWER-UP
  // =========================
  if (powerUp.type === "double") {
  ctx.save();

  // Gold glow
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 20;

  // Outer circle
  ctx.beginPath();
  ctx.arc(powerUp.x, powerUp.y, 18, 0, Math.PI * 2);
  ctx.fillStyle = "#241b00";
  ctx.fill();

  ctx.strokeStyle = "#ffd700";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Double points symbol
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("×2", powerUp.x, powerUp.y);

  ctx.restore();
}
});

    // Draw players
    room.players.forEach((player, index) => {
  const isCurrentPlayer =
    player.id === socket.id;

  const shieldEnd =
    room?.shieldUntil?.[player.id] || 0;

  const isShielded =
    Date.now() < shieldEnd;

  const speedEnd = room?.speedUntil?.[player.id] || 0;
  const isSpeedBoosted = Date.now() < speedEnd;

  // Check if another player is within stealing range
  let showHeistPrompt = false;

  if (isCurrentPlayer) {
    const nearbyPlayer = room.players.find((target) => {
      if (target.id === player.id) return false;

      const distance = Math.sqrt(
        Math.pow(player.x - target.x, 2) +
        Math.pow(player.y - target.y, 2)
      );

      return distance <= 60;
    });

    showHeistPrompt = !!nearbyPlayer;
  }

  drawPlayer(
    ctx,
    player.x,
    player.y,
    index,
    player.name,
    isCurrentPlayer,
    isShielded,
    showHeistPrompt,
    isSpeedBoosted
  );
  if (isCurrentPlayer && scorePopup) {
  ctx.save();

  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = "#00ff88";
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur = 12;

  const popupProgress = 1 - 0.8 / 0.8;

  ctx.globalAlpha = 1 - popupProgress;
  ctx.fillText(
    scorePopup,
    player.x,
    player.y - 45 - popupProgress * 25
  );

  ctx.restore();
}
});


  }, [room, canHeist, scorePopup]);

  return (
    <div className="game-container">

      {heistMessage && (
  <div className="heist-message">
    {heistMessage}
  </div>
)}

      <div className="game-header">

        <div>
          🏆 SCORE
          <strong> {myScore}</strong>
        </div>

        <div>
          ⏱️ TIME
          <strong> {gameTime}</strong>s
        </div>

        <div>
          👥 PLAYERS
          <strong> {room?.players.length}/8</strong>
        </div>

      </div>

      <canvas
        ref={canvasRef}
        className="game-canvas"
      />

      <div className="game-instructions">
        ⚡ Collect energy crystals to score points!
      </div>

    </div>
  );
}


// ========================================
// DRAW CRYSTAL
// ========================================

function drawCrystal(ctx, x, y) {
  ctx.save();

  // Outer glow
  ctx.shadowColor = "#00e5ff";
  ctx.shadowBlur = 28;

  // Main diamond
  ctx.beginPath();
  ctx.moveTo(x, y - 15);
  ctx.lineTo(x + 13, y);
  ctx.lineTo(x, y + 15);
  ctx.lineTo(x - 13, y);
  ctx.closePath();

  ctx.fillStyle = "#00e5ff";
  ctx.fill();

  // Bright inner diamond
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x, y + 10);
  ctx.lineTo(x - 8, y);
  ctx.closePath();

  ctx.fillStyle = "#7df9ff";
  ctx.fill();

  // Crystal highlight
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x, y);
  ctx.closePath();

  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.7;
  ctx.fill();

  ctx.restore();
}


// ========================================
// DRAW PLAYER
// ========================================

function drawPlayer(
  ctx,
  x,
  y,
  index,
  name,
  isCurrentPlayer,
  isShielded,
  showHeistPrompt,
  isSpeedBoosted
) {
  if (isShielded) {
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, Math.PI * 2);
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 3;
  ctx.shadowColor = "#00e5ff";
  ctx.shadowBlur = 15;
  ctx.stroke();

  ctx.shadowBlur = 0;
}

if (isSpeedBoosted) {
  ctx.save();

  ctx.beginPath();
  ctx.arc(x, y, 33, 0, Math.PI * 2);

  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 5;
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur = 22;

  ctx.stroke();

  ctx.restore();
}
  const playerColors = [
    "#00e5ff",
    "#ff3d81",
    "#9b5cff",
    "#00ff88",
    "#ffd000",
    "#ff7a00",
    "#4d7cff",
    "#ffffff",
  ];

  const color =
    playerColors[index % playerColors.length];

  ctx.save();

  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;

  // Player body
  ctx.fillStyle = color;

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    20,
    0,
    Math.PI * 2
  );

  ctx.fill();

  // Current player ring
  if (isCurrentPlayer) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      28,
      0,
      Math.PI * 2
    );

    ctx.stroke();
  }

  ctx.restore();

  // Player name
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";

  ctx.fillText(
    name,
    x,
    y + 42
  );

// 👇 ADD SHIELD CODE HERE
if (isShielded) {
  ctx.save();

  // Silver shield icon above the player
  ctx.fillStyle = "#c0c0c0";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(x, y - 31);
  ctx.lineTo(x + 8, y - 26);
  ctx.lineTo(x + 7, y - 16);
  ctx.quadraticCurveTo(x, y - 8, x - 7, y - 16);
  ctx.lineTo(x - 8, y - 26);
  ctx.closePath();

  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

  if (showHeistPrompt) {
  const vibrationX = Math.sin(Date.now() / 60) * 3;
  const vibrationY = Math.cos(Date.now() / 70) * 2;

  ctx.save();

  ctx.translate(vibrationX, vibrationY);

  // E button background
  ctx.beginPath();
  ctx.roundRect(x - 16, y - 58, 32, 30, 8);
  ctx.fillStyle = "#111827";
  ctx.fill();

  // Glowing border
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#00e5ff";
  ctx.shadowBlur = 12;
  ctx.stroke();

  // E text
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#00e5ff";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("E", x, y - 43);

  ctx.restore();
}
}

function HeistBackground() {
  const [scene, setScene] = useState({
    characters: [
      { id: 1, x: 8, y: 25, dir: 1, money: false, target: "bag" },
      { id: 2, x: 28, y: 55, dir: 1, money: false, target: "bag" },
      { id: 3, x: 55, y: 35, dir: -1, money: false, target: "bag" },
      { id: 4, x: 82, y: 70, dir: -1, money: false, target: "bag" }
    ],

    bags: [
      { id: 1, x: 20, y: 30, visible: true },
      { id: 2, x: 45, y: 65, visible: true },
      { id: 3, x: 70, y: 25, visible: true },
      { id: 4, x: 88, y: 55, visible: true }
    ],

    message: ""
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setScene((prev) => {
        let characters = prev.characters.map((character) => ({
          ...character
        }));

        let bags = prev.bags.map((bag) => ({
          ...bag
        }));

        let message = "";

        characters = characters.map((character, index) => {
          let newX = character.x;
          let newY = character.y;
          let newDir = character.dir;
          let newMoney = character.money;
          let newTarget = character.target;

          /* ========================= */
          /* RUNNING WITHOUT MONEY */
          /* ========================= */

          if (!newMoney) {
            const availableBags = bags.filter(
              (bag) => bag.visible
            );

            if (availableBags.length > 0) {
              let closestBag = availableBags[0];

              let closestDistance =
                Math.abs(character.x - closestBag.x) +
                Math.abs(character.y - closestBag.y);

              availableBags.forEach((bag) => {
                const distance =
                  Math.abs(character.x - bag.x) +
                  Math.abs(character.y - bag.y);

                if (distance < closestDistance) {
                  closestBag = bag;
                  closestDistance = distance;
                }
              });

              const dx = closestBag.x - character.x;
              const dy = closestBag.y - character.y;

              if (Math.abs(dx) > 1) {
                newX += dx > 0 ? 1.5 : -1.5;
                newDir = dx > 0 ? 1 : -1;
              }

              if (Math.abs(dy) > 1) {
                newY += dy > 0 ? 0.7 : -0.7;
              }

              /* REACHED MONEY BAG */
              if (
                Math.abs(character.x - closestBag.x) < 3 &&
                Math.abs(character.y - closestBag.y) < 3
              ) {
                const bagIndex = bags.findIndex(
                  (bag) => bag.id === closestBag.id
                );

                if (bagIndex !== -1) {
                  bags[bagIndex].visible = false;
                }

                newMoney = true;
                newTarget = "player";

                message = `💰 Runner ${index + 1} grabbed the money!`;
              }
            }
          }

          /* ========================= */
          /* RUNNING WITH MONEY */
          /* ========================= */

          if (newMoney) {
            const otherPlayers = characters.filter(
              (other) => other.id !== character.id
            );

            if (otherPlayers.length > 0) {
              let victim = otherPlayers[0];

              let closestDistance =
                Math.abs(character.x - victim.x) +
                Math.abs(character.y - victim.y);

              otherPlayers.forEach((other) => {
                const distance =
                  Math.abs(character.x - other.x) +
                  Math.abs(character.y - other.y);

                if (distance < closestDistance) {
                  victim = other;
                  closestDistance = distance;
                }
              });

              const dx = victim.x - character.x;
              const dy = victim.y - character.y;

              if (Math.abs(dx) > 1) {
                newX += dx > 0 ? 2 : -2;
                newDir = dx > 0 ? 1 : -1;
              }

              if (Math.abs(dy) > 1) {
                newY += dy > 0 ? 1 : -1;
              }

              /* STEAL */
              if (
                Math.abs(character.x - victim.x) < 5 &&
                Math.abs(character.y - victim.y) < 5
              ) {
                const victimIndex = characters.findIndex(
                  (other) => other.id === victim.id
                );

                if (victimIndex !== -1) {
                  characters[victimIndex].money = false;
                }

                newMoney = false;
                newTarget = "bag";

                message = `🏃 Runner ${index + 1} stole the money!`;
              }
            }
          }

          /* KEEP INSIDE SCREEN */

          if (newX > 100) newX = -5;
          if (newX < -5) newX = 100;

          if (newY > 90) newY = 10;
          if (newY < 10) newY = 90;

          return {
            ...character,
            x: newX,
            y: newY,
            dir: newDir,
            money: newMoney,
            target: newTarget
          };
        });

        /* RESPAWN MONEY BAGS */

        bags = bags.map((bag) => {
          if (!bag.visible) {
            return {
              ...bag,
              visible: true,
              x: Math.random() * 90 + 5,
              y: Math.random() * 75 + 10
            };
          }

          return bag;
        });

        return {
          characters,
          bags,
          message
        };
      });
    }, 80);

    return () => clearInterval(timer);
  }, []);
   
}

export default App;