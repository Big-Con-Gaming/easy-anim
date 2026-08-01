// Sets up basic stuff.
import mcf from './mcf.js';
import * as debug from './debug.js';
import { calculateLaneX, unclaimLane, findPlayerAxisOffset } from './inventory.js';
import { recGroupSearch, regroupEntities, removeDocile, grabSizeAnchorEditor, cleanUpNewAnimationData, grabAnimationFromUuid, grabPlayerAndAnimation, exitSelection, appendAllDataChanges, turnEntityDocile } from './selection.js';
import { storeFrame, retrieveFrame, removeFrame } from './storage.js';
import { cameraSaveFrame, cameraLoadQueueFrame, toggleHighlightFrame, cameraClosest } from './camera.js';
import { cleanKill, testIfInt, stringEquals, arrayMoveEntry } from './util.js';
const folder = mcf.animation;
export const {
    enterEditor, selectInPlayerFrame, recPlaceFrames, editorAnchorInData, tpIntoEditor, clean, parseToggleSingleSelectFrame,
    parseToggleRangeSelectFrame, saveCameraCurrentFrame, recPlayerSearch, saveSpecificFrame, addNewFrame,
    toggleAllSelectFrame, clearSpecificFrame, pullNextFrameData, recMoveFrames, loadSpecificFrame, moveFrame,
    selectAllFrames, placeFrame, loadCameraCurrentFrame, toggleHighlightCurrentFrame, exit, recRemoveFrames,
    renumberFrame, modifyCurrentFrameDuration, operationOnSelectedFrames, cameraSaveFrameEnterIterate, insertSpace, duplicateFrame
} = folder;
const {
    anonymous: a, cleanRemainder, newPlayerLane, modifyFrameDurationDialog, setFrameDuration,
    toggleSelectionState, removeQuoteMacroInsertScore, recToggle, recSelectAll, selectFrame, deselectFrame,
    recSelectCheck, recOperate, grabFromRef
} = folder;
const ns = 'easy-anim';

const editor_menu_item = 'minecraft:carrot_on_a_stick[item_name={italic:false,text:"Editor Menu"}, item_model="minecraft:test_instance_block"]';

// Run when the player wants to enter the editor for an existing animation. Must be executed with the player as context.
enterEditor`
    # Log the entry point
    ${debug.entry} {input: "from dialog enter_editor | from dialog main_menu editExistinAnimation"}
    # Log the function call
    $${debug.run} {input: "enterEditor for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabPlayerAndAnimation -> | newPlayerLane -> | findPlayerAxisOffset -> calculateLaneX -> recPlaceFrames (retrieveFrame -> editorAnchorInData -> regroupEntities) -> [exitSelection | cleanRemainder -> appendAllDataChanges] -> tpIntoEditor"}
    # Error if the player doesn't have a current animation.
    $execute unless data storage ${ns}:player_data players[{UUID:$(UUID)}].currentAnim run return run ${debug.error} {input: "Player has no current animation!"}
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
    # Grab the x size of the first frame and store that into the macro.
    data modify storage ${ns}:temp eemacro.sx set from storage ${ns}:temp eemacro.frames[0].size[0]
    # Grab the y size of the first frame and store that into the macro.
    data modify storage ${ns}:temp eemacro.sy set from storage ${ns}:temp eemacro.frames[0].size[1]
    # Grab the z size of the first frame and store that into the macro.
    data modify storage ${ns}:temp eemacro.sz set from storage ${ns}:temp eemacro.frames[0].size[2]
    # Set the first Z offset to 2.
    data modify storage ${ns}:temp eemacro.z set value 2
    # Set i (frame #) to 0, representing the first frame:
    data modify storage ${ns}:temp eemacro.i set value 0
    # Set up a temporary scoreboard to be able to calculate offset and the iterative variable on the fly, and set its first value to 2.
    scoreboard objectives add ${ns}-temp dummy
    scoreboard players set offset ${ns}-temp 2
    scoreboard players set i ${ns}-temp 0
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
        # Regroup all grouped entities
        $execute in ${ns}:editor positioned $(x) 1 $(z) run ${regroupEntities} with storage ${ns}:temp eemacro
        # Warn if the structure block will replace a non-air block
        $execute in ${ns}:editor unless block $(x) 0 $(z) minecraft:air run ${debug.warn} {input: "Non-air block at $(x) 0 $(z)! Overwriting with structure block..."} 
        # Place in the frame's structure block
        $execute in ${ns}:editor run setblock $(x) 0 $(z) minecraft:structure_block{mode:"LOAD",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(i)",strict:true}
        # If the frame is supposed to be selected, run the selectFrame command to update it so.
        $execute in ${ns}:editor if data storage ${ns}:animation_data new.frames[$(i)].selected run ${selectFrame} {ax: $(x), ay: 1, az: $(z), sx: $(sx), sy: $(sy), sz: $(sz), framenum: $(i)}
        # Store the current size along the z axis for this frame.
        execute store result score zadd ${ns}-temp run data get storage ${ns}:temp eemacro.frames[0].size[2]
        # Remove the current frame from the list.
        data remove storage ${ns}:temp eemacro.frames[0]
        # If there's no more frames, return and end the recursive loop.
        execute unless data storage ${ns}:temp eemacro.frames[0] run return 1
        # Grab the x size and store that into the macro.
        data modify storage ${ns}:temp eemacro.sx set from storage ${ns}:temp eemacro.frames[0].size[0]
        # Grab the y size and store that into the macro.
        data modify storage ${ns}:temp eemacro.sy set from storage ${ns}:temp eemacro.frames[0].size[1]
        # Grab the z size and store that into the macro.
        data modify storage ${ns}:temp eemacro.sz set from storage ${ns}:temp eemacro.frames[0].size[2]
        # Combine the current offset with the newly found one from the size's z axis, and add 1 for more separation. Store directly into the macro storage.
        scoreboard players operation offset ${ns}-temp += zadd ${ns}-temp
        execute store result storage ${ns}:temp eemacro.z int 1 run scoreboard players add offset ${ns}-temp 1
        # Increment i and store that as well.
        execute store result storage ${ns}:temp eemacro.i int 1 run scoreboard players add i ${ns}-temp 1
        # Execute this recursive function once more.
        ${recPlaceFrames} with storage ${ns}:temp eemacro
        # Remove this forceloaded area
        $execute in ${ns}:editor positioned $(x) 0 $(z) run forceload remove ~ ~ ~47 ~47
    `} with storage ${ns}:temp eemacro
    # Just in case 0 0 was unforceloaded, add it back
    execute in ${ns}:editor run forceload add 0 0
    # Tag the player with inEditor so it is easier to track.
    tag @s add ${ns}-inEditor
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
    
    # Teleport the player into the editor dimension.
    ${tpIntoEditor`
        # Log the function call
        ${debug.run} {input: "tpIntoEditor"}
        $execute in ${ns}:editor run tp @s $(x) 3 0 0 0
    `} with storage ${ns}:temp eemacro
    # Remove temporary data.
    data remove storage ${ns}:temp eemacro
    scoreboard objectives remove ${ns}-temp
    # Give them the quick menu item. This item's data is stored as a constant above.
    execute unless items entity @s inventory.* ${editor_menu_item} unless items entity @s hotbar.* ${editor_menu_item} unless items entity @s weapon.* ${editor_menu_item} run give @s ${editor_menu_item}
`;

// Modifies all data needed to make the given frame selected
selectFrame`
    # Log the function call
    $${debug.run} {input: "selectFrame for frame $(framenum) at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz)"}
    # Warn if the frame is already selected
    $execute if data storage ${ns}:animation_data new.frames[$(framenum)].selected run ${debug.warn} {input: "Frame is already selected! Running anyway..."}
    # Set the frame's selected value to true.
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].selected set value true
    # Warn if the structure block is missing.
    $execute positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~ minecraft:structure_block run ${debug.warn} {input: "Missing structure block for frame! Unable to show bounding box!"}
    # Make the bounding box visible.
    $execute positioned $(ax) $(ay) $(az) run data modify block ~ ~-1 ~ showboundingbox set value true
    # tag all entities from being selected.
    $execute positioned $(ax) $(ay) $(az) run tag @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=!${ns}-selected] add ${ns}-selected
`;

// Modifies all data needed to make the given frame deselected
deselectFrame`
    # Log the function call
    $${debug.run} {input: "deselectFrame for frame $(framenum) at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz)"}
    # Warn if the frame isn't selected
    $execute unless data storage ${ns}:animation_data new.frames[$(framenum)].selected run ${debug.warn} {input: "Frame isn't selected! Running anyway..."}
    # Set the frame's selected value to false.
    $data remove storage ${ns}:animation_data new.frames[$(framenum)].selected
    # Warn if the structure block is missing.
    $execute positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~ minecraft:structure_block run ${debug.warn} {input: "Missing structure block for frame! Unable to hide bounding box!"}
    # Make the bounding box invisible.
    $execute positioned $(ax) $(ay) $(az) run data modify block ~ ~-1 ~ showboundingbox set value false
    # Untag all entities from being selected.
    $execute positioned $(ax) $(ay) $(az) run tag @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-selected] remove ${ns}-selected
