/*
 * Project : Computer Controlled Robot with Arm
 * Level   : Kaizen Robotics Program - Level 2
 * Board   : ATmega16 (Arduino core)
 *
 * Drives the robot and its two-axis arm from a PC serial terminal. The
 * last received key is shown on a 16x2 LCD; while no data arrives the
 * robot stays stopped and the LCD shows "Start".
 *
 *   Drive : 'w' forward   's' reverse   'a' left   'd' right   'x' stop
 *   Arm   : 'i' elbow up  'k' elbow down
 *           'j' wrist up  'l' wrist down
 *
 * Wiring:
 *   RX       <- USB-TTL dongle (9600 baud)
 *   D24, D25 -> left motor driver inputs
 *   D0, D1   -> right motor driver inputs
 *   D13, D14 -> elbow motor driver inputs
 *   D15, D16 -> wrist motor driver inputs
 *   D2..D7   -> LCD RS, EN, D4..D7
 */

#include <LiquidCrystal.h>

LiquidCrystal lcd(2, 3, 4, 5, 6, 7);

const int LM1 = 24;
const int LM2 = 25;
const int RM1 = 0;
const int RM2 = 1;

const int ELBOW_A = 13;
const int ELBOW_B = 14;
const int WRIST_A = 15;
const int WRIST_B = 16;

void drive(int lm1, int lm2, int rm1, int rm2)
{
    digitalWrite(LM1, lm1);
    digitalWrite(LM2, lm2);
    digitalWrite(RM1, rm1);
    digitalWrite(RM2, rm2);
}

void forward()    { drive(1, 0, 1, 0); }
void reverse()    { drive(0, 1, 0, 1); }
void turn_left()  { drive(0, 1, 1, 0); }
void turn_right() { drive(1, 0, 0, 1); }

void joint(int pin_a, int pin_b, int a, int b)
{
    digitalWrite(pin_a, a);
    digitalWrite(pin_b, b);
}

void stop_all()
{
    drive(0, 0, 0, 0);
    joint(ELBOW_A, ELBOW_B, 0, 0);
    joint(WRIST_A, WRIST_B, 0, 0);
}

void setup()
{
    Serial.begin(9600);

    pinMode(LM1, OUTPUT);
    pinMode(LM2, OUTPUT);
    pinMode(RM1, OUTPUT);
    pinMode(RM2, OUTPUT);
    pinMode(ELBOW_A, OUTPUT);
    pinMode(ELBOW_B, OUTPUT);
    pinMode(WRIST_A, OUTPUT);
    pinMode(WRIST_B, OUTPUT);

    lcd.begin(16, 2);
    lcd.print("Initialising");
    delay(1000);
}

void loop()
{
    lcd.clear();
    while (!Serial.available())
    {
        lcd.clear();
        lcd.print("Start");
        delay(50);
        stop_all();
    }

    char command = Serial.read();
    Serial.println(command);
    lcd.print(command);

    switch (command)
    {
        case 'w': forward();                          break;
        case 's': reverse();                          break;
        case 'a': turn_left();                        break;
        case 'd': turn_right();                       break;
        case 'x': stop_all();                         break;
        case 'i': joint(ELBOW_A, ELBOW_B, 1, 0);      break;
        case 'k': joint(ELBOW_A, ELBOW_B, 0, 1);      break;
        case 'j': joint(WRIST_A, WRIST_B, 1, 0);      break;
        case 'l': joint(WRIST_A, WRIST_B, 0, 1);      break;
    }
}
