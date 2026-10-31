/*
 * Kaizen Robotics live demos - shared simulation engine.
 *
 * World  : floor lines, black areas, obstacles, walls and an optional table
 * Robot  : differential-drive chassis with line / proximity / edge / sonar sensors
 * Firmware runner : runs a firmware port written as a generator function.
 *          `yield ms` means "_delay_ms(ms)"; every loop iteration yields 1 ms.
 * Widgets: register bit view, decision table, LCD, oscilloscope, sim loop.
 *
 * The non-DOM parts also load in Node so the demos can be tested headless.
 */
(function (root) {
    'use strict';

    const K = {};

    // ------------------------------------------------------------ geometry

    function distToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = ax + t * dx, cy = ay + t * dy;
        return Math.hypot(px - cx, py - cy);
    }

    // Ray from (ox,oy) along unit (dx,dy) against an axis-aligned rect
    function rayRect(ox, oy, dx, dy, r) {
        let tmin = 0, tmax = Infinity;
        const axes = [[ox, dx, r.x, r.x + r.w], [oy, dy, r.y, r.y + r.h]];
        for (const [o, d, lo, hi] of axes) {
            if (Math.abs(d) < 1e-9) {
                if (o < lo || o > hi) return Infinity;
            } else {
                let t1 = (lo - o) / d, t2 = (hi - o) / d;
                if (t1 > t2) [t1, t2] = [t2, t1];
                tmin = Math.max(tmin, t1);
                tmax = Math.min(tmax, t2);
                if (tmin > tmax) return Infinity;
            }
        }
        return tmin;
    }

    function rayCircle(ox, oy, dx, dy, c) {
        const fx = ox - c.x, fy = oy - c.y;
        const b = fx * dx + fy * dy;
        const cc = fx * fx + fy * fy - c.r * c.r;
        const disc = b * b - cc;
        if (disc < 0) return Infinity;
        const s = Math.sqrt(disc);
        const t1 = -b - s, t2 = -b + s;
        if (t1 >= 0) return t1;
        if (t2 >= 0) return 0;
        return Infinity;
    }

    // Distance from inside a rect to its boundary along a ray
    function rayInsideRect(ox, oy, dx, dy, r) {
        let t = Infinity;
        if (dx > 0) t = Math.min(t, (r.x + r.w - ox) / dx);
        if (dx < 0) t = Math.min(t, (r.x - ox) / dx);
        if (dy > 0) t = Math.min(t, (r.y + r.h - oy) / dy);
        if (dy < 0) t = Math.min(t, (r.y - oy) / dy);
        return Math.max(0, t);
    }

    function pointInRect(x, y, r) {
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    }

    K.geometry = { distToSegment, rayRect, rayCircle, pointInRect };

    // Samples a closed Catmull-Rom spline / arcs into a polyline
    K.track = {
        // Figure-eight: two circles joined by straight diagonals crossing at 90 deg
        figureEight(cx, cy, R, step = 6) {
            const d = R * Math.SQRT2, pts = [];
            const C1 = [cx + d, cy], C2 = [cx - d, cy];
            const at = (C, deg) => [C[0] + R * Math.cos(deg * Math.PI / 180),
                                    C[1] + R * Math.sin(deg * Math.PI / 180)];
            const line = (a, b) => {
                const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
                for (let i = 0; i < n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
            };
            const arc = (C, from, to) => {
                const n = Math.max(1, Math.round(Math.abs(to - from) * Math.PI / 180 * R / step));
                for (let i = 0; i < n; i++) pts.push(at(C, from + (to - from) * i / n));
            };
            const T1 = at(C1, 225), T2 = at(C1, 135), T3 = at(C2, 315), T4 = at(C2, 45);
            line(T4, T1);
            arc(C1, 225, 495);
            line(T2, T3);
            arc(C2, 315, 45);
            return { pts, closed: true, start: { x: T4[0], y: T4[1], heading: -Math.PI / 4 },
                     tangents: { T1, T2, T3, T4 }, centre: [cx, cy] };
        },
    };

    // --------------------------------------------------------------- world

    class World {
        constructor(opts = {}) {
            this.width = opts.width || 900;
            this.height = opts.height || 560;
            this.lines = opts.lines || [];          // [{pts, width, closed}]
            this.blackRects = opts.blackRects || [];
            this.obstacles = opts.obstacles || [];  // {x,y,w,h} or {x,y,r}
            this.walls = opts.walls || null;        // rect the robot is kept inside
            this.table = opts.table || null;        // rect, outside = drop
            this.decor = opts.decor || [];          // cosmetic rects {x,y,w,h,fill}
            this._index();
        }

        _index() {
            this.cell = 40;
            this.grid = new Map();
            for (const line of this.lines) {
                const n = line.pts.length, segs = line.closed ? n : n - 1;
                for (let i = 0; i < segs; i++) {
                    const a = line.pts[i], b = line.pts[(i + 1) % n];
                    const seg = [a[0], a[1], b[0], b[1], line.width / 2];
                    const x0 = Math.floor((Math.min(a[0], b[0]) - line.width) / this.cell);
                    const x1 = Math.floor((Math.max(a[0], b[0]) + line.width) / this.cell);
                    const y0 = Math.floor((Math.min(a[1], b[1]) - line.width) / this.cell);
                    const y1 = Math.floor((Math.max(a[1], b[1]) + line.width) / this.cell);
                    for (let gx = x0; gx <= x1; gx++) {
                        for (let gy = y0; gy <= y1; gy++) {
                            const key = gx + ',' + gy;
                            if (!this.grid.has(key)) this.grid.set(key, []);
                            this.grid.get(key).push(seg);
                        }
                    }
                }
            }
        }

        distanceToLine(x, y) {
            const segs = this.grid.get(Math.floor(x / this.cell) + ',' + Math.floor(y / this.cell));
            let best = Infinity;
            if (segs) {
                for (const s of segs) best = Math.min(best, distToSegment(x, y, s[0], s[1], s[2], s[3]) - s[4]);
            }
            return best;
        }

        isBlack(x, y) {
            if (this.distanceToLine(x, y) <= 0) return true;
            return this.blackRects.some(r => pointInRect(x, y, r));
        }

        onTable(x, y) {
            return !this.table || pointInRect(x, y, this.table);
        }

        // Distance along a ray to the nearest obstacle or wall
        ray(ox, oy, angle, maxRange) {
            const dx = Math.cos(angle), dy = Math.sin(angle);
            let best = Infinity;
            for (const o of this.obstacles) {
                best = Math.min(best, o.r !== undefined ? rayCircle(ox, oy, dx, dy, o) : rayRect(ox, oy, dx, dy, o));
            }
            if (this.walls) best = Math.min(best, rayInsideRect(ox, oy, dx, dy, this.walls));
            return best <= maxRange ? best : Infinity;
        }

        collides(x, y, radius) {
            for (const o of this.obstacles) {
                if (o.r !== undefined) {
                    if (Math.hypot(x - o.x, y - o.y) < radius + o.r) return true;
                } else {
                    const cx = Math.max(o.x, Math.min(x, o.x + o.w));
                    const cy = Math.max(o.y, Math.min(y, o.y + o.h));
                    if (Math.hypot(x - cx, y - cy) < radius) return true;
                }
            }
            if (this.walls) {
                const w = this.walls;
                if (x - radius < w.x || x + radius > w.x + w.w || y - radius < w.y || y + radius > w.y + w.h) return true;
            }
            return false;
        }

        obstacleAt(x, y) {
            for (let i = this.obstacles.length - 1; i >= 0; i--) {
                const o = this.obstacles[i];
                if (o.r !== undefined ? Math.hypot(x - o.x, y - o.y) <= o.r : pointInRect(x, y, o)) return o;
            }
            return null;
        }
    }
    K.World = World;

    // --------------------------------------------------------------- robot

    class Robot {
        constructor(opts = {}) {
            this.x = opts.x || 100;
            this.y = opts.y || 100;
            this.heading = opts.heading || 0;
            this.length = opts.length || 60;
            this.width = opts.width || 46;
            this.wheelBase = opts.wheelBase || 44;
            this.maxSpeed = opts.maxSpeed || 90;    // px/s at full duty
            this.tau = opts.tau || 0.04;            // motor time constant (s)
            this.sensors = opts.sensors || [];
            this.style = opts.style || {};
            this.radius = opts.radius || 26;
            this.target = { left: 0, right: 0 };
            this.wheel = { left: 0, right: 0 };
            this.readings = {};
            this.buzzer = false;
            this.trail = [];
            this.home = { x: this.x, y: this.y, heading: this.heading };
            this.odometer = 0;
        }

        reset(pose = this.home) {
            Object.assign(this, { x: pose.x, y: pose.y, heading: pose.heading });
            this.target = { left: 0, right: 0 };
            this.wheel = { left: 0, right: 0 };
            this.buzzer = false;
            this.trail = [];
            this.odometer = 0;
            this.fallen = false;
        }

        setWheels(left, right) {
            this.target.left = left;
            this.target.right = right;
        }

        toWorld(dx, dy) {
            const c = Math.cos(this.heading), s = Math.sin(this.heading);
            return [this.x + dx * c - dy * s, this.y + dx * s + dy * c];
        }

        step(dt, world) {
            const k = 1 - Math.exp(-dt / this.tau);
            this.wheel.left += (this.target.left - this.wheel.left) * k;
            this.wheel.right += (this.target.right - this.wheel.right) * k;

            const vl = this.wheel.left * this.maxSpeed, vr = this.wheel.right * this.maxSpeed;
            const v = (vl + vr) / 2;
            this.heading += (vl - vr) / this.wheelBase * dt;
            const nx = this.x + Math.cos(this.heading) * v * dt;
            const ny = this.y + Math.sin(this.heading) * v * dt;
            if (!world || !world.collides(nx, ny, this.radius)) {
                this.odometer += Math.hypot(nx - this.x, ny - this.y);
                this.x = nx;
                this.y = ny;
            }
            const last = this.trail[this.trail.length - 1];
            if (!last || Math.hypot(last[0] - this.x, last[1] - this.y) > 4) {
                this.trail.push([this.x, this.y]);
                if (this.trail.length > 400) this.trail.shift();
            }
            if (world && world.table && !world.onTable(this.x, this.y)) this.fallen = true;
        }

        // Updates this.readings: line -> 1 on black, prox/edge -> 1 when triggered,
        // sonar -> distance in px (Infinity when nothing in range)
        sense(world) {
            for (const s of this.sensors) {
                const [sx, sy] = this.toWorld(s.dx, s.dy);
                s.wx = sx; s.wy = sy;
                if (s.type === 'line') {
                    this.readings[s.name] = world.isBlack(sx, sy) ? 1 : 0;
                } else if (s.type === 'edge') {
                    this.readings[s.name] = world.onTable(sx, sy) ? 0 : 1;
                } else {
                    const a = this.heading + (s.angle || 0);
                    const spread = s.spread || 0;
                    let d = Infinity;
                    for (const off of spread ? [-spread, 0, spread] : [0]) d = Math.min(d, world.ray(sx, sy, a + off, s.range));
                    s.hit = d;
                    this.readings[s.name] = s.type === 'sonar' ? d : (d < Infinity ? 1 : 0);
                }
            }
            return this.readings;
        }
    }
    K.Robot = Robot;

    // Level 1 kit: PB3/PB2 = left motor fwd/rev, PB1/PB0 = right motor fwd/rev
    K.decodePortB = function (portb, mirrored = false) {
        const b = i => (portb >> i) & 1;
        let left = b(3) - b(2), right = b(1) - b(0);
        if (mirrored) [left, right] = [b(1) - b(0), b(3) - b(2)];
        return { left, right, buzzer: !!b(4) };
    };

    K.MOTOR = { STOP: 0, FORWARD: 0b1010, BACKWARD: 0b0101, LEFT: 0b0110, RIGHT: 0b1001, BUZZER: 0b10000 };

    K.describeMotion = function (left, right) {
        const sgn = v => (v > 0.05 ? 1 : v < -0.05 ? -1 : 0);
        const key = sgn(left) + ',' + sgn(right);
        return ({
            '0,0': 'Stopped', '1,1': 'Forward', '-1,-1': 'Backward',
            '-1,1': 'Spin left', '1,-1': 'Spin right',
            '0,1': 'Pivot left', '1,0': 'Pivot right', '0,-1': 'Pivot back right', '-1,0': 'Pivot back left',
        })[key] || 'Moving';
    };

    // ------------------------------------------------------------ firmware

    class Firmware {
        constructor(program, io) {
            this.io = io;
            this.it = program(io);
            this.wakeAt = 0;
            this.done = false;
        }

        // Runs the program until it waits past simulated time `t` (ms)
        step(t) {
            let guard = 0;
            while (!this.done && t >= this.wakeAt) {
                const r = this.it.next();
                if (r.done) { this.done = true; break; }
                this.wakeAt += Math.max(0, r.value === undefined ? 1 : r.value);
                if (this.wakeAt < t - 50) this.wakeAt = t;      // don't build up debt
                if (++guard > 10000) { this.wakeAt = t + 1; break; }
            }
        }
    }
    K.Firmware = Firmware;

    // Byte FIFO with a fixed depth; extra bytes are dropped (receiver overrun)
    class Uart {
        constructor(depth = 2) { this.depth = depth; this.q = []; this.dropped = 0; this.log = []; }
        send(ch) {
            this.log.push(ch);
            if (this.log.length > 60) this.log.shift();
            if (this.q.length >= this.depth) { this.dropped++; return; }
            this.q.push(ch);
        }
        available() { return this.q.length; }
        read() { return this.q.length ? this.q.shift() : -1; }
        clear() { this.q = []; }
    }
    K.Uart = Uart;

    // ------------------------------------------------------ drawing (DOM)

    K.drawWorld = function (ctx, world, opts = {}) {
        ctx.save();
        ctx.fillStyle = world.table ? '#3b3f46' : '#fbfbf8';
        ctx.fillRect(0, 0, world.width, world.height);

        if (world.table) {
            const t = world.table;
            ctx.fillStyle = '#c99a62';
            ctx.fillRect(t.x, t.y, t.w, t.h);
            ctx.strokeStyle = '#8a5f30';
            ctx.lineWidth = 3;
            ctx.strokeRect(t.x, t.y, t.w, t.h);
            ctx.strokeStyle = 'rgba(120,80,40,0.25)';
            ctx.lineWidth = 1;
            for (let y = t.y + 14; y < t.y + t.h; y += 22) {
                ctx.beginPath(); ctx.moveTo(t.x, y); ctx.lineTo(t.x + t.w, y + 4); ctx.stroke();
            }
        } else {
            ctx.strokeStyle = 'rgba(0,0,0,0.045)';
            ctx.lineWidth = 1;
            for (let x = 0; x < world.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, world.height); ctx.stroke(); }
            for (let y = 0; y < world.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(world.width, y); ctx.stroke(); }
        }

        for (const d of world.decor) {
            ctx.fillStyle = d.fill;
            ctx.fillRect(d.x, d.y, d.w, d.h);
            if (d.label) {
                ctx.fillStyle = d.labelColor || '#555';
                ctx.font = '12px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(d.label, d.x + d.w / 2, d.y + d.h / 2 + 4);
            }
        }

        ctx.strokeStyle = '#111';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const line of world.lines) {
            ctx.lineWidth = line.width;
            ctx.beginPath();
            line.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
            if (line.closed) ctx.closePath();
            ctx.stroke();
        }
        ctx.fillStyle = '#111';
        for (const r of world.blackRects) ctx.fillRect(r.x, r.y, r.w, r.h);

        if (world.walls) {
            ctx.strokeStyle = '#7b8794';
            ctx.lineWidth = 6;
            const w = world.walls;
            ctx.strokeRect(w.x - 3, w.y - 3, w.w + 6, w.h + 6);
        }

        for (const o of world.obstacles) {
            ctx.fillStyle = o.fill || '#e8833a';
            ctx.strokeStyle = '#a4521b';
            ctx.lineWidth = 2;
            if (o.r !== undefined) {
                ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            } else {
                ctx.fillRect(o.x, o.y, o.w, o.h);
                ctx.strokeRect(o.x, o.y, o.w, o.h);
                if (!o.wall) {
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w, o.y + o.h);
                    ctx.moveTo(o.x + o.w, o.y); ctx.lineTo(o.x, o.y + o.h); ctx.stroke();
                }
            }
        }
        ctx.restore();
    };

    K.drawRobot = function (ctx, robot, opts = {}) {
        const st = robot.style;
        ctx.save();

        if (opts.trail !== false && robot.trail.length > 1) {
            ctx.strokeStyle = st.trail || 'rgba(37,99,235,0.35)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            robot.trail.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Sensor beams
        for (const s of robot.sensors) {
            if (s.type !== 'prox' && s.type !== 'sonar') continue;
            const a = robot.heading + (s.angle || 0);
            const len = Math.min(s.hit === undefined ? s.range : s.hit, s.range);
            const hit = s.hit !== undefined && s.hit < Infinity;
            ctx.strokeStyle = hit ? 'rgba(220,38,38,0.55)' : 'rgba(34,197,94,0.35)';
            ctx.fillStyle = hit ? 'rgba(220,38,38,0.10)' : 'rgba(34,197,94,0.07)';
            const spread = s.spread || 0.12;
            ctx.beginPath();
            ctx.moveTo(s.wx, s.wy);
            ctx.arc(s.wx, s.wy, len, a - spread, a + spread);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        ctx.translate(robot.x, robot.y);
        ctx.rotate(robot.heading);

        if (robot.buzzer) {
            ctx.strokeStyle = 'rgba(234,179,8,0.8)';
            ctx.lineWidth = 3;
            for (const r of [34, 42]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
        }

        const L = robot.length, W = robot.width;
        // wheels
        ctx.fillStyle = '#222';
        ctx.fillRect(-12, -W / 2 - 6, 24, 8);
        ctx.fillRect(-12, W / 2 - 2, 24, 8);
        // chassis
        ctx.fillStyle = st.body || '#1f7a4d';
        ctx.strokeStyle = '#0d3b24';
        ctx.lineWidth = 2;
        roundRect(ctx, -L / 2, -W / 2, L, W, 7);
        ctx.fill();
        ctx.stroke();
        // MCU chip
        ctx.fillStyle = '#111';
        ctx.fillRect(-14, -7, 22, 14);
        ctx.fillStyle = '#9ca3af';
        for (let i = 0; i < 5; i++) { ctx.fillRect(-12 + i * 4, -9, 2, 2); ctx.fillRect(-12 + i * 4, 7, 2, 2); }
        // heading arrow
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.moveTo(L / 2 - 4, 0); ctx.lineTo(L / 2 - 14, -6); ctx.lineTo(L / 2 - 14, 6); ctx.closePath(); ctx.fill();

        for (const s of robot.sensors) {
            const v = robot.readings[s.name];
            const on = s.type === 'sonar' ? v < Infinity : !!v;
            if (s.type === 'sonar') {
                ctx.fillStyle = '#94a3b8';
                ctx.strokeStyle = '#334155';
                for (const off of [-7, 7]) { ctx.beginPath(); ctx.arc(s.dx, s.dy + off, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
                continue;
            }
            ctx.fillStyle = on ? (s.onColor || '#ef4444') : (s.offColor || '#e5e7eb');
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(s.dx, s.dy, s.type === 'line' || s.type === 'edge' ? 4.5 : 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }

        ctx.rotate(-robot.heading);
        if (opts.handle) {
            const [hx, hy] = [Math.cos(robot.heading) * 46, Math.sin(robot.heading) * 46];
            ctx.fillStyle = 'rgba(37,99,235,0.85)';
            ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    };

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    K.roundRect = roundRect;

    // ---------------------------------------------------------- UI widgets

    const el = (tag, cls, html) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    };
    K.el = el;

    // 8-bit register view. labels: {bit: 'text'}
    K.registerView = function (container, name, labels = {}, note = '') {
        const box = el('div', 'reg');
        box.append(el('div', 'reg-head', `<span class="reg-name">${name}</span><code class="reg-val">0b00000000</code>`));
        const bits = el('div', 'reg-bits');
        const cells = [];
        for (let i = 7; i >= 0; i--) {
            const c = el('div', 'bit' + (labels[i] ? ' used' : ''), `<span class="bit-num">${i}</span><span class="bit-v">0</span>`);
            if (labels[i]) c.title = labels[i];
            bits.append(c);
            cells[i] = c;
        }
        box.append(bits);
        const legend = el('div', 'reg-legend');
        for (let i = 7; i >= 0; i--) if (labels[i]) legend.append(el('span', '', `<b>${i}</b> ${labels[i]}`));
        box.append(legend);
        if (note) box.append(el('div', 'reg-note', note));
        container.append(box);
        let last = -1;
        return {
            update(v) {
                if (v === last) return;
                last = v;
                box.querySelector('.reg-val').textContent = '0b' + (v & 0xff).toString(2).padStart(8, '0');
                for (let i = 0; i < 8; i++) {
                    const on = (v >> i) & 1;
                    cells[i].classList.toggle('on', !!on);
                    cells[i].querySelector('.bit-v').textContent = on;
                }
            },
        };
    };

    // Rows: [{id, when, meaning, action}] - the firmware's switch/if cases
    K.decisionTable = function (container, title, rows, source) {
        const box = el('div', 'logic');
        box.append(el('div', 'logic-head', `<span>${title}</span>` + (source ? `<a href="${source}" target="_blank" rel="noopener">view source</a>` : '')));
        const table = el('table', 'logic-table');
        table.innerHTML = '<thead><tr><th>Input</th><th>Meaning</th><th>Action</th></tr></thead>';
        const tbody = el('tbody');
        const map = {};
        for (const r of rows) {
            const tr = el('tr', '', `<td><code>${r.when}</code></td><td>${r.meaning}</td><td>${r.action}</td>`);
            tbody.append(tr);
            map[r.id] = tr;
        }
        table.append(tbody);
        box.append(table);
        const none = el('div', 'logic-none', 'No case matches: outputs keep their last value.');
        box.append(none);
        container.append(box);
        let current;
        return {
            highlight(id) {
                if (id === current) return;
                if (current && map[current]) map[current].classList.remove('active');
                current = id;
                if (id && map[id]) map[id].classList.add('active');
                none.classList.toggle('show', id === null);
            },
        };
    };

    // 16x2 character LCD with the LiquidCrystal API used by the sketches
    K.lcd = function (container) {
        const box = el('div', 'lcd');
        const rows = [el('div', 'lcd-row'), el('div', 'lcd-row')];
        box.append(...rows);
        container.append(box);
        const buf = [Array(16).fill(' '), Array(16).fill(' ')];
        let cx = 0, cy = 0;
        const render = () => rows.forEach((r, i) => (r.textContent = buf[i].join('')));
        const api = {
            clear() { buf.forEach(b => b.fill(' ')); cx = cy = 0; render(); },
            setCursor(x, y) { cx = x; cy = y; },
            print(v) {
                for (const ch of String(v)) {
                    if (cx < 16) buf[cy][cx] = ch;
                    cx++;
                }
                render();
            },
            show(line1, line2 = '') { api.clear(); api.print(line1); api.setCursor(0, 1); api.print(line2); },
        };
        render();
        return api;
    };

    // Rolling oscilloscope. channels: [{name, color}]
    K.scope = function (canvas, channels, windowMs = 400) {
        const ctx = canvas.getContext('2d');
        const data = channels.map(() => []);
        return {
            push(t, values) {
                values.forEach((v, i) => {
                    data[i].push([t, v]);
                    while (data[i].length && data[i][0][0] < t - windowMs) data[i].shift();
                });
            },
            clear() { data.forEach(d => (d.length = 0)); },
            draw(t) {
                const W = canvas.width, H = canvas.height;
                ctx.fillStyle = '#0b1220';
                ctx.fillRect(0, 0, W, H);
                ctx.strokeStyle = 'rgba(148,163,184,0.15)';
                ctx.lineWidth = 1;
                for (let x = 0; x < W; x += W / 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
                const lane = H / channels.length;
                channels.forEach((ch, i) => {
                    const top = i * lane + 16, bottom = (i + 1) * lane - 8;
                    ctx.fillStyle = ch.color;
                    ctx.font = '11px ui-monospace, monospace';
                    ctx.fillText(ch.name, 6, i * lane + 12);
                    ctx.strokeStyle = ch.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    let prev = null;
                    for (const [pt, v] of data[i]) {
                        const x = W - (t - pt) / windowMs * W;
                        const y = v ? top : bottom;
                        if (prev === null) ctx.moveTo(x, y);
                        else { ctx.lineTo(x, prev); ctx.lineTo(x, y); }
                        prev = y;
                    }
                    if (prev !== null) ctx.lineTo(W, prev);
                    ctx.stroke();
                });
            },
        };
    };

    // Simple beeper shared by all demos (off until the user enables sound)
    K.beeper = (function () {
        let ctx = null, osc = null, gain = null, enabled = false;
        return {
            set enabled(v) {
                enabled = v;
                if (v && !ctx) {
                    const AC = root.AudioContext || root.webkitAudioContext;
                    if (!AC) return;
                    ctx = new AC();
                    osc = ctx.createOscillator();
                    gain = ctx.createGain();
                    osc.frequency.value = 2400;
                    osc.type = 'square';
                    gain.gain.value = 0;
                    osc.connect(gain).connect(ctx.destination);
                    osc.start();
                }
                if (!v && gain) gain.gain.value = 0;
            },
            get enabled() { return enabled; },
            set(on) { if (gain) gain.gain.value = enabled && on ? 0.03 : 0; },
        };
    })();

    // Main loop: steps physics + firmware in 1 ms ticks, then draws a frame.
    // opts: {canvas, world, robot, tick(t), draw(ctx), onFrame(t), dragRobot, onPointer}
    K.Sim = class {
        constructor(opts) {
            Object.assign(this, opts);
            this.ctx = this.canvas.getContext('2d');
            this.t = 0;
            this.speed = 1;
            this.running = true;
            this.drag = null;
            this._last = null;
            this._bindPointer();
            const frame = now => {
                if (this._last === null) this._last = now;
                const dt = Math.min(50, now - this._last);
                this._last = now;
                if (this.running) {
                    const ticks = Math.round(dt * this.speed);
                    for (let i = 0; i < ticks; i++) {
                        this.t += 1;
                        this.tick(this.t);
                    }
                }
                this.render();
                requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        }

        render() {
            const ctx = this.ctx;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            const scale = this.canvas.width / this.world.width;
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            K.drawWorld(ctx, this.world);
            if (this.draw) this.draw(ctx);
            if (this.robot) K.drawRobot(ctx, this.robot, { handle: this.dragRobot !== false });
            if (this.overlay) this.overlay(ctx);
            if (this.onFrame) this.onFrame(this.t);
        }

        toWorld(ev) {
            const r = this.canvas.getBoundingClientRect();
            return [(ev.clientX - r.left) / r.width * this.world.width, (ev.clientY - r.top) / r.height * this.world.height];
        }

        _bindPointer() {
            const c = this.canvas;
            c.addEventListener('pointerdown', ev => {
                const [x, y] = this.toWorld(ev);
                const rb = this.robot;
                if (rb && this.dragRobot !== false) {
                    const hx = rb.x + Math.cos(rb.heading) * 46, hy = rb.y + Math.sin(rb.heading) * 46;
                    if (Math.hypot(x - hx, y - hy) < 12) { this.drag = { kind: 'rotate' }; }
                    else if (Math.hypot(x - rb.x, y - rb.y) < 32) { this.drag = { kind: 'move', ox: x - rb.x, oy: y - rb.y }; }
                }
                if (!this.drag && this.onPointer) this.drag = this.onPointer('down', x, y, ev) || null;
                if (this.drag) { c.setPointerCapture(ev.pointerId); ev.preventDefault(); }
            });
            c.addEventListener('pointermove', ev => {
                if (!this.drag) return;
                const [x, y] = this.toWorld(ev);
                const rb = this.robot;
                if (this.drag.kind === 'move') {
                    rb.x = x - this.drag.ox; rb.y = y - this.drag.oy; rb.trail = []; rb.fallen = false;
                } else if (this.drag.kind === 'rotate') {
                    rb.heading = Math.atan2(y - rb.y, x - rb.x); rb.trail = [];
                } else if (this.drag.move) {
                    this.drag.move(x, y);
                }
            });
            const end = () => { if (this.drag && this.drag.end) this.drag.end(); this.drag = null; };
            c.addEventListener('pointerup', end);
            c.addEventListener('pointercancel', end);
        }
    };

    // Standard toolbar: play/pause, reset, speed, sound
    K.toolbar = function (container, sim, opts = {}) {
        const bar = container.classList.contains('toolbar') ? container : el('div', 'toolbar');
        const play = el('button', 'btn primary', 'Pause');
        play.onclick = () => { sim.running = !sim.running; play.textContent = sim.running ? 'Pause' : 'Play'; };
        const reset = el('button', 'btn', 'Reset');
        reset.onclick = () => opts.onReset && opts.onReset();
        const speed = el('label', 'speed', 'Speed <select><option>0.25</option><option>0.5</option><option selected>1</option><option>2</option><option>4</option></select>×');
        speed.querySelector('select').onchange = e => (sim.speed = parseFloat(e.target.value));
        bar.append(play, reset, speed);
        if (opts.sound !== false) {
            const snd = el('label', 'check', '<input type="checkbox"> Sound');
            snd.querySelector('input').onchange = e => (K.beeper.enabled = e.target.checked);
            bar.append(snd);
        }
        if (opts.extra) opts.extra.forEach(x => bar.append(x));
        if (bar !== container) container.append(bar);
        return { bar, play };
    };

    // Pointer handler: click empty floor to add a block, drag a block to move
    // it, click a block without dragging to remove it. Walls are left alone.
    K.obstacleEditor = function (world, opts = {}) {
        const size = opts.size || 40;
        return (type, x, y) => {
            if (opts.enabled && !opts.enabled()) return null;
            const o = world.obstacleAt(x, y);
            if (o && o.wall) return null;
            if (!o) {
                const box = { x: x - size / 2, y: y - size / 2, w: size, h: size };
                world.obstacles.push(box);
                return { move: () => {}, end: () => {} };
            }
            const ox = x - o.x, oy = y - o.y;
            let moved = false;
            return {
                move(nx, ny) { moved = true; o.x = nx - ox; o.y = ny - oy; },
                end() { if (!moved) world.obstacles.splice(world.obstacles.indexOf(o), 1); },
            };
        };
    };

    K.PORTB_LABELS = { 0: 'PB0 right motor rev', 1: 'PB1 right motor fwd', 2: 'PB2 left motor rev', 3: 'PB3 left motor fwd', 4: 'PB4 buzzer' };

    // URL of a repository file relative to the demos folder
    K.source = path => '../' + path.split('/').map(encodeURIComponent).join('/');

    K.motorView = function (container) {
        const box = el('div', 'motors');
        box.innerHTML = `
            <div class="motor"><span>Left wheel</span><div class="mbar"><i></i></div></div>
            <div class="motor"><span>Right wheel</span><div class="mbar"><i></i></div></div>
            <div class="motion"><b class="motion-text">Stopped</b><span class="buzz">BUZZER</span></div>`;
        container.append(box);
        const bars = box.querySelectorAll('.mbar i');
        return {
            update(robot) {
                [robot.wheel.left, robot.wheel.right].forEach((v, i) => {
                    const pct = Math.min(1, Math.abs(v)) * 50;
                    bars[i].style.width = pct + '%';
                    bars[i].style.left = v >= 0 ? '50%' : 50 - pct + '%';
                    bars[i].className = v >= 0 ? 'fwd' : 'rev';
                });
                box.querySelector('.motion-text').textContent = K.describeMotion(robot.target.left, robot.target.right);
                box.querySelector('.buzz').classList.toggle('on', !!robot.buzzer);
            },
        };
    };

    root.Kaizen = K;
    if (typeof module !== 'undefined' && module.exports) module.exports = K;
})(typeof window !== 'undefined' ? window : globalThis);