`;

// Toggles the selection state of the provided frame number.
toggleSelectionState`
    # Log the function call
    $${debug.run} {input: "toggleSelectionState for frame $(framenum)"}
    # Error if frame data is missing (in general).
    $execute unless data storage ${ns}:animation_data new.frames[$(framenum)] run return run ${debug.error} {input: "Frame is missing all data!"}
    # Stores the current state and flips depending on that old state.
    scoreboard objectives add ${ns}-tss dummy
    $execute store result score selected ${ns}-tss run data get storage ${ns}:animation_data new.frames[$(framenum)].selected
    # Grab the needed data about the frame
    $${grabSizeAnchorEditor} {framenum: $(framenum)}
    # Place framenum into grabsizeanchor (other incoming functions may not have it stored there.)
    $data modify storage ${ns}:temp grabsizeanchor.framenum set value $(framenum)
    # Warn if the selected score is missing entirely.
    execute unless score selected ${ns}-tss matches 0.. run ${debug.error} {input: "selected score has no value! Unable to select or deselect..."}
    execute if score selected ${ns}-tss matches 1 run ${deselectFrame} with storage ${ns}:temp grabsizeanchor
    execute if score selected ${ns}-tss matches 0 run ${selectFrame} with storage ${ns}:temp grabsizeanchor
    # Clean up trailing data
    scoreboard objectives remove ${ns}-tss
    data remove storage ${ns}:temp grabsizeanchor
`;

// Finds which frame the player is currently located in and selects it.
// Input: UUID = player's UUID
selectInPlayerFrame`
    # Log the entry point
    ${debug.entry} {input: "from modify_selection dialog"}
    # Log the function call
    $${debug.run} {input: "selectInPlayerFrame for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> grabSizeAnchorEditor -> recPlayerSearch (^ toggleSelectionState -> grabSizeAnchorEditor) -> cleanUpNewAnimationData"}
    # Grab animation_data using UUID
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Error but don't return if the animation has no frames.
    execute unless data storage ${ns}:animation_data new.frames[0] run ${debug.error} {input: "Player's current animation has no frames!"}
    # Grab the animation name
    data modify storage ${ns}:temp grabsizeanchor.name set from storage ${ns}:animation_data new.name
    # Place UUID into macro
    $data modify storage ${ns}:temp grabsizeanchor.UUID set value $(UUID)
    # Set up a scoreboard for the iterative var used within the saveSpecificFrame macro
    scoreboard objectives add ${ns}-sipf dummy
    execute store result storage ${ns}:temp grabsizeanchor.framenum int 1 run scoreboard players set i ${ns}-sipf 0
    # Grab the framecount
    execute store result score framecount ${ns}-sipf store result storage ${ns}:temp grabsizeanchor.framecount int 1 run data get storage ${ns}:animation_data new.framecount
    # Pull specific data into the macro for the first frame.
    execute if score framecount ${ns}-sipf matches 1.. run ${grabSizeAnchorEditor} {framenum: 0}
    execute if score framecount ${ns}-sipf matches 1.. run ${recPlayerSearch`
        # Log the function call
        $${debug.run} {input: "recPlayerSearch at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz) for $(name) frame $(framenum) out of $(framecount) player $(UUID)"}
        # If the player is within this frame's bounding box, toggle it.
        $execute in ${ns}:editor positioned $(ax) $(ay) $(az) if entity @p[dx=$(sx), dy=$(sy), dz=$(sz)] run return run ${toggleSelectionState} with storage ${ns}:temp grabsizeanchor
        # Iterate framenum
        execute store result storage ${ns}:temp grabsizeanchor.framenum int 1 run scoreboard players add i ${ns}-sipf 1
        # Grab the next frame's data
        ${grabSizeAnchorEditor} with storage ${ns}:temp grabsizeanchor
        # Unless framecount is equal or greater than the iterative variable, do another recursive search.
        execute unless score i ${ns}-sipf >= framecount ${ns}-sipf run ${recPlayerSearch} with storage ${ns}:temp grabsizeanchor
    `} with storage ${ns}:temp grabsizeanchor
    # Clean up remaining data
    data remove storage ${ns}:temp grabsizeanchor
    scoreboard objectives remove ${ns}-sipf
    # Set animation_data new to the player's animation
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # All frame selection commands that interface with the modify_selection dialog will bring the player back to the menu
    dialog show @s ${ns}:editor_menu
`;

// Given a frame number either from a slider or a text box, toggle that frame's selection state.
parseToggleSingleSelectFrame`
    # Log the entry point
    ${debug.entry} {input: "from modify_selection dialog"}
    # Log the function call
    $${debug.run} {input: "parseToggleSingleSelectFrame for frame $(firstselectbar) or $(firstselecttext) for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> | testIfInt -> grab size -> toggleSelectionState"}
    # Need to figure out which input is used, use text first but if empty use bar, place the frame's size into a macro for toggleSelectionState and then clean up the data after.
    # Create a temporary scoreboard.
    scoreboard objectives add ${ns}-ptssf dummy
    # Test if the macro from the text input is an int, if so use that, if not use the text bar input.
    $execute store success score numtest ${ns}-ptssf run ${testIfInt} {input: '$(firstselecttext)'}
    # Warn if numtest has no value.
    execute unless score numtest ${ns}-ptssf matches 0.. run ${debug.error} {input: "numtest has no value! Unable to assign a framenum..."}
    $execute if score numtest ${ns}-ptssf matches 1 run data modify storage ${ns}:temp temptoggle.framenum set value '$(firstselecttext)'
    $execute if score numtest ${ns}-ptssf matches 0 run data modify storage ${ns}:temp temptoggle.framenum set value $(firstselectbar)
    # Grab animation_data
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Run the toggleSelectionState.
    ${toggleSelectionState} with storage ${ns}:temp temptoggle
    # Clear trailing data
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    data remove storage ${ns}:temp temptoggle
    scoreboard objectives remove ${ns}-ptssf
    # All frame selection commands that interface with the modify_selection dialog will bring the player back to the menu
    dialog show @s ${ns}:editor_menu
`;

// Helper method for placing a possible text entry into a score.
removeQuoteMacroInsertScore`
    $scoreboard players set $(name) ${ns}-temptoggle $(num)
`

// Given 2 frame numbers either from a slider or a text box, toggle all of the frames' selection state between those numbers.
parseToggleRangeSelectFrame`
    # Log the entry point
    ${debug.entry} {input: "from modify_selection dialog"}
    # Log the function call
    $${debug.run} {input: "parseToggleRangeSelectFrame from frame $(firstselectbar) or $(firstselecttext) to frame $(secondselectbar) or $(secondselecttext) for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> | testIfInt x2 -> grabAnimationFromUuid -> (recToggle -> toggleSelectionState)"}
    # Need to figure out which input is used, use text first but if empty use bar, place the frame's size into a macro for toggleSelectionState and then clean up the data after.
    # Create a temporary scoreboard.
    scoreboard objectives add ${ns}-temptoggle dummy
    # Test if the first macro from the text input is an int, if so use that, if not use the text bar input. Placing into a score so that we can find the difference.
    $execute store success score numtest ${ns}-temptoggle run ${testIfInt} {input: '$(firstselecttext)'}
    # This has to be placed in a separate function so that we can use firstselecttext without quotes.
    # We're only allowed to since the previous function checked if it is a valid number for us already.
    execute unless score numtest ${ns}-temptoggle matches 0.. run ${debug.error} {input: "numtest has no value! Unable to assign a first framenum..."}
    $execute if score numtest ${ns}-temptoggle matches 1 run ${removeQuoteMacroInsertScore} {name: "start", num: '$(firstselecttext)'}
    $execute if score numtest ${ns}-temptoggle matches 0 run scoreboard players set start ${ns}-temptoggle $(firstselectbar)
    # Test if the second macro from the text input is an int, if so use that, if not use the text bar input. Placing into a score so that we can find the difference.
    $execute store success score numtest2 ${ns}-temptoggle run ${testIfInt} {input: '$(secondselecttext)'}
    execute unless score numtest2 ${ns}-temptoggle matches 0.. run ${debug.error} {input: "numtest2 has no value! Unable to assign a second framenum..."}
    $execute if score numtest2 ${ns}-temptoggle matches 1 run ${removeQuoteMacroInsertScore} {name: "end", num: '$(secondselecttext)'}
    $execute if score numtest2 ${ns}-temptoggle matches 0 run scoreboard players set end ${ns}-temptoggle $(secondselectbar)
    # From the two, figure out min and max.
    scoreboard players operation max ${ns}-temptoggle = start ${ns}-temptoggle
    scoreboard players operation max ${ns}-temptoggle > end ${ns}-temptoggle
    scoreboard players operation min ${ns}-temptoggle = start ${ns}-temptoggle
    scoreboard players operation min ${ns}-temptoggle < end ${ns}-temptoggle
    # Set up the first framenum (equal to min)
    execute store result storage ${ns}:temp temptoggle.framenum int 1 run scoreboard players get min ${ns}-temptoggle
    # Grab animation_data
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Place the frame's size into macro storage for toggleSelectionState
    ${recToggle`
        # Log the function call
        $${debug.run} {input: "recToggle for $(framenum)"}
        # Run the toggleSelectionState.
        ${toggleSelectionState} with storage ${ns}:temp temptoggle
        # Iterate framenum
        execute store result storage ${ns}:temp temptoggle.framenum int 1 run scoreboard players add min ${ns}-temptoggle 1
        # Unless min is now greater than max, recursively call this function.
        execute unless score min ${ns}-temptoggle > max ${ns}-temptoggle run ${recToggle} with storage ${ns}:temp temptoggle
    `} with storage ${ns}:temp temptoggle
    # Clear trailing data
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    data remove storage ${ns}:temp temptoggle
    scoreboard objectives remove ${ns}-temptoggle
    # All frame selection commands that interface with the modify_selection dialog will bring the player back to the menu
    dialog show @s ${ns}:editor_menu
