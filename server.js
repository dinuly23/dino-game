// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

const scoresFile = path.join(__dirname, 'scores.json');
const clientBuildPath = path.join(__dirname, 'dino-game', 'dist', 'dino-game', 'browser');

// ===== Middleware =====
app.use(cors());
app.use(express.json());
app.use(express.static(clientBuildPath));

// ===== JSON File Utilities =====
// Чтение JSON из файла
function readScores() {
  try {
    const data = fs.readFileSync(scoresFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}


function writeScores(scores) {
  try {
    fs.writeFileSync(scoresFile, JSON.stringify(scores, null, 2), 'utf8');
  } catch (err) {
    console.error('Ошибка записи в scores.json:', err);
  }
}

// ===== API Routes =====
app.get('/score/:playerName', (req, res) => {
  const playerName = decodeURIComponent(req.params.playerName);
  console.log('Fetching score for player:', playerName);

  const scores = readScores();
  const leader = scores["__leader"] || null;

  if (scores[playerName]) {
    res.send({
      playerName,
      bestScore: scores[playerName].score || 0,
      realName: scores[playerName].realName || "",
      leader
    });
  } else {
    const defaultPlayer = scores["__ghalam"] || { realName: "ghalam_gamer", score: 0 };
    res.send({
      playerName,
      bestScore: defaultPlayer.score,
      realName: defaultPlayer.realName,
      leader
    });
  }
});

app.post('/score', (req, res) => {
  const { playerName, realName, score, quote } = req.body;

  if (!playerName || !realName || score === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const scores = readScores();

  if (!scores[playerName] || score > scores[playerName].score) {
    scores[playerName] = { realName, score };
  }

  const currentLeader = scores.__leader || { score: -1 };
  if (score > currentLeader.score) {
    scores.__leader = {
      realName,
      score,
      quote: typeof quote === 'string' ? quote.slice(0, 100) : 'error',
    };
    console.log('Новый лидер:', scores.__leader);
  }

  writeScores(scores);

  res.json({
    bestScore: scores[playerName].score,
    leader: scores.__leader,
  });
});

// POST: обновление счёта (и, если нужно, лидера)
app.post('/score', (req, res) => {
  const { playerName, realName, score, quote } = req.body;

  if (!playerName || !realName || score === undefined) {
    return res.status(400).send({ error: 'playerName, realName, and score are required' });
  }

  const scores = readScores();
  const current = scores[playerName];

  // Обновляем счёт игрока, если он улучшил результат
  if (!current || score > current.score) {
    scores[playerName] = { realName, score }; // без quote
  }

  const currentLeader = scores.__leader || { score: -1 };
  if (score > currentLeader.score) {
    // Новый лидер — добавляем quote
    scores.__leader = {
      realName,
      score,
      quote: (typeof quote === 'string') ? quote.slice(0, 100) : 'error'
    };
    console.log("Qoute: ", scores.__leader);
  }

  writeScores(scores);

  res.send({
    bestScore: scores[playerName].score,
    leader: scores.__leader
  });
});

// ===== SPA Catch-All Route =====
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== Start Server =====
app.listen(port, () => {
  console.log(`🎮 Server running at http://localhost:${port}`);
});
