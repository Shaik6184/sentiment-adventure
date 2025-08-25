// Simple rule-based sentiment analyzer with kid-friendly explanations
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

function analyzeSentiment(text) {
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
  let emphasis = Math.min(2, exclamations) - Math.min(1, questions > 2 ? 1 : 0);
  if (exclamations > 0) reasons.push(`Exclamation mark adds excitement (+${Math.min(2, exclamations)})`);
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
      if (hasNeg) value *= -1;
      value += Math.min(2, intensCount); // add up to +2 for intensifiers
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

function wirePlayground() {
  const input = document.getElementById('inputText');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const chips = document.querySelectorAll('.chip');

  chips.forEach(ch => {
    ch.addEventListener('click', () => {
      input.value = ch.getAttribute('data-example');
      analyzeBtn.click();
    });
  });

  analyzeBtn.addEventListener('click', () => {
    const res = analyzeSentiment(input.value);
    updateUI(res);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    document.getElementById('result').classList.add('hidden');
  });
}

function wireExercises() {
  document.getElementById('ex1-check').addEventListener('click', () => {
    const word = document.getElementById('ex1-word').value;
    const sentence = `This pizza is ${word}!`;
    const { label } = analyzeSentiment(sentence);
    document.getElementById('ex1-feedback').textContent = label === 'Positive' ? 'Correct! Positive vibe! 😄' : 'Try again. Aim for Positive.';
  });

  document.getElementById('ex2-check').addEventListener('click', () => {
    const word = document.getElementById('ex2-word').value;
    const sentence = `I am ${word} about the delay.`;
    const { label } = analyzeSentiment(sentence);
    document.getElementById('ex2-feedback').textContent = label === 'Negative' ? 'Nice! Negation flipped it. 🙃' : 'Not quite. Make it Negative.';
  });

  document.getElementById('ex3-check').addEventListener('click', () => {
    const word = document.getElementById('ex3-word').value;
    const sentence = `The weather is ${word} today.`;
    const res = analyzeSentiment(sentence);
    document.getElementById('ex3-feedback').textContent = `Result: ${res.label} (score ${res.score}). Notice how “not” flips the feeling!`;
  });
}

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
  });

  reset.addEventListener('click', () => {
    document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
    result.textContent = '';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wirePlayground();
  wireExercises();
  wireQuiz();
});


