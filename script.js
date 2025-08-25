// Sentiment Adventure - Enhanced interactivity
// Features: Dual analyzers (Rule vs AFINN), tuning sliders, TTS, confetti, badges

// Lexicons
const LEXICON = {
  positive: [
    'love','like','great','awesome','amazing','good','happy','fun','nice','cool','fantastic','excellent','yay','wow','delight','enjoy','smile','wonderful','brilliant','sweet','best'
  ],
  negative: [
    'hate','dislike','bad','terrible','awful','angry','sad','boring','slow','worse','worst','annoying','ugly','mad','yuck','gross','horrible','poor'
  ],
  intensifiers: ['very','so','really','super','extremely','totally'],
  negations: ['not','never','no','hardly','barely','isn\'t','aren\'t','don\'t','doesn\'t','can\'t','won\'t','didn\'t']
};

// Small AFINN-like dictionary (subset)
const AFINN_SMALL = {
  'love': 3, 'loved': 3, 'loves': 3, 'like': 2, 'likes': 2, 'awesome': 4, 'amazing': 4, 'great': 3, 'good': 2, 'happy': 3, 'fun': 2, 'nice': 2, 'cool': 2, 'fantastic': 4, 'excellent': 4, 'yay': 3, 'wow': 2, 'enjoy': 2, 'enjoyed': 2, 'wonderful': 4, 'brilliant': 3, 'sweet': 2, 'best': 4,
  'bad': -2, 'worse': -3, 'worst': -4, 'terrible': -4, 'awful': -4, 'angry': -3, 'sad': -2, 'boring': -2, 'slow': -1, 'annoying': -2, 'ugly': -3, 'mad': -2, 'yuck': -3, 'gross': -3, 'horrible': -4, 'poor': -2, 'hate': -3, 'hated': -3, 'dislike': -2, 'problem': -2, 'problems': -2,
  'okay': 1, 'fine': 1, 'neutral': 0
};

// UI/Analyzer state
const STATE = {
  intensifierBoostMax: 2,
  exclamationPower: 1,
  flipOnNegation: true,
  hasTuned: false,
  lastResult: null
};

// Rule-based analyzer with explanations
function analyzeSentimentRule(text, options) {
  const reasons = [];
  if (!text || !text.trim()) {
    return { score: 0, label: 'Neutral', face: '😐', tokenInfo: [], reasons: ['No text yet.'] };
  }

  const emojis = {
    '😀': 2,'😄': 2,'😊': 2,'🙂': 1,'😍': 3,'😎': 2,'🎉': 2,'👍': 2,
    '😐': 0,'😶': 0,
    '🙁': -1,'😞': -2,'😡': -3,'😢': -2,'👎': -2
  };

  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s!\?😀-🙏👍👎🎉😍😎😐😶🙁😞😡😢]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let score = 0;
  const tokenInfo = [];

  // Emoji and punctuation emphasis
  let exclamations = (text.match(/!/g) || []).length;
  let questions = (text.match(/\?/g) || []).length;
  let emphasis = Math.min(options?.exclamationPower ?? STATE.exclamationPower, exclamations) - Math.min(1, questions > 2 ? 1 : 0);
  if (exclamations > 0) reasons.push(`Exclamation mark adds excitement (+${Math.min(options?.exclamationPower ?? STATE.exclamationPower, exclamations)})`);
  if (questions > 2) reasons.push('Many question marks reduce certainty (-1)');

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];

    // Emoji handling
    if (emojis[word]) {
      score += emojis[word];
      tokenInfo.push({ token: word, kind: emojis[word] > 0 ? 'pos' : 'neg', value: emojis[word] });
      reasons.push(`Emoji ${word} contributes ${emojis[word] > 0 ? '+' : ''}${emojis[word]}`);
      continue;
    }

    const isPositive = LEXICON.positive.includes(word);
    const isNegative = LEXICON.negative.includes(word);
    const isIntens = LEXICON.intensifiers.includes(word);
    const isNegation = LEXICON.negations.includes(word);

    if (isIntens) {
      tokenInfo.push({ token: word, kind: 'neu', value: 0 });
      reasons.push(`Intensifier “${word}” makes nearby feeling stronger`);
      continue;
    }

    if (isNegation) {
      tokenInfo.push({ token: word, kind: 'neu', value: 0 });
      reasons.push(`Negation “${word}” flips the next feeling word`);
      continue;
    }

    let local = 0;
    if (isPositive) local = 1;
    if (isNegative) local = -1;

    if (local !== 0) {
      // Look back for negation and intensifier in window of 2
      const windowStart = Math.max(0, i - 2);
      const window = tokens.slice(windowStart, i);
      const hasNeg = window.some(w => LEXICON.negations.includes(w));
      const intensCount = window.filter(w => LEXICON.intensifiers.includes(w)).length;
      let value = local;
      if (hasNeg && (options?.flipOnNegation ?? STATE.flipOnNegation)) value *= -1;
      value += Math.min(options?.intensifierBoostMax ?? STATE.intensifierBoostMax, intensCount); // add up to +N for intensifiers
      value += emphasis; // punctuation influence

      score += value;
      tokenInfo.push({ token: word, kind: value > 0 ? 'pos' : (value < 0 ? 'neg' : 'neu'), value });
      reasons.push(`${hasNeg ? 'Negation flips ' : ''}${intensCount ? intensCount + ' intensifier(s) boost ' : ''}“${word}” → ${value > 0 ? '+' : ''}${value}`.trim());
    } else {
      tokenInfo.push({ token: word, kind: 'neu', value: 0 });
    }
  }

  let label = 'Neutral';
  let face = '😐';
  if (score >= 2) { label = 'Positive'; face = '😄'; }
  else if (score <= -2) { label = 'Negative'; face = '🙁'; }

  return { score, label, face, tokenInfo, reasons };
}

