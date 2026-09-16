/**
 * FARM RESCUE 3D · 遊戲核心狀態機與音效控制
 * 遵照《兒童美語 3D 互動遊戲開發指南與 GPT6-Astra 提示詞庫》重構：
 * 1. ZzFX 即時輕量合成音效（按鍵泡泡音、答對升調和弦、答錯彈簧音、點擊動物音）
 * 2. 88 個 Google Cloud Chirp 3 HD MP3 本地音訊無縫集成
 * 3. 滿版 3D 遊戲 HUD 狀態展示、分隊輪流挑戰與教師確認跟讀機制
 */

import { questions, words, randomQuestions } from './questions.js';
import { createFarm } from './scene.js';

const $ = id => document.getElementById(id);

// ==========================================
// 1. ZzFX 超輕量合成音效模組 (< 1KB)
// ==========================================
let isMuted = false;
const zzfx = (p=1,k=.05,b=220,e=0,r=0,t=.1,q=0,D=1,u=0,y=0,v=0,z=0,l=0,E=0,A=0,F=0,c=0,w=1,m=0,B=0)=>{
  if (isMuted) return;
  try {
    let M=Math,R=44100,d=2*M.PI,G=u*=500*d/R/R,C=b*=(1-k+2*k*M.random(k=[]))*d/R,g=0,c1=0,a=0,f=1,h=0,
    n=0,q1=new (window.AudioContext||window.webkitAudioContext);
    let S=q1.createBuffer(1,R*t,R),L=S.getChannelData(0);
    for(;n<R*t;L[n++]=a)a=M.sin(g)*f,f=n<R*e?n/(R*e):n<R*(e+r)?1-(n-R*e)/(R*r)*(1-D):n<R*(t-c)?D:(t-n/R)/c*D,
    g+=C,C+=G;let p1=q1.createBufferSource();p1.buffer=S;p1.connect(q1.destination);p1.start();
  } catch(e) {}
};

const SFX = {
  click: () => zzfx(1, 0.05, 480, 0.01, 0.04, 0.08, 1, 1, 6),
  animalBoing: () => zzfx(1, 0.05, 360, 0.02, 0.12, 0.16, 1, 1.6, -5),
  correct: () => zzfx(1, 0.05, 523.25, 0.02, 0.22, 0.35, 1, 1.8, 5, 2),
  wrong: () => zzfx(1, 0.05, 220, 0, 0.12, 0.3, 1, 1.2, -8)
};

// ==========================================
// 2. 音訊載入與播放管理 (88 個 Chirp 3 HD MP3)
// ==========================================
let activeAudio = null;
let audioGeneration = 0;
const audioMap = fetch('./audio/manifest.json')
  .then(r => r.json())
  .then(m => new Map(m.entries.filter(e => e.status === 'ready').map(e => [e.text, e.file])))
  .catch(() => new Map());

function stopSpeech() {
  audioGeneration++;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
}

let playbackRate = 1.0;

