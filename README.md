# Chess Vision Trainer

A browser-based sandbox chessboard for training board vision. There's no
engine or opponent — you move both sides yourself — but every square is
tinted by who attacks it:

- **Green** = squares White attacks or defends, darker with more attackers.
- **Red** = squares Black attacks or defends, darker with more attackers.
- Where both overlap, the square reads as contested by both sides.
- A **dashed orange ring** marks a piece currently under attack.
- A **pulsing red ring** marks a piece that's attacked more times than it's
  defended (i.e. hanging).
- A king whose square is attacked gets a red glow (check).

Hover any square to see the exact list of attacking/defending pieces on
both sides in the "Square inspector" panel. Full standard chess rules are
enforced (legal moves, check, castling, en passant, promotion, checkmate/
stalemate detection) — there's just no AI on the other side.

## Running it

No build step or dependencies — it's plain HTML/CSS/JS with ES modules.
Serve the directory with any static file server and open it, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`. (Opening `index.html` directly via
`file://` won't work in most browsers because ES module imports require
an HTTP origin.)

## Files

- `index.html` — page shell and layout
- `style.css` — board, overlay, and panel styling
- `js/chess.js` — rules engine: move generation, check detection, and the
  per-square attack maps that drive the overlay
- `js/main.js` — DOM rendering and interaction
