const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://neon-heist-client.onrender.com"
  ],
  methods: ["GET", "POST"]
}));

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://neon-heist-client.onrender.com"
    ],
    methods: ["GET", "POST"]
  }
});

// Store all active rooms
const rooms = new Map();


// Generate a 6-character room code
function generateRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i++) {
    code += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }

  return code;
}


// Send current room information to everyone
function sendRoomUpdate(roomCode) {
  const room = rooms.get(roomCode);

  if (!room) return;

  io.to(roomCode).emit("room:update", {
    roomCode: room.code,
    players: room.players,
    hostId: room.hostId,
    status: room.status,
    crystals: room.crystals || [],
    scores: room.scores || {},
    powerUps: room.powerUps || [],
    speedUntil: room.speedUntil || {},
    rematchReady: room.rematchReady || {},
    shieldUntil: room.shieldUntil || {},
  });
}


app.get("/", (req, res) => {
  res.send("Neon Heist server is running!");
});

// =========================
// GENERATE CRYSTALS
// =========================

function generateCrystals(count = 10) {
  const crystals = [];

  for (let i = 0; i < count; i++) {
    crystals.push({
      id: `crystal-${Date.now()}-${i}`,
      x: Math.floor(Math.random() * 820) + 40,
      y: Math.floor(Math.random() * 470) + 40,
      value: 10,
    });
  }

  return crystals;
}

