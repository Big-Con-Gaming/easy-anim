// This file should be used for functions that relate to the editor dimension, specifically with the player entering, exiting, etc.

// Sets up basic stuff.
import mcf from './mcf.js';
// Import functions needed here:
import * as debug from './debug.js';
import { grabAnimationFromUuid, grabPlayerAndAnimation, cleanUpNewAnimationData, grabPlayerData } from './data.js';
import { regroupEntities } from './entity.js';
import { exitSelection } from './selection.js';
import { retrieveFrame } from './storage.js';
import { clearSpecificFrame } from './animation/functions.js';
import { toggleSelectionState } from './animation/selecting.js';
import { calculateLaneX, unclaimLane, findPlayerAxisOffset } from './editor/lane.js';
import { axis } from './util.js';

const folder = mcf.editor;

// Define functions you want other files to use here:
export const {
    enterEditor, exit, reEnterEditor, checkFrameLoaded, checkAllFramesLoaded, finishEnterEditor
} = folder;

// Define local functions here:
const {
    anonymous: a, recPlaceFrames, recRemoveFrames, tpIntoEditor, newPlayerLane, recCheckLoaded,
    editorAnchorInData, cleanRemainder, eemacroSize, pullAnchorSizeExit, recRegroupLoadedFrames, recUnforceloadFrames
} = folder;

const ns = 'easy-anim';

// Item used within the editor to access the editor menu
const editor_menu_item = 'minecraft:carrot_on_a_stick[item_name={italic:false,text:"Editor Menu"}, item_model="minecraft:test_instance_block"]';

// Run when the player wants to enter the editor for an existing animation. Must be executed with the player as context.
const eemacroSizeCommands = [];

function createEemacroSize({axis, i}) {
    return`
        # Grab the ${axis} size of the first frame and store that into the macro.
        data modify storage ${ns}:temp eemacro.s${axis} set from storage ${ns}:temp eemacro.frames[0].size[${i}]
    `
}

eemacroSizeCommands.push(...axis.map(createEemacroSize));

eemacroSize(eemacroSizeCommands.join('\n'));