async function speak(text) {
  stopSpeech();
  const generation = audioGeneration;
  if (isMuted) return;
  const map = await audioMap;
  if (generation !== audioGeneration) return;
  const path = map.get(text);
  if (!path) return;

  const audio = new Audio(path);
  audio.playbackRate = playbackRate;
  activeAudio = audio;
  try {
    await audio.play();
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
}

// 監聽動物被點擊
window.onAnimalClicked = (kind) => {
  SFX.animalBoing();
};

let farm = createFarm();

const teamNames = ['Team A', 'Team B', 'Team C', 'Team D'];
let gameState = 'menu';
let previousState = '';
let deck = [];
let currentIndex = 0;
let teamScores = [];
let attempts = 0;
let records = [];
let teamCount = 3;
let showText = true;
let choices = [];

// 輪流與搶答狀態管理
let scheduledTurnTeam = 0;  // 本題輪流順序的主答組
let activeAnsweringTeam = 0; // 目前按鍵作答的組 (可為搶答組)
let isStealMode = false;     // 是否已解鎖搶答

// ==========================================
// 3. 遊戲流程與 HUD 更新
// ==========================================
function updateScoreboard() {
  const board = $('team-scoreboard');
  board.innerHTML = '';

  for (let i = 0; i < teamCount; i++) {
    const chip = document.createElement('div');
    const isCurrent = (i === activeAnsweringTeam);

    if (isStealMode) {
      if (isCurrent) {
        chip.className = 'team-chip stealing-now';
        chip.innerHTML = `
          <span>🔥 ${teamNames[i]} 搶答中</span>
          <span class="team-stars">⭐ ${teamScores[i] || 0}</span>
        `;
      } else {
        chip.className = 'team-chip can-steal';
        chip.innerHTML = `
          <span>⚡ ${teamNames[i]} 搶答！</span>
          <span class="team-stars">⭐ ${teamScores[i] || 0}</span>
        `;
        chip.title = `點擊指派 ${teamNames[i]} 搶答此題`;
        chip.onclick = () => selectStealTeam(i);
      }
    } else {
      chip.className = `team-chip ${isCurrent ? 'active-turn' : ''}`;
      chip.innerHTML = `
        <span>${isCurrent ? '👉 ' : ''}${teamNames[i]}</span>
        <span class="team-stars">⭐ ${teamScores[i] || 0}</span>
      `;
    }
    board.appendChild(chip);
  }
}

function selectStealTeam(teamIndex) {
  if (!isStealMode || gameState !== 'playing') return;
  SFX.click();
  activeAnsweringTeam = teamIndex;
  updateScoreboard();
  showToast(`✋ ${teamNames[teamIndex]} 獲得搶答權！請選擇答案卡！`, 'correct');
  // 重新解鎖卡牌點擊
  $('answers-deck').querySelectorAll('.answer-card').forEach(c => c.style.pointerEvents = 'auto');
}

function showToast(text, type = 'correct') {
  const toast = $('feedback-toast');
  toast.textContent = text;
  toast.className = `feedback-toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function updateSpeedBtn() {
  const btn = $('btn-speed');
  if (!btn) return;
  if (playbackRate === 1.0) {
    btn.textContent = '⚡ 1.0x';
    btn.title = '目前語速：標準 (點擊切換)';
  } else if (playbackRate === 0.8) {
    btn.textContent = '🐢 0.8x';
    btn.title = '目前語速：慢速 (點擊切換)';
  } else {
    btn.textContent = '🐇 1.2x';
    btn.title = '目前語速：快節奏 (點擊切換)';
  }
}

function cycleSpeed() {
  SFX.click();
  if (playbackRate === 1.0) {
    playbackRate = 0.8;
  } else if (playbackRate === 0.8) {
    playbackRate = 1.2;
  } else {
    playbackRate = 1.0;
  }
  updateSpeedBtn();
}

function startGame(customDeck) {
  stopSpeech();
  teamCount = Number($('setting-teams').value) || 3;
  showText = $('setting-hints').value === 'show';
  const rounds = Number($('setting-rounds').value);
  const mode = $('setting-mode').value;
  if ($('setting-speed')) {
    playbackRate = Number($('setting-speed').value) || 1.0;
    updateSpeedBtn();
  }

  deck = customDeck || (mode === 'random' ? randomQuestions(rounds) : questions.slice(0, rounds));
  currentIndex = 0;
  teamScores = Array(teamCount).fill(0);
  records = [];

  $('modal-overlay').hidden = true;
  farm?.pause(false);
  loadQuestion();
}

function loadQuestion() {
  gameState = 'playing';
  attempts = 0;
  stopSpeech();

  // 每一題固定依照輪流排程，初始主答隊伍為 currentIndex % teamCount
  scheduledTurnTeam = currentIndex % teamCount;
  activeAnsweringTeam = scheduledTurnTeam;
  isStealMode = false;

  $('teacher-bar').hidden = true;
  const q = deck[currentIndex];

  $('progress-pill').textContent = `救援進度 ${currentIndex + 1} / ${deck.length}`;
  $('question-text').textContent = showText ? q.prompt : '🎧 仔細聽：問了哪些動物？';

  updateScoreboard();
  farm?.populate(q.animal, q.count);

  // 隨機生成 3 個選項
  const alternatives = Array.from({ length: 10 }, (_, i) => i + 1)
    .filter(n => n !== q.count)
    .sort((a, b) => Math.abs(a - q.count) - Math.abs(b - q.count));
  choices = [q.count, ...alternatives.slice(0, 2)];
  const rotate = (currentIndex + 1) % 3;
  choices = choices.slice(rotate).concat(choices.slice(0, rotate));

  const answersDeck = $('answers-deck');
  answersDeck.innerHTML = '';

  choices.forEach((n, idx) => {
    const card = document.createElement('div');
    card.className = 'answer-card';
    card.innerHTML = `
      <div class="answer-number">${n}</div>
      <div class="answer-word">${words[n]}</div>
      <span class="answer-key">按鍵 ${idx + 1}</span>
    `;
    card.onclick = () => submitAnswer(n, card);
    answersDeck.appendChild(card);
  });

  speak(q.spokenPrompt);
}

function submitAnswer(n, cardElement) {
  if (gameState !== 'playing') return;
  attempts++;
  const q = deck[currentIndex];

  if (n !== q.count) {
    // 答錯反饋：解鎖搶答模式
    SFX.wrong();
    if (!isStealMode) {
      isStealMode = true;
      showToast(`❌ ${teamNames[activeAnsweringTeam]} 答錯！該題解鎖！請老師點選搶答組別 ✋`, 'wrong');
      // 暫時鎖定答案卡，等待老師點選搶答組別
      $('answers-deck').querySelectorAll('.answer-card').forEach(c => c.style.pointerEvents = 'none');
    } else {
      showToast(`❌ ${teamNames[activeAnsweringTeam]} 搶答亦答錯！可再點選其他組別搶答 ✋`, 'wrong');
      $('answers-deck').querySelectorAll('.answer-card').forEach(c => c.style.pointerEvents = 'none');
    }
    updateScoreboard();
    return;
  }

  // 答對反饋
  gameState = 'feedback';
  teamScores[activeAnsweringTeam]++;
  records.push({
    id: q.id,
    firstCorrect: attempts === 1,
    attempts,
    spoken: false,
    team: activeAnsweringTeam,
    wasStolen: (activeAnsweringTeam !== scheduledTurnTeam)
  });

  updateScoreboard();
  SFX.correct();

  if (cardElement) cardElement.classList.add('correct');
  $('answers-deck').querySelectorAll('.answer-card').forEach(c => c.style.pointerEvents = 'none');

  if (activeAnsweringTeam !== scheduledTurnTeam) {
    showToast(`🎉 搶答成功！${teamNames[activeAnsweringTeam]} 奪得 1 顆合作星！`, 'correct');
  } else {
    showToast(`🎉 EXCELLENT! ${teamNames[activeAnsweringTeam]} 答對 +1 顆星！`, 'correct');
  }
  
  $('question-text').textContent = q.answer;

  // 顯示全班跟讀確認欄
  $('teacher-bar').hidden = false;
  farm?.celebrate();
  speak(q.answer);
}

function proceedNext(spoken) {
  if (gameState !== 'feedback') return;
  if (records.length > 0) {
    records[records.length - 1].spoken = spoken;
  }
  stopSpeech();
  // 換下一題：自動恢復原本排定的下一隊 (currentIndex + 1) % teamCount
  currentIndex++;
  if (currentIndex < deck.length) {
    loadQuestion();
  } else {
    finishGame();
  }
}

function finishGame() {
  gameState = 'results';
  const correctCount = records.filter(r => r.firstCorrect).length;
  const spokenCount = records.filter(r => r.spoken).length;

  if (typeof confetti === 'function') {
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
  }

  const overlay = $('modal-overlay');
  const modal = $('modal-content');

  const teamReportHtml = teamScores.map((s, i) => `
    <div style="font-size:16px; margin: 4px 0;">${teamNames[i]}：<b>${s} 顆合作星 ⭐</b></div>
  `).join('');

  modal.innerHTML = `
    <span class="modal-badge">RESCUE COMPLETED!</span>
    <h2 class="modal-title">🎉 牧場動物全數平安脫困！</h2>
    <p class="modal-desc">
      全班合作完成 <b>${records.length}</b> 題救援<br>
      首次答對率：<b>${correctCount} / ${records.length}</b>（${Math.round((correctCount / records.length) * 100)}%）<br>
      全隊流利朗讀：<b>${spokenCount}</b> 題
    </p>
    <div style="background:#f1f5f9; padding: 14px; border-radius: 16px; margin-bottom: 20px;">
      ${teamReportHtml}
    </div>
    <div style="display:flex; gap:12px; justify-content:center;">
      <button class="btn-start-game" id="btn-replay-all" style="margin:0;">再玩一輪 ↻</button>
      <button class="btn-start-game" id="btn-review-wrong" style="margin:0; background:#38bdf8; color:#0c4a6e; box-shadow:0 8px 0 #0284c7;">練習錯題 💡</button>
    </div>
  `;

  overlay.hidden = false;

  $('btn-replay-all').onclick = () => location.reload();
  $('btn-review-wrong').onclick = () => {
    const wrongIds = new Set(records.filter(r => !r.firstCorrect).map(r => r.id));
    if (wrongIds.size === 0) {
      alert('太厲害了！本輪全部第一次答對，沒有錯題！');
      return;
    }
    startGame(deck.filter(q => wrongIds.has(q.id)));
  };
}

// 綁定 UI 事件
$('btn-start-play').onclick = () => startGame();
$('btn-speech-ok').onclick = () => proceedNext(true);
$('btn-speech-skip').onclick = () => proceedNext(false);

$('btn-replay-question').onclick = () => {
  if (['playing', 'feedback'].includes(gameState) && deck[currentIndex]) {
    speak(deck[currentIndex].spokenPrompt);
  }
};

$('btn-cam-left').onclick = () => farm?.rotate(-0.25);
$('btn-cam-right').onclick = () => farm?.rotate(0.25);
$('btn-cam-center').onclick = () => farm?.resetView();

// 語速切換與回到首頁按鈕
if ($('btn-speed')) $('btn-speed').onclick = () => cycleSpeed();
if ($('btn-home')) $('btn-home').onclick = () => confirmReturnHome();

function confirmReturnHome() {
  if (gameState === 'menu') return;
  stopSpeech();
  farm?.pause(true);
  const overlay = $('modal-overlay');
  const modal = $('modal-content');
  modal.innerHTML = `
    <span class="modal-badge">RETURN TO MENU</span>
    <h2 class="modal-title">🏠 結束本輪並回到首頁？</h2>
    <p class="modal-desc">
      目前進行到第 <b>${currentIndex + 1} / ${deck.length}</b> 題。<br>
      回到首頁可以重新設定參賽隊伍、語速與挑戰題數！
    </p>
    <div style="display:flex; gap:14px; justify-content:center; margin-top:20px;">
      <button class="btn-start-game" id="btn-confirm-home" style="margin:0; background:#f43f5e; box-shadow:0 8px 0 #be123c;">確定回首頁 🏠</button>
      <button class="btn-start-game" id="btn-cancel-home" style="margin:0;">繼續遊戲 ▶</button>
    </div>
  `;
  overlay.hidden = false;

  $('btn-confirm-home').onclick = () => location.reload();
  $('btn-cancel-home').onclick = () => {
    overlay.hidden = true;
    farm?.pause(false);
  };
}

$('btn-pause').onclick = () => togglePause();

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    farm?.pause(true);
    const overlay = $('modal-overlay');
    const modal = $('modal-content');
    modal.innerHTML = `
      <span class="modal-badge">GAME PAUSED</span>
      <h2 class="modal-title">⏸️ 遊戲暫停中</h2>
      <p class="modal-desc">老師可利用暫停時間引導學生複習動物名稱與數量問答。</p>
      <div style="display:flex; gap:12px; justify-content:center;">
        <button class="btn-start-game" id="btn-resume-game" style="margin:0;">繼續遊戲 ▶</button>
        <button class="btn-start-game" id="btn-restart-game" style="margin:0; background:#f43f5e; color:#fff; box-shadow:0 8px 0 #be123c;">重新開始 ↻</button>
      </div>
    `;
    overlay.hidden = false;
    $('btn-resume-game').onclick = () => {
      overlay.hidden = true;
      farm?.pause(false);
      gameState = 'playing';
    };
    $('btn-restart-game').onclick = () => {
      location.reload();
    };
  } else if (gameState === 'paused') {
    $('modal-overlay').hidden = true;
    farm?.pause(false);
    gameState = 'playing';
  }
}

$('btn-mute').onclick = () => {
  isMuted = !isMuted;
  stopSpeech();
  $('btn-mute').textContent = isMuted ? '🔇' : '♫';
};

$('btn-fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (e) {}
};

// 鍵盤支援 (1, 2, 3 答題，R 聽音，P 暫停，H 回首頁，S 切換語速)
window.addEventListener('keydown', (e) => {
  if (e.repeat || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (['1', '2', '3'].includes(e.key)) {
    const idx = Number(e.key) - 1;
    if (choices[idx] !== undefined) {
      const cards = $('answers-deck').children;
      submitAnswer(choices[idx], cards[idx]);
    }
  }
  if (e.key.toLowerCase() === 'r') $('btn-replay-question').click();
  if (e.key.toLowerCase() === 'p') togglePause();
  if (e.key.toLowerCase() === 's') cycleSpeed();
  if (e.key.toLowerCase() === 'h') confirmReturnHome();
});