io.on("connection", (socket) => {

  console.log("Player connected:", socket.id);


  // =========================
  // CREATE ROOM
  // =========================

  socket.on("room:create", (playerName) => {

    const name = playerName?.trim();

    if (!name) {
      socket.emit("room:error", "Please enter your name.");
      return;
    }

    let roomCode;

    do {
      roomCode = generateRoomCode();
    } while (rooms.has(roomCode));


    const player = {
  id: socket.id,
  name: name,
  isHost: true,
  x: 250,
  y: 270,
};

    const room = {
  code: roomCode,
  hostId: socket.id,
  players: [player],
  status: "waiting",
  shieldUntil: {},
  powerUps: [],
  speedUntil: {},
  doublePointsUntil: {},
  rematchReady: {},
  powerUpTimers: {
  speed: null,
  double: null,
  },
};


    rooms.set(roomCode, room);

    socket.join(roomCode);

    socket.roomCode = roomCode;

    console.log(`Room created: ${roomCode}`);

    sendRoomUpdate(roomCode);
  });


  // =========================
  // JOIN ROOM
  // =========================

  socket.on("room:join", ({ roomCode, playerName }) => {

    const name = playerName?.trim();
    const code = roomCode?.trim().toUpperCase();


    if (!name) {
      socket.emit("room:error", "Please enter your name.");
      return;
    }


    if (!code) {
      socket.emit("room:error", "Please enter a room code.");
      return;
    }


    const room = rooms.get(code);


    if (!room) {
      socket.emit("room:error", "Room not found.");
      return;
    }


    if (room.players.length >= 4) {
      socket.emit("room:error", "This room is full.");
      return;
    }


    const player = {
  id: socket.id,
  name: name,
  isHost: false,
  x: 650,
  y: 270,
};


    room.players.push(player);

    socket.join(code);

    socket.roomCode = code;

    console.log(`${name} joined room ${code}`);

    sendRoomUpdate(code);
  });

// =========================
// START GAME
// =========================

socket.on("room:start", () => {
  const roomCode = socket.roomCode;

  if (!roomCode) return;

  const room = rooms.get(roomCode);

  if (!room) return;

  // Only the host can start the game
  if (room.hostId !== socket.id) {
    socket.emit("room:error", "Only the host can start the game.");
    return;
  }

  // Need at least 2 players
  if (room.players.length < 2) {
    socket.emit(
      "room:error",
      "At least 2 players are required to start."
    );
    return;
  }

  // Prevent starting twice
  if (room.status === "playing") {
    return;
  }

  room.status = "starting";

// Create crystals
room.crystals = generateCrystals(10);

// Create score for every player
room.scores = {};

room.players.forEach((player) => {
  room.scores[player.id] = 0;
});

const startAt = Date.now() + 3500;
const gameDuration = 60000;
const gameEndsAt = startAt + gameDuration;


room.gameEndsAt = gameEndsAt;
// Send initial game state
sendRoomUpdate(roomCode);

io.to(roomCode).emit("game:start", {
  startAt,
  gameEndsAt,
});

// After the countdown, officially start the game
setTimeout(() => {
  const currentRoom = rooms.get(roomCode);

  if (!currentRoom) return;

  currentRoom.powerUps = [
  {
    id: `speed-${Date.now()}`,
    type: "speed",
    x: Math.floor(Math.random() * 700) + 100,
    y: Math.floor(Math.random() * 350) + 100
  },
  {
    id: `double-${Date.now()}`,
    type: "double",
    x: Math.floor(Math.random() * 700) + 100,
    y: Math.floor(Math.random() * 350) + 100
  }
];

  currentRoom.status = "playing";

  io.to(roomCode).emit("game:ready");

  sendRoomUpdate(roomCode);

  console.log(`Game started in room ${roomCode}`);
}, 3500);

// ========================
// GAME TIMER
// ========================

setTimeout(() => {
    const currentRoom = rooms.get(roomCode);

    if (!currentRoom) return;

    if (currentRoom.status !== "playing") return;

    currentRoom.status = "finished";

    io.to(roomCode).emit("game:over", {
        scores: currentRoom.scores,
    });

    sendRoomUpdate(roomCode);

    console.log(`Game over in room ${roomCode}`);
}, gameEndsAt - Date.now());

  console.log(`Game starting in room ${roomCode}`);
});



// =========================
// PLAYER MOVEMENT
// =========================

socket.on("player:move", ({ dx, dy }) => {

  const roomCode = socket.roomCode;

  if (!roomCode) return;

  const room = rooms.get(roomCode);

  if (!room) return;

  // Movement is only allowed during the game
  if (room.status !== "playing") return;


  const player = room.players.find(
    (player) => player.id === socket.id
  );

  if (!player) return;


  // Movement speed
  const speed =
  Date.now() < (room.speedUntil?.[player.id] || 0)
    ? 10
    : 5;


  // Calculate new position
  let newX = player.x + dx * speed;
  let newY = player.y + dy * speed;


  // Keep player inside the canvas
  const playerRadius = 20;

  const minX = playerRadius;
  const maxX = 900 - playerRadius;

  const minY = playerRadius;
  const maxY = 550 - playerRadius;


  newX = Math.max(
    minX,
    Math.min(maxX, newX)
  );

  newY = Math.max(
    minY,
    Math.min(maxY, newY)
  );


  // Update server state
  player.x = newX;
player.y = newY;

// =========================
// CRYSTAL COLLISION
// =========================

if (room.crystals) {

  const collectedCrystal = room.crystals.find(
    (crystal) => {

      const distance = Math.sqrt(
        Math.pow(player.x - crystal.x, 2) +
        Math.pow(player.y - crystal.y, 2)
      );

      return distance < 35;
    }
  );


  if (collectedCrystal) {

  // Remove collected crystal
  room.crystals = room.crystals.filter(
    (crystal) => crystal.id !== collectedCrystal.id
  );

// Add score
const isDoubleActive =
  room.doubleUntil?.[player.id] &&
  Date.now() < room.doubleUntil[player.id];

const points = isDoubleActive
  ? collectedCrystal.value * 2
  : collectedCrystal.value;

room.scores[player.id] =
  (room.scores[player.id] || 0) + points;

io.to(roomCode).emit("crystal:collected", {
  playerId: player.id,
  points,
});

  // Create a new crystal
  const newCrystal = {
    id: `${Date.now()}-${Math.random()}`,
    x: Math.floor(Math.random() * 850) + 25,
    y: Math.floor(Math.random() * 500) + 25,
    value: collectedCrystal.value
  };

  // Add new crystal to room
  room.crystals.push(newCrystal);

  console.log(
    `${player.name} collected a crystal and a new one appeared`
  );
}
}

// =========================
// SPEED BOOST COLLECTION
// =========================
const POWERUP_DISTANCE = 45;

const collectedPowerUp = (room.powerUps || []).find((powerUp) => {
  const distance = Math.sqrt(
    Math.pow(player.x - powerUp.x, 2) +
    Math.pow(player.y - powerUp.y, 2)
  );

  return distance <= POWERUP_DISTANCE;
});
console.log(
  "POWERUP CHECK:",
  collectedPowerUp ? collectedPowerUp.type : "none"
);

if (collectedPowerUp) {
  console.log(
    `POWER-UP COLLECTED: ${collectedPowerUp.type} by ${player.name}`
  );

  // Remove collected power-up immediately
  room.powerUps = room.powerUps.filter(
    (powerUp) => powerUp.id !== collectedPowerUp.id
  );

  if (collectedPowerUp.type === "speed") {
    const SPEED_DURATION = 5000;

    room.speedUntil[player.id] = Date.now() + SPEED_DURATION;

    io.to(roomCode).emit("powerup:collected", {
      playerId: player.id,
      playerName: player.name,
      type: "speed"
    });

    // Respawn speed boost after 20 seconds
    room.powerUpTimers.speed = setTimeout(() => {
      const currentRoom = rooms.get(roomCode);

      if (!currentRoom) return;
      if (currentRoom.status !== "playing") return;

      currentRoom.powerUps.push({
        id: `speed-${Date.now()}`,
        type: "speed",
        x: Math.floor(Math.random() * 700) + 100,
        y: Math.floor(Math.random() * 350) + 100
      });

      sendRoomUpdate(roomCode);
    }, 20000);
  }

 if (collectedPowerUp.type === "double") {
  const DOUBLE_DURATION = 5000;

  if (!room.doubleUntil) {
    room.doubleUntil = {};
  }

  room.doubleUntil[player.id] =
    Date.now() + DOUBLE_DURATION;

  io.to(roomCode).emit("powerup:collected", {
    playerId: player.id,
    playerName: player.name,
    type: "double"
  });

  console.log(
    `${player.name} collected DOUBLE power-up`
  );

    // Respawn DOUBLE power-up after 20 seconds
room.powerUpTimers.double = setTimeout(() => {
  const currentRoom = rooms.get(roomCode);

  if (!currentRoom) return;
  if (currentRoom.status !== "playing") return;

  currentRoom.powerUps.push({
    id: `double-${Date.now()}`,
    type: "double",
    x: Math.floor(Math.random() * 700) + 100,
    y: Math.floor(Math.random() * 350) + 100
  });

  sendRoomUpdate(roomCode);

  console.log("DOUBLE power-up respawned");
}, 20000);
}

// Send updated room immediately
sendRoomUpdate(roomCode);
}
// Send updated game state
sendRoomUpdate(roomCode);
});

// =========================
// HEIST ACTION
// =========================

socket.on("player:heist", () => {
  const roomCode = socket.roomCode;

  if (!roomCode) return;

  const room = rooms.get(roomCode);

  if (!room || room.status !== "playing") return;

  const thief = room.players.find(
    (player) => player.id === socket.id
  );

  if (!thief) return;

  const HEIST_DISTANCE = 60;
  const HEIST_AMOUNT = 20;

  const victim = room.players.find((target) => {
    if (target.id === thief.id) return false;

    const distance = Math.sqrt(
      Math.pow(thief.x - target.x, 2) +
      Math.pow(thief.y - target.y, 2)
    );

    return distance <= HEIST_DISTANCE;
  });

  if (!victim) return;

// 🛡️ Check if victim is protected
const shieldEnd = room.shieldUntil[victim.id] || 0;

if (Date.now() < shieldEnd) {
  io.to(roomCode).emit("heist", {
    thief: thief.name,
    victim: victim.name,
    amount: 0,
    blocked: true
  });

  return;
}

  if ((room.scores[victim.id] || 0) < HEIST_AMOUNT) return;

room.scores[victim.id] =
  (room.scores[victim.id] || 0) - HEIST_AMOUNT;

room.scores[thief.id] =
  (room.scores[thief.id] || 0) + HEIST_AMOUNT;

// 🛡️ Give victim 5 seconds of protection
const SHIELD_DURATION = 5000;
room.shieldUntil[victim.id] = Date.now() + SHIELD_DURATION;

  io.to(roomCode).emit("heist", {
    thief: thief.name,
    victim: victim.name,
    amount: HEIST_AMOUNT
  });

  sendRoomUpdate(roomCode);
});

// ========================
// PLAY AGAIN / REMATCH
// ========================

socket.on("room:rematch", () => {
  const roomCode = socket.roomCode;
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) return;

  // Mark this player as ready
  room.rematchReady[socket.id] = true;

  // Send updated ready status to everyone
  sendRoomUpdate(roomCode);

  // Check if ALL players are ready
  const allReady = room.players.every(
    (player) => room.rematchReady[player.id]
  );

  if (!allReady) {
    console.log(
      `Rematch ready: ${
        Object.keys(room.rematchReady).length
      }/${room.players.length}`
    );
    return;
  }

  // Everyone is ready → reset the game
  room.status = "starting";
  room.crystals = generateCrystals(10);
  room.scores = {};
  if (room.powerUpTimers.speed) {
  clearTimeout(room.powerUpTimers.speed);
  room.powerUpTimers.speed = null;
}

if (room.powerUpTimers.double) {
  clearTimeout(room.powerUpTimers.double);
  room.powerUpTimers.double = null;
}
  room.powerUps = [
  {
    id: `speed-${Date.now()}`,
    type: "speed",
    x: Math.floor(Math.random() * 700) + 100,
    y: Math.floor(Math.random() * 350) + 100
  },
  {
    id: `double-${Date.now()}`,
    type: "double",
    x: Math.floor(Math.random() * 700) + 100,
    y: Math.floor(Math.random() * 350) + 100
  }
];
  room.speedUntil = {};
  room.doubleUntil = {};
  room.shieldUntil = {};
  room.rematchReady = {};

  room.players.forEach((player, index) => {
    player.x = index === 0 ? 650 : 300;
    player.y = 270;
    player.isHost = index === 0;
    room.scores[player.id] = 0;
  });

  sendRoomUpdate(roomCode);

  

const startAt = Date.now() + 3500;
const gameDuration = 60000;
const gameEndAt = startAt + gameDuration;

room.gameEndAt = gameEndAt;

sendRoomUpdate(roomCode);

io.to(roomCode).emit("game:start", {
  startAt,
  gameEndAt,
});

// After the countdown, officially start the rematch
setTimeout(() => {
  const currentRoom = rooms.get(roomCode);

  if (!currentRoom) return;

  currentRoom.status = "playing";

  sendRoomUpdate(roomCode);

  console.log(`Rematch started for room ${roomCode}`);
}, 3500);

setTimeout(() => {
  const currentRoom = rooms.get(roomCode);

  if (!currentRoom) return;
  if (currentRoom.status !== "playing") return;

  currentRoom.status = "finished";

  io.to(roomCode).emit("game:over", {
    scores: currentRoom.scores,
  });

  sendRoomUpdate(roomCode);

  console.log(`Rematch game over in room ${roomCode}`);
}, 63500);

});
  // =========================
  // DISCONNECT
  // =========================

  socket.on("disconnect", () => {

    console.log("Player disconnected:", socket.id);


    const roomCode = socket.roomCode;

    if (!roomCode) return;


    const room = rooms.get(roomCode);

    if (!room) return;


    room.players = room.players.filter(
      (player) => player.id !== socket.id
    );

    // Remove disconnected player's rematch readiness
if (room.rematchReady) {
  delete room.rematchReady[socket.id];
}

// Remove disconnected player's temporary effects
if (room.speedUntil) {
  delete room.speedUntil[socket.id];
}

if (room.doubleUntil) {
  delete room.doubleUntil[socket.id];
}

if (room.shieldUntil) {
  delete room.shieldUntil[socket.id];
}


    // If the host left, make the next player host
    if (room.hostId === socket.id) {

      if (room.players.length > 0) {

        room.hostId = room.players[0].id;

        room.players[0].isHost = true;

      } else {

        rooms.delete(roomCode);

        console.log(`Room deleted: ${roomCode}`);

        return;
      }
    }


    sendRoomUpdate(roomCode);
  });

});


const PORT = 3001;

server.listen(PORT, () => {
  console.log(`🎮 Neon Heist server running on port ${PORT}`);
});