// AFINN-based alternative analyzer
function analyzeSentimentAFINN(text, options) {
  const reasons = [];
  if (!text || !text.trim()) {
    return { score: 0, label: 'Neutral', face: '😐', tokenInfo: [], reasons: ['No text yet.'] };
  }
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s!\?]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let score = 0;
  const tokenInfo = [];
  let exclamations = (text.match(/!/g) || []).length;
  let questions = (text.match(/\?/g) || []).length;
  let emphasis = Math.min(options?.exclamationPower ?? STATE.exclamationPower, exclamations) - Math.min(1, questions > 2 ? 1 : 0);
  if (exclamations > 0) reasons.push(`Exclamation adds ${Math.min(options?.exclamationPower ?? STATE.exclamationPower, exclamations)}`);
  if (questions > 2) reasons.push('Many question marks reduce certainty (-1)');

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    const base = AFINN_SMALL[word];
    if (base !== undefined) {
      const windowStart = Math.max(0, i - 2);
      const window = tokens.slice(windowStart, i);
      const hasNeg = window.some(w => LEXICON.negations.includes(w));
      const intensCount = window.filter(w => LEXICON.intensifiers.includes(w)).length;
      let value = base;
      if (hasNeg && (options?.flipOnNegation ?? STATE.flipOnNegation)) value *= -1;
      value += Math.min(options?.intensifierBoostMax ?? STATE.intensifierBoostMax, intensCount);
      value += emphasis;
      score += value;
      tokenInfo.push({ token: word, kind: value > 0 ? 'pos' : (value < 0 ? 'neg' : 'neu'), value });
      reasons.push(`${hasNeg ? 'Negation flips ' : ''}${intensCount ? '+'+intensCount+' boost ' : ''}“${word}” → ${value > 0 ? '+' : ''}${value}`.trim());
    } else {
      tokenInfo.push({ token: word, kind: 'neu', value: 0 });
    }
  }

  let label = 'Neutral';
  let face = '😐';
  if (score >= 2) { label = 'Positive'; face = '😄'; }
  else if (score <= -2) { label = 'Negative'; face = '🙁'; }
  return { score, label, face, tokenInfo, reasons };
}

// UI updates
function updateUI(result) {
  const scoreEl = document.getElementById('score');
  const labelEl = document.getElementById('label');
  const faceEl = document.getElementById('face');
  const tokenView = document.getElementById('tokenView');
  const reasonsEl = document.getElementById('reasons');
  const resultBox = document.getElementById('result');

  scoreEl.textContent = String(result.score);
  labelEl.textContent = result.label;
  faceEl.textContent = result.face;

  tokenView.innerHTML = '';
  result.tokenInfo.forEach(t => {
    const span = document.createElement('span');
    span.className = `token ${t.kind}`;
    span.textContent = `${t.token} ${t.value ? '(' + (t.value>0?'+':'') + t.value + ')' : ''}`.trim();
    tokenView.appendChild(span);
  });

  reasonsEl.innerHTML = '';
  result.reasons.forEach(r => {
    const li = document.createElement('li');
    li.textContent = r;
    reasonsEl.appendChild(li);
  });

  resultBox.classList.remove('hidden');
}

