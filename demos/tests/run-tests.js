/*
 * Headless checks for the demo simulations: node demos/tests/run-tests.js
 *
 * Each test runs a firmware port in its rig and checks the robot does what
 * the real robot is meant to do (follow the line, stop at obstacles, stay on
 * the table, solve the maze by the shortest route, ...).
 */
'use strict';

const path = require('path');
const assets = path.join(__dirname, '..', 'assets');
require(path.join(assets, 'kaizen.js'));
const F = require(path.join(assets, 'firmware.js'));
const R = require(path.join(assets, 'rigs.js'));
const M = require(path.join(assets, 'maze.js'));

let failures = 0;
function check(name, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
    if (!ok) failures++;
}

function run(rig, ms) {
    const end = rig.t + ms;
    for (let t = rig.t + 1; t <= end; t++) rig.tick(t);
}

// Line followers stay on the line and keep lapping the track
for (const name of Object.keys(R.LINE_FIRMWARE)) {
    const rig = R.lineFollower(name);
    let maxOff = 0;
    for (let s = 0; s < 60; s++) {
        run(rig, 1000);
        maxOff = Math.max(maxOff, R.nearestIndex(rig.track.pts, rig.robot.x, rig.robot.y).dist);
    }
    const laps = rig.robot.odometer / (rig.track.pts.length * 6);
    check(`${name}: follows the figure-eight`, maxOff < 12 && laps > 2, `${laps.toFixed(1)} laps, max ${maxOff.toFixed(1)} px off`);
}

// Obstacle-aware line followers stop for an obstacle and resume after it goes
for (const name of ['OARLFR', 'ALFR', 'ALFRArduino']) {
    const rig = R.lineFollower(name);
    const p = rig.track.pts[40];
    rig.world.obstacles.push({ x: p[0] - 12, y: p[1] - 12, w: 24, h: 24 });
    run(rig, 15000);
    const odo = rig.robot.odometer;
    run(rig, 4000);
    const stopped = rig.robot.odometer - odo < 1;
    rig.world.obstacles.pop();
    run(rig, 4000);
    check(`${name}: waits at an obstacle, then carries on`, stopped && rig.robot.odometer - odo > 50);
}

// ALFR slows down in the cave according to the potentiometer
{
    const lap = adc => { const rig = R.lineFollower('ALFR', { adc }); run(rig, 60000); return rig.robot.odometer; };
    const slow = lap(800), fast = lap(100);
    check('ALFR: higher pot reading means slower in the cave', slow < fast, `${slow.toFixed(0)} px vs ${fast.toFixed(0)} px`);
}

// Obstacle avoider keeps moving around the room
{
    const rig = R.obstacleAvoider();
    let stuck = 0, last = 0;
    for (let s = 0; s < 120; s++) {
        run(rig, 1000);
        if (rig.robot.odometer - last < 5) stuck++;
        last = rig.robot.odometer;
    }
    check('OAR: roams without getting stuck', stuck === 0, `${rig.robot.odometer.toFixed(0)} px driven`);
}

// Table top robot never drives off the table
{
    let falls = 0;
    for (let trial = 0; trial < 4; trial++) {
        const rig = R.tableTop();
        rig.robot.heading = trial * 1.7;
        for (let s = 0; s < 120 && !rig.robot.fallen; s++) run(rig, 1000);
        if (rig.robot.fallen) falls++;
    }
    check('TTR: stays on the table', falls === 0, `${falls} falls in 4 x 120 s`);
}

// Wheelchair stops about 40 cm from a wall
{
    const rig = R.serialRobot('WC');
    for (let i = 0; i < 9000; i++) {
        if (i % 50 === 0) rig.io.uart.send('F');
        rig.tick(rig.t + 1);
    }
    const gapCm = (600 - (rig.robot.x + 30)) / R.PX_PER_CM;
    check('WC: backs off from an obstacle at 40 cm', gapCm > 30 && gapCm < 50, `${gapCm.toFixed(0)} cm gap`);
}

// Gesture remote -> receiver
{
    const rig = R.gesture('RFRemote');
    rig.remoteIo.tilt = { x: 396, y: 384 };
    run(rig, 3000);
    check('Gesture: forward tilt drives the robot', rig.robot.odometer > 100 && rig.trace === 'f');
}

// Path simplification matches the six rules in the sketches
{
    const rules = { LUL: 'S', LUS: 'R', LUR: 'U', SUL: 'R', SUS: 'U', RUL: 'U' };
    const ok = Object.entries(rules).every(([from, to]) => F.simplifyPath([...from]).path.join('') === to);
    check('simplify_path(): LUL->S, LUS->R, LUR->U, SUL->R, SUS->U, RUL->U', ok);
    check('reverse_path(): reverses and swaps L/R', F.reversePath([...'LSRS']).join('') === 'SLSR');
}

// Maze: explore, then the shortest run and the return trip are optimal
{
    let bad = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const maze = M.generate(4 + seed % 6, 3 + seed % 4, seed);
        const explore = [...M.run(maze, 'explore')];
        const end = explore[explore.length - 1];
        const plan = M.simplify(end.path).path;
        const replay = [...M.run(maze, 'replay', { path: plan })];
        const back = [...M.run(maze, 'return', { path: M.reverse(plan), arrivalDir: end.dir })];
        const home = back[back.length - 1];
        if (end.kind !== 'end' || replay.length - 1 !== maze.shortest || replay[replay.length - 1].kind !== 'end' ||
            home.kind !== 'home' || back.length - 1 !== maze.shortest) bad++;
    }
    check('Maze: shortest run and return trip are optimal on 200 random mazes', bad === 0, `${bad} failures`);
}

console.log(failures ? `\n${failures} test(s) failed` : '\nAll tests passed');
process.exit(failures ? 1 : 0);