`;

// Toggles all of the frames' selection states within an animation.
toggleAllSelectFrame`
    # Log the entry point
    ${debug.entry} {input: "from modify_selection dialog"}
    # Log the function call
    $${debug.run} {input: "toggleAllSelectFrame for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> (recToggle -> toggleSelectionState)"}
    # Grab animation_data
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Create a temporary scoreboard.
    scoreboard objectives add ${ns}-temptoggle dummy
    # Store the framecount as the max for the recursive function. (Error if missing but continue execution)
    execute unless data storage ${ns}:animation_data new.framecount run ${debug.error} {input: "Missing framecount!"}
    execute store result score max ${ns}-temptoggle run data get storage ${ns}:animation_data new.framecount
    # Decrease max by 1 so that we don't include a nonexistent frame.
    scoreboard players remove max ${ns}-temptoggle 1
    # Set up the first framenum (equal to 0)
    execute store result storage ${ns}:temp temptoggle.framenum int 1 run scoreboard players set min ${ns}-temptoggle 0
    # Use the recursive function defined in the previous function to toggle all frames.
    ${recToggle} with storage ${ns}:temp temptoggle
    # Clear trailing data
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    data remove storage ${ns}:temp temptoggle
    scoreboard objectives remove ${ns}-temptoggle
    # All frame selection commands that interface with the modify_selection dialog will bring the player back to the menu
    dialog show @s ${ns}:editor_menu
`

// Selects all of the frames within an animation.
// INPUT: UUID: the player who is executing this command's UUID. select: 1 indicates selecting all, -1 indicates deselecting all.
selectAllFrames`
    # Log the entry point
    ${debug.entry} {input: "from modify_selection dialog"}
    # Log the function call
    $${debug.run} {input: "selectAllFrames for $(UUID) select(1)/deselect(-1): $(select)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> grabSizeAnchorEditor -> (recSelectAll)"}
    # Create a temporary scoreboard
    scoreboard objectives add ${ns}-temptoggle dummy
    # Place select into this scoreboard
    $scoreboard players set select ${ns}-temptoggle $(select)
    # Grab animation_data
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Store the framecount as the max for the recursive function. (Error if missing but continue execution)
    execute unless data storage ${ns}:animation_data new.framecount run ${debug.error} {input: "Missing framecount!"}
    execute store result score max ${ns}-temptoggle run data get storage ${ns}:animation_data new.framecount
    # Decrease max by 1 so that we don't include a nonexistent frame.
    scoreboard players remove max ${ns}-temptoggle 1
    # Set up the first framenum (equal to 0) and store the next one as well.
    data modify storage ${ns}:temp grabsizeanchor.framenum set value 0
    execute store result score min ${ns}-temptoggle run data modify storage ${ns}:temp grabsizeanchor.framenext set value 1
    # Grab the size and anchor of the next frame.
    ${grabSizeAnchorEditor} {framenum: 0}
    # Recursively select all frames
    ${recSelectAll`
        # Log the function call
        $${debug.run} {input: "recSelectAll for $(framenum)"}
        # Select (or deselect) this current frame. (Error if missing)
        execute unless score select ${ns}-temptoggle matches -1.. run ${debug.error} {input: "select in ${ns}-temptoggle score is missing! Unable to select or deselect!"}
        execute if score select ${ns}-temptoggle matches 1 run ${selectFrame} with storage ${ns}:temp grabsizeanchor
        execute if score select ${ns}-temptoggle matches -1 run ${deselectFrame} with storage ${ns}:temp grabsizeanchor
        # Exit the loop if this is the last frame.
        execute if score min ${ns}-temptoggle > max ${ns}-temptoggle run return 1
        # iterate framenum and framenext.
        data modify storage ${ns}:temp grabsizeanchor.framenum set from storage ${ns}:temp grabsizeanchor.framenext
        execute store result storage ${ns}:temp grabsizeanchor.framenext int 1 run scoreboard players add min ${ns}-temptoggle 1
        # Grab the next frame's size and store that into the macro for the next loop.
        $${grabSizeAnchorEditor} {framenum: $(framenext)}
        # Recursively call this function.
        ${recSelectAll} with storage ${ns}:temp grabsizeanchor
    `} with storage ${ns}:temp grabsizeanchor
    # Remove trailing data.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    scoreboard objectives remove ${ns}-temptoggle
    data remove storage ${ns}:temp grabsizeanchor
    # All frame selection commands that interface with the modify_selection dialog will bring the player back to the menu
    dialog show @s ${ns}:editor_menu
`

// Saves a specific frame within the editor to the structure file. Ungroups entities beforehand and regroups them after.
// Needs this input from a macro: a[x, y, z] = anchor coordinates, s[x, y, z] = size parameters, name = animation name, framenum = frame number. 
saveSpecificFrame`
    # Log the function call
    $${debug.run} {input: "saveSpecificFrame at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz) for $(name) frame $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> recGroupSearch -> removeDocile -> storeFrame -> regroupEntities"}
    # Ungroup all of the entities within the frame, reusing functions from the create animation function within menu.
    data modify storage ${ns}:temp str.id set value 0
    # All important data needs to be placed into str for the old recGroupSearch function to work. I feel like there's a better way to do this.
    $data modify storage ${ns}:temp str.sx set value $(sx)
    $data modify storage ${ns}:temp str.sy set value $(sy)
    $data modify storage ${ns}:temp str.sz set value $(sz)
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run ${recGroupSearch} with storage ${ns}:temp str
    # Untag them from selected and remove docile for all entities within the frame.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run tag @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-selected] remove ${ns}-selected
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-entity-turned-docile] run ${removeDocile}
    # Warn if the structure block will replace a non-air block
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~ minecraft:air unless block ~ ~-1 ~ minecraft:structure_block run ${debug.warn} {input: "Non-air and Non-structure block at $(ax) ($(ay) - 1) $(az)! Overwriting with structure block..."}
    # Make sure the frame's structure block is there.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~ minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
    # Warn if the redstone block will be replacing a non-air block
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) unless block ~-1 ~-1 ~ minecraft:air run ${debug.warn} {input: "Non-air block at ($(ax) - 1) ($(ay) - 1) $(az)! Overwriting with redstone block..."}
    # Save the frame
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~-1 ~-1 ~ minecraft:redstone_block
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~-1 ~-1 ~ minecraft:air
    # Place back into LOAD mode for visual bounding box toggle.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~ minecraft:structure_block{mode:"LOAD",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
    # Store structure data since it changed.
    $${storeFrame} {framenum: $(framenum)}
    # Tag them all again with selected.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run tag @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-selected] add ${ns}-selected
    # Regroup all entities.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run ${regroupEntities} with storage ${ns}:temp str
    # Remove all trailing data.
    data remove storage ${ns}:temp str
