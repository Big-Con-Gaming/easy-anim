// Deals with managing operations that occur on multiple frames of an animation at once.

// Sets up basic stuff.
import mcf from '../mcf.js';
import * as debug from '../debug.js';
import { toggleSelectionState } from './selecting.js';
import { saveSpecificFrame, clearSpecificFrame, loadSpecificFrame, setFrameDuration, addNewFrame, duplicateFrame, moveSelectedFrames } from './functions.js';
import { calculateSelectedFrameBounds } from './helpers.js';
import { grabAnimationFromUuid, cleanUpNewAnimationData } from '../data.js';
import { grabSizeAnchorEditor } from '../selection/data.js';
import { cameraSaveFrame, cameraLoadQueueFrame, toggleHighlightFrame, cameraClosest } from '../camera/frame.js';

const folder = mcf.animation.operate;

// Define functions you want other files to use here:
export const {
    operationOnSelectedFrames
} = folder;

// Define local functions here:
const {
    anonymous: a, recOperate, recSelectCheck
} = folder;

const ns = 'easy-anim';

// Used in operationOnSelectedFrames
// Input: mode: which function to execute, based on this map:

const operateCommands = [];

const operationMap = [
    {mode: "save", command: `${saveSpecificFrame}`},
    {mode: "clear", command: `${clearSpecificFrame}`, beforeExecute: `data merge storage ${ns}:temp {csf:{removeData:true, shift:true}}`},
    {mode: "load", command: `${loadSpecificFrame}`},
    {mode: "saveCamera", command: `${cameraSaveFrame}`},
    {mode: "cameraClosest", command: `${cameraClosest}`},
    {mode: "loadCamera", command: `${cameraLoadQueueFrame}`},
    {mode: "highlightCamera", command: `${toggleHighlightFrame}`},
    {mode: "duration", command: `${setFrameDuration}`},
    {mode: "addBase", command: `${addNewFrame}`, beforeExecute: `data modify storage ${ns}:temp grabsizeanchor.targetframe set value "base"`},
    {mode: "duplicate", command: `${duplicateFrame}`},
    {mode: "calcBounds", command: `${calculateSelectedFrameBounds}`},
    {mode: "move", command: `${moveSelectedFrames}`}
];

function createOperateCommands({mode, command, beforeExecute}) {
    let preExecute = "";
    if (beforeExecute) {
        preExecute = `execute if data storage ${ns}:temp selectedframes.${mode} run ` + beforeExecute;
    }
    return `
        # Check if mode equals ${mode}, if so execute that command with macro context (and it's precheck if it exists).
        ${preExecute}
        execute if data storage ${ns}:temp selectedframes.${mode} run ${command} with storage ${ns}:temp grabsizeanchor
    `
}

operateCommands.push(...operationMap.map(createOperateCommands));

