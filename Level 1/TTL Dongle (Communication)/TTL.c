/*
 * Project : Serial Communication via TTL Dongle
 * Level   : Kaizen Robotics Program - Level 1
 * Board   : ATmega16 @ 1 MHz, Embedded C (WinAVR, register level)
 *
 * Drives the robot from a PC terminal (or Bluetooth module) over UART.
 * Each received character selects a motion; any other character stops.
 *
 *   'F' forward   'B' backward   'L' left   'R' right
 *
 * Wiring:
 *   PD0 (RXD)  <- TX of the USB-TTL dongle / HC-05, 4800 baud 8N1
 *   PB0..PB3   -> L293D motor driver inputs
 */

#ifndef F_CPU
#define F_CPU 1000000UL
#endif

#include <avr/io.h>
#include <util/delay.h>

#define BAUDRATE        4800
#define UBRR_VALUE      ((F_CPU / (BAUDRATE * 16UL)) - 1)

#define MOTOR_STOP      0b00000000
#define MOTOR_FORWARD   0b00001010
#define MOTOR_BACKWARD  0b00000101
#define MOTOR_LEFT      0b00000110  // Spin left on the spot
#define MOTOR_RIGHT     0b00001001  // Spin right on the spot

static void uart_init(void)
{
    UBRRH = (uint8_t)(UBRR_VALUE >> 8);
    UBRRL = (uint8_t)UBRR_VALUE;
    UCSRB |= (1 << RXEN);           // Enable the receiver
}

static uint8_t uart_receive(void)
{
    while ((UCSRA & (1 << RXC)) == 0)
    {
        // Wait until a byte has been received
    }
    return UDR;
}

int main(void)
{
    DDRB = 0b11111111;              // Port B is an output port
    uart_init();
    _delay_ms(50);

    while (1)
    {
        switch (uart_receive())
        {
            case 'F': PORTB = MOTOR_FORWARD;  break;
            case 'B': PORTB = MOTOR_BACKWARD; break;
            case 'L': PORTB = MOTOR_LEFT;     break;
            case 'R': PORTB = MOTOR_RIGHT;    break;
            default:  PORTB = MOTOR_STOP;     break;
        }
    }
}
