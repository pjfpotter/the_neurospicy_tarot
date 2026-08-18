import {
  createInitialState, computeAttackMaps, legalMovesForSquare, applyMove,
  gameStatus, squareName, FILES,
} from './chess.js';

const GLYPHS = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status-line');
const moveListEl = document.getElementById('move-list');
const inspectorEl = document.getElementById('inspector');

const controls = {
  showWhite: document.getElementById('toggle-white'),
  showBlack: document.getElementById('toggle-black'),
  showCounts: document.getElementById('toggle-counts'),
  showThreats: document.getElementById('toggle-threats'),
};

let state = createInitialState();
let history = [state];
let selected = null; // {r,c}
let legalTargets = []; // moves for selected piece
let flipped = false;
let pendingPromotion = null; // {from, move}
let hovered = null; // {r,c}

const squares = [];
for (let r = 0; r < 8; r++) {
  for (let c = 0; c < 8; c++) {
    const sq = document.createElement('div');
    sq.className = 'square';
    sq.dataset.r = r;
    sq.dataset.c = c;

    const whiteLayer = document.createElement('div');
    whiteLayer.className = 'overlay white-layer';
    const blackLayer = document.createElement('div');
    blackLayer.className = 'overlay black-layer';
    const pieceEl = document.createElement('div');
    pieceEl.className = 'piece';
    const countEl = document.createElement('div');
    countEl.className = 'count-label';

    sq.append(whiteLayer, blackLayer, pieceEl, countEl);
    sq.addEventListener('click', () => onSquareClick(r, c));
    sq.addEventListener('mouseenter', () => { hovered = { r, c }; showInspector(r, c); });

    boardEl.appendChild(sq);
    squares.push({ el: sq, whiteLayer, blackLayer, pieceEl, countEl, r, c });
  }
}
addCoordLabels();

function addCoordLabels() {
  for (let c = 0; c < 8; c++) {
    const cell = squares[7 * 8 + c];
    const label = document.createElement('div');
    label.className = 'coord file';
    label.textContent = FILES[c];
    cell.el.appendChild(label);
  }
  for (let r = 0; r < 8; r++) {
    const cell = squares[r * 8 + 0];
    const label = document.createElement('div');
    label.className = 'coord rank';
    label.textContent = 8 - r;
    cell.el.appendChild(label);
  }
}

function boardIndex(r, c) {
  const rr = flipped ? 7 - r : r;
  const cc = flipped ? 7 - c : c;
  return rr * 8 + cc;
}

function render() {
  const maps = computeAttackMaps(state.board);
  const status = gameStatus(state);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = squares[boardIndex(r, c)];
      const piece = state.board[r][c];
      const isLight = (r + c) % 2 === 0;
      cell.el.className = 'square ' + (isLight ? 'light' : 'dark');

      const wCount = maps.w.counts[r][c];
      const bCount = maps.b.counts[r][c];

      cell.whiteLayer.style.opacity = controls.showWhite.checked ? Math.min(0.85, wCount * 0.22) : 0;
      cell.blackLayer.style.opacity = controls.showBlack.checked ? Math.min(0.85, bCount * 0.22) : 0;

      cell.pieceEl.textContent = piece ? GLYPHS[piece] : '';
      cell.pieceEl.className = 'piece' + (piece ? ` piece-${piece[0]}` : '');

      if (piece && controls.showThreats.checked) {
        const ownColor = piece[0];
        const oppCount = ownColor === 'w' ? bCount : wCount;
        const ownDefend = ownColor === 'w' ? wCount : bCount;
        if (oppCount > 0) cell.pieceEl.classList.add('threatened');
        if (oppCount > ownDefend) cell.pieceEl.classList.add('hanging');
        if (piece[1] === 'K' && oppCount > 0) cell.pieceEl.classList.add('in-check');
      }

      if (controls.showCounts.checked && (wCount || bCount)) {
        cell.countEl.textContent = `${wCount || 0}/${bCount || 0}`;
      } else {
        cell.countEl.textContent = '';
      }

      if (selected && selected.r === r && selected.c === c) {
        cell.el.classList.add('selected');
      }

      cell.el.querySelectorAll('.move-dot').forEach(el => el.remove());
    }
  }

  for (const move of legalTargets) {
    const cell = squares[boardIndex(move.to.r, move.to.c)];
    const dot = document.createElement('div');
    dot.className = 'move-dot' + (move.capture ? ' capture' : '');
    cell.el.appendChild(dot);
  }

  renderStatusLine(status);
  renderMoveList();

  if (hovered) showInspector(hovered.r, hovered.c);
}

