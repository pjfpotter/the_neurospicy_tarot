import {
  createInitialState, computeAttackMaps, legalMovesForSquare, applyMove,
  gameStatus, squareName, FILES, attackRaysForSquare,
} from './chess.js';

const GLYPHS = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status-line');
const moveListEl = document.getElementById('move-list');
const inspectorEl = document.getElementById('inspector');
const capturedByWhiteEl = document.getElementById('captured-by-white');
const capturedByBlackEl = document.getElementById('captured-by-black');
const btnBack = document.getElementById('btn-back');
const btnForward = document.getElementById('btn-forward');

const PIECE_VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

const controls = {
  showWhite: document.getElementById('toggle-white'),
  showBlack: document.getElementById('toggle-black'),
  showCounts: document.getElementById('toggle-counts'),
  showThreats: document.getElementById('toggle-threats'),
  showLines: document.getElementById('toggle-lines'),
};

// `timeline` holds one game state per ply (index 0 = initial position);
// `viewIndex` is whichever one is currently displayed/played from. Playing
// a move while viewIndex isn't at the end truncates everything after it —
// same as most chess GUIs — rather than blocking review-then-play.
let timeline = [createInitialState()];
let viewIndex = 0;
let state = timeline[viewIndex];
let selected = null; // {r,c}
let legalTargets = []; // moves for selected piece
let flipped = false;
let pendingPromotion = null; // {from, move}
let hovered = null; // {r,c}
let dragState = null; // {r, c, draggable, dragging, startX, startY, ghostEl, hoverCell}

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
    sq.addEventListener('mouseenter', () => onHoverSquare(r, c));
    sq.addEventListener('pointerdown', (e) => onPointerDown(e, r, c));

    boardEl.appendChild(sq);
    squares.push({ el: sq, whiteLayer, blackLayer, pieceEl, countEl, r, c });
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const linesSvg = document.createElementNS(SVG_NS, 'svg');
linesSvg.setAttribute('class', 'attack-lines-svg');
linesSvg.setAttribute('viewBox', '0 0 8 8');
linesSvg.setAttribute('preserveAspectRatio', 'none');
const defs = document.createElementNS(SVG_NS, 'defs');
defs.innerHTML = `
  <marker id="arrow-w" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="rgb(22,163,74)" />
  </marker>
  <marker id="arrow-b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="rgb(220,38,38)" />
  </marker>
`;
linesSvg.appendChild(defs);
boardEl.appendChild(linesSvg);

boardEl.addEventListener('mouseleave', clearAttackLines);
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
  renderCaptured();
  refreshHover();

  btnBack.disabled = viewIndex === 0;
  btnForward.disabled = viewIndex === timeline.length - 1;
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
    moveListEl.append(num, moveCell(i), moveCell(i + 1));
  }
  moveListEl.scrollTop = moveListEl.scrollHeight;
}

function moveCell(plyIndex) {
  const entry = state.history[plyIndex];
  const cell = document.createElement('div');
  if (!entry) return cell;
  cell.textContent = entry.text;
  cell.className = 'move-entry';
  if (plyIndex + 1 === viewIndex) cell.classList.add('current-move');
  cell.addEventListener('click', () => goTo(plyIndex + 1));
  return cell;
}

function renderCaptured() {
  const captured = state.history.map(h => h.captured).filter(Boolean);
  const byWhite = captured.filter(p => p[0] === 'b'); // white captured black pieces
  const byBlack = captured.filter(p => p[0] === 'w');
  const order = { Q: 0, R: 1, B: 2, N: 3, P: 4 };
  const sortFn = (a, b) => order[a[1]] - order[b[1]];
  const materialDiff = (list) => list.reduce((sum, p) => sum + PIECE_VALUE[p[1]], 0);
  const whiteEdge = materialDiff(byWhite) - materialDiff(byBlack);

  const renderTray = (el, list, edge) => {
    el.innerHTML = list.slice().sort(sortFn).map(p => `<span class="piece-${p[0]}">${GLYPHS[p]}</span>`).join('');
    if (edge > 0) el.innerHTML += `<span class="material-diff">+${edge}</span>`;
  };
  renderTray(capturedByWhiteEl, byWhite, whiteEdge);
  renderTray(capturedByBlackEl, byBlack, -whiteEdge);
}

function onHoverSquare(r, c) {
  hovered = { r, c };
  refreshHover();
}

function refreshHover() {
  if (!hovered) return;
  showInspector(hovered.r, hovered.c);
  drawAttackLines(hovered.r, hovered.c);
}

function toDisplay(r, c) {
  return flipped ? { r: 7 - r, c: 7 - c } : { r, c };
}

function clearAttackLines() {
  linesSvg.querySelectorAll('line').forEach(el => el.remove());
}

