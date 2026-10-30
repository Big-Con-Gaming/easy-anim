// Contains getters and setters for specific data like anchor and size of a selection (or technically animation as well).

// Sets up basic stuff.
import mcf from '../mcf.js';
// Import functions needed here:
import * as debug from '../debug.js';
import { axis } from '../util.js';

const folder = mcf.selection.data;

// Define functions you want other files to use here:
export const {
    grabSizeAnchor, grabSizeAnchorEditor, grabStrBlockPos
} = folder;

// Define local functions here:
const {
    anonymous: a
} = folder;

const ns = 'easy-anim';

// Grabs size and anchor and toss them into a temporary storage place to be used in other commands. Exports data into ${ns}:temp grabsizeanchor.
const grabSizeAnchorCommands = [];

function createGrabSizeAnchorCommands({axis, i}){
    return`
        data modify storage ${ns}:temp grabsizeanchor.a${axis} set from storage ${ns}:animation_data new.anchor[${i}]
        data modify storage ${ns}:temp grabsizeanchor.s${axis} set from storage ${ns}:animation_data new.size[${i}]
        execute store result score s${axis} ${ns}-grabSizeAnchor run data get storage ${ns}:animation_data new.size[${i}] 
        execute store result storage ${ns}:temp grabsizeanchor.sh${axis} int 1 run scoreboard players remove s${axis} ${ns}-grabSizeAnchor 1
    `;
}

grabSizeAnchorCommands.push(`
    # Log the function call - Removed for running every frame
    # ${debug.run} {input: "grabSizeAnchor"}
    # Remove possibly trailing data
    scoreboard objectives remove ${ns}-grabSizeAnchor
    scoreboard objectives add ${ns}-grabSizeAnchor dummy
    # Error if animation_data new does not exist. (not checking anchor and size individually because 1. floods chat and 2. can run without them. Would be a warn) (contains the function name due to missing run log, because it runs every frame.)
    execute unless data storage ${ns}:animation_data new run return run ${debug.error} {input: "grabSizeAnchor: No data found in new"}
`);

grabSizeAnchorCommands.push(...axis.map(createGrabSizeAnchorCommands));

grabSizeAnchorCommands.push(`
    scoreboard objectives remove ${ns}-grabSizeAnchor
`);

grabSizeAnchor`${grabSizeAnchorCommands.join('\n')}`;

// Grabs size and the coordinates within the editor for a specific frame and tosses them into a temporary storage place to be used in other commands. Exports data into ${ns}:temp grabsizeanchor.
const grabSizeAnchorEditorCommands = [];

function createGrabSizeAnchorEditorCommands({axis, i}){
    return`
        $data modify storage ${ns}:temp grabsizeanchor.a${axis} set from storage ${ns}:animation_data new.frames[$(framenum)].eanchor[${i}]
        $data modify storage ${ns}:temp grabsizeanchor.s${axis} set from storage ${ns}:animation_data new.frames[$(framenum)].size[${i}]
        $execute store result score s${axis} ${ns}-grabSizeAnchorEditor run data get storage ${ns}:animation_data new.frames[$(framenum)].size[${i}]
        execute store result storage ${ns}:temp grabsizeanchor.sh${axis} int 1 run scoreboard players remove s${axis} ${ns}-grabSizeAnchorEditor 1
    `;
}

grabSizeAnchorEditorCommands.push(`
    # Log the function call - Removed for running every frame
    # $${debug.run} {input: "grabSizeAnchorEditor for frame $(framenum)"}
    # Remove possibly trailing data
    scoreboard objectives remove ${ns}-grabSizeAnchorEditor
    scoreboard objectives add ${ns}-grabSizeAnchorEditor dummy
    # Error if animation_data new.frames[$(framenum)] does not exist. (not checking anchor and size individually because 1. floods chat and 2. can run without them. Would be a warn) (contains the function name due to missing run log, because it runs every frame.)
    $execute unless data storage ${ns}:animation_data new.frames[$(framenum)] run return run ${debug.error} {input: "grabSizeAnchorEditor: No data found in new.frames[$(framenum)]"}
`);

grabSizeAnchorEditorCommands.push(...axis.map(createGrabSizeAnchorEditorCommands));

grabSizeAnchorEditorCommands.push(`
    scoreboard objectives remove ${ns}-grabSizeAnchorEditor
`);

grabSizeAnchorEditor`${grabSizeAnchorEditorCommands.join('\n')}`;

// Takes the anchor position and subtracts 1 to find the structure block location. Also tosses some information into the same storage for macros (size)
const grabStrBlockPosCommands = [];

// Set up temporary scoreboard
grabStrBlockPosCommands.push(`
    # Log the function call
    ${debug.run} {input: "grabStrBlockPos"}
    # Clear possibly trailing data
    scoreboard objectives remove ${ns}-calculategrabStrBlockPosCommands
    scoreboard objectives add ${ns}-calculategrabStrBlockPosCommands dummy
    # Check if animation_data new has anchor, otherwise error. Warn if size or dimension is missing.
    execute unless data storage ${ns}:animation_data new.anchor run return run ${debug.error} {input: "No anchor found within animation_data new!"}
    execute unless data storage ${ns}:animation_data new.size run ${debug.warn} {input: "No size found within animation_data new! Assuming a value of 1..."}
    execute unless data storage ${ns}:animation_data new.dimension run ${debug.error} {input: "No dimension found within animation_data new! Won't be placed into str.dimension"}
    # Grab dimension from the animation data to toss into temp storage for removing the structure block later.
    data modify storage ${ns}:temp str.dimension set from storage ${ns}:animation_data new.dimension
`);

function calculategrabStrBlockPosCommands({axis, i}) {
    return`
        # Take anchor out of storge and subtract one on all axis (position of structure block)
        execute store result score str${axis} ${ns}-calculategrabStrBlockPosCommands run data get storage ${ns}:animation_data new.anchor[${i}] 1
        scoreboard players remove str${axis} ${ns}-calculategrabStrBlockPosCommands 1
        # Toss the structure block coordinates into a temporary storage to be macroed into the command.
        execute store result storage ${ns}:temp str.${axis} int 1 run scoreboard players get str${axis} ${ns}-calculategrabStrBlockPosCommands
        # Toss the size of the selection into a temporary storage to be macroed into the command.
        execute if data storage ${ns}:animation_data new.size[${i}] run data modify storage ${ns}:temp str.s${axis} set from storage ${ns}:animation_data new.size[${i}]
        # Give size an initial value of 1 (in case there isn't one set yet, in case there's only the anchor selected)
        execute unless data storage ${ns}:animation_data new.size[${i}] run data modify storage ${ns}:temp str.s${axis} set value 1
    `;
}

// Add axis-specific commands from function above.
grabStrBlockPosCommands.push(...axis.map(calculategrabStrBlockPosCommands));

// Remove temporary scoreboard
grabStrBlockPosCommands.push(`
    scoreboard objectives remove ${ns}-calculategrabStrBlockPosCommands
`);

// Compile the grabStrBlockPosCommands into grabStrBlockPos
grabStrBlockPos(grabStrBlockPosCommands.join('\n'));
