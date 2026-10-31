/*
 * Test rigs: the world, robot and I/O wiring for each demo.
 *
 * A rig connects a firmware port to the simulated hardware exactly the way
 * the real robot is wired (which sensor sits on which PIND bit, how PORTB
 * drives the motors). DOM-free, so the same rigs run in the browser and in
 * the headless tests.
 */
(function (root) {
    'use strict';

    const K = root.Kaizen || require('./kaizen.js');
    const F = root.KaizenFirmware || require('./firmware.js');
    const R = {};

    const PX_PER_CM = 4;        // 1 px = 2.5 mm

    // Rotate a list of points around (cx, cy)
    function rotate(pts, cx, cy, a) {
        const c = Math.cos(a), s = Math.sin(a);
        return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
    }

    // Shared helper: builds a rig object around a robot and firmware
    function makeRig({ world, robot, program, io, onTick }) {
        const rig = { world, robot, io, trace: null, t: 0, program };
        io.trace = id => { rig.trace = id; };
        rig.firmware = new K.Firmware(program, io);
        rig.tick = t => {
            rig.t = t;
            robot.sense(world);
            rig.firmware.step(t);
            if (onTick) onTick(t);
            robot.step(0.001, world);
        };
        rig.restart = () => {
            robot.reset();
            rig.firmware = new K.Firmware(program, io);
            if (io.onRestart) io.onRestart();
        };
        return rig;
    }

    // Level 1 PORTB output wiring
    function portB(robot, rig, mirrored = false) {
        return v => {
            rig.portb = v;
            const m = K.decodePortB(v, mirrored);
            robot.setWheels(m.left, m.right);
            robot.buzzer = m.buzzer;
        };
    }

    // Arduino drive(lm1, lm2, rm1, rm2, speed) wiring
    function arduinoDrive(robot) {
        return (lm1, lm2, rm1, rm2, speed = 255) => {
            const k = speed / 255;
            robot.setWheels((lm1 - lm2) * k, (rm1 - rm2) * k);
        };
    }

    // ------------------------------------------------------ line followers

    R.lineTrack = function () {
        const cx = 450, cy = 280, Rr = 128;
        const t = K.track.figureEight(cx, cy, Rr);
        const pts = rotate(t.pts, cx, cy, Math.PI / 4);
        const [T4] = rotate([t.tangents.T4], cx, cy, Math.PI / 4);
        const cave = { x0: T4[0] + 6, x1: cx - 46, y: cy, gap: 40 };
        return {
            pts, cx, cy, R: Rr, cave,
            start: { x: T4[0] - 30, y: cy, heading: 0 },
        };
    };

    const LINE_FIRMWARE = {
        LFR: { label: 'LFR.c', program: F.LFR, obstacle: false, cave: false },
        OARLFR: { label: 'OARLFR.c', program: F.OARLFR, obstacle: true, cave: false },
        ALFR: { label: 'ALFR.c', program: F.ALFR, obstacle: true, cave: true },
        ALFRArduino: { label: 'ALFR(Arduino).ino', program: F.ALFRArduino, obstacle: true, cave: true },
    };
    R.LINE_FIRMWARE = LINE_FIRMWARE;

    R.lineFollower = function (name, opts = {}) {
        const fw = LINE_FIRMWARE[name];
        const track = R.lineTrack();
        const c = track.cave;
        const obstacles = (opts.obstacles || []).slice();
        const decor = [];
        if (fw.cave) {
            obstacles.push({ x: c.x0, y: c.y - c.gap - 8, w: c.x1 - c.x0, h: 8, wall: true, fill: '#64748b' });
            obstacles.push({ x: c.x0, y: c.y + c.gap, w: c.x1 - c.x0, h: 8, wall: true, fill: '#64748b' });
            decor.push({ x: c.x0, y: c.y - c.gap, w: c.x1 - c.x0, h: c.gap * 2, fill: 'rgba(100,116,139,0.18)', label: 'CAVE', labelColor: '#475569' });
        }
        const world = new K.World({ lines: [{ pts: track.pts, width: 14, closed: true }], obstacles, decor });

        const sensors = [
            { name: 'left', type: 'line', dx: 28, dy: -11 },
            { name: 'right', type: 'line', dx: 28, dy: 11 },
        ];
        if (fw.obstacle) sensors.push({ name: 'front', type: 'prox', dx: 31, dy: 0, angle: 0, range: 34, spread: 0.15 });
        if (fw.cave) sensors.push({ name: 'cave', type: 'prox', dx: 0, dy: 23, angle: Math.PI / 2, range: 45 });

        const robot = new K.Robot({ ...track.start, sensors, maxSpeed: opts.maxSpeed || 80 });
        const io = { adc: opts.adc === undefined ? 600 : opts.adc };
        const rig = makeRig({ world, robot, program: fw.program, io });
        rig.track = track;
        rig.portb = 0;
        const s = robot.readings;
        io.PORTB = portB(robot, rig);
        io.readADC = () => io.adc;
        io.inCave = false;
        io.cave = on => { io.inCave = on; };

        if (name === 'LFR') {
            io.pind = () => 0b11111100 | (s.left << 1) | s.right;
            io.labels = { 0: 'PD0 right line', 1: 'PD1 left line' };
        } else if (name === 'OARLFR') {
            io.pind = () => 0b11111000 | s.left | ((s.front ? 0 : 1) << 1) | (s.right << 2);
            io.labels = { 0: 'PD0 left line', 1: 'PD1 path clear', 2: 'PD2 right line' };
        } else {
            io.pind = () => 0b11110000 | s.right | (s.left << 1) | ((s.front ? 0 : 1) << 2) | ((s.cave ? 0 : 1) << 3);
            io.labels = { 0: 'PD0 right line', 1: 'PD1 left line', 2: 'PD2 path clear', 3: 'PD3 no cave wall' };
        }
        io.PIND = io.pind;

        if (name === 'ALFRArduino') {
            io.digitalRead = n => (n === 'obstacle' ? (s.front ? 0 : 1) : n === 'cave' ? (s.cave ? 0 : 1) : s[n]);
            io.drive = arduinoDrive(robot);
            io.buzzer = on => { robot.buzzer = on; };
        }
        return rig;
    };

    // Progress along a closed polyline, for tests: index of nearest point
    R.nearestIndex = function (pts, x, y) {
        let best = 0, bd = Infinity;
        pts.forEach((p, i) => {
            const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
            if (d < bd) { bd = d; best = i; }
        });
        return { index: best, dist: Math.sqrt(bd) };
    };

    // --------------------------------------------------- obstacle avoider

    R.defaultBoxes = function () {
        return [
            { x: 260, y: 120, w: 70, h: 70 }, { x: 560, y: 90, w: 90, h: 50 },
            { x: 650, y: 330, w: 60, h: 120 }, { x: 330, y: 360, w: 110, h: 50 },
            { x: 140, y: 300, r: 32 }, { x: 470, y: 250, r: 26 },
        ];
    };

    R.obstacleAvoider = function (opts = {}) {
        const walls = { x: 20, y: 20, w: 860, h: 520 };
        const world = new K.World({ walls, obstacles: opts.obstacles || R.defaultBoxes() });
        const sensors = [
            { name: 'right', type: 'prox', dx: 27, dy: 14, angle: 0.6, range: 46 },
            { name: 'centre', type: 'prox', dx: 31, dy: 0, angle: 0, range: 46 },
            { name: 'left', type: 'prox', dx: 27, dy: -14, angle: -0.6, range: 46 },
        ];
        const robot = new K.Robot({ x: 90, y: 90, heading: 0.3, sensors, maxSpeed: 80, style: { body: '#2563eb', trail: 'rgba(234,88,12,0.35)' } });
        const io = {};
        const rig = makeRig({ world, robot, program: F.OAR, io });
        const s = robot.readings;
        io.PORTB = portB(robot, rig);
        io.PIND = () => 0b11111000 | (s.right ? 0 : 1) | ((s.centre ? 0 : 1) << 1) | ((s.left ? 0 : 1) << 2);
        io.labels = { 0: 'PD0 right clear', 1: 'PD1 centre clear', 2: 'PD2 left clear', 3: 'PD3 aux (high)' };
        return rig;
    };

    // ------------------------------------------------------ table top robot

    R.tableTop = function () {
        const table = { x: 150, y: 70, w: 600, h: 420 };
        const world = new K.World({ table });
        const sensors = [
            { name: 's1', type: 'edge', dx: 34, dy: -21, label: 'S1' },
            { name: 's2', type: 'edge', dx: 34, dy: 21, label: 'S2' },
            { name: 's3', type: 'edge', dx: -34, dy: 21, label: 'S3' },
            { name: 's4', type: 'edge', dx: -34, dy: -21, label: 'S4' },
        ];
        const robot = new K.Robot({ x: 450, y: 280, heading: -0.5, sensors, maxSpeed: 80, style: { body: '#7c3aed' } });
        const io = {};
        const rig = makeRig({ world, robot, program: F.TTR, io });
        const s = robot.readings;
        io.PORTB = portB(robot, rig);
        io.PIND = () => 0b11110000 | (s.s1 << 3) | (s.s2 << 2) | (s.s3 << 1) | s.s4;
        io.labels = { 0: 'PD0 S4 off edge', 1: 'PD1 S3 off edge', 2: 'PD2 S2 off edge', 3: 'PD3 S1 off edge' };
        return rig;
    };

    // ------------------------------------------------------ serial control

    R.SERIAL_FIRMWARE = {
        TTL: { label: 'TTL.c', program: F.TTL, level: 1 },
        WC: { label: 'WC.c (wheelchair)', program: F.WC, level: 1, mirrored: true, sonar: true },
        SpeedControl: { label: 'Speed_Control_Assignment.ino', program: F.SpeedControl, level: 2 },
        ComputerControlled: { label: 'Computer_Controlled.ino', program: F.ComputerControlled, level: 2, arm: true },
    };

    R.serialRobot = function (name, opts = {}) {
        const fw = R.SERIAL_FIRMWARE[name];
        const walls = { x: 20, y: 20, w: 860, h: 520 };
        const world = new K.World({ walls, obstacles: opts.obstacles || [{ x: 600, y: 200, w: 80, h: 160 }, { x: 250, y: 380, r: 40 }] });
        const sensors = fw.sonar ? [{ name: 'sonar', type: 'sonar', dx: 30, dy: 0, angle: 0, range: 400 * PX_PER_CM, spread: 0.13 }] : [];
        const robot = new K.Robot({
            x: 160, y: 200, heading: 0, sensors, maxSpeed: 90,
            style: { body: fw.sonar ? '#0f766e' : '#1f7a4d' },
        });
        const io = { lcd: opts.lcd || { clear() {}, print() {}, show() {}, setCursor() {} } };
        io.uart = new K.Uart(fw.level === 1 ? 2 : 64);
        io.joints = { elbow: 0, wrist: 0 };
        io.jointAngle = { elbow: 0.3, wrist: 0.5 };
        const rig = makeRig({
            world, robot, program: fw.program, io,
            onTick: () => {
                for (const j of ['elbow', 'wrist']) {
                    io.jointAngle[j] = Math.max(0, Math.min(1, io.jointAngle[j] + io.joints[j] * 0.0006));
                }
            },
        });
        rig.fw = fw;
        rig.portb = 0;
        io.PORTB = portB(robot, rig, !!fw.mirrored);
        io.uartAvailable = () => io.uart.available();
        io.uartRead = () => io.uart.read();
        io.available = io.uartAvailable;
        io.read = io.uartRead;
        io.sonarCm = () => {
            const d = robot.readings.sonar;
            return d === undefined || d === Infinity ? 0xffff : Math.floor(d / PX_PER_CM);
        };
        io.drive = arduinoDrive(robot);
        io.joint = (n, a, b) => { io.joints[n] = a - b; };
        io.onRestart = () => { io.uart.clear(); io.joints.elbow = io.joints.wrist = 0; };
        return rig;
    };

    // ------------------------------------------------------ gesture control

    R.REMOTES = {
        RFRemote: { label: 'Level2_Remote.ino (RF Control)', program: F.RFRemote, receiver: F.Gesture2, receiverLabel: 'Assignment_Gesture2.ino', tilt: true },
        GestureRemote: { label: 'Level2_Remote2.ino (Gesture Bot)', program: F.GestureRemote, receiver: F.GestureBotReceiver, receiverLabel: "receiver ('o' = reverse)", tilt: true },
        ArmRemote: { label: 'Assignment_Arm_Remote.ino (Pick & Place)', program: F.ArmRemote, receiver: F.Gesture2, receiverLabel: 'Assignment_Gesture2.ino', tilt: true, arm: true },
        DPDTRemote: { label: 'Assignment_DPDT_Wireless.ino', program: F.DPDTRemote, receiver: F.Gesture2, receiverLabel: 'Assignment_Gesture2.ino', tilt: false },
    };

    R.gesture = function (name) {
        const rm = R.REMOTES[name];
        const walls = { x: 20, y: 20, w: 860, h: 520 };
        const world = new K.World({
            walls,
            obstacles: [],
            decor: [
                { x: 640, y: 90, w: 120, h: 90, fill: 'rgba(37,99,235,0.10)', label: 'DROP ZONE', labelColor: '#1d4ed8' },
            ],
        });
        const robot = new K.Robot({ x: 200, y: 380, heading: -Math.PI / 2, maxSpeed: 80, style: { body: '#b45309' } });
        const remoteIo = { tilt: { x: rm.program.rest ? rm.program.rest.x : 0, y: rm.program.rest ? rm.program.rest.y : 0 }, switches: { arm1: 0, arm2: 0, drive: 0, steer: 0 } };
        const link = new K.Uart(64);
        const rxIo = { joints: { arm1: 0, arm2: 0 }, jointAngle: { arm1: 0.2, arm2: 0.8 } };
        remoteIo.analogRead = axis => Math.round(remoteIo.tilt[axis]);
        remoteIo.switchPos = n => remoteIo.switches[n];
        remoteIo.print = c => { link.send(c); if (rig.remote) rig.remote.wakeAt += 1; };  // ~1 ms per byte at 9600 baud
        remoteIo.trace = () => {};
        rxIo.available = () => link.available();
        rxIo.read = () => link.read();
        rxIo.drive = arduinoDrive(robot);
        rxIo.joint = (n, a, b) => { rxIo.joints[n] = a - b; };

        const rig = makeRig({
            world, robot, program: rm.receiver, io: rxIo,
            onTick: t => {
                rig.remote.step(t);
                for (const j of ['arm1', 'arm2']) {
                    rxIo.jointAngle[j] = Math.max(0, Math.min(1, rxIo.jointAngle[j] + rxIo.joints[j] * 0.0007));
                }
            },
        });
        rig.rm = rm;
        rig.link = link;
        rig.remoteIo = remoteIo;
        rig.remote = new K.Firmware(rm.program, remoteIo);
        const restart = rig.restart;
        rig.restart = () => { restart(); link.clear(); rig.remote = new K.Firmware(rm.program, remoteIo); };
        return rig;
    };

    R.PX_PER_CM = PX_PER_CM;

    root.KaizenRigs = R;
    if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
