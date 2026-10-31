/*
 * Project : Advanced Line Following Robot (Arduino port)
 * Level   : Kaizen Robotics Program - Level 1
 * Board   : ATmega16 (Arduino core)
 *
 * Arduino version of ALFR.c. Follows a black line with two IR sensors,
 * beeps on junctions, stops and sounds the buzzer when an obstacle is in
 * front, and drives slower while a cave wall is detected.
 *
 *   Line sensors      : 0 over white, 1 over the black line
 *   Proximity sensors : 0 when an object is detected
 *
 * Wiring:
 *   D0, D1   -> right motor driver inputs
 *   D2, D3   -> left motor driver inputs
 *   D4, D5   -> left / right motor enable pins (PWM)
 *   D6       -> buzzer
 *   D15      <- left line sensor
 *   D16      <- right line sensor
 *   D17      <- front obstacle sensor
 *   D14      <- cave wall sensor
 */

const int RM1  = 0;
const int RM2  = 1;
const int LM1  = 2;
const int LM2  = 3;
const int LMEN = 4;
const int RMEN = 5;

const int BUZZER         = 6;
const int LEFT_SENSOR    = 15;
const int RIGHT_SENSOR   = 16;
const int OBSTACLE_SENSOR = 17;
const int CAVE_SENSOR    = 14;

const int FULL_SPEED = 255;
const int CAVE_SPEED = 200;

int speed = FULL_SPEED;

void drive(int lm1, int lm2, int rm1, int rm2)
{
    digitalWrite(LM1, lm1);
    digitalWrite(LM2, lm2);
    digitalWrite(RM1, rm1);
    digitalWrite(RM2, rm2);
    analogWrite(LMEN, speed);
    analogWrite(RMEN, speed);
}

void forward()     { drive(1, 0, 1, 0); }
void turn_right()  { drive(1, 0, 0, 1); }
void turn_left()   { drive(0, 1, 1, 0); }
void stop_motors() { drive(0, 0, 0, 0); }

void buzzer(bool on)
{
    digitalWrite(BUZZER, on);
}

void set_speed()
{
    speed = digitalRead(CAVE_SENSOR) == 1 ? FULL_SPEED : CAVE_SPEED;
}

void line_follow()
{
    if (digitalRead(OBSTACLE_SENSOR) == 0)      // Obstacle in front
    {
        stop_motors();
        buzzer(true);
        return;
    }

    int left  = digitalRead(LEFT_SENSOR);
    int right = digitalRead(RIGHT_SENSOR);

    if (left == 0 && right == 0)                // Line centred
    {
        forward();
        buzzer(false);
    }
    else if (left == 1 && right == 0)           // Line under left sensor
    {
        turn_left();
        buzzer(false);
    }
    else if (left == 0 && right == 1)           // Line under right sensor
    {
        turn_right();
        buzzer(false);
    }
    else                                        // Junction: beep and cross
    {
        forward();
        buzzer(true);
    }
}

void setup()
{
    pinMode(LM1, OUTPUT);
    pinMode(LM2, OUTPUT);
    pinMode(RM1, OUTPUT);
    pinMode(RM2, OUTPUT);
    pinMode(LMEN, OUTPUT);
    pinMode(RMEN, OUTPUT);
    pinMode(BUZZER, OUTPUT);

    pinMode(LEFT_SENSOR, INPUT);
    pinMode(RIGHT_SENSOR, INPUT);
    pinMode(OBSTACLE_SENSOR, INPUT);
    pinMode(CAVE_SENSOR, INPUT);
}

void loop()
{
    set_speed();
    line_follow();
}
