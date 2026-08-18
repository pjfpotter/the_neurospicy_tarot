// Minimal chess rules engine: legal move generation, check detection, and
// per-square "attack maps" used to drive the vision-training overlay.
// No search/evaluation here — this is a sandbox board, not an opponent.

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_OFFSETS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

export function squareName(r, c) {
  return FILES[c] + (8 - r);
}

export function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function cloneBoard(board) {
  return board.map(row => row.slice());
}

export function createInitialState() {
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = 'b' + back[c];
    board[1][c] = 'bP';
    board[6][c] = 'wP';
    board[7][c] = 'w' + back[c];
  }
  return {
    board,
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null, // {r,c} square a pawn skipped over, capturable next move
    history: [],
    kings: { w: { r: 7, c: 4 }, b: { r: 0, c: 4 } },
  };
}

function pieceColor(p) { return p ? p[0] : null; }
function pieceType(p) { return p ? p[1] : null; }
function opponent(color) { return color === 'w' ? 'b' : 'w'; }

// Squares a piece attacks/defends, ignoring whose turn it is and ignoring
// occupant color (own-piece squares count as "defended"). Sliding pieces
// stop at (and include) the first occupied square in each direction.
export function pieceAttackSquares(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const color = pieceColor(piece);
  const type = pieceType(piece);
  const squares = [];

  if (type === 'P') {
    const dir = color === 'w' ? -1 : 1;
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (inBounds(nr, nc)) squares.push({ r: nr, c: nc });
    }
    return squares;
  }

  if (type === 'N') {
    for (const [dr, dc] of KNIGHT_OFFSETS) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc)) squares.push({ r: nr, c: nc });
    }
    return squares;
  }

  if (type === 'K') {
    for (const [dr, dc] of QUEEN_DIRS) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc)) squares.push({ r: nr, c: nc });
    }
    return squares;
  }

  const dirs = type === 'B' ? BISHOP_DIRS : type === 'R' ? ROOK_DIRS : QUEEN_DIRS;
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      squares.push({ r: nr, c: nc });
      if (board[nr][nc]) break; // blocked after including the blocker
      nr += dr; nc += dc;
    }
  }
  return squares;
}

// Returns { w: {counts,attackers}, b: {...} } — counts[r][c] = number of
// pieces of that color attacking/defending that square.
export function computeAttackMaps(board) {
  const maps = {
    w: { counts: makeGrid(0), attackers: makeGrid(() => []) },
    b: { counts: makeGrid(0), attackers: makeGrid(() => []) },
  };
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const color = pieceColor(piece);
      const map = maps[color];
      for (const { r: tr, c: tc } of pieceAttackSquares(board, r, c)) {
        map.counts[tr][tc]++;
        map.attackers[tr][tc].push({ r, c, piece });
      }
    }
  }
  return maps;
}

function makeGrid(fill) {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => (typeof fill === 'function' ? fill() : fill)));
}

// Pseudo-legal moves for the piece at (r,c): respects blocking/capture and
// pawn/castle/en-passant special rules, but does NOT yet filter out moves
// that leave the mover's own king in check.
function pseudoMoves(state, r, c) {
  const { board } = state;
  const piece = board[r][c];
  if (!piece) return [];
  const color = pieceColor(piece);
  const type = pieceType(piece);
  const moves = [];

  if (type === 'P') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const promoRow = color === 'w' ? 0 : 7;
    const oneStep = r + dir;
    if (inBounds(oneStep, c) && !board[oneStep][c]) {
      moves.push({ to: { r: oneStep, c }, promotion: oneStep === promoRow });
      const twoStep = r + 2 * dir;
      if (r === startRow && !board[twoStep][c]) {
        moves.push({ to: { r: twoStep, c }, doubleStep: true });
      }
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (target && pieceColor(target) !== color) {
        moves.push({ to: { r: nr, c: nc }, capture: true, promotion: nr === promoRow });
      } else if (!target && state.enPassant && state.enPassant.r === nr && state.enPassant.c === nc) {
        moves.push({ to: { r: nr, c: nc }, capture: true, enPassant: true });
      }
    }
    return moves;
  }

  for (const { r: nr, c: nc } of pieceAttackSquares(board, r, c)) {
    const target = board[nr][nc];
    if (target && pieceColor(target) === color) continue;
    moves.push({ to: { r: nr, c: nc }, capture: !!target });
  }

  if (type === 'K') {
    addCastlingMoves(state, color, r, c, moves);
  }

  return moves;
}

function addCastlingMoves(state, color, r, c, moves) {
  const rights = state.castling;
  const row = color === 'w' ? 7 : 0;
  if (r !== row || c !== 4) return;
  const opp = opponent(color);
  const oppMap = computeAttackMaps(state.board)[opp];
  if (oppMap.counts[r][c] > 0) return; // can't castle out of check

  const canCastle = (side) => {
    const kingSide = side === 'K';
    const rookCol = kingSide ? 7 : 0;
    const rook = state.board[row][rookCol];
    if (!rights[color + side] || !rook || rook !== color + 'R') return false;
    const between = kingSide ? [5, 6] : [1, 2, 3];
    for (const col of between) if (state.board[row][col]) return false;
    const kingPath = kingSide ? [5, 6] : [3, 2];
    for (const col of kingPath) if (oppMap.counts[row][col] > 0) return false;
    return true;
  };

  if (canCastle('K')) moves.push({ to: { r: row, c: 6 }, castle: 'K' });
  if (canCastle('Q')) moves.push({ to: { r: row, c: 2 }, castle: 'Q' });
}