function updateUICompare(ruleRes, afinnRes) {
  const resultBox = document.getElementById('resultCompare');
  const faceRule = document.getElementById('faceRule');
  const scoreRule = document.getElementById('scoreRule');
  const labelRule = document.getElementById('labelRule');
  const faceAF = document.getElementById('faceAFINN');
  const scoreAF = document.getElementById('scoreAFINN');
  const labelAF = document.getElementById('labelAFINN');
  faceRule.textContent = ruleRes.face; scoreRule.textContent = String(ruleRes.score); labelRule.textContent = ruleRes.label;
  faceAF.textContent = afinnRes.face; scoreAF.textContent = String(afinnRes.score); labelAF.textContent = afinnRes.label;
  resultBox.classList.remove('hidden');
}

// Playground wiring
function wirePlayground() {
  const input = document.getElementById('inputText');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const chips = document.querySelectorAll('.chip');
  const speakResultBtn = document.getElementById('speakResultBtn');
  const modeRule = document.getElementById('modeRule');
  const modeAFINN = document.getElementById('modeAFINN');
  const modeCompare = document.getElementById('modeCompare');
  const intensSlider = document.getElementById('intensSlider');
  const exclSlider = document.getElementById('exclSlider');
  const negFlipCk = document.getElementById('negFlipCk');
  const intensVal = document.getElementById('intensVal');
  const exclVal = document.getElementById('exclVal');
  const resetTuning = document.getElementById('resetTuning');

  chips.forEach(ch => {
    ch.addEventListener('click', () => {
      input.value = ch.getAttribute('data-example');
      analyzeBtn.click();
    });
  });

  analyzeBtn.addEventListener('click', () => {
    const text = input.value;
    const options = {
      intensifierBoostMax: STATE.intensifierBoostMax,
      exclamationPower: STATE.exclamationPower,
      flipOnNegation: STATE.flipOnNegation
    };
    document.getElementById('result').classList.add('hidden');
    document.getElementById('resultCompare').classList.add('hidden');
    if (modeCompare?.checked) {
      const ruleRes = analyzeSentimentRule(text, options);
      const afRes = analyzeSentimentAFINN(text, options);
      updateUICompare(ruleRes, afRes);
      STATE.lastResult = ruleRes; // default for TTS
    } else if (modeAFINN?.checked) {
      const res = analyzeSentimentAFINN(text, options);
      updateUI(res);
      STATE.lastResult = res;
    } else {
      const res = analyzeSentimentRule(text, options);
      updateUI(res);
      STATE.lastResult = res;
    }
    // Badges
    awardBadgeOnce('first-analysis', 'First Analyzer', '🕵️');
    if (/[😀-🙏👍👎🎉😍😎😐😶🙁😞😡😢]/u.test(text)) awardBadgeOnce('emoji-explorer', 'Emoji Explorer', '🎭');
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    document.getElementById('result').classList.add('hidden');
    document.getElementById('resultCompare').classList.add('hidden');
  });

  // Tuning controls
  intensSlider?.addEventListener('input', () => {
    STATE.intensifierBoostMax = Number(intensSlider.value);
    intensVal.textContent = `+${STATE.intensifierBoostMax}`;
    STATE.hasTuned = true; awardBadgeOnce('tuning-tinkerer', 'Tuning Tinkerer', '🛠️');
  });
  exclSlider?.addEventListener('input', () => {
    STATE.exclamationPower = Number(exclSlider.value);
    exclVal.textContent = `+${STATE.exclamationPower}`;
    STATE.hasTuned = true; awardBadgeOnce('tuning-tinkerer', 'Tuning Tinkerer', '🛠️');
  });
  negFlipCk?.addEventListener('change', () => {
    STATE.flipOnNegation = !!negFlipCk.checked;
    STATE.hasTuned = true; awardBadgeOnce('tuning-tinkerer', 'Tuning Tinkerer', '🛠️');
  });
  resetTuning?.addEventListener('click', () => {
    STATE.intensifierBoostMax = 2; intensSlider.value = '2'; intensVal.textContent = '+2';
    STATE.exclamationPower = 1; exclSlider.value = '1'; exclVal.textContent = '+1';
    STATE.flipOnNegation = true; negFlipCk.checked = true;
  });

  // TTS for result
  speakResultBtn?.addEventListener('click', () => {
    if (!STATE.lastResult) return;
    const msg = `I think this message is ${STATE.lastResult.label}, with score ${STATE.lastResult.score}.`;
    speak(msg);
  });
}

