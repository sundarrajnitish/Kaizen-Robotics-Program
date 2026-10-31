/*
 * Project : Bluetooth Controlled Wheelchair with Obstacle Avoidance
 * Level   : Kaizen Robotics Program - Level 1 (final project)
 * Board   : ATmega16 @ 1 MHz, Embedded C (WinAVR, register level)
 *
 * The wheelchair is driven from the Android app "Bluetooth RC Controller"
 * through an HC-05 module. After every command it measures the distance
 * ahead with an HC-SR04 ultrasonic sensor; if something is closer than
 * STOP_DISTANCE_CM it stops for a second and then backs away.
 *
 *   'F' forward   'B' backward   'L' left   'R' right   other: stop
 *
 * The echo pulse is timed with Timer1 input capture, so the timer runs at
 * F_CPU (1 tick = 1 us at 1 MHz). Sound covers 1 cm and back in ~58 us.
 *
 * Wiring:
 *   PD0 (RXD)  <- HC-05 TX, 4800 baud 8N1
 *   PA0        -> HC-SR04 TRIG
 *   PD6 (ICP1) <- HC-SR04 ECHO
 *   PB0..PB3   -> L293D motor driver inputs (motors mounted mirrored,
 *                 so the left/right patterns are swapped vs. the kit robot)
 */

#ifndef F_CPU
#define F_CPU 1000000UL
#endif

#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>

#define BAUDRATE        4800
#define UBRR_VALUE      ((F_CPU / (BAUDRATE * 16UL)) - 1)

#define MOTOR_STOP      0b00000000
#define MOTOR_FORWARD   0b00001010
#define MOTOR_BACKWARD  0b00000101
#define MOTOR_LEFT      0b00001001
#define MOTOR_RIGHT     0b00000110

#define TRIGGER_PIN     PA0
#define TICKS_PER_CM    (58UL * (F_CPU / 1000000UL))
#define STOP_DISTANCE_CM 40
#define ECHO_TIMEOUT_OVERFLOWS 2    // ~130 ms at 1 MHz without an echo

static volatile uint16_t timer_overflows = 0;

ISR(TIMER1_OVF_vect)
{
    timer_overflows++;
}

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

static void restart_capture(uint8_t tccr1b)
{
    TCNT1  = 0;
    TCCR1B = tccr1b;
    TIFR   = (1 << ICF1);           // Clear input capture flag
    TIFR   = (1 << TOV1);           // Clear overflow flag
    timer_overflows = 0;
}

// Wait for the next input capture edge; returns 0 on timeout
static uint8_t wait_for_edge(void)
{
    while ((TIFR & (1 << ICF1)) == 0)
    {
        if (timer_overflows >= ECHO_TIMEOUT_OVERFLOWS)
        {
            return 0;
        }
    }
    return 1;
}

// Returns the distance to the nearest object in cm, or 0xFFFF if no echo
static uint16_t measure_distance_cm(void)
{
    PORTA |= (1 << TRIGGER_PIN);    // 10 us trigger pulse
    _delay_us(10);
    PORTA &= ~(1 << TRIGGER_PIN);

    restart_capture((1 << ICES1) | (1 << CS10));    // Rising edge, no prescaler
    if (!wait_for_edge())
    {
        return 0xFFFF;
    }

    restart_capture(1 << CS10);                     // Falling edge, no prescaler
    if (!wait_for_edge())
    {
        return 0xFFFF;
    }

    uint32_t ticks = ICR1 + 65536UL * timer_overflows;
    return (uint16_t)(ticks / TICKS_PER_CM);
}

int main(void)
{
    DDRA = (1 << TRIGGER_PIN);      // Trigger is the only output on Port A
    DDRB = 0b11111111;              // Port B is an output port
    uart_init();
    _delay_ms(50);

    TCCR1A = 0;                     // Timer1 in normal mode
    TIMSK  = (1 << TOIE1);          // Count overflows for long echoes
    sei();

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

        if (measure_distance_cm() <= STOP_DISTANCE_CM)
        {
            PORTB = MOTOR_STOP;     // Obstacle: stop, then back away
            _delay_ms(1000);
            PORTB = MOTOR_BACKWARD;
            _delay_ms(1000);
        }
    }
}
