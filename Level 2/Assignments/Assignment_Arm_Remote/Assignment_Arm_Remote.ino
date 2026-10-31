/*
 * Project : Pick and Place Remote (accelerometer + arm switches)
 * Level   : Kaizen Robotics Program - Level 2 (assignment)
 * Board   : ATmega16 (Arduino core)
 *
 * Gesture remote for the pick and place robot. The accelerometer steers
 * the chassis and two DPDT switches move the two arm motors. Each loop
 * transmits at most one drive command and one command per arm motor:
 *
 *   Drive : 's' stop   'f' forward   'R' reverse   'l' left   'r' right
 *   Arm 1 : 'z' forward   'y' reverse
 *   Arm 2 : 'x' forward   'w' reverse
 *
 * Wiring:
 *   A0     <- accelerometer X axis
 *   A1     <- accelerometer Y axis
 *   D2, D3 <- arm 1 DPDT switch
 *   D0, D1 <- arm 2 DPDT switch
 *   TX     -> wireless transmitter module (9600 baud)
 */

const int X_PIN = A0;
const int Y_PIN = A1;

const int ARM1_A = 2;
const int ARM1_B = 3;
const int ARM2_A = 0;
const int ARM2_B = 1;

void print_calibration()
{
    Serial.print(analogRead(X_PIN));
    Serial.print('\t');
    Serial.println(analogRead(Y_PIN));
}

// Returns `forward`/`reverse` for a DPDT switch position, or 0 when centred
char switch_command(int pin_a, int pin_b, char forward, char reverse)
{
    int a = digitalRead(pin_a);
    int b = digitalRead(pin_b);

    if (a == 1 && b == 0) return forward;
    if (a == 0 && b == 1) return reverse;
    return 0;
}

void send(char command)
{
    if (command)
    {
        Serial.println(command);
    }
}

void setup()
{
    Serial.begin(9600);
    print_calibration();

    pinMode(ARM1_A, INPUT);
    pinMode(ARM1_B, INPUT);
    pinMode(ARM2_A, INPUT);
    pinMode(ARM2_B, INPUT);
}

void loop()
{
    int x = analogRead(X_PIN);
    int y = analogRead(Y_PIN);
    char drive = 0;

    if (x >= 366 && x <= 426 && y >= 376 && y <= 436) drive = 's';     // Level
    if (y >= 380 && y <= 388)                         drive = 'f';     // Tilt forward
    if (y >= 415 && y <= 475)                         drive = 'R';     // Tilt back
    if (x >= 398 && x <= 458)                         drive = 'l';     // Tilt left
    if (x >= 305 && x <= 365)                         drive = 'r';     // Tilt right

    send(drive);
    send(switch_command(ARM1_A, ARM1_B, 'z', 'y'));
    send(switch_command(ARM2_A, ARM2_B, 'x', 'w'));
}
