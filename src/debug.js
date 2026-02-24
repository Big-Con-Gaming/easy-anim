// Sets up basic things.
import mcf from './mcf.js';
const folder = mcf.debug;
export const { run, path, entry, warn, error, info, debugSetup, displayLog, displayLogFiltered } = folder;
const { recPrintLog, recShrinkLogLevel, recShrinkLogLimit, anonymous: a } = folder;
const ns = 'easy-anim';

/*
Examples:

import * as debug from './debug.js';

# Log the function call
$${debug.run} {input: "recPlayerSearch at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz) for $(name) frame $(framenum) out of $(framecount)"}

# Log the function call
${debug.run} {input: "saveCurrentFrame"}

Regex for finding function references (non debug):
(\$\{(?!ns)(?!debug)(?=.*\}|.*`))

Key for paths:
-> omit root function from path
functions that run in order -> point in order
(looped functions are within parentheses)
| optional functions denoted with bar
[branching functions | are split with bar and are within braces]
^ breakpoint functions denoted with carat
{functions that are macroed in are within brackets}
repeated non looped functions are denoted with X(number of repeats, can be a range)
anonymous functions should have a description matching their logs

How to log:
assuming a value that is crucial to execution: error if not found
assuming a value for an optional command: warn if not found
selecting entities or checking blocks that could be there: error if required, warn if optional
macro requires specific characters or string to complete later function/macro: error if not found
Overriding existing data: warn, possible error if 100% should not be there
execution context in any way isn’t aligned: error
anytime previously an unexpected return is ran: error
*/

// Set up the debug log storage. This will clear it every reload.
debugSetup`
    data modify storage ${ns}:debug log set value []
`

// Tells the executing player the current debug log by looping through each log entry and displaying it in chat.
displayLog`
    # If there are no logs, log an error that will be displayed to the user (making the log no longer empty).
    # This shouldn't normally happen since a log is added on load.
    execute unless data storage ${ns}:debug log[0] run ${error} {input: "No log entries were present."}
    # Grab a copy of the entire log to iterate through.
    data modify storage ${ns}:debug temp.log set from storage ${ns}:debug log
    ${recPrintLog`
        # Print out the next log entry to the player.
        tellraw @s {type: "nbt", source: "storage", nbt: "temp.log[0].text", storage: "${ns}:debug", interpret: true}
        # Remove the printed log entry from the temporary log.
        data remove storage ${ns}:debug temp.log[0]
        # If there's more log entries, repeat.
        execute if data storage ${ns}:debug temp.log[0] run ${recPrintLog}
    `}
    # Clean up temporary values.
    data remove storage ${ns}:debug temp.log
`

