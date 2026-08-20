// Contains the functions for allocating, unclaiming, and calculating positions for editor lanes.
// Separated to remove a circular reference call between editor.js and selection.js

// Sets up basic stuff.
import mcf from '../mcf.js';
// Import functions needed here:
import * as debug from '../debug.js';
import { grabPlayerDataFromOwner } from '../data.js';

const folder = mcf.editor.lane;

// Define functions you want other files to use here:
export const {
    calculateLaneX, findPlayerAxisOffset, unclaimLane
} = folder;

// Define local functions here:
const {
    anonymous: a, macroUnclaim, recEditorSearch
} = folder;

const ns = 'easy-anim';

// Calculates the x position from the lane value placed in the current player's data. Output is a specified path with the output macro, and the type to save the number as.
calculateLaneX`
    # Log the function call
    $${debug.run} {input: "calculateLaneX outputting to $(output)"}
    # Log the expected function path.
    ${debug.path} {input: "-> | grabPlayerDataFromOwner"}
    execute unless data storage ${ns}:player_data current run ${grabPlayerDataFromOwner}
    # Error if the player doesn't have a lane.
    execute unless data storage ${ns}:player_data current.lane run return run ${debug.error} {input:"Player does not have an editor lane!"}
    scoreboard objectives add ${ns}-lane dummy
    scoreboard players set 48 ${ns}-lane 48
    execute store result score current-lane ${ns}-lane run data get storage ${ns}:player_data current.lane
    scoreboard players operation blocks ${ns}-lane = current-lane ${ns}-lane
    scoreboard players operation blocks ${ns}-lane *= 48 ${ns}-lane
    # Warn if output already has data. This would work except $(output) currently provides a type, which can't be used here...
    # $execute if data storage $(output) run ${debug.warn} {input:"$(output) already has data! Overwriting..."}
    $execute store result storage $(output) 1 run scoreboard players get blocks ${ns}-lane
    scoreboard objectives remove ${ns}-lane
    data remove storage ${ns}:player_data current
`;

// Searches the editor dimension recursively to find a "lane" for a player. This will be stored inside of player_data, and this function outputs into current.lane.
findPlayerAxisOffset`
    # Log the function call
    ${debug.run} {input: "findPlayerAxisOffset"}
    # Log the expected function path.
    ${debug.path} {input: "-> recEditorSearch (^ found empty lane)"}
    # Error if the player already has a lane
    execute if data storage ${ns}:player_data current.lane run return run ${debug.error} {input:"Player already has a lane!"}
    scoreboard objectives add ${ns}-lane dummy
    scoreboard players set current-lane ${ns}-lane 0
    execute unless data storage ${ns}:player_data current.lane in ${ns}:editor positioned 0 1 0 run ${recEditorSearch`
        # Log the function call
        ${debug.run} {input: "recEditorSearch"}
        forceload add ~ ~
        execute unless block ~ ~ ~ minecraft:bedrock run return run ${a`
            # Log the function call
            ${debug.run} {input: "found empty lane"}
            execute store result storage ${ns}:player_data current.lane int 1 run scoreboard players get current-lane ${ns}-lane
            # Warn if a non-air block is located here.
            execute unless block ~ ~ ~ minecraft:air run ${debug.warn} {input: "Non-air block found in lane! Overwriting..."}
            setblock ~ ~ ~ minecraft:bedrock
            forceload remove ~ ~
        `}
        forceload remove ~ ~
        scoreboard players add current-lane ${ns}-lane 1
        execute positioned ~48 ~ ~ run ${recEditorSearch}
    `}
    scoreboard objectives remove ${ns}-lane
`;

// Removes a player's lane by deleting the bedrock block and by unforceloading the chunk. current.lane is used and must be provided.
unclaimLane`
    # Log the function call
    ${debug.run} {input: "unclaimLane"}
    # Log the expected function path.
    ${debug.path} {input: "-> calculateLaneX -> macroUnclaim"}
    ${calculateLaneX} {output:"${ns}:temp macro_unclaim.pos int"}
    ${macroUnclaim`
        # Log the function call
        $${debug.run} {input: "macroUnclaim at x value: $(pos)"}
        # Warn if non-bedrock block is placed here.
        $execute unless block $(pos) 1 0 minecraft:bedrock run ${debug.warn} {input:"Expected bedrock at $(pos) 1 0! Overwriting..."}
        $setblock $(pos) 1 0 minecraft:air
        # Warn if we're in the first lane.
        $execute if block $(pos) 2 0 minecraft:obsidian run ${debug.warn} {input:"This is the initial lane! Skipping unload..."}
        $execute unless block $(pos) 2 0 minecraft:obsidian run forceload remove $(pos) 0
    `} with storage ${ns}:temp macro_unclaim
    data remove storage ${ns}:temp macro_unclaim
`;