`;

// Clears a specific frame within the editor. This removes all blocks and entities within the frame's area.
// Needs this input from a macro: a[x, y, z] = anchor coordinates, s[x, y, z] = size parameters, name = animation name, framenum = frame number.
clearSpecificFrame`
    # Log the function call
    $${debug.run} {input: "clearSpecificFrame at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz) for $(name) frame $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> /fill air -> cleanKill -> | pullNextFrameData -> (| recMoveFrames) -> | removeFrameData"}
    # Create a scoreboard and shrink size by 1 in each axis to be accurate for relative coordinates.
    scoreboard objectives add ${ns}-csf dummy
    $scoreboard players set x ${ns}-csf $(sx)
    $scoreboard players set y ${ns}-csf $(sy)
    $scoreboard players set z ${ns}-csf $(sz)
    execute store result storage ${ns}:temp csf.sx int 1 run scoreboard players remove x ${ns}-csf 1
    execute store result storage ${ns}:temp csf.sy int 1 run scoreboard players remove y ${ns}-csf 1
    execute store result storage ${ns}:temp csf.sz int 1 run scoreboard players remove z ${ns}-csf 1
    # Place anchor into the new macro storage.
    $data modify storage ${ns}:temp csf.ax set value $(ax)
    $data modify storage ${ns}:temp csf.ay set value $(ay)
    $data modify storage ${ns}:temp csf.az set value $(az)
    # Fill the area with air.
    ${a`
        # Log the function call
        $${debug.run} {input: "/fill air within ${ns}:editor at $(ax) $(ay) $(az) to $(sx) $(sy) $(sz)"}
        $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run fill ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) minecraft:air strict
    `} with storage ${ns}:temp csf
    # Warn if there are no entites to kill.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) unless entity @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-entity-turned-docile] run ${debug.warn} {input: "No entities within frame! Skipping..."}
    # Kill all entities within the area, using cleanKill to make sure nothing is left behind.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-entity-turned-docile] run ${cleanKill}
    # Place name into macro storage for future use.
    $data modify storage ${ns}:temp csf.name set value $(name)
    # Warn if there's no structure block to remove.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~ minecraft:structure_block run ${debug.warn} {input: "No structure block to remove at $(ax) ($(ay) - 1) $(az)! Skipping..."}
    # Remove the structure block.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) if block ~ ~-1 ~ minecraft:structure_block run setblock ~ ~-1 ~ minecraft:air strict
    # Store this frame's z size for offseting the rest of the frames.
    execute store result score diff ${ns}-csf run data get storage ${ns}:temp csf.sz
    execute store result storage ${ns}:temp csf.diff int 1 run scoreboard players add diff ${ns}-csf 2
    # Grab the current frame number into scoreboard and storage.
    $execute store result storage ${ns}:temp csf.currentframe int 1 run scoreboard players set nextframe ${ns}-csf $(framenum)
    # grab the framecount.
    $execute store result score remainder ${ns}-csf store result score target ${ns}-csf run data get storage ${ns}:animation_data animations[{name:$(name)}].data.framecount
    # Subtract by the current frame number to see how many frames are left. We remove one since framenum starts at 0 while length starts at 1.
    scoreboard players operation remainder ${ns}-csf -= nextframe ${ns}-csf
    scoreboard players remove remainder ${ns}-csf 1
    # Calculate the next frame.
    execute if score remainder ${ns}-csf matches 1.. store result storage ${ns}:temp csf.nextframe int 1 run scoreboard players add nextframe ${ns}-csf 1
    # Place the namespace into storage
    data modify storage ${ns}:temp csf.namespace set value "csf"
    # Make sure recFrames operates backwards using neg
    data modify storage ${ns}:temp csf.neg set value "-"
    # Store the data for the next frame into macro storage for quick access. Used in the recursive function below as well.
    execute if data storage ${ns}:temp {csf:{shift:true}} if score remainder ${ns}-csf matches 1.. run ${pullNextFrameData} with storage ${ns}:temp csf
    # Renumber and move all subsequent frames recursively.
    execute in ${ns}:editor if data storage ${ns}:temp {csf:{shift:true}} if score remainder ${ns}-csf matches 1.. run ${recMoveFrames} with storage ${ns}:temp csf
    # If removeData is true, then remove the frame's data from storage and decrease framecount.
    $execute if data storage ${ns}:temp {csf:{removeData:true}} run ${a`
        # Log the function call
        $${debug.run} {input: "removing frame data for $(framenum)"}
        execute store result score framecount ${ns}-csf run data get storage ${ns}:animation_data new.framecount
        execute store result storage ${ns}:animation_data new.framecount int 1 run scoreboard players remove framecount ${ns}-csf 1
        # If shift is true, remove the frame at the end from storage. If shift was false, remove this framenum's frame.
        execute if data storage ${ns}:temp {csf:{shift:true}} run ${a`
            $${removeFrame} {framenum:$(framecount)}
        `} with storage ${ns}:animation_data new
        # error if there's no frame data to remove.
        $execute unless data storage ${ns}:animation_data new.frames[$(framenum)] run return run ${debug.error} {input: "No frame data to remove for frame $(framenum)!"}
        $execute unless data storage ${ns}:temp {csf:{shift:true}} run ${removeFrame} {framenum:$(framenum)}
        # Remove frame data from command storage. Has to be after so that framecount uses the correct data to remove the frame at the end.
        $data remove storage ${ns}:animation_data new.frames[$(framenum)]
    `} {framenum: $(framenum)}

    # Clear trailing data.
    scoreboard objectives remove ${ns}-csf
    data remove storage ${ns}:temp csf
