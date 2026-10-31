/*
 * Project : Line Follower Robot
 * Level   : Kaizen Robotics Program - Level 1
 * Board   : ATmega16 @ 1 MHz, Embedded C (WinAVR, register level)
 *
 * Follows a black line using two IR sensors that straddle it. Each sensor
 * reads 0 over the white surface and 1 over the black line. When both
 * sensors see black the robot is on a crossroad: it beeps and drives
 * straight across.
 *
 * Wiring:
 *   PD0        <- right IR sensor  (internal pull-up enabled)
 *   PD1        <- left IR sensor   (internal pull-up enabled)
 *   PB0..PB3   -> L293D motor driver inputs
 *   PB4        -> buzzer
 */

#include <avr/io.h>
#include <util/delay.h>

#define MOTOR_FORWARD   0b00001010
#define MOTOR_LEFT      0b00000110  // Spin left on the spot
#define MOTOR_RIGHT     0b00001001  // Spin right on the spot
#define BUZZER          0b00010000

// PIND patterns (unused pins PD2..PD7 are pulled up and read as 1)
#define LINE_CENTRED    0b11111100  // Both sensors on white
#define LINE_UNDER_LEFT 0b11111110  // Left sensor on the line
#define LINE_UNDER_RIGHT 0b11111101 // Right sensor on the line
#define CROSSROAD       0b11111111  // Both sensors on the line

int main(void)
{
    DDRD  = 0b00000000;             // Port D is an input port
    PORTD = 0b11111111;             // Enable pull-ups on Port D
    DDRB  = 0b11111111;             // Port B is an output port

    while (1)
    {
        switch (PIND)
        {
            case LINE_CENTRED:
                PORTB = MOTOR_FORWARD;
                break;

            case LINE_UNDER_LEFT:
                PORTB = MOTOR_LEFT;
                break;

            case LINE_UNDER_RIGHT:
                PORTB = MOTOR_RIGHT;
                break;

            case CROSSROAD:
                PORTB = MOTOR_FORWARD | BUZZER;     // Beep and cross over
                _delay_ms(200);
                break;
        }
    }
}
