/*
 * Project : Obstacle Avoiding Line Follower (OAR + LFR)
 * Level   : Kaizen Robotics Program - Level 1
 * Board   : ATmega16 @ 1 MHz, Embedded C (WinAVR, register level)
 *
 * Line follower with a front proximity sensor. It follows the black line
 * with two IR sensors, beeps while crossing junctions, and stops whenever
 * something blocks the path. It drives on once the obstacle is removed.
 *
 *   Line sensors     : 0 over white, 1 over the black line
 *   Obstacle sensor  : 0 when an obstacle is in front, 1 when clear
 *
 * Wiring:
 *   PD0        <- left line sensor   (internal pull-up enabled)
 *   PD1        <- obstacle sensor    (internal pull-up enabled)
 *   PD2        <- right line sensor  (internal pull-up enabled)
 *   PB0..PB3   -> L293D motor driver inputs
 *   PB4        -> buzzer
 */

#include <avr/io.h>

#define MOTOR_STOP      0b00000000
#define MOTOR_FORWARD   0b00001010
#define MOTOR_LEFT      0b00000110  // Spin left on the spot
#define MOTOR_RIGHT     0b00001001  // Spin right on the spot
#define BUZZER          0b00010000

// PIND patterns (bit 0 = left line, bit 1 = obstacle, bit 2 = right line)
#define LINE_CENTRED            0b11111010
#define LINE_UNDER_LEFT         0b11111011
#define LINE_UNDER_RIGHT        0b11111110
#define JUNCTION                0b11111111
#define BLOCKED_CENTRED         0b11111000
#define BLOCKED_UNDER_LEFT      0b11111001
#define BLOCKED_UNDER_RIGHT     0b11111100
#define BLOCKED_JUNCTION        0b11111101

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

            case JUNCTION:
                PORTB = MOTOR_FORWARD | BUZZER;     // Beep and cross over
                break;

            case BLOCKED_CENTRED:
            case BLOCKED_UNDER_LEFT:
            case BLOCKED_UNDER_RIGHT:
            case BLOCKED_JUNCTION:
                PORTB = MOTOR_STOP;                 // Wait for a clear path
                break;
        }
    }
}