`;

// Loads a specific frame within the editor. This places all blocks and entities back into the world.
// Needs this input from a macro: a[x, y, z] = anchor coordinates, s[x, y, z] = size parameters, name = animation name, framenum = frame number.
loadSpecificFrame`
    # Log the function call
    $${debug.run} {input: "loadSpecificFrame at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz) for $(name) frame $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> clearSpecificFrame -> retrieveFrame -> regroupEntities"}
    # First, clear the specific frame so that there are no overlapping entities or blocks.
    $${clearSpecificFrame} {name: $(name), framenum: $(framenum), ax: $(ax), ay: $(ay), az: $(az), sx: $(sx), sy: $(sy), sz: $(sz)}
    # Retrieve structure data in case it was unloaded.
    $${retrieveFrame} {framenum: $(framenum)}
    # Place the frame's structure in.
    $execute in ${ns}:editor run place template ${ns}:$(name)-frame$(framenum) $(ax) $(ay) $(az) none none 1 1 strict
    # Warn if the structure block will replace a non-air block
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~ minecraft:air run ${debug.warn} {input: "Non-air block at $(ax) ($(ay) - 1) $(az)! Overwriting with structure block..."}
    # Place in the structure block.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~ minecraft:structure_block{mode:"LOAD",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
    # Tag all of the entities with selected.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run tag @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-selected] add ${ns}-selected
    # Regroup all grouped entities
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run ${regroupEntities} {sx: $(sx), sy: $(sy), sz: $(sz)}
`;

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

// Sets the duration for every given frame (typically selected) based on the duration specified in the carryover information (${ns}:temp carryover.duration)
setFrameDuration`
    # Log the function call
    $${debug.run} {input: "setFrameDuration for $(name) frame $(framenum)"}
    # Set duration based on carryover information
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].duration set from storage ${ns}:temp carryover.duration
`

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

// Adds a frame to whichever framenum is passed in, or at the end if none are given. Pulls from targetframe for which frame is inserted.
addNewFrame`
    # Log the function call
    $${debug.run} {input: "addNewFrame at $(framenum) from $(targetframe)"}
    # Log the expected function path.
    ${debug.path} {input: "-> stringEquals -> grabFromRef -> retrieveFrame -> toggleSelectionState -> cleanUpNewAnimationData -> grabAnimationFromUuid -> | insertSpace -> | insert consecutive [-> insertSpace -> moveFrame -> arrayMoveEntry] -> | calculateLaneX -> placeFrame -> regroupEntities -> storeFrame -> toggleSelectionState"}
    # create a temporary scoreboard
    scoreboard objectives add ${ns}-anf dummy
    # Place the framenum into the scoreboard
    $execute store result storage ${ns}:temp anf.framenum int 1 run scoreboard players set framenum ${ns}-anf $(framenum)
    # Grab consecutive frame data if applicable (and place it into a score for comparison)
    $data modify storage ${ns}:temp anf.consecutive set from storage ${ns}:temp carryover.consecutive.$(framenum)
    execute store result score consecutive ${ns}-anf run data get storage ${ns}:temp anf.consecutive
    # Check if it is equal to "base" or a number, and generate a data reference from it
    $${stringEquals} {input1: "base", input2: "$(targetframe)", output: "score basecheck ${ns}-anf"}
    execute if score basecheck ${ns}-anf matches 0 run data modify storage ${ns}:temp anf.ref set value ""
    $execute if score basecheck ${ns}-anf matches 1 run data modify storage ${ns}:temp anf.ref set value "frames[$(targetframe)]."
    # Using reference, copy over the data into the same temp namespace for easy grabbing.
    ${grabFromRef`
        # Log the function call
        $${debug.run} {input: "grabFromRef from $(ref)"}
        # Using ref, place all needed data into temporary storage.
        # Size
        $data modify storage ${ns}:temp anf.sx set from storage ${ns}:animation_data new.$(ref)size[0]
        $data modify storage ${ns}:temp anf.sy set from storage ${ns}:animation_data new.$(ref)size[1]
        $data modify storage ${ns}:temp anf.sz set from storage ${ns}:animation_data new.$(ref)size[2]
        $data modify storage ${ns}:temp anf.size set from storage ${ns}:animation_data new.$(ref)size
        # Anchor
        $data modify storage ${ns}:temp anf.anchor set from storage ${ns}:animation_data new.$(ref)anchor
        # Camera
        $data modify storage ${ns}:temp anf.camera set from storage ${ns}:animation_data new.$(ref)camera
        # Target x and z for duplicating frame (not used with base frame)
        $execute if score basecheck ${ns}-anf matches 1 run data modify storage ${ns}:temp anf.tx set from storage ${ns}:animation_data new.$(ref)eanchor[0]
        $execute if score basecheck ${ns}-anf matches 1 run data modify storage ${ns}:temp anf.tz set from storage ${ns}:animation_data new.$(ref)eanchor[2]
    `} with storage ${ns}:temp anf
    # Error if the animation is missing specific frame data, but do not return (so we can clear data.)
    $execute unless data storage ${ns}:temp anf.anchor run ${debug.error} {input: "No anchor data for frame $(targetframe)!"}
    $execute unless data storage ${ns}:temp anf.camera run ${debug.error} {input: "No camera data for frame $(targetframe)!"}
    $execute unless data storage ${ns}:temp anf.size run ${debug.error} {input: "No size data for frame $(targetframe)!"}
    # Retrieve structure data in case it was unloaded.
    $${retrieveFrame} {framenum: "$(targetframe)"}
    # Grab the frame count. If this frame is at the end, then skip insertSpace.
    execute store result score framecount ${ns}-anf run data get storage ${ns}:animation_data new.framecount
    # deselect the duplicated frame (baseFrame handles this in operateOnSelectedFrames)
    $execute if score basecheck ${ns}-anf matches 1 run ${toggleSelectionState} {framenum: $(targetframe)}
    # Must save the deselection to raw data so that pullNextFrameData in insertSpace uses the correct data
    execute unless score framenum ${ns}-anf = framecount ${ns}-anf run ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    execute unless score framenum ${ns}-anf = framecount ${ns}-anf run ${grabAnimationFromUuid} with entity @s
    # If we're moving a frame over, grab that frame's eanchor as ours.
    $execute unless score framenum ${ns}-anf = framecount ${ns}-anf run data modify storage ${ns}:temp anf.eanchor set from storage ${ns}:animation_data new.frames[$(framenum)].eanchor
    # Unless we're moving a frame over, grab the z coordinate of the current last frame's eanchor for calc z.
    execute if score framenum ${ns}-anf = framecount ${ns}-anf if data storage ${ns}:animation_data new.frames[-1] store result score lastframez ${ns}-anf run data get storage ${ns}:animation_data new.frames[-1].eanchor[2] 100
    # Unless we're moving a frame over, grab the z size of the current last frame for calc z.
    execute if score framenum ${ns}-anf = framecount ${ns}-anf if data storage ${ns}:animation_data new.frames[-1] store result score lastframesizez ${ns}-anf run data get storage ${ns}:animation_data new.frames[-1].size[2] 100
    # Run insert space to create room for our new frame (skip if at the end OR if frames are consecutive)
    execute unless score framenum ${ns}-anf = framecount ${ns}-anf unless score consecutive ${ns}-anf matches 2.. run ${insertSpace} with storage ${ns}:temp anf
    # Calculate the frame num diff from the consecutive count so that it can be used in the preceeding macro
    execute if score consecutive ${ns}-anf matches 2.. run scoreboard players operation consecutive ${ns}-anf += framenum ${ns}-anf
    execute if score consecutive ${ns}-anf matches 2.. store result storage ${ns}:temp anf.movetoframe int 1 run scoreboard players get consecutive ${ns}-anf
    # (oh btw, the "matches 2.." check still works after this math because consecutive is >= 2 to begin with [if consecutive] so += framenum will also be >= 2)
    # If there's consecutive frames, we need to insert the space at where the original frame needs to be moved to, and move it there.
    execute if score consecutive ${ns}-anf matches 2.. run ${a`
        # Log the function call
        $${debug.run} {input: "Inserting space after consecutive and moving this frame to $(movetoframe)"}
        # Insert space at movetoframe
        $${insertSpace} {framenum: $(movetoframe), sz: $(sz)}
        # Move frame at framenum to this new position
        $${moveFrame} {framenum: $(framenum), targetframe: $(movetoframe)}
        # Update the array of frames so that this frame's data is there.
        $${arrayMoveEntry} {array: "${ns}:animation_data new.frames", source: $(framenum), target: $(movetoframe)}
    `} with storage ${ns}:temp anf
    # Copy the target frame's data into the new frame. Entities aren't copied as storeFrame will generate that for us
    $data modify storage ${ns}:animation_data new.frames insert $(framenum) value {}
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].duration set value 20
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].camera set from storage ${ns}:temp anf.camera
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].anchor set from storage ${ns}:temp anf.anchor
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].size set from storage ${ns}:temp anf.size
    # Create eanchor
    # If we stored one earlier, use that.
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].eanchor set from storage ${ns}:temp anf.eanchor
    # If we don't have any, use the default first frame's eanchor
    $execute unless data storage ${ns}:temp anf.eanchor run data modify storage ${ns}:animation_data new.frames[$(framenum)].eanchor set value [0.0d, 1.0d, 2.0d]
    # And calculate the X needed for this lane.
    $execute unless data storage ${ns}:temp anf.eanchor run ${calculateLaneX} {output: "${ns}:animation_data new.frames[$(framenum)].eanchor[0] double"}
    # Only situation left -> frame is added at the end of the animation so eanchor has incorrect data -> must calc a new Z coordinate from previous frame (+1 for distance between frames.) Also, all is scaled by 100 to retain decimal places.
    execute if score lastframez ${ns}-anf matches 0.. if score lastframesizez ${ns}-anf matches 0.. run scoreboard players operation lastframez ${ns}-anf += lastframesizez ${ns}-anf
    $execute if score lastframez ${ns}-anf matches 0.. store result storage ${ns}:animation_data new.frames[$(framenum)].eanchor[2] double 0.01 run scoreboard players add lastframez ${ns}-anf 100 
    # Store the new framecount (+1)
    execute store result storage ${ns}:animation_data new.framecount int 1 run scoreboard players add framecount ${ns}-anf 1
    # Toss eanchor and name into macro storage. (eanchor of framenum for base frame adding, eanchor of target for duplicating)
    data modify storage ${ns}:temp anf.name set from storage ${ns}:animation_data new.name
    # Set eanchor for both normal and target coords to the same thing (eanchor for framenum) (unless tx and tz already exist, which is true when duplicating as it is set earlier.)
    $data modify storage ${ns}:temp anf.x set from storage ${ns}:animation_data new.frames[$(framenum)].eanchor[0]
    $data modify storage ${ns}:temp anf.z set from storage ${ns}:animation_data new.frames[$(framenum)].eanchor[2]
    execute unless data storage ${ns}:temp anf.tx run data modify storage ${ns}:temp anf.tx set from storage ${ns}:temp anf.x
    execute unless data storage ${ns}:temp anf.tz run data modify storage ${ns}:temp anf.tz set from storage ${ns}:temp anf.z
    # Place targetframe into macro context
    $data modify storage ${ns}:temp anf.targetframe set value "$(targetframe)"
    # Size was set earlier
    ${placeFrame`
        # Log the function call
        $${debug.run} {input: "placeFrame at $(x) 0 $(z) to $(tx) 0 $(tz) within $(sx) $(sy) $(sz) for $(name) frame $(framenum) targeted $(targetframe)"}
        # Log the expected path
        ${debug.path} {input: "-> turnEntityDocile -> regroupEntities -> storeFrame"}
        # Makes sure this entire animation is loaded
        $execute in ${ns}:editor positioned $(tx) 0 $(tz) run forceload add ~ ~ ~47 ~47
        # Place the base frame structure in (only for adding base frame). i = frame#
        $execute if score basecheck ${ns}-anf matches 0 in ${ns}:editor run place template ${ns}:$(name)-base $(x) 1 $(z) none none 1 1 strict
        # Ungroup all of the entities in the duplicating frame (not used if base)
        execute if score basecheck ${ns}-anf matches 1 run data modify storage ${ns}:temp anf.id set value 0
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor positioned $(tx) 1 $(tz) run ${recGroupSearch} with storage ${ns}:temp anf
        # Warn if the structure block will replace a non-air block
        $execute in ${ns}:editor unless block $(tx) 0 $(tz) minecraft:air run ${debug.warn} {input: "Non-air block at $(tx) 0 $(tz)! Overwriting with structure block..."}
        # Place in the frame's structure block
        $execute in ${ns}:editor run setblock $(tx) 0 $(tz) minecraft:structure_block{mode:"SAVE",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
        # Warn if the powering block will replace a non-air block
        $execute in ${ns}:editor positioned $(tx) 0 $(tz) unless block ~1 ~ ~ minecraft:air run ${debug.warn} {input: "Non-air block at ($(tx) + 1) 0 $(tz)! Overwriting with powering block..."}
        # Power and unpower the structure block to save the structure.
        $execute in ${ns}:editor positioned $(tx) 0 $(tz) run setblock ~1 ~ ~ minecraft:redstone_block
        $execute in ${ns}:editor positioned $(tx) 0 $(tz) run setblock ~1 ~ ~ minecraft:air
        # Make the new entities docile (so that recMoveFrames can target it to teleport) (only if base, since if duplicating we're only saving the target)
        $execute if score basecheck ${ns}-anf matches 0 in ${ns}:editor positioned $(tx) 0 $(tz) as @e[dx=$(sx), dy=$(sy), dz=$(sz), type=!minecraft:player] run ${turnEntityDocile}
        # Set back into LOAD mode for visual bounding box toggle. (If duplicating, this has to go back to the targetframe num)
        $execute if score basecheck ${ns}-anf matches 0 in ${ns}:editor run setblock $(tx) 0 $(tz) minecraft:structure_block{mode:"LOAD",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor run setblock $(tx) 0 $(tz) minecraft:structure_block{mode:"LOAD",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(targetframe)",strict:true}
        # Regroup all grouped entities
        $execute in ${ns}:editor positioned $(tx) 1 $(tz) run ${regroupEntities} with storage ${ns}:temp anf
        # Remove this forceloaded area
        $execute in ${ns}:editor positioned $(tx) 0 $(tz) run forceload remove ~ ~ ~47 ~47
        # If duplcating, then at this point forceload the actual spot,
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor positioned $(x) 0 $(z) run forceload add ~ ~ ~47 ~47
        # place the template,
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor run place template ${ns}:$(name)-frame$(framenum) $(x) 1 $(z) none none 1 1 strict
        # place the LOAD structure block,
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor unless block $(x) 0 $(z) minecraft:air run ${debug.warn} {input: "Non-air block at $(x) 0 $(z)! Overwriting with structure block..."}
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor run setblock $(x) 0 $(z) minecraft:structure_block{mode:"LOAD",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
        # make entities docile,
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor positioned $(x) 0 $(z) as @e[dx=$(sx), dy=$(sy), dz=$(sz), type=!minecraft:player] run ${turnEntityDocile}
        # regroup them,
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor positioned $(x) 1 $(z) run ${regroupEntities} with storage ${ns}:temp anf
        # Unforceload
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor positioned $(x) 0 $(z) run forceload remove ~ ~ ~47 ~47
        # Store structure data since it changed.
        $${storeFrame} {framenum: $(framenum)}
    `} with storage ${ns}:temp anf 
    # Select the newly created frame
    ${toggleSelectionState} with storage ${ns}:temp anf
    # Clear trailing data
    data remove storage ${ns}:temp anf
    scoreboard objectives remove ${ns}-anf
