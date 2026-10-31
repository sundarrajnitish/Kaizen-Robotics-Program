/*
 * Line-maze model for the maze solver demos.
 *
 * The maze is a grid of junctions joined by black lines. The robot runs the
 * same decision logic as maze_solver.ino / ShortestPathAlgorithm.ino /
 * Maze_bot_return_final.ino: at every node it sees one of the sensor
 * patterns below (before and after the "inch" forward), chooses with the
 * left hand rule and records the decision when the junction had a choice.
 *
 * Directions: 0 = east, 1 = south, 2 = west, 3 = north (screen coordinates).
 */
(function (root) {
    'use strict';

    const F = root.KaizenFirmware || require('./firmware.js');
    const M = {};
    const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
    M.DX = DX;
    M.DY = DY;

    function rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6d2b79f5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Perfect maze (exactly one route between any two nodes) by depth-first search
    M.generate = function (w, h, seed = 1) {
        const rand = rng(seed);
        const open = Array.from({ length: h }, () => Array.from({ length: w }, () => [false, false, false, false]));
        const seen = Array.from({ length: h }, () => Array(w).fill(false));
        const stack = [[0, h - 1]];
        seen[h - 1][0] = true;
        while (stack.length) {
            const [x, y] = stack[stack.length - 1];
            const dirs = [0, 1, 2, 3].filter(d => {
                const nx = x + DX[d], ny = y + DY[d];
                return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny][nx];
            });
            if (!dirs.length) { stack.pop(); continue; }
            const d = dirs[Math.floor(rand() * dirs.length)];
            const nx = x + DX[d], ny = y + DY[d];
            open[y][x][d] = true;
            open[ny][nx][(d + 2) % 4] = true;
            seen[ny][nx] = true;
            stack.push([nx, ny]);
        }
        const maze = { w, h, open, seed };
        const degree = (x, y) => open[y][x].filter(Boolean).length;
        // Start: the dead end closest to the bottom-left corner
        let start = null;
        for (let s = 0; s < w + h && !start; s++) {
            for (let x = 0; x <= s && !start; x++) {
                const y = h - 1 - (s - x);
                if (x < w && y >= 0 && degree(x, y) === 1) start = { x, y };
            }
        }
        start.dir = open[start.y][start.x].indexOf(true);
        maze.start = start;
        // End: the dead end farthest from the start
        const dist = M.distances(maze, start);
        let best = -1;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (degree(x, y) === 1 && dist[y][x] > best && !(x === start.x && y === start.y)) {
                    best = dist[y][x];
                    maze.end = { x, y };
                }
            }
        }
        maze.shortest = best;
        return maze;
    };

    M.distances = function (maze, from) {
        const dist = Array.from({ length: maze.h }, () => Array(maze.w).fill(Infinity));
        dist[from.y][from.x] = 0;
        const q = [[from.x, from.y]];
        while (q.length) {
            const [x, y] = q.shift();
            for (let d = 0; d < 4; d++) {
                if (!maze.open[y][x][d]) continue;
                const nx = x + DX[d], ny = y + DY[d];
                if (dist[ny][nx] === Infinity) { dist[ny][nx] = dist[y][x] + 1; q.push([nx, ny]); }
            }
        }
        return dist;
    };

    // Exits relative to the heading: left, straight, right
    function exits(maze, x, y, dir) {
        const o = maze.open[y][x];
        return { L: o[(dir + 3) % 4], S: o[dir], R: o[(dir + 1) % 4] };
    }

    const bits = s => s.split('').join(' ');

    // What the five sensors see at a node, mirroring the sketch's if/else chain.
    // Returns {kind, before, after, lcd, choice}
    function classify(e, isEnd) {
        if (isEnd) return { kind: 'end', before: '00000', after: '00000', lcd: ['T/END/4', 'END OF MAZE'] };
        if (!e.L && !e.S && !e.R) return { kind: 'dead', before: '11111', lcd: ['U TURN'] };
        if (!e.L && e.S && !e.R) return { kind: 'line', before: '11011', lcd: ['FORWARD'] };
        if (!e.L && !e.S && e.R) return { kind: 'rightOnly', before: '11000', after: '11111', lcd: ['RT/Strt n rt?', 'right'] };
        if (!e.L && e.S && e.R) return { kind: 'straightRight', before: '11000', after: '11011', lcd: ['RT/Strt n rt?', 'STRAIGHT'], choice: true };
        if (e.L && !e.S && !e.R) return { kind: 'leftOnly', before: '00011', after: '11111', lcd: ['Lft/str n lft?', 'LEFT'] };
        if (e.L && e.S && !e.R) return { kind: 'straightLeft', before: '00011', after: '11011', lcd: ['Lft/str n lft?', 'LEFT'], choice: true };
        if (e.L && !e.S && e.R) return { kind: 'T', before: '00000', after: '11111', lcd: ['T/END/4', 'T-int'], choice: true };
        return { kind: 'cross', before: '00000', after: '11011', lcd: ['T/END/4', '4 WAY'], choice: true };
    }

    M.KIND_LABEL = {
        end: 'End box (all black after inching)', dead: 'Dead end', line: 'Straight line',
        rightOnly: 'Right turn only', straightRight: 'Straight or right', leftOnly: 'Left turn only',
        straightLeft: 'Straight or left', T: 'T junction', cross: '4-way crossing',
    };

    const RELATIVE = { L: 3, S: 0, R: 1, U: 2 };

    /*
     * Runs the robot through the maze, yielding one event per node.
     *   mode 'explore' : left hand rule, records the path        (maze_solver.ino)
     *   mode 'replay'  : start -> end following `path`            (ShortestPathAlgorithm.ino)
     *   mode 'return'  : end -> start following `path`            (Maze_bot_return_final.ino)
     * Event: {x, y, dir, newDir, kind, before, after, lcd, recorded, decision, path, done}
     */
    M.run = function* (maze, mode, opts = {}) {
        let x, y, dir;
        const path = [];
        let k = 0;
        const plan = opts.path || [];
        if (mode === 'return') {
            ({ x, y } = maze.end);
            dir = (opts.arrivalDir + 2) % 4;            // turn around in the end box
            yield { x, y, dir, newDir: dir, kind: 'uturnAtEnd', lcd: ['ENTERED FINAL'], turn: 'U' };
        } else {
            ({ x, y, dir } = maze.start);
            yield { x, y, dir, newDir: dir, kind: 'start', lcd: [mode === 'explore' ? 'MSR with LHR' : 'ENTERED FINAL'] };
        }
        x += DX[dir];
        y += DY[dir];

        for (let guard = 0; guard < 4 * maze.w * maze.h + 10; guard++) {
            const isEnd = mode !== 'return' && x === maze.end.x && y === maze.end.y;
            const e = exits(maze, x, y, dir);
            const c = classify(e, isEnd);
            const ev = { x, y, dir, ...c, recorded: null, decision: null };

            if (c.kind === 'end') {
                ev.newDir = dir;
                ev.done = true;
                if (mode === 'explore') path.push('E');
                ev.path = path.slice();
                yield ev;
                return;
            }
            if (mode === 'return' && c.kind === 'dead') {
                ev.kind = 'home';
                ev.lcd = ['Back at start'];
                ev.newDir = dir;
                ev.done = true;
                yield ev;
                return;
            }

            let turn;
            if (mode === 'explore') {
                turn = e.L ? 'L' : e.S ? 'S' : e.R ? 'R' : 'U';
                if (c.kind === 'dead' || c.choice) { ev.recorded = turn; path.push(turn); }
            } else if (c.choice) {
                turn = plan[k++] || 'S';
                ev.decision = turn;
                ev.lcd = c.lcd.slice(0, 1).concat(['ENTERD DECISIONS']);
            } else {
                turn = e.S ? 'S' : e.L ? 'L' : e.R ? 'R' : 'U';
            }
            ev.turn = turn;
            ev.newDir = (dir + RELATIVE[turn]) % 4;
            ev.path = path.slice();
            yield ev;
            dir = ev.newDir;
            x += DX[dir];
            y += DY[dir];
        }
    };

    M.simplify = path => F.simplifyPath(path.filter(t => t !== 'E'));
    M.reverse = F.reversePath;
    M.bits = bits;

    root.KaizenMaze = M;
    if (typeof module !== 'undefined' && module.exports) module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);
