# Kaizen-Robotics-Program
This repository contains all the code for the robotics projects I underwent during my time at the Training Program.

## The Program
Kaizen Robotics Program is a certificate training program aimed at providing students a steep learning curve in the field of Robotics & Embedded Systems. The program comprises 40 hours of Intensive Training. 
Location - IIT Madras Research Park, Chennai, India

### Kaizen Robotics Program: Level - 1 [Link](https://www.eventshigh.com/detail/chennai/5d49814f9d1a70b862053ed0d8182bcc-kaizen-robotics-program-level-1)
- ADC Based Speed Control (Register Level Programming)
- Line Following Robot (Register Level Programming)
- Obstacle Avoiding Robot (Register Level Programming)
- Pulse Width Modulation (Register Level Programming)
- Table Top Robot (Register Level Programming)
- Serial Communication (Register Level Programming)
- Simple HandWriting Robot (Arduino) [Link](https://github.com/NithishSundarraj/Handwriting-Machine/)

### Kaizen Robotics Program: Level - 2 [Link](https://www.eventshigh.com/detail/chennai/35c36b3a32cf6d100297c4521d9a6f50-kaizen-robotics-program-level-2)

- Manually Controlled Robot (Arduino)
- MEMS Accelerometer based Gesture Controlled Robot (Arduino)
- Gesture Controlled Pick and Place Robot (Arduino)
- Wireless Communication (Arduino)
- Computer Controlled Robot (Arduino)
- Serial Communication (Arduino)
- Maze Solving Robot (Arduino)
- Maze Solver With Shortest Path Algorithm (Arduino) [Link](https://github.com/NithishSundarraj/Maze-Solving-Robot-with-Shortest-Path-Algorithm)

## Live Demos
Open [`demos/index.html`](demos/index.html) in any web browser. Nothing to install, and it works offline.

Every robot runs in a small simulator driven by a JavaScript port of its firmware. Each port has one case per branch of the real C / Arduino code. While the robot moves, the page shows the input pins (`PIND`), the output pins (`PORTB`), the motors and the firmware case that is currently active.

| Demo | Firmware it runs |
|------|------------------|
| [PWM & ADC Speed Control](demos/pwm-adc.html) | `PWM.c`, `SpeedCntrl.c` |
| [Line Following Robots](demos/line-follower.html) | `LFR.c`, `OARLFR.c`, `ALFR.c`, `ALFR(Arduino).ino` |
| [Obstacle Avoider](demos/obstacle-avoider.html) | `OAR.c` |
| [Table Top Robot](demos/table-top.html) | `TTR.c` |
| [Serial & Bluetooth Control](demos/serial-control.html) | `TTL.c`, `WC.c`, `Speed_Control_Assignment.ino`, `Computer_Controlled.ino` |
| [Gesture & Wireless Remotes](demos/gesture.html) | `Level2_Remote.ino`, `Level2_Remote2.ino`, `Assignment_Arm_Remote.ino`, `Assignment_DPDT_Wireless.ino`, `Assignment_Gesture2.ino` |
| [Maze Solver](demos/maze.html) | `maze_solver.ino`, `ShortestPathAlgorithm.ino`, `Maze_bot_return_final.ino` |
| [Tachometer](demos/tachometer.html) | `Tachometer_Assignment.ino` |

To check that the simulations still behave like the robots, run `node demos/tests/run-tests.js` (needs Node.js).

## Building the Code
- **Level 1** (Embedded C, ATmega16 @ 1 MHz): run `make` in a project folder with WinAVR or avr-gcc + avr-libc, then flash the `.hex` file. The committed `.hex` files were rebuilt from the current sources.
- **Level 2** (Arduino): open the `.ino` in the Arduino IDE with an ATmega16 board core installed (for example MightyCore). The LCD sketches use the built-in `LiquidCrystal` library.

## Code Conventions
All sources follow the same layout:
- A header comment with the project, level, board, a short description and the wiring.
- Named constants instead of magic numbers: motor patterns (`MOTOR_FORWARD = 0b00001010`), sensor patterns, timings and pins.
- One `switch` or `if` chain per decision, with one comment per case.
- 4-space indentation, braces on their own line, `snake_case` function names.