enterEditor`
    # Log the entry point
    ${debug.entry} {input: "from dialog enter_editor | from dialog main_menu editExistinAnimation"}
    # Log the function call
    $${debug.run} {input: "enterEditor for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabPlayerAndAnimation -> | newPlayerLane -> | findPlayerAxisOffset -> calculateLaneX -> recPlaceFrames (retrieveFrame -> editorAnchorInData -> regroupEntities) -> [exitSelection | cleanRemainder -> appendAllDataChanges] -> tpIntoEditor"}
    # Error if the player doesn't have a current animation.
    $execute unless data storage ${ns}:player_data players[{UUID:$(UUID)}].currentAnim run return run ${debug.error} {input: "Player has no current animation!"}
    # Remove possibly trailing data.
    data remove storage ${ns}:temp eemacro
    scoreboard objectives remove ${ns}-temp
    # Load the player's and animation's data.
    $${grabPlayerAndAnimation} {UUID:$(UUID)}
    # Warn if the player doesn't have a lane, and assign them one if so.
    $execute unless data storage ${ns}:player_data current.lane run ${newPlayerLane`
        ${debug.warn} {input: "Player doesn't have an editor lane! Assigning a new one..."}
        ${findPlayerAxisOffset}
        $data modify storage ${ns}:player_data players[{UUID:$(UUID)}].lane set from storage ${ns}:player_data current.lane
    `} {UUID:$(UUID)}
    # Warn if the animation has no frames, but still allow them to enter the editor.
    execute unless data storage ${ns}:animation_data new.frames[0] run ${debug.warn} {input: "Player's current animation has no frames! Continuing entry..."}
    # Set the player's real world location into storage to be used when they exit the editor.
    $data modify storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos set from entity @s Pos
    # Set the player's current dimension into storage to be used when they exit the editor.
    $data modify storage ${ns}:player_data players[{UUID:$(UUID)}].prevDim set from entity @s Dimension
    # Toss the name of the of the animation into macro data.
    data modify storage ${ns}:temp eemacro.name set from storage ${ns}:player_data current.currentAnim
    # Grab the lane's X and store it within temporary storage for a macro.
    ${calculateLaneX} {output: "${ns}:temp eemacro.x int"}
    # Store a list of all of the frames within the macro.
    data modify storage ${ns}:temp eemacro.frames set from storage ${ns}:animation_data new.frames
    # Set y to 0 so that the regrouping macro knows where to go.
    data modify storage ${ns}:temp eemacro.y set value 1
    ${eemacroSize}
    # Set the first Z offset to 2.
    data modify storage ${ns}:temp eemacro.z set value 2
    # Set i (frame #) to 0, representing the first frame:
    data modify storage ${ns}:temp eemacro.i set value 0
    # Set up a temporary scoreboard to be able to calculate offset and the iterative variable on the fly, and set its first value to 2.
    scoreboard objectives add ${ns}-temp dummy
    scoreboard players set offset ${ns}-temp 2
    scoreboard players set i ${ns}-temp 0
    # Add UUID to macro context.
    $data modify storage ${ns}:temp eemacro.UUID set value $(UUID)
    execute if data storage ${ns}:animation_data new.frames[0] run ${recPlaceFrames`
        # Log the function call
        $${debug.run} {input: "recPlaceFrames at $(x) 0 $(z) for frame $(i) of animation $(name) with size $(sx) $(sy) $(sz)"}
        # Makes sure this entire animation is loaded
        $execute in ${ns}:editor positioned $(x) 0 $(z) run forceload add ~ ~ ~47 ~47
        # Retrieve structure data in case it was unloaded.
        $${retrieveFrame} {framenum: $(i)}
        # Place the frame's structure in. i = frame#
        $execute in ${ns}:editor run place template ${ns}:$(name)-frame$(i) $(x) 1 $(z) none none 1 1 strict
        # Toss the editor's anchor point for this frame into storage. We use a temporary marker's position to place it in.
        $execute in ${ns}:editor positioned $(x) 1 $(z) align xyz summon minecraft:marker run ${editorAnchorInData`
            # Log the function call
            ${debug.run} {input: "editorAnchorInData"}
            $data modify storage ${ns}:animation_data new.frames[$(i)].eanchor set from entity @s Pos
            kill @s
        `} with storage ${ns}:temp eemacro
        # Mark this frame for loaded check so that we can regroup entities after all frames are loaded.
        $data modify storage ${ns}:temp waitingLoaded[{UUID: $(UUID)}].frames append value {framenum: $(i), x: $(x), z: $(z), sx: $(sx), sy: $(sy), sz: $(sz)}
        # Tag this player so that we can check if they are waiting for all frames to load.
        execute unless entity @s[tag=${ns}-waitLoadEditor] run tag @s add ${ns}-waitLoadEditor
        # Warn if the structure block will replace a non-air block
        $execute in ${ns}:editor unless block $(x) 0 $(z) minecraft:air run ${debug.warn} {input: "Non-air block at $(x) 0 $(z)! Overwriting with structure block..."} 
        # Place in the frame's structure block
        $execute in ${ns}:editor run setblock $(x) 0 $(z) minecraft:structure_block{mode:"LOAD",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(i)",strict:true}
        # If the frame is supposed to be selected, run the selectFrame command to update it so.
        $execute in ${ns}:editor if data storage ${ns}:animation_data new.frames[$(i)].selected run ${toggleSelectionState} {framenum: $(i)}
        # Store the current size along the z axis for this frame.
        execute store result score zadd ${ns}-temp run data get storage ${ns}:temp eemacro.frames[0].size[2]
        # Remove the current frame from the list.
        data remove storage ${ns}:temp eemacro.frames[0]
        # If there's no more frames, return and end the recursive loop.
        execute unless data storage ${ns}:temp eemacro.frames[0] run return 1
        ${eemacroSize}
        # Combine the current offset with the newly found one from the size's z axis, and add 1 for more separation. Store directly into the macro storage.
        scoreboard players operation offset ${ns}-temp += zadd ${ns}-temp
        execute store result storage ${ns}:temp eemacro.z int 1 run scoreboard players add offset ${ns}-temp 1
        # Increment i and store that as well.
        execute store result storage ${ns}:temp eemacro.i int 1 run scoreboard players add i ${ns}-temp 1
        # Execute this recursive function once more.
        ${recPlaceFrames} with storage ${ns}:temp eemacro
    `} with storage ${ns}:temp eemacro
    # Return the player's original inventory (in case they were coming from the selection menu).
    # This also cleans up almost all of our extra data, and sets the animation's location to editor.
    execute if data storage ${ns}:animation_data {new:{location:"anchor"}} run ${a`
        ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
        ${exitSelection} with entity @s
    `}
    execute unless data storage ${ns}:animation_data {new:{location:"anchor"}} run ${cleanRemainder`
        data modify storage ${ns}:animation_data new.location set value "editor"
        ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    `}
    # Remove temporary data.
    data remove storage ${ns}:temp eemacro
    scoreboard objectives remove ${ns}-temp
    # Notify the player that they are being teleported into the editor. (In case it takes a while to load all of the frames.)
    tellraw @s {text: "Teleporting into the editor...", color: "green"}
    # Check if all frames have been loaded and are ready for regrouping entities.
    ${checkAllFramesLoaded} {location: "waitingLoaded", success: "${finishEnterEditor} with entity @s"}
`;

const cornersToCheck = [0, 16, 32, 47];

const checkFrameLoadedPredicates = [];

for (let i = 0; i < cornersToCheck.length; i++) {
    for (let j = 0; j < cornersToCheck.length; j++) {
        checkFrameLoadedPredicates.push(`if loaded ~${cornersToCheck[i]} ~ ~${cornersToCheck[j]}`)
    }
}

// Executes at different points possibly in different chunks of a frame to see if all parts are loaded.
checkFrameLoaded`
    # Log the function call
    ${debug.run} {input: "checkFrameLoaded"}
    # This function is expected to be ran at an animation's anchor point.
    execute ${checkFrameLoadedPredicates.join(" ")} run return 1
    return fail
`

// Checks all of the frames in an animation to see if they are all loaded, and if so, enters the editor for the player.
checkAllFramesLoaded`
    # Log the function call
    $${debug.run} {input: "checkAllFramesLoaded for data located in $(location) running if success: $(success)"}
    # Log the function path
    $${debug.path} {input: "-> pull data -> (recCheckLoaded -> checkFrameLoaded) -> $(success)"}
    # Clear possibly trailing data
    data remove storage ${ns}:temp cafl
    scoreboard objectives remove ${ns}-cafl
    # Setup scoreboard
    scoreboard objectives add ${ns}-cafl dummy
    # Place needed data into temporary storage for a macro.
    data modify storage ${ns}:temp cafl.UUID set from entity @s UUID
    $data modify storage ${ns}:temp cafl.location set value $(location)
    # Pull the frame data from the given location.
    ${a`
        $data modify storage ${ns}:temp cafl.frames set from storage ${ns}:temp $(location)[{UUID: $(UUID)}].frames
    `} with storage ${ns}:temp cafl
    # Check all of the frames to see if they are all loaded.
    execute if data storage ${ns}:temp cafl.frames[0] store success score allLoaded ${ns}-cafl run ${recCheckLoaded`
        # Log the function call
        ${debug.run} {input: "recCheckLoaded"}
        # Reset thisframe's result
        scoreboard players reset thisframe ${ns}-cafl
        # Check this frame and store result.
        $execute in ${ns}:editor positioned $(x) 1 $(z) store success score thisframe ${ns}-cafl run ${checkFrameLoaded}
        # If this frame failed, return and end the recursive loop.
        execute if score thisframe ${ns}-cafl matches 0 run return fail
        # Remove the current frame from the list.
        data remove storage ${ns}:temp cafl.frames[0]
        # If there's no more frames, return and end the recursive loop.
        execute unless data storage ${ns}:temp cafl.frames[0] run return 1
        # Run the next recursive call.
        return run ${recCheckLoaded} with storage ${ns}:temp cafl.frames[0]
    `} with storage ${ns}:temp cafl.frames[0]
    # If all frames are loaded, run the given output function.
    $execute if score allLoaded ${ns}-cafl matches 1 run $(success)
    # Clear trailing data
    data remove storage ${ns}:temp cafl
    scoreboard objectives remove ${ns}-cafl
`

finishEnterEditor`
    # Log the function call
    ${debug.run} {input: "finishEnterEditor"}
    # Log the function path
    ${debug.path} {input: "-> grabPlayerData -> calculateLaneX -> tpIntoEditor"}
    # clear possibly trailing data
    data remove storage ${ns}:temp fee
    # pull the players data into current.
    ${grabPlayerData} with entity @s
    # Grab the lane's X and store it within temporary storage for a macro.
    ${calculateLaneX} {output: "${ns}:temp fee.x int"}
    # Pull the stored frame data from the waitingLoaded storage and place it into temporary storage for a macro.
    $data modify storage ${ns}:temp fee.frames set from storage ${ns}:temp waitingLoaded[{UUID: $(UUID)}].frames
    execute if data storage ${ns}:temp fee.frames[0] run ${recRegroupLoadedFrames`
        # Log the function call
        ${debug.run} {input: "regrouping the frames"}
        # Regroup all entities for this frame
        $execute in ${ns}:editor positioned $(x) 1 $(z) align xyz run ${regroupEntities} with storage ${ns}:temp fee.frames[0]
        # Remove this frame from the storage.
        data remove storage ${ns}:temp fee.frames[0]
        # If there are more frames to iterate through, run this function again.
        execute if data storage ${ns}:temp fee.frames[0] run ${recRegroupLoadedFrames} with storage ${ns}:temp fee.frames[0]
    `} with storage ${ns}:temp fee.frames[0]
    # Now that all entities have been regrouped, we can safely unforceload all of these frames.
    # Pull data AGAIN
    $data modify storage ${ns}:temp fee.frames set from storage ${ns}:temp waitingLoaded[{UUID: $(UUID)}].frames
    # Unforceload all of the frames that were loaded.
    execute if data storage ${ns}:temp fee.frames[0] run ${recUnforceloadFrames`
        # Log the function call
        ${debug.run} {input: "unforceloading the frames"}
        # unforceload all chunks for this frame
        $execute in ${ns}:editor positioned $(x) 1 $(z) align xyz run forceload remove ~ ~ ~47 ~47
        # Remove this frame from the storage.
        data remove storage ${ns}:temp fee.frames[0]
        # If there are more frames to iterate through, run this function again.
        execute if data storage ${ns}:temp fee.frames[0] run ${recUnforceloadFrames} with storage ${ns}:temp fee.frames[0]
    `} with storage ${ns}:temp fee.frames[0]
    # Remove the data in waitingLoaded.
    $data remove storage ${ns}:temp waitingLoaded[{UUID: $(UUID)}]
    # If waitingLoaded is empty, remove the whole structure.
    execute unless data storage ${ns}:temp waitingLoaded[0] run data remove storage ${ns}:temp waitingLoaded
    # Remove their waiting for editor load tag.
    tag @s remove ${ns}-waitLoadEditor
    # Just in case 0 0 was unforceloaded, add it back
    execute in ${ns}:editor run forceload add 0 0
    # Tag the player with inEditor so it is easier to track.
    tag @s add ${ns}-inEditor
    # Teleport the player into the editor dimension.
    ${tpIntoEditor`
        # Log the function call
        ${debug.run} {input: "tpIntoEditor"}
        $execute in ${ns}:editor run tp @s $(x) 3 0 0 0
    `} with storage ${ns}:temp fee
    # Give them the quick menu item. This item's data is stored as a constant above.
    execute unless items entity @s inventory.* ${editor_menu_item} unless items entity @s hotbar.* ${editor_menu_item} unless items entity @s weapon.* ${editor_menu_item} run give @s ${editor_menu_item}
    # clear trailing data
    data remove storage ${ns}:temp fee
`

reEnterEditor`
    # Log the function call
    ${debug.run} {input: "reEnterEditor"}
    # Log the function path
    ${debug.path} {input: "-> grabPlayerData -> calculateLaneX -> tpIntoEditor"}
    # Remove possibly trailing data
    data remove storage ${ns}:temp ree
    # Grab player data from UUID
    ${grabPlayerData} with entity @s
    # Grab the lane's X and store it within temporary storage for a macro.
    ${calculateLaneX} {output: "${ns}:temp ree.x int"}
    # Teleport the player back into the editor at their animation
    ${tpIntoEditor} with storage ${ns}:temp ree
    # Remove temporary data
    data remove storage ${ns}:temp ree
    data remove storage ${ns}:player_data current
    # Let the player know that if they want to leave they must exit through the editor item.
    tellraw @s {text:"If you wish to exit the editor, please use the editor menu to do such!", color:"red"}
`;

// Allows the player to exit the editor dimension.

const pullAnchorSizeExitCommands = [];

function createPullAnchorSizeExit({axis, i}) {
    return`
        data modify storage ${ns}:temp exit.a${axis} set from storage ${ns}:temp exit.frames[0].eanchor[${i}]
        data modify storage ${ns}:temp exit.s${axis} set from storage ${ns}:temp exit.frames[0].size[${i}]
        execute store result score sh${axis} ${ns}-exit run data get storage ${ns}:temp exit.s${axis}
        execute store result storage ${ns}:temp exit.sh${axis} int 1 run scoreboard players remove sh${axis} ${ns}-exit 1
    `;
}

pullAnchorSizeExitCommands.push(...axis.map(createPullAnchorSizeExit));

pullAnchorSizeExit(pullAnchorSizeExitCommands.join('\n'));

const exitCommands = [];

exitCommands.push(`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog"}
    # Log the function call
    $${debug.run} {input: "exit for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> recRemoveFrames (clearSpecificFrame) -> unclaimLane -> tp out -> cleanUpNewAnimationData"}
    # Error if the player is missing prevPos or prevDim data.
    $execute unless data storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos run return run ${debug.error} {input: "No prevPos data for player!"}
    $execute unless data storage ${ns}:player_data players[{UUID:$(UUID)}].prevDim run return run ${debug.error} {input: "No prevDim data for player!"}
    # Warn if the player is missing the inEditor tag.
    execute unless entity @s[tag=${ns}-inEditor] run ${debug.warn} {input: "Player is missing inEditor tag! Continuing anyway..."} 
    # Remove possibly trailing data.
    data remove storage ${ns}:temp exit
    scoreboard objectives remove ${ns}-exit
    scoreboard objectives add ${ns}-exit dummy
    # Grab animation data using UUID.
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Warn if the animation has no frames.
    execute unless data storage ${ns}:animation_data new.frames[0] run ${debug.warn} {input: "Animation has no frames! Skipping frame removal..."}
    # Clone the frames list into temporary storage so we can iterate through it.
    data modify storage ${ns}:temp exit.frames set from storage ${ns}:animation_data new.frames
    # Grab all the info for the first frame and place it in the macro storage.
    data modify storage ${ns}:temp exit.name set from storage ${ns}:animation_data new.name
    ${pullAnchorSizeExit}
    # Add a placeholder framenum as it is only needed for removing data and we are not doing that.
    data modify storage ${ns}:temp exit.framenum set value 0
    execute if data storage ${ns}:temp exit.frames[0] run ${recRemoveFrames`
        # Log the function call
        ${debug.run} {input: "recRemoveFrames"}
        # Remove the frame's structure from the editor.
        ${clearSpecificFrame} with storage ${ns}:temp exit
        # Remove the first frame from the list.
        data remove storage ${ns}:temp exit.frames[0]
        # If there's no more frames, return and end the recursive loop.
        execute unless data storage ${ns}:temp exit.frames[0] run return 1
        # Error if the next frame is missing eanchor or size, but don't return to remove future frames.
        execute unless data storage ${ns}:temp exit.frames[0].eanchor run ${debug.error} {input: "No eanchor data for next frame!"}
        execute unless data storage ${ns}:temp exit.frames[0].size run ${debug.error} {input: "No size data for next frame!"}
        # Grab all the info for the next frame and place it in the macro storage.
        ${pullAnchorSizeExit}
        # Loop
        ${recRemoveFrames} with storage ${ns}:temp exit
    `} with storage ${ns}:temp exit
    # Remove lane bedrock
    ${unclaimLane}
    # Return the player to the overworld at the anchor location. Grabs dimension data and the real world anchor coordinates.
    $data modify storage ${ns}:temp exit.dimension set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevDim
`);

function createExit({axis, i}) {
    return`
        $data modify storage ${ns}:temp exit.p${axis} set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos[${i}]
    `;
}

exitCommands.push(...axis.map(createExit));

exitCommands.push(`
    ${a`
        # Log the function call
        $${debug.run} {input: "tp out of editor to $(dimension) at $(px) $(py) $(pz)"}
        $execute in $(dimension) run tp @s $(px) $(py) $(pz)
    `} with storage ${ns}:temp exit
    # Remove the inEditor tag.
    tag @s remove ${ns}-inEditor
    # Remove the editor item from their inventory.
    clear @s ${editor_menu_item}
    # Set the animation's location to "none".
    data modify storage ${ns}:animation_data new.location set value "none"
    # Warn if the player is missing data
    $execute unless data storage ${ns}:player_data players[{UUID:$(UUID)}] run ${debug.warn} {input:"Player has no data at all! Skipping removal..."}
    # Clear the remainder of the player's data (not needed if not accessing a selection or animation)
    $data remove storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Save modifications made to the animation.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove trailing data.
    data remove storage ${ns}:temp exit
    scoreboard objectives remove ${ns}-exit
`);

exit(exitCommands.join('\n'));
