// Functions here work with animations, and specifically need abstraction to call operateOnselectedFrames (since that function is used to do almost everything with animations.)

// Sets up basic stuff.
import mcf from './mcf.js';
import * as debug from './debug.js';
import { operationOnSelectedFrames } from './animation/operate.js';
import { grabAnimationFromUuid, cleanUpNewAnimationData } from './data.js';
import { cameraSaveFrame } from './camera.js';
import { testIfInt } from './util.js';
const folder = mcf.animation;
export const {
    cameraSaveFrameEnterIterate, moveFramesShowDialog, grabOffsetAndOperate
} = folder;
const {
    anonymous: a, modifyFrameDurationDialog
} = folder;
const ns = 'easy-anim';

// Checks the output from the duration dialog and stores the correct duration into storage.
modifyFrameDurationDialog`
    # Log the entry point
    ${debug.entry} {input: "from: frame_duration dialog"}
    # Log the function call
    $${debug.run} {input: "modifyFrameDurationDialog setting to either $(slider) or $(text) if valid"}
    # Log the expected function path.
    ${debug.path} {input: "-> | testIfInt -> operationOnSelectedFrames"}
    # Create temporary scoreboard
    scoreboard objectives add ${ns}-mfdd dummy
    # Set a player within the objective to the value of the text input. If the text input is empty or invalid, it will be set to 0.
    $execute store result score check ${ns}-mfdd run ${testIfInt} {input: '$(text)'}
    # If score is 0, use slider to set duration
    $execute if score check ${ns}-mfdd matches 0 run data modify storage ${ns}:temp carryover.duration set value $(slider)
    # If score is 1, use text to set duration
    $execute if score check ${ns}-mfdd matches 1 run data modify storage ${ns}:temp carryover.duration set value '$(text)'
    # Run operationOnSelectedFrames with the given carryover data setting frame duration
    ${operationOnSelectedFrames} {mode: "duration"}
    # Clear carryover data / trailing data
    data remove storage ${ns}:temp carryover
    scoreboard objectives remove ${ns}-mfdd
`;

// Loops through all selected frames, finds the closest one to the player, saves the camera relative to that frame, and then applies it to all other frames.
// Requires an input of the camera note.
cameraSaveFrameEnterIterate`
    # Log the entry point
    ${debug.entry} {input: "from camera_info_frame dialog"}
    # Log the function call
    $${debug.run} {input: "cameraSaveFrameEnterIterate with note $(note)"}
    # Log the expected function path.
    ${debug.path} {input: "operationOnSelectedFrames -> grabAnimationFromUuid -> cameraSaveFrame -> cleanUpNewAnimationData -> operationOnSelectedFrames"}
    # Create a temporary scoreboard and store -1 for later.
    scoreboard objectives add ${ns}-camclose dummy
    scoreboard players set -1 ${ns}-camclose -1
    # Calculate which of the selected frames is closest to the player or contains the player.
    ${operationOnSelectedFrames} {mode: "cameraClosest"}
    # Store the note into a special location just for the closest camera save.
    $data modify storage ${ns}:temp csf.note set value "$(note)"
    # Run cameraSaveFrame for the closest frame.
    ${grabAnimationFromUuid} with entity @s
    ${cameraSaveFrame} with storage ${ns}:temp csf
    # Save changes.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Operate on the rest of the selected frames to add the carryover camera data.
    ${operationOnSelectedFrames} {mode: "saveCamera"}
    # Remove the temporary scoreboard and other trailing data.
    data remove storage ${ns}:temp csf
    scoreboard objectives remove ${ns}-camclose
`

// Asks the user for an offset to move all selected frames by.
moveFramesShowDialog`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog"}
    # Log the function call
    ${debug.run} {input: "moveFramesShowDialog"}
    # Log the expected path
    ${debug.path} {input: "-> grabAnimationFromUuid -> ^ no selection -> operationOnSelectedFrames -> show Move Selected Frames dialog"}
    # Grab animation data (just for the check below)
    ${grabAnimationFromUuid} with entity @s
    # If no frames are selected, error and exit. Warn the player in the process.
    execute unless data storage ${ns}:animation_data new.frames[].selected run return run ${a`
        # Remove leftover data in new, which was opened just to check if any frames were selected.
        data remove storage ${ns}:animation_data new
        # Log error
        ${debug.error} {input: "No frames are selected!"}
        # Warn the user that they must select frames first.
        tellraw @s {text: "Please select some frames first!", color:red}
    `}
    # Execute operationOnSelectedFrames with the calcBounds operation.
    ${operationOnSelectedFrames} {mode: "calcBounds"}
    # Create an offset macro key insert in storage for the dialog to use.
    data modify storage ${ns}:temp csfbounds.offsetinsert set value "$(offset)"
    # Using the bounds, generate and show the dialog to the user.
    ${a`
        $dialog show @s {type:"minecraft:multi_action",title:"Move Selected Frames",inputs:[{type:"minecraft:number_range",key:"offset",label:"Offset",start:-$(lower),end:$(upper),step:1,initial:0}],exit_action:{label:"Cancel"},actions:[{label:"Move Frames",tooltip:"Takes each frame's # and applies the offset to move them that amount within the animation. + is later, - is earlier.",action:{type:"minecraft:dynamic/run_command",template:"function easy-anim:animation/grab_offset_and_operate {offset: $(offsetinsert)}"}}]}
    `} with storage ${ns}:temp csfbounds
    # Clean up trailing data
    data remove storage ${ns}:temp csfbounds
`

// Tosses the given offset into carryover and calls operationOnSelectedFrames with the move operation.
grabOffsetAndOperate`
    # Log the function call
    $${debug.run} {input: "grabOffsetAndOperate with offset $(offset)"}
    # Create a scoreboard to test offset's sign
    scoreboard objectives add ${ns}-gao dummy
    # Store this offset into carryover for operationOnSelectedFrames to use.
    $data modify storage ${ns}:temp carryover.offset set value $(offset)
    execute store result score offset ${ns}-gao run data get storage ${ns}:temp carryover.offset
    # If offset is zero, we exit since you can't move a frame to itself...
    execute if score offset ${ns}-gao matches 0 run return run ${a`
        tellraw @s {text: "You can't move a frame to it's own location! Try an offset that isn't zero!", color: "red"}
        ${debug.error} {input: "User inputted an offset of 0 from move_frames dialog, exiting..."}
        data remove storage ${ns}:temp carryover.offset
        scoreboard objectives remove ${ns}-gao
    `}
    # Check if this value is negative, and if so, trigger a flag so that operationOnSelectedFrames can run in ascending order instead of descending order.
    execute if score offset ${ns}-gao matches ..-1 run data modify storage ${ns}:temp selectedframes.reverseCount set value true
    # Execute operationOnSelectedFrames with the move operation.
    ${operationOnSelectedFrames} {mode: "move"}
    # remove the scoreboard
    scoreboard objectives remove ${ns}-gao
`
