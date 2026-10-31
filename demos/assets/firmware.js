/*
 * JavaScript ports of the robot firmware in this repository.
 *
 * Each port mirrors its C / Arduino source line for line, so the demo shows
 * what the real code does. Conventions:
 *   yield ms      -> _delay_ms(ms) / delay(ms)
 *   yield 1       -> one pass of the main loop (simulated as 1 ms)
 *   io.trace(id)  -> highlights the matching row of the decision table
 */
(function (root) {
    'use strict';

    const F = {};

    // Level 1 PORTB motor patterns (see the #defines in each .c file)
    const STOP = 0b00000000;
    const FORWARD = 0b00001010;
    const BACKWARD = 0b00000101;
    const LEFT = 0b00000110;
    const RIGHT = 0b00001001;
    const BUZZER = 0b00010000;

    // ------------------------------------------------------------ Level 1

    // Level 1/PWM/PWM.c
    F.PWM = function* (io) {
        while (true) {
            io.trace('short');
            io.PORTA(1); yield 50;
            io.PORTA(0); yield 50;
            io.trace('long');
            io.PORTA(1); yield 1000;
            io.PORTA(0); yield 1000;
        }
    };

    // Level 1/ADC Based Speed Control/SpeedCntrl.c
    F.SpeedCntrl = function* (io) {
        yield 500;
        while (true) {
            const reading = io.readADC();
            const tOff = Math.floor(reading / 40);
            const tOn = 25 - tOff;
            if (reading < 870) {
                io.trace('pwm');
                io.PORTB(FORWARD); yield tOn;
                io.PORTB(STOP); yield tOff;
            } else {
                io.trace('stop');
                io.PORTB(STOP);
            }
            yield 0.2;      // ADC conversion time
        }
    };

    // Level 1/Line Follower Robot/LFR.c
    F.LFR = function* (io) {
        while (true) {
            switch (io.PIND()) {
                case 0b11111100: io.trace('centred'); io.PORTB(FORWARD); break;
                case 0b11111110: io.trace('left'); io.PORTB(LEFT); break;
                case 0b11111101: io.trace('right'); io.PORTB(RIGHT); break;
                case 0b11111111: io.trace('cross'); io.PORTB(FORWARD | BUZZER); yield 200; break;
                default: io.trace(null);
            }
            yield 1;
        }
    };

    // Level 1/OAR + LFR/OARLFR.c
    F.OARLFR = function* (io) {
        while (true) {
            switch (io.PIND()) {
                case 0b11111010: io.trace('centred'); io.PORTB(FORWARD); break;
                case 0b11111011: io.trace('left'); io.PORTB(LEFT); break;
                case 0b11111110: io.trace('right'); io.PORTB(RIGHT); break;
                case 0b11111111: io.trace('cross'); io.PORTB(FORWARD | BUZZER); break;
                case 0b11111000:
                case 0b11111001:
                case 0b11111100:
                case 0b11111101: io.trace('blocked'); io.PORTB(STOP); break;
                default: io.trace(null);
            }
            yield 1;
        }
    };

    // Level 1/Line Follower Competition/.../ALFR.c
    F.ALFR = function* (io) {
        const NO_CHANGE = 0xff, NO_CAVE_WALL = 1 << 3;
        const lineDecision = sensors => {
            switch (sensors | NO_CAVE_WALL) {
                case 0b11111100: io.trace('centred'); return FORWARD;
                case 0b11111110: io.trace('left'); return LEFT;
                case 0b11111101: io.trace('right'); return RIGHT;
                case 0b11111111: io.trace('cross'); return FORWARD | BUZZER;
                case 0b11111000: io.trace('obstacle'); return BUZZER;
                default: io.trace(null); return NO_CHANGE;
            }
        };
        yield 500;
        while (true) {
            const sensors = io.PIND();
            const output = lineDecision(sensors);
            if (output !== NO_CHANGE) {
                if (!(sensors & NO_CAVE_WALL) && output !== BUZZER) {
                    io.cave(true);                      // cave_speed_cycle()
                    const reading = io.readADC();
                    const tOff = Math.floor(reading / 40);
                    const tOn = 25 - tOff;
                    io.PORTB(output);
                    if (reading <= 870) {
                        yield tOn;
                        io.PORTB(output & BUZZER);
                        yield tOff;
                    }
                } else {
                    io.cave(false);
                    io.PORTB(output);
                }
            }
            yield 1;
        }
    };

    // Level 1/Line Follower Competition/.../ALFR(Arduino).ino
    F.ALFRArduino = function* (io) {
        while (true) {
            const speed = io.digitalRead('cave') === 1 ? 255 : 200;     // set_speed()
            if (io.digitalRead('obstacle') === 0) {
                io.trace('obstacle'); io.drive(0, 0, 0, 0, speed); io.buzzer(true);
            } else {
                const left = io.digitalRead('left'), right = io.digitalRead('right');
                if (left === 0 && right === 0) { io.trace('centred'); io.drive(1, 0, 1, 0, speed); io.buzzer(false); }
                else if (left === 1 && right === 0) { io.trace('left'); io.drive(0, 1, 1, 0, speed); io.buzzer(false); }
                else if (left === 0 && right === 1) { io.trace('right'); io.drive(1, 0, 0, 1, speed); io.buzzer(false); }
                else { io.trace('cross'); io.drive(1, 0, 1, 0, speed); io.buzzer(true); }
            }
            yield 1;
        }
    };

    // Level 1/Obstacle Avoider Robot/OAR.c
    F.OAR = function* (io) {
        function* backOffAndTurn(turn) {
            io.PORTB(BACKWARD); yield 300;
            io.PORTB(turn); yield 300;
        }
        while (true) {
            switch (io.PIND()) {
                case 0b11111111: io.trace('clear'); io.PORTB(FORWARD); break;
                case 0b11111110: io.trace('right'); io.PORTB(LEFT); break;
                case 0b11111011: io.trace('left'); io.PORTB(RIGHT); break;
                case 0b11111101:
                case 0b11111100:
                case 0b11111010: io.trace('backLeft'); yield* backOffAndTurn(LEFT); break;
                case 0b11111001:
                case 0b11110101: io.trace('backRight'); yield* backOffAndTurn(RIGHT); break;
                case 0b11111000: io.trace('all'); io.PORTB(RIGHT); yield 2000; break;
                default: io.trace(null);
            }
            yield 1;
        }
    };

    // Level 1/Table Top Robot/TTR.c
    F.TTR = function* (io) {
        function* manoeuvre(first, firstMs, second, secondMs) {
            io.PORTB(first); yield firstMs;
            io.PORTB(second); yield secondMs;
        }
        while (true) {
            switch (io.PIND()) {
                case 0b11110000: io.trace('on'); io.PORTB(FORWARD); break;
                case 0b11111000: io.trace('s1'); yield* manoeuvre(BACKWARD, 400, RIGHT, 600); break;
                case 0b11110100: io.trace('s2'); yield* manoeuvre(BACKWARD, 400, LEFT, 300); break;
                case 0b11110010:
                case 0b11110001: io.trace('s34'); yield* manoeuvre(FORWARD, 200, RIGHT, 300); break;
                case 0b11111100: io.trace('s12'); yield* manoeuvre(BACKWARD, 250, RIGHT, 300); break;
                case 0b11110011: io.trace('rear'); io.PORTB(FORWARD); break;
                case 0b11111001:
                case 0b11110110:
                case 0b11111110:
                case 0b11110111: io.trace('spinL'); io.PORTB(LEFT); break;
                case 0b11111011:
                case 0b11111101: io.trace('spinR'); io.PORTB(RIGHT); break;
                default: io.trace(null);
            }
            yield 1;
        }
    };

    // Level 1/TTL Dongle (Communication)/TTL.c
    F.TTL = function* (io) {
        yield 50;
        while (true) {
            while (!io.uartAvailable()) yield 1;            // uart_receive()
            const c = io.uartRead();
            switch (c) {
                case 'F': io.trace('F'); io.PORTB(FORWARD); break;
                case 'B': io.trace('B'); io.PORTB(BACKWARD); break;
                case 'L': io.trace('L'); io.PORTB(LEFT); break;
                case 'R': io.trace('R'); io.PORTB(RIGHT); break;
                default: io.trace('other'); io.PORTB(STOP);
            }
            yield 2;                                        // 1 byte at 4800 baud
        }
    };

    // Level 1/Final Project/.../WC.c  (wheelchair, motors mirrored)
    F.WC = function* (io) {
        yield 50;
        while (true) {
            while (!io.uartAvailable()) yield 1;
            const c = io.uartRead();
            switch (c) {
                case 'F': io.trace('F'); io.PORTB(FORWARD); break;
                case 'B': io.trace('B'); io.PORTB(BACKWARD); break;
                case 'L': io.trace('L'); io.PORTB(0b00001001); break;
                case 'R': io.trace('R'); io.PORTB(0b00000110); break;
                default: io.trace('other'); io.PORTB(STOP);
            }
            const cm = io.sonarCm();                         // measure_distance_cm()
            yield 2 + (cm < 400 ? cm * 58 / 1000 : 38);      // echo time
            if (cm <= 40) {
                io.trace('obstacle');
                io.PORTB(STOP); yield 1000;
                io.PORTB(BACKWARD); yield 1000;
            }
        }
    };

    // ------------------------------------------------------------ Level 2

    // Level 2/RF Control/Level2_Remote.ino
    F.RFRemote = function* (io) {
        while (true) {
            const x = io.analogRead('x'), y = io.analogRead('y');
            let command = 0;
            if (x >= 366 && x <= 426 && y >= 376 && y <= 436) command = 's';
            if (y >= 380 && y <= 388) command = 'f';
            if (y >= 415 && y <= 475) command = 'R';
            if (x >= 398 && x <= 458) command = 'l';
            if (x >= 305 && x <= 365) command = 'r';
            if (command) io.print(command);
            yield 1;
        }
    };
    F.RFRemote.windows = [
        { c: 's', x: [366, 426], y: [376, 436] }, { c: 'f', y: [380, 388] },
        { c: 'R', y: [415, 475] }, { c: 'l', x: [398, 458] }, { c: 'r', x: [305, 365] },
    ];
    F.RFRemote.rest = { x: 396, y: 406 };

    // Level 2/Gesture Bot/Level2_Remote2/Level2_Remote2.ino
    F.GestureRemote = function* (io) {
        while (true) {
            const x = io.analogRead('x'), y = io.analogRead('y');
            let command = 0;
            if (x >= 365 && x <= 465 && y >= 350 && y <= 450) command = 's';
            if (y >= 415 && y <= 515) command = 'f';
            if (y >= 300 && y <= 400) command = 'o';
            if (x >= 415 && x <= 515) command = 'r';
            if (x >= 300 && x <= 400) command = 'l';
            if (command) io.print(command);
            yield 1;
        }
    };
    F.GestureRemote.windows = [
        { c: 's', x: [365, 465], y: [350, 450] }, { c: 'f', y: [415, 515] },
        { c: 'o', y: [300, 400] }, { c: 'r', x: [415, 515] }, { c: 'l', x: [300, 400] },
    ];
    F.GestureRemote.rest = { x: 415, y: 407 };

    // Level 2/Assignments/Assignment_Arm_Remote/Assignment_Arm_Remote.ino
    F.ArmRemote = function* (io) {
        const switchCommand = (name, fwd, rev) => {
            const v = io.switchPos(name);
            return v === 1 ? fwd : v === -1 ? rev : 0;
        };
        while (true) {
            const x = io.analogRead('x'), y = io.analogRead('y');
            let drive = 0;
            if (x >= 366 && x <= 426 && y >= 376 && y <= 436) drive = 's';
            if (y >= 380 && y <= 388) drive = 'f';
            if (y >= 415 && y <= 475) drive = 'R';
            if (x >= 398 && x <= 458) drive = 'l';
            if (x >= 305 && x <= 365) drive = 'r';
            for (const c of [drive, switchCommand('arm1', 'z', 'y'), switchCommand('arm2', 'x', 'w')]) {
                if (c) io.print(c);
            }
            yield 1;
        }
    };
    F.ArmRemote.windows = F.RFRemote.windows;
    F.ArmRemote.rest = F.RFRemote.rest;

    // Level 2/Assignments/Assignment_DPDT_Wireless/Assignment_DPDT_Wireless.ino
    F.DPDTRemote = function* (io) {
        while (true) {
            const drive = io.switchPos('drive'), steer = io.switchPos('steer');
            if (drive === 1) io.print('f');
            else if (drive === -1) io.print('R');
            else if (steer === -1) io.print('l');
            else if (steer === 1) io.print('r');
            else io.print('s');
            yield 1;
        }
    };

    // Level 2/Assignments/Assignment_Gesture2/Assignment_Gesture2.ino
    F.Gesture2 = function* (io) {
        while (true) {
            while (!io.available()) yield 1;
            const c = io.read();
            switch (c) {
                case 'f': io.trace('f'); io.drive(1, 0, 1, 0); break;
                case 's': io.trace('s'); io.drive(0, 0, 0, 0); break;
                case 'R': io.trace('R'); io.drive(0, 1, 0, 1); break;
                case 'l': io.trace('l'); io.drive(0, 1, 1, 0); break;
                case 'r': io.trace('r'); io.drive(1, 0, 0, 1); break;
                case 'z': io.trace('z'); io.joint('arm1', 1, 0); break;
                case 'y': io.trace('y'); io.joint('arm1', 0, 1); break;
                case 'x': io.trace('x'); io.joint('arm2', 1, 0); break;
                case 'w': io.trace('w'); io.joint('arm2', 0, 1); break;
                default: io.trace(null);
            }
            yield 1;
        }
    };

    // Receiver used with Level2_Remote2 (its own receiver is not in the repo):
    // same as Gesture2 but with 'o' meaning reverse
    F.GestureBotReceiver = function* (io) {
        while (true) {
            while (!io.available()) yield 1;
            switch (io.read()) {
                case 'f': io.trace('f'); io.drive(1, 0, 1, 0); break;
                case 's': io.trace('s'); io.drive(0, 0, 0, 0); break;
                case 'o': io.trace('o'); io.drive(0, 1, 0, 1); break;
                case 'l': io.trace('l'); io.drive(0, 1, 1, 0); break;
                case 'r': io.trace('r'); io.drive(1, 0, 0, 1); break;
                default: io.trace(null);
            }
            yield 1;
        }
    };

    // Level 2/Assignments/Speed_Control_Assignment/Speed_Control_Assignment.ino
    F.SpeedControl = function* (io) {
        while (true) {
            switch (io.read()) {
                case 'W': io.trace('W'); io.drive(1, 0, 1, 0, 255); break;
                case 'w': io.trace('w'); io.drive(1, 0, 1, 0, 100); break;
                case 'S': io.trace('S'); io.drive(0, 1, 0, 1, 255); break;
                case 's': io.trace('s'); io.drive(0, 1, 0, 1, 100); break;
                case 'A': io.trace('A'); io.drive(0, 1, 1, 0, 255); break;
                case 'a': io.trace('a'); io.drive(0, 1, 1, 0, 100); break;
                case 'D': io.trace('D'); io.drive(1, 0, 0, 1, 255); break;
                case 'd': io.trace('d'); io.drive(1, 0, 0, 1, 100); break;
                case 'x': io.trace('x'); io.drive(0, 0, 0, 0, 255); break;
            }
            yield 1;
        }
    };

    // Level 2/Computer_Controlled/Computer_Controlled.ino
    F.ComputerControlled = function* (io) {
        const stopAll = () => { io.drive(0, 0, 0, 0); io.joint('elbow', 0, 0); io.joint('wrist', 0, 0); };
        io.lcd.show('Initialising');
        yield 1000;
        while (true) {
            io.lcd.clear();
            while (!io.available()) {
                io.lcd.clear();
                io.lcd.print('Start');
                yield 50;
                stopAll();
                io.trace('idle');
            }
            const c = io.read();
            io.lcd.print(c);
            switch (c) {
                case 'w': io.trace('w'); io.drive(1, 0, 1, 0); break;
                case 's': io.trace('s'); io.drive(0, 1, 0, 1); break;
                case 'a': io.trace('a'); io.drive(0, 1, 1, 0); break;
                case 'd': io.trace('d'); io.drive(1, 0, 0, 1); break;
                case 'x': io.trace('x'); stopAll(); break;
                case 'i': io.trace('i'); io.joint('elbow', 1, 0); break;
                case 'k': io.trace('k'); io.joint('elbow', 0, 1); break;
                case 'j': io.trace('j'); io.joint('wrist', 1, 0); break;
                case 'l': io.trace('l'); io.joint('wrist', 0, 1); break;
            }
            yield 1;
        }
    };

    // Level 2/Assignments/Tachometer_Assignment/Tachometer_Assignment.ino
    // count_pulses() busy-waits 1000 x 1227 loop passes; RPM = pulses * 12 / 3
    // = pulses * 4, i.e. a 15 s window with one marker per revolution.
    F.TACHO_WINDOW_MS = 15000;
    F.Tachometer = function* (io) {
        io.lcd.show('Tachometer', 'Circuit Digest');
        yield 2000;
        while (true) {
            io.trace('prompt');
            io.lcd.show('  Please Press  ', 'Button to Start ');
            while (!io.startPressed()) yield 1;

            io.trace('count');
            io.lcd.show('Reading RPM.....');
            let pulses = 0, prev = io.revolutions();
            io.pulses = 0;
            for (let ms = 0; ms < F.TACHO_WINDOW_MS; ms++) {
                yield 1;
                const now = io.revolutions();
                pulses += Math.floor(now) - Math.floor(prev);   // one marker per turn
                prev = now;
                io.pulses = pulses;
                io.windowLeft = F.TACHO_WINDOW_MS - ms;
            }

            io.trace('wait');
            io.lcd.show('Please Wait.....');
            const rpm = Math.floor((pulses * 12) / 3);
            yield 2000;

            io.trace('show');
            io.lcd.show('RPM=' + rpm);
            io.lastRpm = rpm;
            yield 5000;
        }
    };

    // ------------------------------------------- maze path simplification

    // Same algorithm as simplify_path() in the maze sketches. Returns the
    // simplified path plus every reduction step for the demo to display.
    F.simplifyPath = function (path) {
        const angle = { S: 0, R: 90, U: 180, L: 270 };
        const turn = { 0: 'S', 90: 'R', 180: 'U', 270: 'L' };
        const out = [], steps = [];
        for (const t of path) {
            out.push(t);
            while (out.length >= 3 && out[out.length - 2] === 'U') {
                const [a, , b] = out.slice(-3);
                const r = turn[(angle[a] + 180 + angle[b]) % 360];
                steps.push({ from: a + 'U' + b, to: r, before: out.join('') });
                out.splice(-3, 3, r);
            }
        }
        return { path: out, steps };
    };

    // Same as reverse_path(): reverse the order and mirror L <-> R
    F.reversePath = function (path) {
        return path.slice().reverse().map(t => (t === 'L' ? 'R' : t === 'R' ? 'L' : t));
    };

    root.KaizenFirmware = F;
    if (typeof module !== 'undefined' && module.exports) module.exports = F;
})(typeof window !== 'undefined' ? window : globalThis);