function drawAttackLines(r, c) {
  clearAttackLines();
  if (!controls.showLines.checked) return;
  const piece = state.board[r][c];
  if (!piece) return;

  const origin = toDisplay(r, c);
  const colorClass = piece[0] === 'w' ? 'line-w' : 'line-b';
  const marker = piece[0] === 'w' ? 'url(#arrow-w)' : 'url(#arrow-b)';

  for (const target of attackRaysForSquare(state.board, r, c)) {
    const to = toDisplay(target.r, target.c);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', origin.c + 0.5);
    line.setAttribute('y1', origin.r + 0.5);
    line.setAttribute('x2', to.c + 0.5);
    line.setAttribute('y2', to.r + 0.5);
    line.setAttribute('class', 'attack-line ' + colorClass);
    line.setAttribute('marker-end', marker);
    linesSvg.appendChild(line);
  }
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

const DRAG_THRESHOLD = 4;

// All board interaction — tap-to-select/move and drag-to-move — funnels
// through pointerdown/move/up rather than the native 'click' event: once a
// drag crosses from one square's element to another, the browser's
// synthetic click fires on their nearest common ancestor (not on either
// square), so a click-based handler can silently miss it.
function onPointerDown(e, r, c) {
  if (pendingPromotion || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const piece = state.board[r][c];
  const draggable = !!piece && piece[0] === state.turn;

  dragState = {
    r, c, draggable, dragging: false,
    startX: e.clientX, startY: e.clientY,
    ghostEl: null, hoverCell: null,
  };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { once: true });
}

function onPointerMove(e) {
  if (!dragState || !dragState.draggable) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;

  if (!dragState.dragging) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragState.dragging = true;
    selected = { r: dragState.r, c: dragState.c };
    legalTargets = legalMovesForSquare(state, dragState.r, dragState.c);
    render();
    startGhost(e);
  }

  positionGhost(e);
  updateHoverSquare(e);
}

function startGhost(e) {
  const piece = state.board[dragState.r][dragState.c];
  const ghost = document.createElement('div');
  ghost.className = `piece piece-${piece[0]} drag-ghost`;
  ghost.textContent = GLYPHS[piece];
  document.body.appendChild(ghost);
  dragState.ghostEl = ghost;

  const srcCell = squares[boardIndex(dragState.r, dragState.c)];
  srcCell.pieceEl.classList.add('dragging-hidden');
}

function positionGhost(e) {
  if (!dragState.ghostEl) return;
  dragState.ghostEl.style.left = e.clientX + 'px';
  dragState.ghostEl.style.top = e.clientY + 'px';
}

function updateHoverSquare(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const sqEl = el ? el.closest('.square') : null;
  if (dragState.hoverCell && dragState.hoverCell !== sqEl) {
    dragState.hoverCell.classList.remove('drop-target');
  }
  if (sqEl) sqEl.classList.add('drop-target');
  dragState.hoverCell = sqEl;
}

function onPointerUp() {
  window.removeEventListener('pointermove', onPointerMove);
  if (!dragState) return;
  const { r, c, dragging, ghostEl, hoverCell } = dragState;
  dragState = null;

  if (!dragging) {
    activateSquare(r, c);
    return;
  }

  if (ghostEl) ghostEl.remove();
  if (hoverCell) hoverCell.classList.remove('drop-target');
  squares[boardIndex(r, c)].pieceEl.classList.remove('dragging-hidden');

  let moved = false;
  if (hoverCell) {
    const tr = Number(hoverCell.dataset.r), tc = Number(hoverCell.dataset.c);
    const move = legalTargets.find(m => m.to.r === tr && m.to.c === tc);
    if (move) {
      moved = true;
      if (move.promotion) offerPromotion({ r, c }, move);
      else commitMove({ r, c }, move);
    }
  }

  if (!moved) {
    selected = null;
    legalTargets = [];
    render();
  }
}

function activateSquare(r, c) {
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
  const newState = applyMove(state, from, move);
  timeline = timeline.slice(0, viewIndex + 1);
  timeline.push(newState);
  viewIndex = timeline.length - 1;
  state = newState;
  selected = null;
  legalTargets = [];
  render();
}

function goTo(index) {
  const clamped = Math.max(0, Math.min(timeline.length - 1, index));
  if (clamped === viewIndex) return;
  viewIndex = clamped;
  state = timeline[viewIndex];
  selected = null;
  legalTargets = [];
  pendingPromotion = null;
  document.querySelectorAll('.promo-picker').forEach(el => el.remove());
  render();
}

document.getElementById('btn-reset').addEventListener('click', () => {
  timeline = [createInitialState()];
  viewIndex = 0;
  state = timeline[viewIndex];
  selected = null;
  legalTargets = [];
  pendingPromotion = null;
  document.querySelectorAll('.promo-picker').forEach(el => el.remove());
  render();
});

btnBack.addEventListener('click', () => goTo(viewIndex - 1));
btnForward.addEventListener('click', () => goTo(viewIndex + 1));

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') goTo(viewIndex - 1);
  else if (e.key === 'ArrowRight') goTo(viewIndex + 1);
  else return;
  e.preventDefault();
});

document.getElementById('btn-flip').addEventListener('click', () => {
  flipped = !flipped;
  render();
});

for (const key of Object.keys(controls)) {
  controls[key].addEventListener('change', render);
}

render();
