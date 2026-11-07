# Twin mates

Finds mate-in-two puzzles where one key move leaves defences that each need their own mate, like this one from *1001 Chess Exercises for Beginners*: 1.Re8+ and either 1...Qxe8 2.Qxf6# (the queen no longer guards f6) or 1...Bxe8 2.Qg8# (the bishop cuts the queen off from g8).

Run with Node 22 or later, from this folder:

1. `node fetch.js`: streams the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0, about 310 MB) and keeps the mate-in-two puzzles in `mate2.csv` (about 820,000).
2. `node detect.js mate2.csv all.jsonl 4`: with 4 worker threads, about 6 minutes. Keeps the positions where the key leaves defences that no single move mates after all of them, and where no other first move works. About 56,000.
3. `node pick.js all.jsonl 100`: scores them and keeps a varied hundred in `chosen.json`. Points for more different mates, for the same piece taken by different defenders, for a sacrifice, for single mates without duals; none for a defender that only steps in the way to be taken there. At most two of a kind and one per game.
4. `node build.js chosen.json ../../static/js/twins.js`: checks each one again with the app's own rules (castling as the app infers it, no en passant), and writes the puzzles.

`mate2.csv` and the `.jsonl` files are not in git.
