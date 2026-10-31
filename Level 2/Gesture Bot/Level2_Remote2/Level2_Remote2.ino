/*
 * Project : Gesture Remote (accelerometer transmitter)
 * Level   : Kaizen Robotics Program - Level 2
 * Board   : ATmega16 (Arduino core)
 *
 * Hand-worn MEMS accelerometer remote for the gesture controlled robot.
 * Transmits one drive command per loop over the wireless serial link:
 *
 *   's' stop   'f' forward   'o' reverse   'l' left   'r' right
 *
 * The tilt windows overlap; when several match, the later check wins,
 * exactly as the receiver would see when the characters arrive in order.
 * The resting X/Y values are printed once at start-up for calibration.
 *
 * Wiring:
 *   A0 <- accelerometer X axis
 *   A1 <- accelerometer Y axis
 *   TX -> wireless transmitter module (9600 baud)
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

    if (x >= 365 && x <= 465 && y >= 350 && y <= 450) command = 's';   // Level
    if (y >= 415 && y <= 515)                         command = 'f';   // Tilt forward
    if (y >= 300 && y <= 400)                         command = 'o';   // Tilt back
    if (x >= 415 && x <= 515)                         command = 'r';   // Tilt right
    if (x >= 300 && x <= 400)                         command = 'l';   // Tilt left

    if (command)
    {
        Serial.print(command);
    }
}