`

// Takes an input frame number and an output frame number, and renumbers the frame's structure data accordingly. Also needs the name of the animation and the size of the output frame.
renumberFrame`
    # Log the function call
    $${debug.run} {input: "renumberFrame placing $(input) at $(output) for $(name) within $(sx) $(sy) $(sz)"}
    # Log the expected function path.
    ${debug.path} {input: "-> retrieveFrame -> removeFrame -> cleanKill -> storeFrame"}
    # Make sure the area we're going to place the structures is forceloaded.
    execute in ${ns}:editor positioned 0 0 -48 run forceload add ~ ~ ~47 ~47
    # Retrieve structure data in case it was unloaded.
    $${retrieveFrame} {framenum: $(input)}
    # Remove the old frame from storage.
    $${removeFrame} {framenum: $(input)}
    # Place the structure template of the input frame.
    $execute in ${ns}:editor run place template ${ns}:$(name)-frame$(input) 0 1 -48 none none 1 1 strict
    # Warn if the structure block will replace a non-air block
    execute in ${ns}:editor unless block 0 0 -48 minecraft:air run ${debug.warn} {input: "Non-air block at 0 0 -48! Overwriting with structure block..."}
    # Place the structure block for this frame with the output frame number.
    $execute in ${ns}:editor run setblock 0 0 -48 minecraft:structure_block{mode:"SAVE",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(output)",strict:true} strict
    # Warn if the powering block will replace a non-air block
    execute in ${ns}:editor unless block 1 0 -48 minecraft:air run ${debug.warn} {input: "Non-air block at 1 0 -48! Overwriting with powering block..."}
    # Save the structure.
    execute in ${ns}:editor run setblock 1 0 -48 minecraft:redstone_block
    execute in ${ns}:editor run setblock 1 0 -48 minecraft:air
    # Remove the blocks.
    execute in ${ns}:editor run fill 0 0 -48 48 50 -1 minecraft:air strict
    # Warn if there are no entites to kill.
    execute in ${ns}:editor positioned 0 0 -48 unless entity @e[type=!player,dx=48,dy=50,dz=48] run ${debug.warn} {input: "No entities to kill! Skipping..."}
    # Remove the entities.
    execute in ${ns}:editor positioned 0 0 -48 as @e[type=!player,dx=48,dy=50,dz=48] run ${cleanKill}
    # This feels dirty, there has to be a better way to do this. We copy over Size from input into output temporarily so that storeFrame can use it.
    # Why doesn't this function do the data copying itself? Well I think it depends on its use case and we can't cover multiple use cases in one function, right?
    # Temporarily store the size for output frame
    $data modify storage ${ns}:temp renumber.size set from storage ${ns}:animation_data new.frames[$(output)].size
    # Set output's size to inputs so that storeFrame grabs the correct size
    $execute unless data storage ${ns}:animation_data new.frames[$(output)] run data modify storage ${ns}:animation_data new.frames append value {temp:true}
    $data modify storage ${ns}:animation_data new.frames[$(output)].size set from storage ${ns}:animation_data new.frames[$(input)].size
    # Store structure data since it changed.
    $${storeFrame} {framenum: $(output)}
    # Restore previous size for output and remove the temporary storage
    $data modify storage ${ns}:animation_data new.frames[$(output)].size set from storage ${ns}:temp renumber.size
    data remove storage ${ns}:temp renumber
    # If the data we added was temporary, remove it
    $execute if data storage ${ns}:animation_data new.frames[$(output)].temp run data remove storage ${ns}:animation_data new.frames[$(output)]
    # Remove the forceload.
    execute in ${ns}:editor positioned 0 0 -48 run forceload remove ~ ~ ~47 ~47
`;

// Given the SZ of a frame and a position (framenum), it will shift all preceding frames in the editor by that amount and renumber them one framenum ahead.
insertSpace`
    # Log the function call
    $${debug.run} {input: "insertSpace at $(framenum) size $(sz)"}
    # Log the expected function path
    ${debug.path} {input: " -> pullNextFrameData -> (recMoveFrames)"}
    # Create a temporary scoreboard.
    scoreboard objectives add ${ns}-is dummy
    # Set up required data for pullNextFrameData and recMoveFrames
    data modify storage ${ns}:temp is.currentframe set from storage ${ns}:animation_data new.framecount
    execute store result score nextframe ${ns}-is run data get storage ${ns}:temp is.currentframe
    execute store result storage ${ns}:temp is.nextframe int 1 run scoreboard players remove nextframe ${ns}-is 1
    data modify storage ${ns}:temp is.namespace set value "is"
    data modify storage ${ns}:temp is.neg set value ""
    data modify storage ${ns}:temp is.name set from storage ${ns}:animation_data new.name
    # Diff is equal to sz + 1 because all frames are separated by 1 block on each side.
    $scoreboard players set diff ${ns}-is $(sz)
    execute store result storage ${ns}:temp is.diff int 1 run scoreboard players add diff ${ns}-is 1
    $scoreboard players set target ${ns}-is $(framenum)
    # Removing 1 to our target so that itself is still moved over by one but no frames past it (decreased by 1). Target stops when nextframe is equal to this value. Nextframe is the frame being moved.
    scoreboard players remove target ${ns}-is 1
    # Pull our data and begin iterating with recMoveFrames
    ${pullNextFrameData} with storage ${ns}:temp is
    ${recMoveFrames} with storage ${ns}:temp is
    # Clean up trailing data
    scoreboard objectives remove ${ns}-is
    data remove storage ${ns}:temp is
`;

// Pulls and sets up all of the data required for recMoveFrames, which specifically needs eanchor, size, and size - 1 = sh[x-z]. Newz also has to be calculated.
pullNextFrameData`
    # Log the function call
    $${debug.run} {input: "pullNextFrameData for one frame ahead: $(nextframe) for $(name) placed in $(namespace) shifting $(neg)$(diff)"}
    # Error if there's no eanchor on this frame.
    $execute unless data storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor run ${debug.error} {input: "No eanchor data for next frame!"}
    $data modify storage ${ns}:temp $(namespace).ax set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor[0]
    $data modify storage ${ns}:temp $(namespace).ay set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor[1]
    $data modify storage ${ns}:temp $(namespace).az set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor[2]
    $execute store result score az ${ns}-$(namespace) run data get storage ${ns}:temp $(namespace).az
    # Error if there's no size data on this frame.
    $execute unless data storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size run ${debug.error} {input: "No size data for next frame!"}
    $execute store result score x ${ns}-$(namespace) store result storage ${ns}:temp $(namespace).shx int 1 run data get storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size[0]
    $execute store result score y ${ns}-$(namespace) store result storage ${ns}:temp $(namespace).shy int 1 run data get storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size[1]
    $execute store result score z ${ns}-$(namespace) store result storage ${ns}:temp $(namespace).shz int 1 run data get storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size[2]
    $execute store result storage ${ns}:temp $(namespace).sx int 1 run scoreboard players remove x ${ns}-$(namespace) 1
    $execute store result storage ${ns}:temp $(namespace).sy int 1 run scoreboard players remove y ${ns}-$(namespace) 1
    $execute store result storage ${ns}:temp $(namespace).sz int 1 run scoreboard players remove z ${ns}-$(namespace) 1
    # Set diff using neg so that if negative it's subtracted but if positive it is added
    $scoreboard players set diff ${ns}-$(namespace) $(neg)$(diff)
    $execute store result storage ${ns}:temp $(namespace).newz int 1 store result storage ${ns}:animation_data new.frames[$(nextframe)].eanchor[2] double 1 run scoreboard players operation az ${ns}-$(namespace) += diff ${ns}-$(namespace)
    # Set selected to false by default but then true if it does exist on this frame.
    $data modify storage ${ns}:temp $(namespace).selected set value false
    $data modify storage ${ns}:temp $(namespace).selected set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].selected
