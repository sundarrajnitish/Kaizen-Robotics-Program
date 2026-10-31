/*
 * Project : Tachometer
 * Level   : Kaizen Robotics Program - Level 2 (assignment)
 * Board   : ATmega16 (Arduino core)
 *
 * Measures the speed of a rotating shaft with an IR sensor and shows it on
 * a 16x2 LCD. Press the start button, then pulses are counted for a fixed
 * busy-wait window and converted to RPM.
 *
 *   RPM = pulses * 12 / 3   (window length and markers per revolution
 *                            calibrated during the session)
 *
 * Based on the Circuit Digest tachometer example.
 *
 * Wiring:
 *   D18             <- IR sensor output (1 when a marker passes)
 *   D10             <- start push button to GND (internal pull-up)
 *   D3,D2,D4..D7    -> LCD RS, EN, D4..D7
 */

#include <LiquidCrystal.h>

LiquidCrystal lcd(3, 2, 4, 5, 6, 7);

const int SENSOR_PIN = 18;
const int START_PIN  = 10;

// Counts sensor pulses during a fixed busy-wait measurement window
unsigned int count_pulses()
{
    unsigned int count = 0;

    for (int i = 0; i < 1000; i++)
    {
        for (int j = 0; j < 1227; j++)
        {
            if (digitalRead(SENSOR_PIN))
            {
                count++;
                while (digitalRead(SENSOR_PIN))
                {
                    // Wait for the marker to pass
                }
            }
        }
    }
    return count;
}

void setup()
{
    pinMode(SENSOR_PIN, INPUT);
    pinMode(START_PIN, INPUT);
    digitalWrite(START_PIN, HIGH);  // Enable the pull-up on the button
    pinMode(13, OUTPUT);

    lcd.begin(16, 2);
    lcd.print("Tachometer");
    lcd.setCursor(0, 1);
    lcd.print("Circuit Digest");
    delay(2000);
}

void loop()
{
    lcd.clear();
    lcd.print("  Please Press  ");
    lcd.setCursor(0, 1);
    lcd.print("Button to Start ");
    while (digitalRead(START_PIN))
    {
        // Wait for the button to be pressed
    }

    lcd.clear();
    lcd.print("Reading RPM.....");
    unsigned int pulses = count_pulses();

    lcd.clear();
    lcd.print("Please Wait.....");
    unsigned int rpm = (pulses * 12) / 3;
    delay(2000);

    lcd.clear();
    lcd.print("RPM=");
    lcd.print(rpm);
    delay(5000);
}
