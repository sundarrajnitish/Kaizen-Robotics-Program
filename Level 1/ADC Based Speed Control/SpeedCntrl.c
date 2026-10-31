/*
 * Project : ADC Based Speed Control
 * Level   : Kaizen Robotics Program - Level 1
 * Board   : ATmega16 @ 1 MHz, Embedded C (WinAVR, register level)
 *
 * Reads a potentiometer on ADC0 and uses the reading to set the duty
 * cycle of a software PWM signal that drives both motors forward.
 * Turning the potentiometer up lengthens the OFF time, slowing the robot;
 * past ADC_STOP_THRESHOLD the motors stop completely.
 *
 *   PWM period  = 25 ms
 *   OFF time    = ADC reading / 40   (0 .. 25 ms)
 *   ON time     = period - OFF time
 *
 * Wiring:
 *   PA0 (ADC0) <- potentiometer wiper (pot across AVCC and GND)
 *   PB0..PB3   -> L293D motor driver inputs
 */

#include <avr/io.h>
#include <util/delay.h>

#define MOTOR_STOP          0b00000000
#define MOTOR_FORWARD       0b00001010

#define PWM_PERIOD_MS       25      // Total period of one PWM cycle
#define ADC_SCALE           40      // ADC counts per millisecond of OFF time
#define ADC_STOP_THRESHOLD  870     // Readings at or above this stop the motors

// _delay_ms() needs a compile-time constant, so wait 1 ms at a time
static void delay_ms(uint16_t ms)
{
    while (ms--)
    {
        _delay_ms(1);
    }
}

static void init_adc(void)
{
    ADCSRA |= (1 << ADEN);          // Enable the ADC
    ADCSRA |= (1 << ADPS2);         // Prescaler /16 -> 62.5 kHz ADC clock
    ADMUX  |= (1 << REFS0);         // AVCC as reference, channel ADC0
}

static uint16_t read_adc(void)
{
    ADCSRA |= (1 << ADSC);          // Start a conversion
    while ((ADCSRA & (1 << ADIF)) == 0)
    {
        // Wait for the conversion to finish
    }
    ADCSRA |= (1 << ADIF);          // Clear the flag by writing 1 to it

    return ADC;                     // 10-bit result, 0..1023
}

int main(void)
{
    DDRB = 0b11111111;              // Port B is an output port
    init_adc();
    _delay_ms(500);

    while (1)
    {
        uint16_t reading = read_adc();
        uint16_t t_off   = reading / ADC_SCALE;
        uint16_t t_on    = PWM_PERIOD_MS - t_off;

        if (reading < ADC_STOP_THRESHOLD)
        {
            PORTB = MOTOR_FORWARD;
            delay_ms(t_on);
            PORTB = MOTOR_STOP;
            delay_ms(t_off);
        }
        else
        {
            PORTB = MOTOR_STOP;
        }
    }
}
