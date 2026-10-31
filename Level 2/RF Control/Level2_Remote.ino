/*
 * Project : RF Remote (accelerometer transmitter)
 * Level   : Kaizen Robotics Program - Level 2
 * Board   : ATmega16 (Arduino core)
 *
 * Reads the X/Y axes of a MEMS accelerometer and transmits one drive
 * command per loop over the RF serial link:
 *
 *   's' stop   'f' forward   'R' reverse   'l' left   'r' right
 *
 * The tilt windows overlap; when several match, the later check wins,
 * exactly as the receiver would see when the characters arrive in order.
 * The resting X/Y values are printed once at start-up for calibration.
 *
 * Wiring:
 *   A0 <- accelerometer X axis
 *   A1 <- accelerometer Y axis
 *   TX -> RF transmitter module (9600 baud)
 */

const int X_PIN = A0;
const int Y_PIN = A1;

void print_calibration()
{
    Serial.print(analogRead(X_PIN));
    Serial.print('\t');
    Serial.println(analogRead(Y_PIN));
}

void setup()
{
    Serial.begin(9600);
    print_calibration();
}

void loop()
{
    int x = analogRead(X_PIN);
    int y = analogRead(Y_PIN);
    char command = 0;

    if (x >= 366 && x <= 426 && y >= 376 && y <= 436) command = 's';   // Level
    if (y >= 380 && y <= 388)                         command = 'f';   // Tilt forward
    if (y >= 415 && y <= 475)                         command = 'R';   // Tilt back
    if (x >= 398 && x <= 458)                         command = 'l';   // Tilt left
    if (x >= 305 && x <= 365)                         command = 'r';   // Tilt right

    if (command)
    {
        Serial.print(command);
    }
}
