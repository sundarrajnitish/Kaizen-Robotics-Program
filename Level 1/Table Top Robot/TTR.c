/*
 * Project : Table Top Robot (edge avoider)
 * Level   : Kaizen Robotics Program - Level 1
 * Board   : ATmega16 @ 1 MHz, Embedded C (WinAVR, register level)
 *
 * Roams on a table top without falling off. Four downward-facing IR
 * sensors read 0 while they see the table and 1 once they pass the edge.
 * Depending on which sensors left the table, the robot reverses or moves
 * forward briefly and then turns back towards the table.
 *
 * Wiring:
 *   PD3        <- sensor 1   (internal pull-up enabled)
 *   PD2        <- sensor 2   (internal pull-up enabled)
 *   PD1        <- sensor 3   (internal pull-up enabled)
 *   PD0        <- sensor 4   (internal pull-up enabled)
 *   PB0..PB3   -> L293D motor driver inputs
 */

#include <avr/io.h>
#include <util/delay.h>

#define MOTOR_FORWARD   0b00001010
#define MOTOR_BACKWARD  0b00000101
#define MOTOR_LEFT      0b00000110  // Spin left on the spot
#define MOTOR_RIGHT     0b00001001  // Spin right on the spot

// PIND patterns: a 1 bit means that sensor is over the table edge
#define ON_TABLE        0b11110000
#define OFF_S1          0b11111000
#define OFF_S2          0b11110100
#define OFF_S3          0b11110010
#define OFF_S4          0b11110001
#define OFF_S1_S2       0b11111100
#define OFF_S1_S4       0b11111001
#define OFF_S3_S4       0b11110011
#define OFF_S2_S3       0b11110110
#define OFF_S1_S2_S3    0b11111110
#define ONLY_S1_ON      0b11110111
#define ONLY_S2_ON      0b11111011
#define ONLY_S3_ON      0b11111101

// Drive with `first` for first_ms, then with `second` for second_ms
static void manoeuvre(uint8_t first, uint16_t first_ms,
                      uint8_t second, uint16_t second_ms)
{
    PORTB = first;
    while (first_ms--)
    {
        _delay_ms(1);
    }
    PORTB = second;
    while (second_ms--)
    {
        _delay_ms(1);
    }
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
            case ON_TABLE:
                PORTB = MOTOR_FORWARD;
                break;

            case OFF_S1:
                manoeuvre(MOTOR_BACKWARD, 400, MOTOR_RIGHT, 600);
                break;

            case OFF_S2:
                manoeuvre(MOTOR_BACKWARD, 400, MOTOR_LEFT, 300);
                break;

            case OFF_S3:
            case OFF_S4:
                manoeuvre(MOTOR_FORWARD, 200, MOTOR_RIGHT, 300);
                break;

            case OFF_S1_S2:
                manoeuvre(MOTOR_BACKWARD, 250, MOTOR_RIGHT, 300);
                break;

            case OFF_S3_S4:
                PORTB = MOTOR_FORWARD;
                break;

            case OFF_S1_S4:
            case OFF_S2_S3:
            case OFF_S1_S2_S3:
            case ONLY_S1_ON:
                PORTB = MOTOR_LEFT;
                break;

            case ONLY_S2_ON:
            case ONLY_S3_ON:
                PORTB = MOTOR_RIGHT;
                break;
        }
    }
}