// Exercises
function wireExercises() {
  document.getElementById('ex1-check').addEventListener('click', () => {
    const word = document.getElementById('ex1-word').value;
    const sentence = `This pizza is ${word}!`;
    const { label } = analyzeSentimentRule(sentence);
    document.getElementById('ex1-feedback').textContent = label === 'Positive' ? 'Correct! Positive vibe! 😄' : 'Try again. Aim for Positive.';
  });

  document.getElementById('ex2-check').addEventListener('click', () => {
    const word = document.getElementById('ex2-word').value;
    const sentence = `I am ${word} about the delay.`;
    const { label } = analyzeSentimentRule(sentence);
    const ok = label === 'Negative';
    document.getElementById('ex2-feedback').textContent = ok ? 'Nice! Negation flipped it. 🙃' : 'Not quite. Make it Negative.';
    if (ok) awardBadgeOnce('negation-ninja', 'Negation Ninja', '🥷');
  });

  document.getElementById('ex3-check').addEventListener('click', () => {
    const word = document.getElementById('ex3-word').value;
    const sentence = `The weather is ${word} today.`;
    const res = analyzeSentimentRule(sentence);
    document.getElementById('ex3-feedback').textContent = `Result: ${res.label} (score ${res.score}). Notice how “not” flips the feeling!`;
  });
}

// Quiz
function wireQuiz() {
  const submit = document.getElementById('quizSubmit');
  const reset = document.getElementById('quizReset');
  const result = document.getElementById('quizResult');

  submit.addEventListener('click', () => {
    const q1 = (document.querySelector('input[name="q1"]:checked') || {}).value;
    const q2 = (document.querySelector('input[name="q2"]:checked') || {}).value;
    const q3 = (document.querySelector('input[name="q3"]:checked') || {}).value;
    let score = 0;
    if (q1 === 'awesome') score++;
    if (q2 === 'flip') score++;
    if (q3 === 'stronger') score++;
    const faces = ['😿','😺','😸','😻'];
    result.textContent = `You scored ${score}/3 ${faces[score]}. ${score === 3 ? 'Excellent!' : 'Keep practicing!'} `;
    if (score === 3) { awardBadgeOnce('quiz-whiz', 'Quiz Whiz', '🏅'); confettiBurst(); }
  });

  reset.addEventListener('click', () => {
    document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
    result.textContent = '';
  });
}

// Text-to-Speech helper
function speak(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0; utter.pitch = 1.0; utter.volume = 1.0;
    synth.speak(utter);
  } catch (_) {}
}

// Confetti
function confettiBurst() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = window.innerWidth;
  const H = canvas.height = window.innerHeight;
  const pieces = Array.from({ length: 150 }).map(() => ({
    x: Math.random() * W,
    y: -20 - Math.random() * H,
    r: 4 + Math.random() * 6,
    c: `hsl(${Math.floor(Math.random()*360)}, 90%, 60%)`,
    s: 1 + Math.random() * 3
  }));
  let start = null;
  function step(ts) {
    if (!start) start = ts;
    const t = ts - start;
    ctx.clearRect(0,0,W,H);
    for (const p of pieces) {
      p.y += p.s;
      p.x += Math.sin((p.y+p.r)*0.02) * 1.5;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    }
    if (t < 2000) requestAnimationFrame(step);
    else { ctx.clearRect(0,0,W,H); }
  }
  requestAnimationFrame(step);
}
window.addEventListener('resize', () => {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
});

// Badges
function getBadges() {
  try {
    const raw = localStorage.getItem('sentiment_badges');
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}
function setBadges(badges) {
  try { localStorage.setItem('sentiment_badges', JSON.stringify(badges)); } catch (_) {}
}
function awardBadgeOnce(id, name, emoji) {
  const badges = getBadges();
  if (badges.some(b => b.id === id)) return;
  badges.push({ id, name, emoji });
  setBadges(badges);
  renderBadges();
}
function renderBadges() {
  const grid = document.getElementById('badgesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const badges = getBadges();
  if (badges.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'No badges yet. Try the analyzer, exercises, and quiz!';
    grid.appendChild(empty);
    return;
  }
  for (const b of badges) {
    const card = document.createElement('div');
    card.className = 'badge';
    const e = document.createElement('div'); e.className = 'emoji'; e.textContent = b.emoji;
    const n = document.createElement('div'); n.className = 'name'; n.textContent = b.name;
    grid.appendChild(card); card.appendChild(e); card.appendChild(n);
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  const speakStoryBtn = document.getElementById('speakStoryBtn');
  speakStoryBtn?.addEventListener('click', () => {
    const storyText = Array.from(document.querySelectorAll('#story p, #story li'))
      .map(n => n.textContent.trim()).join(' ');
    speak(storyText);
  });

  wirePlayground();
  wireExercises();
  wireQuiz();
  renderBadges();
});