function renderStatusLine(status) {
  const turnName = state.turn === 'w' ? 'White' : 'Black';
  let text = `${turnName} to move`;
  let cls = '';
  if (status === 'check') { text += ' — check!'; cls = 'check'; }
  else if (status === 'checkmate') { text = `Checkmate — ${state.turn === 'w' ? 'Black' : 'White'} wins`; cls = 'checkmate'; }
  else if (status === 'stalemate') { text = 'Stalemate — draw'; cls = 'stalemate'; }
  statusEl.textContent = text;
  statusEl.className = 'status-line ' + cls;
}

function renderMoveList() {
  moveListEl.innerHTML = '';
  for (let i = 0; i < state.history.length; i += 2) {
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = (i / 2 + 1) + '.';
    const w = document.createElement('div');
    w.textContent = state.history[i]?.text ?? '';
    const b = document.createElement('div');
    b.textContent = state.history[i + 1]?.text ?? '';
    moveListEl.append(num, w, b);
  }
  moveListEl.scrollTop = moveListEl.scrollHeight;
}

function showInspector(r, c) {
  if (pendingPromotion) return;
  const maps = computeAttackMaps(state.board);
  const name = squareName(r, c);
  const piece = state.board[r][c];
  const wAtt = maps.w.attackers[r][c];
  const bAtt = maps.b.attackers[r][c];
  const fmt = (list) => list.length
    ? list.map(a => squareName(a.r, a.c)).join(', ')
    : 'none';

  inspectorEl.innerHTML = `
    <div><span class="sq-name">${name}</span>${piece ? ' — ' + describePiece(piece) : ' — empty'}</div>
    <div class="attackers-white">White attacks (${wAtt.length}): ${fmt(wAtt)}</div>
    <div class="attackers-black">Black attacks (${bAtt.length}): ${fmt(bAtt)}</div>
  `;
}

function describePiece(piece) {
  const names = { P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King' };
  const color = piece[0] === 'w' ? 'White' : 'Black';
  return `${color} ${names[piece[1]]}`;
}

function onSquareClick(r, c) {
  if (pendingPromotion) return;

  if (selected) {
    const move = legalTargets.find(m => m.to.r === r && m.to.c === c);
    if (move) {
      if (move.promotion) {
        offerPromotion(selected, move);
        return;
      }
      commitMove(selected, move);
      return;
    }
  }

  const piece = state.board[r][c];
  if (piece && piece[0] === state.turn) {
    selected = { r, c };
    legalTargets = legalMovesForSquare(state, r, c);
  } else {
    selected = null;
    legalTargets = [];
  }
  render();
}

function offerPromotion(from, move) {
  pendingPromotion = { from, move };
  const cell = squares[boardIndex(move.to.r, move.to.c)];
  const picker = document.createElement('div');
  picker.className = 'promo-picker';
  const color = state.board[from.r][from.c][0];
  for (const type of ['Q', 'R', 'B', 'N']) {
    const btn = document.createElement('button');
    btn.textContent = GLYPHS[color + type];
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      picker.remove();
      const finalMove = { ...move, promoteTo: type };
      pendingPromotion = null;
      commitMove(from, finalMove);
    });
    picker.appendChild(btn);
  }
  cell.el.appendChild(picker);
}

function commitMove(from, move) {
  state = applyMove(state, from, move);
  history.push(state);
  selected = null;
  legalTargets = [];
  render();
}

document.getElementById('btn-reset').addEventListener('click', () => {
  state = createInitialState();
  history = [state];
  selected = null;
  legalTargets = [];
  render();
});

document.getElementById('btn-undo').addEventListener('click', () => {
  if (history.length > 1) {
    history.pop();
    state = history[history.length - 1];
    selected = null;
    legalTargets = [];
    render();
  }
});

document.getElementById('btn-flip').addEventListener('click', () => {
  flipped = !flipped;
  render();
});

for (const key of Object.keys(controls)) {
  controls[key].addEventListener('change', render);
}

render();
