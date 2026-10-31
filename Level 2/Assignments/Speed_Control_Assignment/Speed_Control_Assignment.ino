/*
 * Project : Two-Speed Serial Control
 * Level   : Kaizen Robotics Program - Level 2 (assignment)
 * Board   : ATmega16 (Arduino core)
 *
 * Drives the robot from a serial terminal with WASD keys. Upper-case keys
 * move at full speed, lower-case keys at a reduced PWM speed.
 *
 *   'W'/'w' forward   'S'/'s' reverse   'A'/'a' left   'D'/'d' right
 *   'x'     stop
 *
 * Wiring:
 *   RX       <- USB-TTL dongle / wireless receiver (9600 baud)
 *   D24, D25 -> left motor driver inputs
 *   D0, D1   -> right motor driver inputs
 *   D12, D13 -> motor driver enable pins (PWM)
 */

const int LM1 = 24;
const int LM2 = 25;
const int RM1 = 0;
const int RM2 = 1;
const int ENA = 12;
const int ENB = 13;

const int FAST = 255;
const int SLOW = 100;

void drive(int lm1, int lm2, int rm1, int rm2, int speed)
{
    digitalWrite(LM1, lm1);
    digitalWrite(LM2, lm2);
    digitalWrite(RM1, rm1);
    digitalWrite(RM2, rm2);
    analogWrite(ENA, speed);
    analogWrite(ENB, speed);
}

void forward(int speed)    { drive(1, 0, 1, 0, speed); }
void reverse(int speed)    { drive(0, 1, 0, 1, speed); }
void turn_left(int speed)  { drive(0, 1, 1, 0, speed); }
void turn_right(int speed) { drive(1, 0, 0, 1, speed); }
void stop_motors()         { drive(0, 0, 0, 0, FAST); }

void setup()
{
    Serial.begin(9600);

    pinMode(LM1, OUTPUT);
    pinMode(LM2, OUTPUT);
    pinMode(RM1, OUTPUT);
    pinMode(RM2, OUTPUT);
    pinMode(ENA, OUTPUT);
    pinMode(ENB, OUTPUT);
}

void loop()
{
    switch (Serial.read())          // -1 when nothing has been received
    {
        case 'W': forward(FAST);    break;
        case 'w': forward(SLOW);    break;
        case 'S': reverse(FAST);    break;
        case 's': reverse(SLOW);    break;
        case 'A': turn_left(FAST);  break;
        case 'a': turn_left(SLOW);  break;
        case 'D': turn_right(FAST); break;
        case 'd': turn_right(SLOW); break;
        case 'x': stop_motors();    break;
    }
}
