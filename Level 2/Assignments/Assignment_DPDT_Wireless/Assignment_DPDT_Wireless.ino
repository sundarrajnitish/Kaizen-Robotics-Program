/*
 * Project : Wireless DPDT Remote
 * Level   : Kaizen Robotics Program - Level 2 (assignment)
 * Board   : ATmega16 (Arduino core)
 *
 * Two DPDT switches act as a wired joystick; their positions are sent as
 * single characters over the wireless serial link:
 *
 *   'f' forward   'R' reverse   'l' left   'r' right   's' stop
 *
 * Wiring:
 *   D0, D1 <- drive switch (forward / reverse)
 *   D2, D3 <- steer switch (left / right)
 *   TX     -> wireless transmitter module (9600 baud)
 */

const int FORWARD_PIN = 0;
const int REVERSE_PIN = 1;
const int LEFT_PIN    = 2;
const int RIGHT_PIN   = 3;

void setup()
{
    Serial.begin(9600);

    pinMode(FORWARD_PIN, INPUT);
    pinMode(REVERSE_PIN, INPUT);
    pinMode(LEFT_PIN, INPUT);
    pinMode(RIGHT_PIN, INPUT);
}

void loop()
{
    int forward = digitalRead(FORWARD_PIN);
    int reverse = digitalRead(REVERSE_PIN);
    int left    = digitalRead(LEFT_PIN);
    int right   = digitalRead(RIGHT_PIN);

    if (forward == 1 && reverse == 0)
    {
        Serial.print('f');
    }
    else if (reverse == 1 && forward == 0)
    {
        Serial.print('R');
    }
    else if (left == 1 && right == 0)
    {
        Serial.print('l');
    }
    else if (right == 1 && left == 0)
    {
        Serial.print('r');
    }
    else
    {
        Serial.print('s');
    }
}
