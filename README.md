# Robot Chessboard Lab

A simulator for a self-moving chessboard. All 32 pieces drive from one position to the next, on a board with side trays for the pieces not in play: no teleporting and no touching. Five path planners can be compared on the same change of position, and the mate-in-two puzzles are playable, with the robot defending.

**[Open the live app](https://mmereu97.github.io/robot-chessboard-lab/)**

![Pieces moving in parallel to the next puzzle, with each path drawn on the board](docs/screenshot.png)

## The problem

The idea came from watching a commercial robotic board, the Chessnut Move, set up its pieces: I wanted to see how short and how smooth that choreography could get. Resetting a board is a multi-robot path-planning problem in a very tight space: up to 32 pieces, each of which must reach a square of its own type, while every other piece is in the way. A naive board moves one piece at a time and takes the better part of a minute. The interesting question is how close you can get to the theoretical limit if the pieces move together.

## The planners

| Planner | Idea |
|---|---|
| **Fastest reset** (default) | Bottleneck assignment, so the longest single trip is as short as possible; then many priority orders within about a second, moving the piece that arrives last to the front; moves checked with exact geometry |
| **Cooperative A\*** | Space-time planning with reservations, one greedy priority order, strict square rules |
| **PIBT** | No long-term plan: at each step every piece moves towards its target, pushing and passing on priority when needed |
| **Optimized sequential** | One magnet under the board: Hungarian assignment, an order that keeps empty magnet travel short, A\* with diagonals and rounded corners |
| **Naive** | One magnet, pieces in board order, orthogonal moves only |

## Measured

All five planners on the same chain of 25 changes of position (every position in the app, in order), at 3 squares/s, with a piece diameter of 0.76 of a square. The lower bound is the longest single trip under the best possible assignment; no planner can beat it.

| Planner | Mean duration | Mean piece travel | Mean compute | Smallest distance between pieces |
|---|---:|---:|---:|---:|
| *Lower bound* | *2.3 s* | | | |
| Fastest reset | **2.7 s** | 90 squares | 485 ms | 0.89 |
| Cooperative A\* | 5.1 s | 106 squares | 86 ms | 1.00 |
| PIBT | 6.1 s | 170 squares | 1 ms | 1.00 |
| Optimized sequential | 39.6 s | 94 squares | 5 ms | 1.00 |
| Naive | 55.9 s | 131 squares | 1 ms | 1.00 |

- The default planner finishes about 13% above the lower bound, roughly 21 times faster than moving one piece at a time.
- Every plan completed, and no two pieces came closer than their diameter. The fallbacks are visible in the app: Cooperative A\* fell back to PIBT on at least one transition, and the two sequential planners finished with serialized PIBT when their heuristic looped.
- The 12 mate-in-two puzzles were checked with the app's own solver: each has exactly one key move.

Compute times are from one run in headless Chromium and will differ on your machine. The Fastest reset planner has a time budget and randomised orders, so its numbers vary slightly between runs.

![The comparison table in the app: the same transition run by all five planners](docs/comparison.png)

## Run

No packages are needed, only Python 3.8+ (or nothing at all, see below).

- **Online:** the [live app](https://mmereu97.github.io/robot-chessboard-lab/).
- **PyCharm:** open the folder, right-click `serve.py` > Run 'serve'. Your browser opens http://localhost:8000.
- **Terminal:** `python serve.py`.
- **Without Python:** double-click `static/index.html`.

## Files

| File | What it does |
|---|---|
| `static/index.html` | Page layout |
| `static/css/style.css` | Colors, fonts, layout (light and dark theme) |
| `static/js/engine.js` | Motion planning: grid, assignment (Hungarian, bottleneck), sequential planner, Cooperative A\*, PIBT, the fastest-reset optimizer, collision checking |
| `static/js/puzzles.js` | Puzzle database (FEN positions). Add your own here |
| `static/js/chess.js` | Chess rules: legal moves, check, mate-in-two solver, robot defence |
| `static/js/app.js` | Drawing, animation, buttons, playing moves |
| `serve.py` | Local web server for PyCharm |
| `index.html` | Entry page for GitHub Pages; redirects to `static/` |

## Adding puzzles

Add a line to `PUZZLES` in `static/js/puzzles.js`:

```js
{ name: 'Mate in two #79', desc: 'White to move.', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1', set: 'm2' },
```

`set: 'm2'` makes the robot defend with Black and checks for mate in two; leave it out for free play. Only the piece-placement part of the FEN is needed. No side may have more pieces of a type than a normal set (e.g. two white queens), because the real trays only hold one set.

## Where to experiment

- **New planner:** add an entry to `ALGOS` at the end of `engine.js`. It receives start cells and target cells and must return segments (see `pathsToPlan`). The planner list in the page is built from `ALGOS` in `app.js`.
- **Movement rules:** `geomOK` inside `planCA` (exact clearance), and the piece diameter slider in the page.
- **Optimizer time budget:** `budget: 1000` in `opt()` in `app.js` (milliseconds).

## How it was built

I set the problem and the rules; the code was written with Claude Code under my direction.

## License

MIT
