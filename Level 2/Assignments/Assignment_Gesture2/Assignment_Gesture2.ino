/*
 * Project : Gesture Controlled Pick and Place Robot (receiver)
 * Level   : Kaizen Robotics Program - Level 2 (assignment)
 * Board   : ATmega16 (Arduino core)
 *
 * Receives single-character commands from the gesture remote and drives
 * the chassis and the two arm motors. Every received character is echoed
 * back on the serial port for debugging.
 *
 *   Drive : 's' stop   'f' forward   'R' reverse   'l' left   'r' right
 *   Arm 1 : 'z' forward   'y' reverse
 *   Arm 2 : 'x' forward   'w' reverse
 *
 * Wiring:
 *   RX       <- wireless receiver module (9600 baud)
 *   D24, D25 -> left motor driver inputs
 *   D0, D1   -> right motor driver inputs
 *   D13, D14 -> arm motor 1 driver inputs
 *   D15, D16 -> arm motor 2 driver inputs
 */

const int LM1 = 24;
const int LM2 = 25;
const int RM1 = 0;
const int RM2 = 1;

const int ARM1_A = 13;
const int ARM1_B = 14;
const int ARM2_A = 15;
const int ARM2_B = 16;

void drive(int lm1, int lm2, int rm1, int rm2)
{
    digitalWrite(LM1, lm1);
    digitalWrite(LM2, lm2);
    digitalWrite(RM1, rm1);
    digitalWrite(RM2, rm2);
}

void forward()     { drive(1, 0, 1, 0); }
void reverse()     { drive(0, 1, 0, 1); }
void turn_left()   { drive(0, 1, 1, 0); }
void turn_right()  { drive(1, 0, 0, 1); }
void stop_motors() { drive(0, 0, 0, 0); }

void arm(int pin_a, int pin_b, int a, int b)
{
    digitalWrite(pin_a, a);
    digitalWrite(pin_b, b);
}

void setup()
{
    Serial.begin(9600);

    pinMode(LM1, OUTPUT);
    pinMode(LM2, OUTPUT);
    pinMode(RM1, OUTPUT);
    pinMode(RM2, OUTPUT);
    pinMode(ARM1_A, OUTPUT);
    pinMode(ARM1_B, OUTPUT);
    pinMode(ARM2_A, OUTPUT);
    pinMode(ARM2_B, OUTPUT);
}

void loop()
{
    while (!Serial.available())
    {
        // Wait for the next command
    }

    char command = Serial.read();
    Serial.println(command);

    switch (command)
    {
        case 'f': forward();                       break;
        case 's': stop_motors();                   break;
        case 'R': reverse();                       break;
        case 'l': turn_left();                     break;
        case 'r': turn_right();                    break;
        case 'z': arm(ARM1_A, ARM1_B, 1, 0);       break;
        case 'y': arm(ARM1_A, ARM1_B, 0, 1);       break;
        case 'x': arm(ARM2_A, ARM2_B, 1, 0);       break;
        case 'w': arm(ARM2_A, ARM2_B, 0, 1);       break;
    }
}