// Tells the executing player the current debug log by looping through each log entry and displaying it in chat. Contains options for different levels of logs and a line limit.
displayLogFiltered`
    # Create a temporary scoreboard to pull filtering options into.
    scoreboard objectives add ${ns}-debug dummy
    $scoreboard players set .level ${ns}-debug $(level)
    $scoreboard players set .lines ${ns}-debug $(lines)
    # Place a counter for printed lines into scoreboard.
    scoreboard players set .printed ${ns}-debug 0
    # Grab a copy of the entire log to iterate through.
    data modify storage ${ns}:debug temp.log set from storage ${ns}:debug log
    # Set up a temporary storage for a filtered log.
    data modify storage ${ns}:debug temp.filteredlog set value []
    # Remove all lines that aren't within the requested level.
    ${recShrinkLogLevel`
        # Grab the level of the current log entry.
        execute store result score .loglevel ${ns}-debug run data get storage ${ns}:debug temp.log[0].level
        # If the log entry is within the requested level, add it to a separate list.
        execute if score .loglevel ${ns}-debug <= .level ${ns}-debug run data modify storage ${ns}:debug temp.filteredlog append from storage ${ns}:debug temp.log[0]
        # Remove the current log entry from the temporary log.
        data remove storage ${ns}:debug temp.log[0]
        # If there are more log entries, repeat.
        execute if data storage ${ns}:debug temp.log[0] run ${recShrinkLogLevel}
    `}
    # Grab the size of the entire log.
    execute store result score .totallines ${ns}-debug run data get storage ${ns}:debug temp.filteredlog
    # If the line limit is larger than zero, remove excess lines from the start of the log.
    execute if score .lines ${ns}-debug matches 1.. if score .totallines ${ns}-debug > .lines ${ns}-debug run ${recShrinkLogLimit`
        # Remove the first log entry.
        data remove storage ${ns}:debug temp.filteredlog[0]
        # Decrement the totallines scoreboard.
        scoreboard players remove .totallines ${ns}-debug 1
        # If there are still too many lines, repeat.
        execute if score .totallines ${ns}-debug > .lines ${ns}-debug run ${recShrinkLogLimit}
    `}
    # Clone the filtered log to the temporary log for printing.
    data modify storage ${ns}:debug temp.log set from storage ${ns}:debug temp.filteredlog
    # If no logs remain, log an error that will be displayed to the user (making the log no longer empty).
    execute if score .totallines ${ns}-debug matches 0 run ${error} {input: "No log entries matched the requested filter criteria."}
    # If no logs remain, add the new error log to the temporary log.
    execute if score .totallines ${ns}-debug matches 0 run data modify storage ${ns}:debug temp.log append from storage ${ns}:debug log[-1]
    # Print out the log.
    execute if data storage ${ns}:debug temp.log[0] run ${recPrintLog}
    # Remove the temporary scoreboard and data storage.
    scoreboard objectives remove ${ns}-debug
    data remove storage ${ns}:debug temp.log
`
// The types of debug messages, with their color symbol and level. Level is used to distinguish importance of logs, with 1 being most important, decreasing in importance as the level increases.
// special is an optional property that denotes special handling for the debug type. By default, the input macro will be text that is logged.
// If special is "store_data", then 3 macros are needed to point to an nbt source which is retrieved and then logged as info. source = [block, entity, storage], location = coordinates for blocks, target selector for entity, or namespace for storage, path = nbt path to the data wanted.
const debugTypes = [{
    name: "run", level: 3, color: "dark_gray", symbol: "🗎"
}, {
    name: "path", level: 3, color: "gray", symbol: "〰"
}, {
    name: "entry", level: 3, color: "white", symbol: "⤵"
}, {
    name: "warn", level: 2, color: "yellow", symbol: "⚠"
}, {
    name: "error", level: 1, color: "red", symbol: "❌"
}, {
    name: "info", level: 1, color: "aqua", symbol: "ℹ", special: "store_data"
}
]

for (const { name, level, color, symbol, special } of debugTypes) {
    if (special == null) {
        folder[`${name}`]`
            # Display the debug message only if the debug level is high enough.
            $execute if score .debug ${ns} matches ${level}.. run tellraw @a {text: '${ns}: (${symbol}) $(input)', color: "${color}"}
            # Store this debug message in the debug log.
            $data modify storage ${ns}:debug log append value {text: {text: '${ns}: (${symbol}) $(input)', color: "${color}"}, level: ${level}}
        `;
    } else if (special === "store_data") {
        folder[`${name}`]`
            # Display the debug message only if the debug level is high enough.
            $execute if score .debug ${ns} matches ${level}.. run tellraw @a [{text: "${ns}: (${symbol}) ", color: "${color}"}, {type: "nbt", source: "$(source)", nbt: "$(path)", $(source): "$(location)", interpret: false}]
            # Store this debug message in the debug log. Grab as text to resolute value.
            $data modify storage ${ns}:debug temp set from $(source) $(location) $(path)
            ${a`
                $data modify storage ${ns}:debug log append value {text: {text: '${ns}: (${symbol}) $(temp)', color: "${color}"}, level: ${level}}
            `} with storage ${ns}:debug
            # Remove redundant data
            data remove storage ${ns}:debug temp
        `;
    }
}