function applyMoveToBoard(board, from, move, color) {
  const piece = board[from.r][from.c];
  const type = pieceType(piece);
  board[from.r][from.c] = null;
  board[move.to.r][move.to.c] = piece;

  if (move.enPassant) {
    const capRow = color === 'w' ? move.to.r + 1 : move.to.r - 1;
    board[capRow][move.to.c] = null;
  }
  if (move.castle) {
    const row = from.r;
    if (move.castle === 'K') {
      board[row][5] = board[row][7];
      board[row][7] = null;
    } else {
      board[row][3] = board[row][0];
      board[row][0] = null;
    }
  }
  if (move.promotion) {
    board[move.to.r][move.to.c] = color + (move.promoteTo || 'Q');
  }
  return type;
}

export function isKingInCheck(board, color, kingSquare) {
  const oppMap = computeAttackMaps(board)[opponent(color)];
  return oppMap.counts[kingSquare.r][kingSquare.c] > 0;
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] === color + 'K') return { r, c };
  return null;
}

// Legal moves for the piece at (r,c): pseudo-legal moves filtered to those
// that don't leave the mover's own king in check.
export function legalMovesForSquare(state, r, c) {
  const piece = state.board[r][c];
  if (!piece || pieceColor(piece) !== state.turn) return [];
  const color = pieceColor(piece);
  const candidates = pseudoMoves(state, r, c);
  const legal = [];
  for (const move of candidates) {
    const board = cloneBoard(state.board);
    applyMoveToBoard(board, { r, c }, move, color);
    const kingSquare = pieceType(piece) === 'K' ? move.to : state.kings[color];
    if (!isKingInCheck(board, color, kingSquare)) legal.push(move);
  }
  return legal;
}

export function allLegalMoves(state, color) {
  const results = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (piece && pieceColor(piece) === color) {
        for (const move of legalMovesForSquare({ ...state, turn: color }, r, c)) {
          results.push({ from: { r, c }, ...move });
        }
      }
    }
  }
  return results;
}

// Applies a move to game state (mutating a clone), returning the new state
// plus metadata used for move-log rendering.
export function applyMove(state, from, move) {
  const piece = state.board[from.r][from.c];
  const color = pieceColor(piece);
  const board = cloneBoard(state.board);
  const capturedPiece = move.enPassant
    ? board[color === 'w' ? move.to.r + 1 : move.to.r - 1][move.to.c]
    : board[move.to.r][move.to.c];
  const type = applyMoveToBoard(board, from, move, color);

  const castling = { ...state.castling };
  if (type === 'K') { castling[color + 'K'] = false; castling[color + 'Q'] = false; }
  if (type === 'R') {
    const row = color === 'w' ? 7 : 0;
    if (from.r === row && from.c === 0) castling[color + 'Q'] = false;
    if (from.r === row && from.c === 7) castling[color + 'K'] = false;
  }
  // Rook captured on its home square also revokes that side's rights.
  for (const side of ['w', 'b']) {
    const row = side === 'w' ? 7 : 0;
    if (move.to.r === row && move.to.c === 0 && capturedPiece === side + 'R') castling[side + 'Q'] = false;
    if (move.to.r === row && move.to.c === 7 && capturedPiece === side + 'R') castling[side + 'K'] = false;
  }

  const enPassant = move.doubleStep ? { r: (from.r + move.to.r) / 2, c: from.c } : null;

  const kings = { ...state.kings };
  if (type === 'K') kings[color] = { ...move.to };

  const newState = {
    board,
    turn: opponent(color),
    castling,
    enPassant,
    kings,
    history: [...state.history, describeMove(state, from, move, piece, capturedPiece)],
  };
  return newState;
}

function describeMove(state, from, move, piece, capturedPiece) {
  const type = pieceType(piece);
  let text;
  if (move.castle === 'K') text = 'O-O';
  else if (move.castle === 'Q') text = 'O-O-O';
  else {
    const isCapture = !!(capturedPiece || move.enPassant);
    const label = type === 'P' ? (isCapture ? FILES[from.c] : '') : type;
    const promo = move.promotion ? '=' + (move.promoteTo || 'Q') : '';
    text = `${label}${isCapture ? 'x' : ''}${squareName(move.to.r, move.to.c)}${promo}`;
  }
  return { color: pieceColor(piece), text };
}

export function gameStatus(state) {
  const color = state.turn;
  const inCheck = isKingInCheck(state.board, color, state.kings[color]);
  const hasMoves = allLegalMoves(state, color).length > 0;
  if (inCheck && !hasMoves) return 'checkmate';
  if (!inCheck && !hasMoves) return 'stalemate';
  if (inCheck) return 'check';
  return 'playing';
}
