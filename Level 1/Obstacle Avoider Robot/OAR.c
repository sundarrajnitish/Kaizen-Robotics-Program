/*
 * Project : Obstacle Avoider Robot
 * Level   : Kaizen Robotics Program - Level 1
 * Board   : ATmega16 @ 1 MHz, Embedded C (WinAVR, register level)
 *
 * Drives forward until one of three front IR proximity sensors detects an
 * obstacle, then steers or backs away from it. The sensors pull their
 * output low when something is in front of them.
 *
 * Wiring:
 *   PD0        <- right IR proximity sensor   (internal pull-up enabled)
 *   PD1        <- centre IR proximity sensor  (internal pull-up enabled)
 *   PD2        <- left IR proximity sensor    (internal pull-up enabled)
 *   PD3        <- auxiliary sensor input      (internal pull-up enabled)
 *   PB0..PB3   -> L293D motor driver inputs
 */

#include <avr/io.h>
#include <util/delay.h>

#define MOTOR_FORWARD   0b00001010
#define MOTOR_BACKWARD  0b00000101
#define MOTOR_LEFT      0b00000110  // Spin left on the spot
#define MOTOR_RIGHT     0b00001001  // Spin right on the spot

#define BACK_OFF_MS     300         // Reverse time before turning away
#define TURN_MS         300         // Turn time after reversing
#define ESCAPE_TURN_MS  2000        // Turn time when boxed in on all sides

// PIND patterns: a 0 bit means that sensor sees an obstacle
#define CLEAR               0b11111111
#define OBSTACLE_RIGHT      0b11111110
#define OBSTACLE_CENTRE     0b11111101
#define OBSTACLE_CENTRE_RIGHT 0b11111100
#define OBSTACLE_LEFT       0b11111011
#define OBSTACLE_LEFT_RIGHT 0b11111010
#define OBSTACLE_LEFT_CENTRE 0b11111001
#define OBSTACLE_ALL        0b11111000
#define OBSTACLE_CENTRE_AUX 0b11110101

// Reverse away from the obstacle, then turn for TURN_MS
static void back_off_and_turn(uint8_t turn)
{
    PORTB = MOTOR_BACKWARD;
    _delay_ms(BACK_OFF_MS);
    PORTB = turn;
    _delay_ms(TURN_MS);
}

int main(void)
{
    DDRD  = 0b00000000;             // Port D is an input port
    PORTD = 0b11111111;             // Enable pull-ups on Port D
    DDRB  = 0b11111111;             // Port B is an output port

    while (1)
    {
        switch (PIND)
        {
            case CLEAR:
                PORTB = MOTOR_FORWARD;
                break;

            case OBSTACLE_RIGHT:
                PORTB = MOTOR_LEFT;
                break;

            case OBSTACLE_LEFT:
                PORTB = MOTOR_RIGHT;
                break;

            case OBSTACLE_CENTRE:
            case OBSTACLE_CENTRE_RIGHT:
            case OBSTACLE_LEFT_RIGHT:
                back_off_and_turn(MOTOR_LEFT);
                break;

            case OBSTACLE_LEFT_CENTRE:
            case OBSTACLE_CENTRE_AUX:
                back_off_and_turn(MOTOR_RIGHT);
                break;

            case OBSTACLE_ALL:
                PORTB = MOTOR_RIGHT;        // Boxed in: turn until clear
                _delay_ms(ESCAPE_TURN_MS);
                break;
        }
    }
}
