/*
 * Project : Maze Solving Robot (left hand rule)
 * Level   : Kaizen Robotics Program - Level 2
 * Board   : ATmega16 (Arduino core)
 *
 * Explores a black-line maze with the left hand rule and records every
 * decision it makes at a junction. When it reaches the black end box it
 * stops and shows the recorded path on the LCD.
 *
 * Five IR sensors in a row read 0 over the black line and 1 over white.
 * They are packed into one 5-bit pattern, left sensor first:
 *
 *   L C1 C2 C3 R      e.g. 0b11011 = only the centre sensor sees the line
 *
 * Path letters: 'L' left, 'S' straight, 'U' U-turn, 'E' end marker.
 * Forced turns (corners with only one way on) are not recorded.
 *
 * Wiring:
 *   D26..D30 <- line sensors L, C1, C2, C3, R
 *   D24, D25 -> right motor driver inputs
 *   D0, D1   -> left motor driver inputs
 *   D2..D7   -> LCD RS, EN, D4..D7
 */

#include <LiquidCrystal.h>

LiquidCrystal lcd(2, 3, 4, 5, 6, 7);

const int RM1 = 24;
const int RM2 = 25;
const int LM1 = 0;
const int LM2 = 1;
const int SENSOR_PINS[5] = {26, 27, 28, 29, 30};   // L, C1, C2, C3, R

const int TURN_MS     = 1500;
const int STRAIGHT_MS = 100;
const int UTURN_MS    = 1000;
const int INCH_MS     = 500;
const int ALIGN_MS    = 60;

const int MAX_PATH = 30;
char path[MAX_PATH];
int path_length = 0;

// Last sensor reading, one variable per sensor
int l, c1, c2, c3, r;

// ---------------------------------------------------------------- motors

void drive(int lm1, int lm2, int rm1, int rm2)
{
    digitalWrite(LM1, lm1);
    digitalWrite(LM2, lm2);
    digitalWrite(RM1, rm1);
    digitalWrite(RM2, rm2);
}

void stop_motors() { drive(0, 0, 0, 0); }
void forward()     { drive(1, 0, 1, 0); }
void small_right() { drive(1, 0, 0, 0); }  // Pivot on the right wheel
void small_left()  { drive(0, 0, 1, 0); }  // Pivot on the left wheel
void turn_right()  { drive(1, 0, 0, 1); }  // Spin on the spot
void turn_left()   { drive(0, 1, 1, 0); }  // Spin on the spot

// --------------------------------------------------------------- sensors

int sensor_pattern()
{
    return (l << 4) | (c1 << 3) | (c2 << 2) | (c3 << 1) | r;
}

// Reads all five sensors, shows them on the LCD and returns the pattern
int read_sensors()
{
    l  = digitalRead(SENSOR_PINS[0]);
    c1 = digitalRead(SENSOR_PINS[1]);
    c2 = digitalRead(SENSOR_PINS[2]);
    c3 = digitalRead(SENSOR_PINS[3]);
    r  = digitalRead(SENSOR_PINS[4]);

    int values[5] = {l, c1, c2, c3, r};
    for (int i = 0; i < 5; i++)
    {
        lcd.print(values[i]);
        lcd.print(" ");
    }
    return sensor_pattern();
}

// True when the line continues straight ahead (1 or 2 centre sensors on it)
bool line_ahead()
{
    read_sensors();
    int on_white = c1 + c2 + c3;
    return on_white == 1 || on_white == 2;
}

// True when both outer sensors are on white and the line continues ahead
bool straight_exit()
{
    return l == 1 && r == 1 && line_ahead();
}

// Moves forward past the junction so the sensors can see what lies beyond
void inch()
{
    lcd.print("inch function");
    stop_motors();
    delay(100);
    forward();
    delay(INCH_MS);
    stop_motors();
    delay(100);
    read_sensors();
    lcd.clear();
}

// Short nudge forward so all junction sensors are over the crossing line
void align()
{
    stop_motors();
    delay(500);
    forward();
    delay(ALIGN_MS);
    stop_motors();
    delay(100);
    lcd.clear();
    read_sensors();
}

// ------------------------------------------------------------------ path

void record(char turn)
{
    if (path_length < MAX_PATH - 1)
    {
        path[path_length++] = turn;
    }
}

void print_path(const char *p)
{
    lcd.clear();
    for (int i = 0; p[i] != 'E'; i++)
    {
        lcd.print(p[i]);
    }
    delay(2000);
}

// ------------------------------------------------------------ main logic

void setup()
{
    lcd.begin(16, 2);
    lcd.print("MSR with LHR");
    delay(500);
    lcd.clear();

    pinMode(LM1, OUTPUT);
    pinMode(LM2, OUTPUT);
    pinMode(RM1, OUTPUT);
    pinMode(RM2, OUTPUT);
    for (int i = 0; i < 5; i++)
    {
        pinMode(SENSOR_PINS[i], INPUT);
    }
}

void loop()
{
    lcd.clear();
    int sensors = read_sensors();
    lcd.clear();

    if (sensors == 0b11011)                                 // On the line
    {
        lcd.print("FORWARD");
        forward();
    }
    else if (sensors == 0b10011 || sensors == 0b10111)      // Drifted right
    {
        lcd.print("LEFT");
        small_left();
    }
    else if (sensors == 0b11101 || sensors == 0b11001)      // Drifted left
    {
        lcd.print("RIGHT");
        small_right();
    }
    else if (sensors == 0b11111)                            // Dead end
    {
        lcd.print("U TURN");
        turn_left();
        delay(UTURN_MS);
        record('U');
    }
    else if ((l == 0 && c1 == 0) || (c3 == 0 && r == 0))    // Junction
    {
        align();
        sensors = sensor_pattern();

        if (sensors == 0b11000 || sensors == 0b10000)       // Right branch
        {
            lcd.print("RT/Strt n rt?");
            inch();
            if (sensor_pattern() == 0b11111)                // Right only
            {
                lcd.print("right");
                turn_right();
                delay(TURN_MS);
            }
            else if (straight_exit())                       // Straight + right
            {
                lcd.print("STRAIGHT");
                record('S');
                forward();
                delay(STRAIGHT_MS);
            }
        }
        else if (sensors == 0b00011 || sensors == 0b00001)  // Left branch
        {
            lcd.print("Lft/str n lft?");
            inch();
            if (sensor_pattern() == 0b11111)                // Left only
            {
                lcd.print("LEFT");
                turn_left();
                delay(TURN_MS);
            }
            else if (straight_exit())                       // Straight + left
            {
                lcd.print("LEFT");
                record('L');
                turn_left();
                delay(TURN_MS);
            }
        }
        else if (sensors == 0b00000)                        // Cross line
        {
            lcd.print("T/END/4");
            inch();
            if (straight_exit())                            // 4-way crossing
            {
                lcd.print("4 WAY");
                record('L');
                turn_left();
                delay(TURN_MS);
            }
            else if (sensor_pattern() == 0b11111)           // T junction
            {
                lcd.print("T-int");
                record('L');
                turn_left();
                delay(TURN_MS);
            }
            else if (sensor_pattern() == 0b00000)           // End box
            {
                lcd.print("END OF MAZE");
                path[path_length] = 'E';
                print_path(path);
                while (true)
                {
                    stop_motors();
                }
            }
        }
    }
}