// Performs a specified operation on all selected frames, in reverse order.
operationOnSelectedFrames`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog, multiple options | moveFramesShowDialog"}
    # Log the function call
    $${debug.run} {input: "operationOnSelectedFrames executing $(mode)"}
    # Log the expected function path.
    $${debug.path} {input: "-> grabAnimationFromUuid -> stringEquals -> | (recSelectCheck -> | count consecutive) -> | grabSizeAnchorEditor -> (recOperate -> | $(mode) -> ^ grabSizeAnchorEditor)"}
    # Clean up possibly trailing data
    scoreboard objectives remove ${ns}-operation
    data remove storage ${ns}:temp grabsizeanchor
    data remove storage ${ns}:temp selectedframes
    # data remove storage ${ns}:temp carryover - Obviously, NEEDED FOR FUNCTIONALITY BELOW!
    # Set up a specific flag for this mode (so that we don't have the use the macro more than twice)
    $data modify storage ${ns}:temp selectedframes.$(mode) set value true
    # Create a temporary score
    scoreboard objectives add ${ns}-operation dummy
    # Load animation data.
    ${grabAnimationFromUuid} with entity @s
    # Add some data to grabsizeanchor that we need.
    data modify storage ${ns}:temp selectedframes.name set from storage ${ns}:animation_data new.name
    data modify storage ${ns}:temp grabsizeanchor.name set from storage ${ns}:temp selectedframes.name
    data modify storage ${ns}:temp grabsizeanchor.UUID set from entity @s UUID
    # First we have to iterate through every frame within the animation and add selected ones to an array. (framenums)
    data modify storage ${ns}:temp selectedframes.framenums set value []
    execute store result storage ${ns}:temp selectedframes.prevframe int 1 store result score maxframe ${ns}-operation run data get storage ${ns}:animation_data new.framecount
    execute store result storage ${ns}:temp selectedframes.maxframe int 1 run scoreboard players remove maxframe ${ns}-operation 1
    # Warn if there are no frames to go through.
    execute unless data storage ${ns}:animation_data new.frames[0] run ${debug.warn} {input: "No frames in this animation! Exiting..."}
    # Here, multiple modes are checked and if true, sets certain flags within storage that change the behavior of this function.
    # Check if the mode is addBase to know if frames should be deselected when tracked and if framecount is used as framenum when no frames are selected, AND if consecutive frames should be tracked.
    execute if data storage ${ns}:temp selectedframes.addBase run data modify storage ${ns}:temp selectedframes.operateWithNoneSelected set value true
    execute if data storage ${ns}:temp selectedframes.addBase run data modify storage ${ns}:temp selectedframes.deselectWhileCounted set value true
    execute if data storage ${ns}:temp selectedframes.addBase run data modify storage ${ns}:temp selectedframes.trackConsecutive set value true
    # Check if the mode is duplicate to know if consecutive frames should be tracked.
    execute if data storage ${ns}:temp selectedframes.duplicate run data modify storage ${ns}:temp selectedframes.trackConsecutive set value true
    execute if data storage ${ns}:animation_data new.frames[0] run ${recSelectCheck`
        # Log the function call
        $${debug.run} {input: "Select Check with $(maxframe) and $(prevframe)"}
        # Check if this frame is selected and that reverseCount is false, and if so, add it to the end of the list of frames to operate on.
        $execute if data storage ${ns}:animation_data new.frames[$(maxframe)].selected unless data storage ${ns}:temp selectedframes.reverseCount run data modify storage ${ns}:temp selectedframes.framenums append value $(maxframe)
        # If selectedframes.reverseCount is true, insert this frame at the beginning of the list instead of the end.
        $execute if data storage ${ns}:animation_data new.frames[$(maxframe)].selected if data storage ${ns}:temp selectedframes.reverseCount run data modify storage ${ns}:temp selectedframes.framenums insert 0 value $(maxframe)
        # If mode is duplicate and this frame is selected, modify carryover to track consecutive frames
        $execute if data storage ${ns}:animation_data new.frames[$(maxframe)].selected if data storage ${ns}:temp selectedframes.trackConsecutive run ${a`
            # log the function call
            ${debug.run} {input:"count consecutive"}
            # If the previous frame is already in consecutive, set this frame to that value + 1
            $execute if data storage ${ns}:temp carryover.consecutive.$(prevframe) store result score consecutive ${ns}-operation run data get storage ${ns}:temp carryover.consecutive.$(prevframe)
            $execute if data storage ${ns}:temp carryover.consecutive.$(prevframe) store result storage ${ns}:temp carryover.consecutive.$(maxframe) int 1 run scoreboard players add consecutive ${ns}-operation 1
            # If preexisting data doesn't exist, set this frame's offset to 1
            $execute unless data storage ${ns}:temp carryover.consecutive.$(prevframe) run data modify storage ${ns}:temp carryover.consecutive.$(maxframe) set value 1
        `} with storage ${ns}:temp selectedframes
        # If deselectWhileCounted is true and this frame is selected, deselect it
        $execute if data storage ${ns}:temp selectedframes.deselectWhileCounted if data storage ${ns}:animation_data new.frames[$(maxframe)].selected run ${toggleSelectionState} {framenum: $(maxframe)}
        # Decrease max frame and prevframe (only if mode = duplicate)
        execute if data storage ${ns}:temp selectedframes.trackConsecutive run data modify storage ${ns}:temp selectedframes.prevframe set from storage ${ns}:temp selectedframes.maxframe
        execute store result storage ${ns}:temp selectedframes.maxframe int 1 run scoreboard players remove maxframe ${ns}-operation 1
        # Loop
        execute if score maxframe ${ns}-operation matches 0.. run ${recSelectCheck} with storage ${ns}:temp selectedframes
    `} with storage ${ns}:temp selectedframes
    # If operateWithNoneSelected is true, and no frames are selected, execute addBase with the framecount as framenum.
    execute if data storage ${ns}:temp selectedframes.operateWithNoneSelected unless data storage ${ns}:temp selectedframes.framenums[0] run return run ${a`
        $${addNewFrame} {framenum: $(framecount), targetframe: "base"}
        # Apply all animation changes made by the possible addBase operation.
        ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
        # Clean up trailing data
        scoreboard objectives remove ${ns}-operation
        data remove storage ${ns}:temp grabsizeanchor
        data remove storage ${ns}:temp selectedframes
    `} with storage ${ns}:animation_data new
    # Warn if there are no selected frames to operate on. Let the user know as well.
    execute unless data storage ${ns}:temp selectedframes.framenums[0] run ${debug.warn} {input: "No selected frames to operate on! Exiting..."}
    execute unless data storage ${ns}:temp selectedframes.framenums[0] run tellraw @s {text:"Select some frames first!", color: "red"}
    # Grab the first framenum from storage. (If we have frames to iterate on)
    execute if data storage ${ns}:temp selectedframes.framenums[0] run data modify storage ${ns}:temp grabsizeanchor.framenum set from storage ${ns}:temp selectedframes.framenums[0]
    # Grab selectedframes for this frame (If we have frames to iterate on).
    execute if data storage ${ns}:temp grabsizeanchor.framenum run ${grabSizeAnchorEditor} with storage ${ns}:temp grabsizeanchor
    # Iterate over the selected frames.
    execute if data storage ${ns}:temp grabsizeanchor.framenum run ${recOperate`
        # Run the specified operation (passed in as a macro, automatically uses grabsizeanchor data)
        ${operateCommands.join("\n")}
        # Apply all animation changes made by the above operation.
        ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
        # Remove this frame from the list.
        data remove storage ${ns}:temp selectedframes.framenums[0]
        # Clear grabsizeanchor for the next frame.
        data remove storage ${ns}:temp grabsizeanchor
        # If there's no more frames, return.
        execute unless data storage ${ns}:temp selectedframes.framenums[0] run return 1
        # Load animation data once again since the loop continues.
        ${grabAnimationFromUuid} with entity @s
        # Grab the next frame number.
        data modify storage ${ns}:temp grabsizeanchor.framenum set from storage ${ns}:temp selectedframes.framenums[0]
        # Pull the animation name
        data modify storage ${ns}:temp grabsizeanchor.name set from storage ${ns}:temp selectedframes.name
        # Pull the UUID
        data modify storage ${ns}:temp grabsizeanchor.UUID set from entity @s UUID
        # Grab the rest of the data from grabsizeanchor.
        ${grabSizeAnchorEditor} with storage ${ns}:temp grabsizeanchor
        # Loop
        ${recOperate} with storage ${ns}:temp selectedframes
    `} with storage ${ns}:temp selectedframes
    # Clean up trailing data
    scoreboard objectives remove ${ns}-operation
    data remove storage ${ns}:temp grabsizeanchor
    data remove storage ${ns}:temp selectedframes
    data remove storage ${ns}:temp carryover
`;
