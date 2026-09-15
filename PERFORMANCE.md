# Performance Tab

The Performance tab summarizes the loaded VESC log. It is calculated from the parsed log data each time the tab is opened; it does not change the raw log or the uPlot display settings.

## Analysis

The analysis section reports findings with three levels:

- **Critical**: an event or value may indicate a fault, thermal throttle, or unsafe operating condition.
- **Warning**: the log shows a possible limit, stress, or data-quality concern.
- **OK**: the measured value stayed within the analyzer's reference threshold.
- **Info**: useful context that is not necessarily a problem.

The analysis checks:

- Controller fault codes, using the VESC fault names when known.
- Controller temperature. 75 °C is treated as hot and 85 °C as the default throttle point.
- Motor temperature, when motor-temperature data is available, using the same 75 °C and 85 °C reference points.
- Duty-cycle limiting. More than 5% of moving samples above 95% duty is reported as a warning.
- Motor-current clipping. More than 5% of samples within 2% of peak motor current is treated as a configured current ceiling.
- Battery voltage sag. Pack resistance is estimated from the voltage/current relationship. Sag above 15% of the resting voltage is reported as significant.
- Low cell voltage. The cell count is estimated by rounding the maximum logged voltage divided by 4.2 V. A minimum estimated cell voltage below 3.2 V is reported as a warning.
- GNSS accuracy. More than 25% of samples with horizontal accuracy worse than 5 m is reported as poor accuracy.
- Regeneration. Little or no increase in charged watt-hours is reported as no regenerative braking recorded.
- Efoil lift coefficient. The true lift coefficient is calculated as $C_L = 2mg / (rho A v^2)$ from rider-plus-board mass, configured wing area, water density, and GNSS speed. Both mass and wing area must be entered in the menu.
- Efoil flight. Flying on the foil lifts the board clear of the water, so drag falls sharply and the board runs faster on less power. A flight is reported only when all three signatures occur together and are sustained for at least 3 seconds: speed rises at least 3 km/h above the preceding plowing state, motor current falls at least 15%, and the lift coefficient falls at least 15%. Speeds below 10 km/h are rejected outright as too slow to be flight; around 15 km/h is indicative of flight but is not itself a test. Each flight is listed with its timestamp, duration, and before/after speed, current, and lift coefficient. Logs without that pattern are reported as having no flight detected, along with the peak speed reached.

These are heuristic checks, not replacements for the VESC configuration, hardware limits, or a safety inspection.

## Session

- **Duration**: Last log timestamp minus first log timestamp.
- **Distance**: Total change in the selected distance series. Efoil profiles use GNSS-derived distance; E-skateboard profiles use tachometer distance.
- **Moving time**: Time between consecutive samples where speed is above 1 km/h. Gaps of 10 seconds or more are excluded so merged logs or pauses do not inflate the result.
- **Samples**: Number of timestamped samples in the loaded log.

## Speed

The speed section uses the profile's speed series:

- **Top speed**: Maximum logged speed.
- **Average moving**: Mean speed for samples above 1 km/h that are part of intervals shorter than 10 seconds.
- **Average overall**: Mean speed across all logged speed samples, including stopped samples.

## Power and Energy

- **Peak power**: Maximum logged power.
- **Average power**: Mean logged power, including low- or zero-power samples.
- **Energy used**: Maximum watt-hours used minus minimum watt-hours used.
- **Efficiency**: Energy used divided by distance, reported in Wh/km. It is shown as unavailable when the distance is too short to produce a meaningful value.
- **Lift coefficient**: For efoil logs, average logged power multiplied by the 90% motor-efficiency assumption, divided by water density (1025 kg/m³), the configured wing area, and average GNSS speed in m/s. It is shown after entering the wing area in the hamburger menu.

## Battery

- **Start voltage**: First logged pack voltage.
- **End voltage**: Last logged pack voltage.
- **Minimum voltage**: Lowest logged pack voltage, with the total voltage range shown as the sag note.
- **Peak battery current**: Maximum logged input/battery current.

## Drive

- **Peak motor current**: Maximum logged motor current.
- **Peak duty cycle**: Maximum logged duty cycle.
- **Peak controller temperature**: Maximum logged controller/MOS temperature.

## Interpreting Results

The displayed numbers describe what happened in the log, not necessarily the configured limits. For example, a low peak current can mean the system was lightly loaded, while a current-clipping finding suggests the log repeatedly reached a ceiling. GNSS-derived speed, distance, and efficiency are also affected by horizontal accuracy and antenna conditions.
