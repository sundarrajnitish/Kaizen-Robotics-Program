/*
 * Project : Potentiometer Speed Control
 * Level   : Kaizen Robotics Program - Level 2 (assignment)
 * Board   : ATmega16 (Arduino core)
 *
 * Drives both motors forward continuously. The speed is set in hardware
 * by a potentiometer wired to the motor driver enable pins.
 *
 * Wiring:
 *   D24, D25 -> left motor driver inputs
 *   D0, D1   -> right motor driver inputs
 */

const int LM1 = 24;
const int LM2 = 25;
const int RM1 = 0;
const int RM2 = 1;

void drive(int lm1, int lm2, int rm1, int rm2)
{
    digitalWrite(LM1, lm1);
    digitalWrite(LM2, lm2);
    digitalWrite(RM1, rm1);
    digitalWrite(RM2, rm2);
}

void forward() { drive(1, 0, 1, 0); }

void setup()
{
    Serial.begin(9600);

    pinMode(LM1, OUTPUT);
    pinMode(LM2, OUTPUT);
    pinMode(RM1, OUTPUT);
    pinMode(RM2, OUTPUT);
}

void loop()
{
    forward();
}
