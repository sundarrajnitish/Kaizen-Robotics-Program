/*
 * Project : Pulse Width Modulation (software PWM)
 * Level   : Kaizen Robotics Program - Level 1
 * Board   : ATmega16 @ 1 MHz, Embedded C (WinAVR, register level)
 *
 * Toggles PA0 with two different on/off timings so the effect of the
 * pulse width can be seen on an LED or motor connected to PA0:
 *   - a fast 50 ms / 50 ms pulse (LED appears to flicker quickly)
 *   - a slow 1 s / 1 s pulse     (LED visibly blinks)
 *
 * Wiring:
 *   PA0 -> LED (through resistor) or motor driver input
 */

#include <avr/io.h>
#include <util/delay.h>

#define OUTPUT_PIN (1 << PA0)

int main(void)
{
    DDRA = 0b11111111;              // Port A is an output port

    while (1)
    {
        PORTA = OUTPUT_PIN;         // Short pulse: 50 ms on, 50 ms off
        _delay_ms(50);
        PORTA = 0;
        _delay_ms(50);

        PORTA = OUTPUT_PIN;         // Long pulse: 1 s on, 1 s off
        _delay_ms(1000);
        PORTA = 0;
        _delay_ms(1000);
    }
}
