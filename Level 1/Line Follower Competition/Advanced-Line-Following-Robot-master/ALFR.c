/*
 * Project : Advanced Line Following Robot (competition)
 * Level   : Kaizen Robotics Program - Level 1
 * Board   : ATmega16 @ 1 MHz, Embedded C (WinAVR, register level)
 *
 * Line follower that also:
 *   - beeps while crossing perpendicular junctions,
 *   - stops and sounds the buzzer when an obstacle is in front,
 *   - slows down inside a "cave" (detected by a side proximity sensor),
 *     with the speed set by a potentiometer through software PWM.
 *
 *   Line sensors      : 0 over white, 1 over the black line
 *   Proximity sensors : 0 when an object is detected
 *
 * Wiring:
 *   PD0        <- right line sensor     (internal pull-up enabled)
 *   PD1        <- left line sensor      (internal pull-up enabled)
 *   PD2        <- front obstacle sensor (internal pull-up enabled)
 *   PD3        <- cave wall sensor      (internal pull-up enabled)
 *   PA0 (ADC0) <- potentiometer for the cave speed
 *   PB0..PB3   -> L293D motor driver inputs
 *   PB4        -> buzzer
 */

#include <avr/io.h>
#include <util/delay.h>

#define MOTOR_STOP      0b00000000
#define MOTOR_FORWARD   0b00001010
#define MOTOR_LEFT      0b00000110  // Spin left on the spot
#define MOTOR_RIGHT     0b00001001  // Spin right on the spot
#define BUZZER          0b00010000

#define PWM_PERIOD_MS       25      // Total period of one PWM cycle
#define ADC_SCALE           40      // ADC counts per millisecond of OFF time
#define ADC_PWM_THRESHOLD   870     // Above this the cave speed is full speed

// PIND patterns with the cave sensor bit (PD3) set, i.e. outside a cave.
// Unused pins PD4..PD7 are pulled up and read as 1.
#define LINE_CENTRED        0b11111100
#define LINE_UNDER_LEFT     0b11111110
#define LINE_UNDER_RIGHT    0b11111101
#define CROSSROAD           0b11111111
#define OBSTACLE_AHEAD      0b11111000
#define NO_CAVE_WALL        (1 << PD3)

#define NO_CHANGE           0xFF    // Unknown pattern: keep the last output

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

// Chooses the PORTB output from the line and obstacle sensors (PD0..PD2)
static uint8_t line_decision(uint8_t sensors)
{
    switch (sensors | NO_CAVE_WALL)
    {
        case LINE_CENTRED:     return MOTOR_FORWARD;
        case LINE_UNDER_LEFT:  return MOTOR_LEFT;
        case LINE_UNDER_RIGHT: return MOTOR_RIGHT;
        case CROSSROAD:        return MOTOR_FORWARD | BUZZER;  // Beep and cross
        case OBSTACLE_AHEAD:   return BUZZER;                  // Stop and alarm
        default:               return NO_CHANGE;
    }
}

// One software PWM cycle of `output`, duty cycle set by the potentiometer
static void cave_speed_cycle(uint8_t output)
{
    uint16_t reading = read_adc();
    uint16_t t_off   = reading / ADC_SCALE;
    uint16_t t_on    = PWM_PERIOD_MS - t_off;

    PORTB = output;
    if (reading <= ADC_PWM_THRESHOLD)
    {
        delay_ms(t_on);
        PORTB = output & BUZZER;    // Motors off, buzzer unchanged
        delay_ms(t_off);
    }
}

int main(void)
{
    DDRB  = 0b11111111;             // Port B is an output port
    DDRD  = 0b00000000;             // Port D is an input port
    PORTD = 0b11111111;             // Enable pull-ups on Port D
    init_adc();
    _delay_ms(500);

    while (1)
    {
        uint8_t sensors = PIND;
        uint8_t output  = line_decision(sensors);

        if (output == NO_CHANGE)
        {
            continue;
        }

        if (!(sensors & NO_CAVE_WALL) && output != BUZZER)
        {
            cave_speed_cycle(output);       // Inside a cave: slow down
        }
        else
        {
            PORTB = output;
        }
    }
}