`

recMoveFrames`
    # Log the function call
    $${debug.run} {input: "recMoveFrames at $(ax) $(ay) $(az) extending $(shx) ($(sx)) $(shy) ($(sy)) $(shz) ($(sz)) shifting $(neg)$(diff) placing at $(newz) for $(name) frame $(currentframe) <- $(nextframe) inside of $(namespace) selected? $(selected)"}
    # Log the expected function path
    ${debug.path} {input: "-> renumberFrame -> recGroupSearch -> regroupEntities -> pullNextFrameData -> ^ recMoveFrames"}
    # Run the renumbering function for this frame.
    $${renumberFrame} {input: $(nextframe), output: $(currentframe), name: $(name), sx: $(shx), sy: $(shy), sz: $(shz)}
    # Set up some constants used in math
    $scoreboard players set 1 ${ns}-$(namespace) 1
    $scoreboard players set -1 ${ns}-$(namespace) -1
    # Add forceloads to make sure the area is loaded.
    $execute positioned $(ax) $(ay) $(az) run forceload add ~ ~ ~47 ~47
    execute positioned 0 0 -48 run forceload add ~ ~ ~47 ~47
    # Warn if there's no structure block to remove.
    $execute positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~ minecraft:structure_block run ${debug.warn} {input: "No structure block to remove at $(ax) ($(ay) - 1) $(az)! Skipping..."}
    # Remove the old structure block.
    $execute positioned $(ax) $(ay) $(az) if block ~ ~-1 ~ minecraft:structure_block run setblock ~ ~-1 ~ minecraft:air strict
    # Clone the frames over the difference of the size of the removed frame's z axis. Must be done twice since source and destination areas cannot overlap.
    $execute positioned $(ax) $(ay) $(az) run clone ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) 0 1 -48 strict masked move
    $execute positioned 0 1 -48 run clone ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) 0 1 $(newz) strict masked move
    # Ungroup all entities so that teleporting them doesn't erase who goes with who
    $data modify storage ${ns}:temp $(namespace).id set value 0
    $execute positioned $(ax) $(ay) $(az) run ${recGroupSearch} with storage ${ns}:temp $(namespace)
    # Teleport all entities in subsequent frames backwards by the size of the removed frame's z axis.
    $execute positioned $(ax) $(ay) $(az) as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-entity-turned-docile] at @s run tp @s ~ ~ ~$(neg)$(diff)
    # Regroup all entities.
    $execute positioned $(ax) $(ay) $(az) positioned ~ ~ ~$(neg)$(diff) run ${regroupEntities} with storage ${ns}:temp $(namespace)
    # Warn if the structure block will replace a non-air block
    $execute positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~$(neg)$(diff) minecraft:air run ${debug.warn} {input: "Non-air block at $(ax) ($(ay) - 1) ($(az) + $(neg)$(diff))! Overwriting with structure block..."}
    # Place a new structure block with the updated frame number.
    $execute positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~$(neg)$(diff) minecraft:structure_block{mode:"LOAD",showboundingbox:$(selected),posX:0,posY:1,posZ:0,sizeX:$(shx),sizeY:$(shy),sizeZ:$(shz),ignoreEntities:false,name:"${ns}:$(name)-frame$(currentframe)",strict:true}
    # Remove forceloads to cleanup.
    $execute positioned $(ax) $(ay) $(az) run forceload remove ~ ~ ~47 ~47
    execute positioned 0 0 -48 run forceload remove ~ ~ ~47 ~47
    # Increment currentframe and nextframe. (remove is used in conjunction with neg so that if we're moving backwards, we're increasing framenums, and if we're moving forwards we're decreasing framenums. This prevents collision with other frames.)
    $execute store result storage ${ns}:temp $(namespace).currentframe int 1 run scoreboard players get nextframe ${ns}-$(namespace)
    $execute store result storage ${ns}:temp $(namespace).nextframe int 1 run scoreboard players operation nextframe ${ns}-$(namespace) -= $(neg)1 ${ns}-$(namespace)
    # Check if there's more frames to renumber.
    $execute if score nextframe ${ns}-$(namespace) = target ${ns}-$(namespace) run return 1
    # Pull the next frame's data into macro storage.
    $${pullNextFrameData} with storage ${ns}:temp $(namespace)
    # Execute this recursive function again.
    $${recMoveFrames} with storage ${ns}:temp $(namespace)
`

// Given a framenum and data of consecutive frames from carryover, duplicates a frame using addNewFrame in order of the frames it is consecutive to.
duplicateFrame`
    # Log the function call
    $${debug.run} {input: "duplicateFrame with $(framenum)"}
    # Log the expected path
    ${debug.path} {input: "-> addNewFrame"}
    # Store framenum as a score and in our new namespace for macroing (need to add it with offset)
    scoreboard objectives add ${ns}-df dummy
    $execute store result storage ${ns}:temp df.targetframe int 1 run scoreboard players set framenum ${ns}-df $(framenum)
    # Grab offset from carryover data (generated in operationOnSelectedFrames)
    $execute store result score offset ${ns}-df run data get storage ${ns}:temp carryover.consecutive.$(framenum)
    # Add framenum and offset together and store that as targetframe for addNewFrame
    execute store result storage ${ns}:temp df.framenum int 1 run scoreboard players operation framenum ${ns}-df += offset ${ns}-df
    # addNewFrame using this offset.
    ${addNewFrame} with storage ${ns}:temp df
    # Clean up trailing data
    data remove storage ${ns}:temp df
    scoreboard objectives remove ${ns}-df
