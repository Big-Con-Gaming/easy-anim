// This file will have everything to do with selecting frames within an animation.

// Sets up basic stuff.
import mcf from '../mcf.js';
import * as debug from '../debug.js';
import { grabSizeAnchorEditor } from '../selection/data.js';
import { grabAnimationFromUuid, cleanUpNewAnimationData } from '../data.js';
import { testIfInt } from '../util.js';
const folder = mcf.animation.selecting;

// Define global funcs here.
export const {
    selectInPlayerFrame, toggleSelectionState, parseToggleSingleSelectFrame, selectAllFrames, toggleAllSelectFrame, parseToggleRangeSelectFrame
} = folder;
// Define local funcs here.
const {
    anonymous: a, removeQuoteMacroInsertScore, recToggle, recSelectAll, selectFrame, deselectFrame, recPlayerSearch
} = folder;

const ns = 'easy-anim';

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
    $execute positioned $(ax) $(ay) $(az) align xyz run tag @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=!${ns}-selected] add ${ns}-selected
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
    $execute positioned $(ax) $(ay) $(az) align xyz run tag @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-selected] remove ${ns}-selected
`;

// Toggles the selection state of the provided frame number.
toggleSelectionState`
    # Log the function call
    $${debug.run} {input: "toggleSelectionState for frame $(framenum)"}
    # Clean up possibly trailing data
    scoreboard objectives remove ${ns}-tss
    data remove storage ${ns}:temp grabsizeanchor
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
    # Clean up possibly trailing data
    data remove storage ${ns}:temp grabsizeanchor
    scoreboard objectives remove ${ns}-sipf
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
        $execute in ${ns}:editor positioned $(ax) $(ay) $(az) align xyz if entity @p[dx=$(sx), dy=$(sy), dz=$(sz), nbt={UUID: $(UUID)}] run return run ${toggleSelectionState} with storage ${ns}:temp grabsizeanchor
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
    # Clean up possibly trailing data
    data remove storage ${ns}:temp temptoggle
    scoreboard objectives remove ${ns}-ptssf
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
    # Clean up possibly trailing data
    data remove storage ${ns}:temp temptoggle
    scoreboard objectives remove ${ns}-temptoggle
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
    # Clean up possibly trailing data
    data remove storage ${ns}:temp temptoggle
    scoreboard objectives remove ${ns}-temptoggle
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
    # Clean up possibly trailing data
    scoreboard objectives remove ${ns}-temptoggle
    data remove storage ${ns}:temp grabsizeanchor
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
