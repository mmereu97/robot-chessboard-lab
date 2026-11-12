# Robot Chessboard Lab

A simulator for a self-moving chessboard. All 32 pieces drive from one position to the next, on a board with side trays for the pieces not in play: no teleporting and no touching. Five path planners can be compared on the same change of position, and a hundred mate-in-two puzzles from Lichess games are playable, with the robot defending.

**[Open the live app](https://mmereu97.github.io/robot-chessboard-lab/)**

![Pieces moving in parallel to the next puzzle, with each path drawn on the board](docs/screenshot.png)

## The problem

The idea came from watching a commercial robotic board, the Chessnut Move, set up its pieces: I wanted to see how short and how smooth that choreography could get. Resetting a board is a multi-robot path-planning problem in a very tight space: up to 32 pieces, each of which must reach a square of its own type, while every other piece is in the way. A naive board moves one piece at a time and takes the better part of a minute. The interesting question is how close you can get to the theoretical limit if the pieces move together.

## The planners

| Planner | Idea |
|---|---|
| **Fastest reset** (default) | Bottleneck assignment, so the longest single trip is as short as possible; then many priority orders within about a second, moving the piece that arrives last to the front; moves checked with exact geometry; pieces with nowhere to go are left alone |
| **Pieces step aside** | Same matching, no grid: pieces are circles. Each trip takes the route that disturbs least; a piece too close to it slides off by the least that lets the circle pass and returns afterwards. Trips run together whenever they collide with nothing already under way. |
| **Cooperative A\*** | Space-time planning with reservations, one greedy priority order, strict square rules |
| **PIBT** | No long-term plan: at each step every piece moves towards its target, pushing and passing on priority when needed |
| **Optimized sequential** | One magnet under the board: Hungarian assignment, an order that keeps empty magnet travel short, A\* with diagonals and rounded corners |
| **Naive** | One magnet, pieces in board order, orthogonal moves only |

## Measured

All five planners on the same chain of 25 changes of position (the 25 positions the app had until 7 November 2026, in order: 13 classic positions and 12 mate-in-two puzzles, in the git history), at 3 squares/s, with a piece diameter of 0.76 of a square. The lower bound is the longest single trip under the best possible assignment; no planner can beat it.

| Planner | Mean duration | Mean piece travel | Mean compute | Smallest distance between pieces |
|---|---:|---:|---:|---:|
| *Lower bound* | *2.2 s* | | | |
| Fastest reset | **2.8 s** | 78 squares | 434 ms | 0.89 |
| Cooperative A\* | 5.0 s | 104 squares | 74 ms | 1.00 |
| PIBT | 5.8 s | 152 squares | 1 ms | 1.00 |
| Optimized sequential | 37.3 s | 89 squares | 5 ms | 1.00 |
| Naive | 59.0 s | 138 squares | 1 ms | 1.00 |

- The default planner finishes about 30% above the lower bound, roughly 21 times faster than moving one piece at a time.
- Every plan completed, and no two pieces came closer than their diameter. The fallbacks are visible in the app: the two sequential planners can finish with serialized PIBT when their heuristic loops.

Pieces step aside was added later and measured on the same chain with the same diameter: a mean of **4.4 s**, against 2.7 s for Fastest reset, with about 3.6 pieces per change stepping aside, by 0.07 of a square on average and 0.41 at most, and the circles never closer than their diameter. On 80 random changes at a diameter of 0.78 it could not place a trip 3 times; it then uses Fastest reset and the comparison table marks it as a fallback. Above a diameter of about 0.84 this happens more often, because a row has little room left to open.

Compute times are from one run in headless Chromium and will differ on your machine. The Fastest reset planner has a time budget and randomised orders, so its numbers vary slightly between runs.

![The comparison table in the app: the same transition run by all five planners](docs/comparison.png)

## Piece themes

Every piece is imagined as the same small robot, with the same round base, so only the drawing changes. Under Movement rules: **Discs**, **Lichess**, **Lichess, inside the base**, and the same **with circle**. The last two are for experiments where size matters: each symbol fits inside a circle as wide as the base the planner checks, invisible or drawn, so pieces that do not collide also do not overlap on screen. King and queen fill the circle, and the others follow the height order of a real set, down to the pawn. The circle follows the Piece diameter slider and starts at 0.78 of a square. The theme with the circle is the default. The Piece sizes tab, next to the board, sets how much of its circle each type of piece fills, in percent with one decimal: at 100% the symbol touches the circle. The board shows each change at once. The space between symbol and circle is gold for White and grey for Black by default; each side can have another colour or stay transparent.

That 78% is the usual guideline (1.75-inch king's base on a 2.25-inch square), not a FIDE rule. The current [FIDE equipment rules](https://handbook.fide.com/chapter/ChessEquipmentWithoutElectronicComponenets032026) give standard heights (king 95 mm, down to pawn 50 mm), a base diameter of 40–50% of each piece's height, and squares of 5–6 cm on which four pawns must fit. That allows a king's base of anywhere from 63% to 95% of the square.

A geometric consequence to keep in mind: a piece moving diagonally between two pieces on the side squares passes their centres at 0.707 of a square, so with equal bases it only fits if the base is at most 0.70. Only the Fastest reset planner uses the slider's exact geometry; the others follow strict square rules.

## Tidy trays

A piece not in play goes to the tray on its side of the board, whatever its colour: files a to d to the left tray, e to h to the right one. A piece already on a tray stays on that tray. Over 54 changes of position, on all six planners, none crossed to the other tray.

For the planners, the pieces not in play have a grid place on the two columns next to the board, the back column first, and on the outer two when those are full; on screen they lie in a heap around it. Duration alone is not what makes a move look right: a planner chasing only the clock will happily make pawns step aside to let a knight squeeze in behind them, which no person would do. So:

- a piece does not squeeze in behind another: the piece in front steps back and the newcomer takes its place;
- in the Fastest reset planner, pieces that stay put reserve their squares first, and each piece that has to step aside counts as extra duration.

Over the same 25 transitions (mean of three runs), pieces stepping aside with nowhere to go fell from about 44 to 1, at the price of 0.2 s per transition.

## Moving a piece

Drag a piece to its square, as on chess.com or lichess, or click the piece and then the square. A dragged piece is put down by you, so no robot carries it; the robots only clear what is in the way: a captured piece when captures by hand are off, the rook when castling. Dropped on a square it cannot go to, it returns home.

## The trays

The trays are two columns wide, half what they used to be (the measurements above were made with four columns). A tray takes as many pieces as fit on it, and a piece that does not fit goes to the other one, whether you drop it there or a capture sends it there. The planners' grid gives each tray only 16 places, so a piece beyond that borrows a free place of the other tray, on paper only; at the next change of position, before anything else, the robots carry the extra pieces across, since the planners need every piece on a place of its own. On screen the pieces lie in a heap, with no fixed places; when a tray is too full for a heap, it is laid out in two neat columns instead. A captured piece goes the shortest way to the nearest tray: along its rank to the tray's edge, stopping as soon as it is inside. The pieces already there move by the least that makes it fit, and stay where they were pushed.

Tested with both trays full (only the two kings left on the board) and back, on all six planners and in the app: nothing overlaps at rest. With the narrower trays, pieces pass each other closer while they move: over 60 changes of position, 9 come closer than their diameter for a moment (3 with the wide trays).

Between positions too, the pieces not in play lie in a heap, at random and without touching. The planners work on a grid, but a piece that stays on a tray stays where it lies, one that leaves starts from where it lies, and one that arrives ends its trip in the heap. The planners do not see the heap, so the trays behave like magnets that repel: whatever lies there is pushed out of the way of what moves, by the least that keeps the distance, and a piece that has arrived drifts to its place in the heap only as far as nothing is in its way. A piece leaving a tray first goes to its grid place, and from there the planner's paths hold. Over 50 changes of position, in 47 no two pieces touched on the way; in the other 3 two pieces still overlap for a moment on a tray, and some of the 47 pass a little closer than the 3 mm. The clearance in the stats shows it. At rest the distance always holds. This costs about 0.3 s per change of position.

A captured piece that goes to a tray takes the straight way if that disturbs nothing. Otherwise several routes to the tray's edge are compared, between pieces too, and the cheapest wins: its length plus how far each piece has to step aside. So a rook leaving along the top rank past a king on h8 passes between the king and the h7 pawn, which move a little and come back, and nothing runs along the route.

You can reach into the trays at any moment of a game, on your turn or not: drag a piece, or click it and click where it goes, on the same tray or the other one. The pieces there make room. Drop it anywhere else, or press Esc, and it goes back where it lay. While the robots are moving, it waits on its new spot until they finish.

Pieces keep 3 mm apart, as magnets that repel would, taken on a 58 mm square (0.05 of a square). To everything that plans or places pieces, a piece is that much wider than it is drawn. On the chain of 25 changes of position this cost no measurable time: Fastest reset stays at 2.7 s and Pieces step aside at 4.5 s. A tray of 32 pieces still holds them all, none closer than that distance.

## Captures by hand

A person does not leave a captured piece to tidy itself away, so by default the app doesn't either. When you take a piece, it stays on your cursor while your own piece drives to the square. Nothing else can move until you drop it on a free place on either tray, wherever you like; in the mate-in-two puzzles the robot replies only after that. Its own captures still go to the tray by themselves. The option is under Movement rules.

Pieces are not tied to parking places: every plan starts from where the pieces really are. The next puzzle takes that knight from wherever you left it. Positions stay on the tray's grid, because the planners work on cells. A test with pieces shuffled across the trays passed on all five planners (12 of 12 transitions each, with no collisions).

![A captured knight on the cursor, with a dashed ring on the free tray place where it would land](docs/capture-by-hand.png)

## Play Stockfish

Set an Elo from 100 to 3000, pick a color and press Play Stockfish: the robots carry out both sides' moves on the board. The bot is the one from [chess-analysis-board](https://github.com/mmereu97/chess-analysis-board), copied with its calibration. Below Elo 1320 it plays and errs like a person: sound opening moves, moves played for an idea, instinctive checks, a rare blunder. An option, off by default, makes it stop making mistakes once it is a rook or more down; its Elo was calibrated with that rule on, so without it the bot is a little weaker when behind. From 1320 up it is Stockfish's own strength limit. Playing Black turns the board around. Games and puzzles are two tabs, and a win gets three seconds of fireworks. During a game a bar beside the board shows who stands better; a second Stockfish at full strength evaluates each position for 0.8 s, whatever the bot's Elo, and the bar can be switched off. Take back returns to your last turn: your move and the bot's answer are undone and the robots put the pieces back, captured ones included. The button counts how many times you used it. Under the board, each side's captures and who is ahead in material, by how many points (pawn 1, knight and bishop 3, rook 5, queen 9). The Elo you last played at is remembered, in the browser and, under serve.py, in lab-settings.json (ignored by git). The page opens on a game, with you as White against Elo 550; the engine starts with Stockfish's first move.

Below Elo 500 the brain cannot get any weaker, so part of its moves are chosen at random: from none at 500 to 80% at 100, for a child's first games. These levels are a slope, not a measurement. Against level 500, level 100 lost all of 14 games and level 300 lost 13 and drew one, so they are weaker, but their numbers are not calibrated Elo as the levels from about 540 up are.

A pawn reaching the last rank waits there: click a queen, rook, bishop or knight of yours on a tray (they are ringed), and that piece drives to the square while the pawn goes off the board. Buttons under the board do the same, and a click on the board takes the move back.

Missed a move? The buttons under the move list, the arrow keys (← →, ↑ for the first position, ↓ for the current one) or a click on a move show any earlier position. Only the picture changes: the game, the engine and the robots carry on underneath, and a click on the board returns to the current move. Resign asks once more before it ends the game, and the moves can still be looked through afterwards.

Best move asks Stockfish at full strength, whatever the bot's Elo, for 1.5 s: an arrow on the board, as in chess-analysis-board, shows the move, and the line under the board names it with the evaluation. It stays until a move is played. The button counts how many times it was used in the game. It works in the games under Openings too.

## Run

No packages are needed, only Python 3.8+ (or nothing at all, see below).

- **Online:** the [live app](https://mmereu97.github.io/robot-chessboard-lab/).
- **PyCharm:** open the folder, right-click `serve.py` > Run 'serve'. Your browser opens http://localhost:8000.
- **Terminal:** `python serve.py`.
- **Without Python:** double-click `static/index.html`.

## Review a game

Under Play Stockfish, paste a game from Lichess or chess.com, or open its .pgn file, and press Review with the robots. Your name there tells which side you were (or choose it). The robots replay the game: ▶ or → plays the next move, Play goes on by itself, ← and the move list look back. Meanwhile Stockfish at full strength reads every position, and each move gets the mark Lichess would give it, from the winning chances it cost: ?! at 10%, ? at 20%, ?? at 30%. Play stops before every marked move. On your own turns an arrow shows the best move, so you can think about the position first; the opponent's better moves are given in words only. The move buttons sit right under the board, which never grows taller than the window, so they stay on screen. At the end, a count of blunders, mistakes and inaccuracies for each side.

## Openings

The third tab is a game against Stockfish that teaches openings as you play. Choose your colour and Stockfish's Elo and press New game. Beside the board, the list holds every opening of [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0, 3,865 named lines in 141 families) that your game can still turn into, and it shrinks with every move. A line stays in the list while every move played so far, by each side, is one of its moves, in any order: after 1.d4 d5 2.Bf4 e6 the London System is still offered, though its lines play Nf3 before Bf4. Openings that go on in the move order played come first; those reached by another order follow under their own heading. Lines named after a White system elsewhere ("Queen's Pawn Game: London System") are grouped with that system: London, Colle, Torre. Above the list, the opening the game has reached so far, with its ECO code.

Click a family and you follow its main line: ghosts show where your pieces go, faint with a dotted outline on the squares they reach at the end of the line, and stronger, ringed, for your move now. Play that move yourself, or press Play. Stockfish plays along with the line you follow, unless that is switched off; then it answers with its own moves and the list tells you what is left. A move off the line drops it, and you can pick another one at any time. Advanced shows every variation under the chosen family, with a filter by name, ECO or moves. Before the game starts, a picked line already shows its ghosts. `tools/openings/build.js` takes the list out of chess-analysis-board, where it is a tree of moves, checks every line and writes `static/data/openings.json`, with each line's moves as squares and its final position worked out in advance: the page only reads them, in a few hundredths of a second instead of seconds.

### Systems

A named opening depends on both players' moves; a system is a setup of your own pieces that you build almost whatever the other side does. Under Openings, Systems offers eleven: for White the London, Colle-Zukertort, Colle-Koltanowski, Torre, Jobava London, Stonewall Attack and King's Indian Attack; for Black the King's Indian / Pirc setup, Caro-Kann / Slav, Hippopotamus and Stonewall Dutch. Choose one and Stockfish's Elo, and play: Stockfish plays as it likes. Ghosts show the squares of the setup still to fill, in any order. On each of your turns Stockfish at full strength looks twice, at the best move of all and at the best of the setup moves (`searchmoves`). If the setup move costs under 0.7 of a pawn, a green arrow shows it; if not, an orange arrow shows what to play first and how much the setup move would lose. Notes explain the usual deviations, such as an early ...Bf5 against the Colle or ...Qb6 against the London. A piece traded off leaves the setup, a bishop by the colour of its squares. Once the setup stands, the arrows follow the system's plan, such as Ne5 and f4 in the Colle-Zukertort.

## Files

| File | What it does |
|---|---|
| `static/index.html` | Page layout |
| `static/css/style.css` | Colors, fonts, layout (light and dark theme) |
| `static/js/engine.js` | Motion planning: grid, assignment (Hungarian, bottleneck), sequential planner, Cooperative A\*, PIBT, the fastest-reset optimizer, collision checking |
| `static/js/pieces.js` | The piece images (cburnett set, see License) |
| `static/js/puzzles.js` | The starting position; add your own puzzles here |
| `static/js/twins.js` | The hundred twin mates, written by `tools/twin-mates` |
| `static/js/chess.js` | Chess rules: legal moves, check, mate-in-two solver, robot defence |
| `static/js/app.js` | Drawing, animation, buttons, playing moves |
| `static/js/openings.js` | The Openings tab: the openings still possible, the line you follow, its ghosts |
| `static/js/review.js` | Review a game: reading a PGN, the replay, Stockfish's marks and the stops before mistakes |
| `static/js/systems.js` | Systems: the eleven setups, their ghosts, the advice checked by Stockfish, the notes |
| `static/data/openings.json` | The named openings: ECO code, name, moves |
| `static/bot/` | The Stockfish bot: its brain and driver (`bot.js`), the engine, chess.js, the openings database |
| `serve.py` | Local web server for PyCharm |
| `index.html` | Entry page for GitHub Pages; redirects to `static/` |

## Adding puzzles

Add a line to `PUZZLES` in `static/js/puzzles.js`:

```js
{ name: 'My mate in two', desc: 'White to move.', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1', set: 'm2' },
```

**Twin mates** are a hundred mate-in-two puzzles where each defence needs its own mate; the robot chooses the defence at random, so the same puzzle can be played several ways. A program in `tools/twin-mates` found them among the 820,000 mate-in-two puzzles of the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0); each comes from a real game on lichess.org, named in its description.

Puzzles of your own can stay off the public site: put them in `static/js/puzzles-private.js`, which git ignores and the page loads only on localhost (run `serve.py`). The file calls `PUZZLES.push(...)` with the same fields, plus `mine: true` and `chapter`, the group in the list, and optionally `sol`, the text that Show solution displays. With such a file, the page opens on the first puzzle not solved yet and offers only its puzzles, by chapter, with no Random. It shows a progress bar and a tick on each solved puzzle; `serve.py` keeps them in `puzzle-progress.json`, which git ignores, and the browser keeps a copy. A `CHAPTER_HELP` object in the file gives each chapter's explanation.

Hint works on every turn, in two steps: the first press marks the piece that moves, the second also the square it goes to. After a wrong first move in a mate in two it says so.

A puzzle can also have a `goal`, with `line`, the book's main line in SAN, and `side: 'b'` when Black moves first (the board then turns around):

- `goal: 'mate', n`: mate in n. The robot plays the book's replies. A different move counts if the solver proves that it still forces mate, and the robot then defends as long as it can.
- `goal: 'line'`: the book's line, and only that; `result: 'draw'` when the aim is a draw.
- `goal: 'place', place: { piece, square }`: take the missing piece from a tray with the mouse and put it on its square. With `placeMate`, any square that gives mate counts.
- `goal: 'view'`: free play, with the solution to read.

`set: 'm2'` makes the robot defend with Black and checks for mate in two; leave it out for free play. Only the piece-placement part of the FEN is needed. No side may have more pieces of a type than a normal set (e.g. two white queens), because the real trays only hold one set.

## Where to experiment

- **New planner:** add an entry to `ALGOS` at the end of `engine.js`. It receives start cells and target cells and must return segments (see `pathsToPlan`). The planner list in the page is built from `ALGOS` in `app.js`.
- **Movement rules:** `geomOK` inside `planCA` (exact clearance), and the piece diameter slider in the page.
- **Optimizer time budget:** `budget: 1000` in `opt()` in `app.js` (milliseconds).

## How it was built

I set the problem and the rules; the code was written with Claude Code under my direction.

## License

MIT, except `static/bot/`: the bot and Stockfish 18 are GPL-3.0 and chess.js is BSD-2-Clause, each with its license file there. The chess pieces are the cburnett set by Colin M.L. Burnett, from [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces), under its BSD license.