`;

// Moves the specified framenum to the specified targetframe within the editor dimension.
moveFrame`
    # Log the function call
    $${debug.run} {input: "moveFrame $(framenum) to $(targetframe)"}
    # Log the expected path
    ${debug.path} {input: "-> moving the frame -> recGroupSearch -> regroupEntities -> renumberFrame"}
    # We're going to make the assumption that this method is being used elsewhere where animation_data is open already and will be closed on its own
    # Open a scoreboard
    scoreboard objectives add ${ns}-mf dummy
    # Pull needed data (Use macros once and then not again). Also warn if this data is missing
    $data modify storage ${ns}:temp moveFrame.frameData set from storage ${ns}:animation_data new.frames[$(framenum)]
    $data modify storage ${ns}:temp moveFrame.frameDataTarget set from storage ${ns}:animation_data new.frames[$(targetframe)]
    # Using input and output namespaces for renumberFrame function (also needs a macro for name)
    $data modify storage ${ns}:temp moveFrame.frameData.input set value $(framenum)
    $data modify storage ${ns}:temp moveFrame.frameData.output set value $(targetframe)
    data modify storage ${ns}:temp moveFrame.frameData.name set from storage ${ns}:animation_data new.name
    execute unless data storage ${ns}:temp moveFrame.frameData run return run ${debug.error} {input: "Missing frameData for moving frame!"}
    execute unless data storage ${ns}:temp moveFrame.frameDataTarget run return run ${debug.error} {input: "Missing frameDataTarget for target frame!"}
    execute unless data storage ${ns}:temp moveFrame.frameData.name run return run ${debug.error} {input: "Missing name for target animation!"}
    # Pull sx-z and id for grouping for frameData
    data modify storage ${ns}:temp moveFrame.frameData.sx set from storage ${ns}:temp moveFrame.frameData.size[0]
    data modify storage ${ns}:temp moveFrame.frameData.sy set from storage ${ns}:temp moveFrame.frameData.size[1]
    data modify storage ${ns}:temp moveFrame.frameData.sz set from storage ${ns}:temp moveFrame.frameData.size[2]
    data modify storage ${ns}:temp moveFrame.frameData.id set value 0
    # Create coords for anchor for frameData
    data modify storage ${ns}:temp moveFrame.frameData.ax set from storage ${ns}:temp moveFrame.frameData.eanchor[0]
    data modify storage ${ns}:temp moveFrame.frameData.ay set from storage ${ns}:temp moveFrame.frameData.eanchor[1]
    data modify storage ${ns}:temp moveFrame.frameData.az set from storage ${ns}:temp moveFrame.frameData.eanchor[2]
    execute store result score anchorz ${ns}-mf run data get storage ${ns}:temp moveFrame.frameData.az 1000
    # Create coords for anchor for frameDataTarget
    data modify storage ${ns}:temp moveFrame.frameData.tax set from storage ${ns}:temp moveFrame.frameDataTarget.eanchor[0]
    data modify storage ${ns}:temp moveFrame.frameData.tay set from storage ${ns}:temp moveFrame.frameDataTarget.eanchor[1]
    data modify storage ${ns}:temp moveFrame.frameData.taz set from storage ${ns}:temp moveFrame.frameDataTarget.eanchor[2]
    # Currently, the Z position is off since insert space was ran first -> so this frame's data is placed sz + 1 ahead. Must subtract sz and 1000 (we scaled up coords) to get accurate targeteanchor.
    execute store result score sizez ${ns}-mf run data get storage ${ns}:temp moveFrame.frameData.sz 1000
    execute store result score anchordiff ${ns}-mf run data get storage ${ns}:temp moveFrame.frameData.taz 1000
    scoreboard players operation anchordiff ${ns}-mf -= sizez ${ns}-mf
    execute store result storage ${ns}:temp moveFrame.frameData.taz double 0.001 run scoreboard players remove anchordiff ${ns}-mf 1000
    # Calculate the difference in the z positions
    execute store result storage ${ns}:temp moveFrame.frameData.diff int 0.001 run scoreboard players operation anchordiff ${ns}-mf -= anchorz ${ns}-mf
    ${a`
        # Log the function call
        ${debug.run} {input: "Moving the frame"}
        # Ungroup entities at framenum
        $execute positioned $(ax) $(ay) $(az) run ${recGroupSearch} with storage ${ns}:temp moveFrame.frameData
        # Clone move the blocks over to the new location
        $execute positioned $(ax) $(ay) $(az) run clone ~ ~-1 ~ ~$(sx) ~$(sy) ~$(sz) ~ ~-1 ~$(diff) masked move
        # teleport all entities
        $execute positioned $(ax) $(ay) $(az) as @e[tag=${ns}-entity-turned-docile,dx=$(sx), dy=$(sy), dz=$(sz)] at @s run tp @s ~ ~ ~$(diff)
        # Regroup the entities
        $execute positioned $(tax) $(tay) $(taz) run ${regroupEntities} with storage ${ns}:temp moveFrame.frameData
        # Renumber the frame in data
        ${renumberFrame} with storage ${ns}:temp moveFrame.frameData
        # Update new frame data since eanchor just changed. (we only changed the Z-coordinate)
        $data modify storage ${ns}:animation_data new.frames[$(input)].eanchor[2] set from storage ${ns}:temp moveFrame.frameData.taz
    `} with storage ${ns}:temp moveFrame.frameData
    # Clean up trailing data
    data remove storage ${ns}:temp moveFrame
`;

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
    {mode: "duplicate", command: `${duplicateFrame}`}
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
    ${debug.entry} {input: "from editor_menu dialog, multiple options"}
    # Log the function call
    $${debug.run} {input: "operationOnSelectedFrames executing $(mode)"}
    # Log the expected function path.
    $${debug.path} {input: "-> grabAnimationFromUuid -> stringEquals -> | (recSelectCheck -> | count consecutive) -> | grabSizeAnchorEditor -> (recOperate -> | $(mode) -> ^ grabSizeAnchorEditor)"}
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
        # Check if this frame is selected, and if so, add it to the end of the list of frames to operate on.
        $execute if data storage ${ns}:animation_data new.frames[$(maxframe)].selected run data modify storage ${ns}:temp selectedframes.framenums append value $(maxframe)
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

// Allows the player to exit the editor dimension.
exit`
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
    # Grab animation data using UUID.
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Warn if the animation has no frames.
    execute unless data storage ${ns}:animation_data new.frames[0] run ${debug.warn} {input: "Animation has no frames! Skipping frame removal..."}
    # Clone the frames list into temporary storage so we can iterate through it.
    data modify storage ${ns}:temp exit.frames set from storage ${ns}:animation_data new.frames
    # Grab all the info for the first frame and place it in the macro storage.
    data modify storage ${ns}:temp exit.name set from storage ${ns}:animation_data new.name
    data modify storage ${ns}:temp exit.ax set from storage ${ns}:temp exit.frames[0].eanchor[0]
    data modify storage ${ns}:temp exit.ay set from storage ${ns}:temp exit.frames[0].eanchor[1]
    data modify storage ${ns}:temp exit.az set from storage ${ns}:temp exit.frames[0].eanchor[2]
    data modify storage ${ns}:temp exit.sx set from storage ${ns}:temp exit.frames[0].size[0]
    data modify storage ${ns}:temp exit.sy set from storage ${ns}:temp exit.frames[0].size[1]
    data modify storage ${ns}:temp exit.sz set from storage ${ns}:temp exit.frames[0].size[2]
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
        data modify storage ${ns}:temp exit.ax set from storage ${ns}:temp exit.frames[0].eanchor[0]
        data modify storage ${ns}:temp exit.ay set from storage ${ns}:temp exit.frames[0].eanchor[1]
        data modify storage ${ns}:temp exit.az set from storage ${ns}:temp exit.frames[0].eanchor[2]
        data modify storage ${ns}:temp exit.sx set from storage ${ns}:temp exit.frames[0].size[0]
        data modify storage ${ns}:temp exit.sy set from storage ${ns}:temp exit.frames[0].size[1]
        data modify storage ${ns}:temp exit.sz set from storage ${ns}:temp exit.frames[0].size[2]
        # Loop
        ${recRemoveFrames} with storage ${ns}:temp exit
    `} with storage ${ns}:temp exit
    # Remove lane bedrock
    ${unclaimLane}
    # Return the player to the overworld at the anchor location. Grabs dimension data and the real world anchor coordinates.
    $data modify storage ${ns}:temp exit.dimension set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevDim
    $data modify storage ${ns}:temp exit.px set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos[0]
    $data modify storage ${ns}:temp exit.py set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos[1]
    $data modify storage ${ns}:temp exit.pz set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos[2]
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
`;

// Temporary cleanup function to help with testing
clean`
    # Warning to remove this function at somepoint
    ${debug.warn} {input: "remove clean function before release, within animation"}
    tag @s remove ${ns}-inEditor
    function ${ns}:menu/delete_animation {anim:"test"}
    execute in ${ns}:editor run setblock 0 1 0 minecraft:air
    data remove storage ${ns}:animation_data animations[]
    data remove storage ${ns}:player_data players[]
    execute in minecraft:overworld run tp @s -99 100 -42 -90 0
`;