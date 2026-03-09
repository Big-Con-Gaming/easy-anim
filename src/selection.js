// Set up stuff
import mcf from './mcf.js';
import * as debug from './debug.js';
import { calculateLaneX, loadInventory, unclaimLane, cleanUpCurrentPlayerData } from './inventory.js';
import { pullDataStringEquals } from './util.js';
const folder = mcf.selection;
export const { grabPlayerData, grabAnimationData, grabPlayerAndAnimation, grabAnimationFromUuid, exitSelection, cleanUpNewAnimationData, appendAllDataChanges, recGroupSearch, regroupEntities, anchorDifference, constructRealCoordinates, grabSizeAnchor, grabSizeAnchorEditor, grabStrBlockPos, handleSummon, resetCornerBlock, handleHighlight, keepHoverSelect, removeHovers, removeDocile } = folder;
const { storeArrayMacro, storeAxisMacro, updateSelection, displayBox, placeStructureBlock, handleExecution, placeGhost, turnEntityDocile, executeAsMarker, removeOldSelection, createTwoPointSelection, twoPointSelection, recDocileSearch, targetSelectInSelection, anonymous: a } = folder;

// grabPlayerData: grabs the player's data and places it into the current namespace. Might be moved out into a player file.
// grabAnimationData: Using currentAnim as a macro for the name of the animation, it pulls that out of animation_data into the new namespace.
// grabPlayerAndAnimation: Calls both grabPlayerData and grabAnimationData to retrieve both player_data current and animation_data new
// grabAnimationFromUuid: Grabs animation data from the player's UUID directly.
// cleanUpNewAnimationData: Saves changes made to the new namespace within animation_data to the actual animation's data. Must be ran with storage ${ns}:animation_data new.
// regroupEntities: Must be ran with xyz and sx sy sz, where xyz represents the neg-neg-neg corner of the frame/selection and sx sy sz represent the size of the frame/selection. This goes through and puts grouped entities back together after they were split for structure saving.
// storeArrayMacro: places data into an output array location dependent on an iterative varible i. It scales down the value by 0.0001 from a scoreboard that is named based on axis, and is in an objective suffixed with math.
// storeAxisMacro: places data into an output object location dependent on a string varible axis. It scales down the value by 0.0001 from a scoreboard that is named based on axis, and is in an objective suffixed with math.
// anchorDifference: Takes an input storage location and calculates the difference between that location and the anchor location from the new selection.
// constructRealCoordinates: Takes an input storage location and calculates the real world coordinates by adding the anchor coordinates from the new selection.
// grabSizeAnchor: Throws the anchor position, selection size, and the real size (shrunk by 1) into a temporary storage space for macros.
// grabSizeAnchorEditor: Grabs size and the coordinates within the editor for a specific frame and tosses them into a temporary storage place to be used in other commands. Exports data into ${ns}:temp grabsizeanchor.
// updateSelection: changes size and anchor to fit in a new selection point into preexisting selection box. Selections within the box run twoPointSelection.
// grabStrBlockPos: Grabs the structure block position of the current selection box and places it into ${ns}:temp str. Also grabs the box's size for a macro.
// handleSummon: Places arrow item entities and interaction entities at each side of the selection area.
// displayBox: Places in the structure block and handles on a selection.
// placeStructureBlock: tosses the block that is xyz - 1 from the anchor of the selection into the editor, and then places the structure block there needed to display the selection's size. Must be executed with storage ${ns}:temp str.
// handleExecution: takes the right and left clicks performed on handles and transforms the selection box accordingly.
// resetCornerBlock: replaces the structure block in a selection with the block that was previously there. must be executed with storage ${ns}:temp str.
// handleHighlight: Thrown into the player raycast command, if the player is looking at a handle, it will glow.
// placeGhost: Where ever executed, places a hover selection box so that the player can use it to select an area with a corner filled with air.
// keepHoverSelect: If the player is still looking at a hover selection box, prevent its deletion. Tossed into the end of the raycast system.
// removeHovers: When executed on an interaction entity representing a hover selection, it will remove itself from the world.
// turnEntityDocile: Turns the executor "docile" (No AI, No Gravity, Silent, Invulnerable, Persistent, Full Pickup Delay and No Despawn Timer for Items)
// removeDocile: Removes docile attributes/nbtdata from the executor.
// executeAsMarker: ran as a marker in the world, depicting the center of the block that a player first selects. Runs the decision tree to determine which selection command to execute.
// removeOldSelection: finds and removes the old selection's structure block and any loose handles.
// createTwoPointSelection: Assumes that an anchor position is the only thing created for the current selection, and treats the current entity's position as the second corner of this selection. Changes anchor and size to match the new selection.
// twoPointSelection: Finds the most negative corner to become the anchor and the most positive corner to calculate box size. It maps through each axis.
// recDocileSearch: Recursive, is called until temporary list docileSearch in animationData is empty. Goes through each animation and turns entities docile within each.
// targetSelectInSelection: using grabSizeAnchor data, it executes turnEntityDocile on every entity (besides the player) in the selection radius.

const ns = 'easy-anim';

// Set up lists that will hold commands.
const anchorDifferenceCommands = [];
const constructRealCoordinatesCommands = [];
const grabSizeAnchorCommands = [];
const grabSizeAnchorEditorCommands = [];
const selectCommands = [];
const twoPointCommands = [];
const displayBoxCommands = [];
const handleSummonCommands = [];
const grabStrBlockPosCommands = [];
const updateSelectionCommands = [];
const handleExecutionCommands = [];
const turnEntityDocileCommands = [];
const removeDocileCommands = [];

// ALL COMMANDS FOR THE SELECT TOOL

// These commands construct the bounding box for the selection tool. This is done by finding the most negative and positive corners between the anchor and the newly selected block.
export const axis = [
    {axis:"x",i:"0"},
    {axis:"y",i:"1"},
    {axis:"z",i:"2"}
];

// grabs the player's data and places it into the current namespace. Might be moved out into a player file.
// Must be ran as the player or with a UUID passed in.
grabPlayerData`
    # Log the function call
    $${debug.run} {input: "grabPlayerData for $(UUID)"}
    # Error if the player doesn't have data
    $execute unless data storage ${ns}:player_data players[{UUID:$(UUID)}] run return run ${debug.error} {input: "Player has no player_data!"}
    # Load the player's inventory from storage.
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
`

// Using currentAnim as a macro for the name of the animation, it pulls that out of animation_data into the new namespace.
grabAnimationData`
    # Log the function call
    $${debug.run} {input: "grabAnimationData for $(currentAnim)"}
    # Warn if animation data is already present in the new namespace.
    execute if data storage ${ns}:animation_data new run ${debug.warn} {input: "New contains data already, overriding..."}
    # Error if the animation requested doesn't exist.
    $execute unless data storage ${ns}:animation_data animations[{name:$(currentAnim)}].data run return run ${debug.error} {input: "Animation $(currentAnim) does not exist."}
    $data modify storage ${ns}:animation_data new set from storage ${ns}:animation_data animations[{name:$(currentAnim)}].data
    $data modify storage ${ns}:animation_data new.name set value $(currentAnim)
`;

// Calls both grabPlayerData and grabAnimationData to retrieve both player_data current and animation_data new
grabPlayerAndAnimation`
    # Log the function call
    $${debug.run} {input: "grabPlayerAndAnimation for $(UUID)"}
    # Log the path
    ${debug.path} {input: "-> grabPlayerData -> grabAnimationData"}
    # Toss player data into current with the provided UUID
    $${grabPlayerData} {UUID:$(UUID)}
    # Using the info inside of player data current, grab the animation data
    ${grabAnimationData} with storage ${ns}:player_data current
`;

// Grabs animation data from the player's UUID directly.
grabAnimationFromUuid`
    # Log the function call
    $${debug.run} {input: "grabAnimationFromUuid for $(UUID)"}
    # Log the path
    ${debug.path} {input: "-> grabAnimationData"}
    # Call grabAnimationData using currentAnim from the player data
    $${grabAnimationData} with storage ${ns}:player_data players[{UUID:$(UUID)}]
`;

// Saves changes made to the new namespace within animation_data to the actual animation's data. Must be ran with storage ${ns}:animation_data new.
cleanUpNewAnimationData`
    # Log the function call
    $${debug.run} {input: "cleanUpNewAnimationData for $(name)"}
    # Error if animation_data new does not exist.
    execute unless data storage ${ns}:animation_data new run return run ${debug.error} {input: "No data found in the new namespace."}
    data remove storage ${ns}:animation_data new.name
    $data modify storage ${ns}:animation_data animations[{name:$(name)}].data set from storage ${ns}:animation_data new
    data remove storage ${ns}:animation_data new
`
appendAllDataChanges`
    # Log the function call
    $${debug.run} {input: "appendAllDataChanges for animation $(name) and player $(owner)"}
    # Log the expected function path.
    ${debug.path} {input: "-> cleanUpNewAnimationData -> cleanUpCurrentPlayerData"}
    # Call each function with the appropriate macro
    $${cleanUpNewAnimationData} {name: $(name)}
    $${cleanUpCurrentPlayerData} {UUID: $(owner)}
`

recGroupSearch`
    # Log the function call
    $${debug.run} {input: "recGroupSearch with id $(id)"}
    # Warn if no entities are present within the selection
    $execute unless entity @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-group,limit=1,sort=random] run ${debug.warn} {input:"No entities can be grouped! Skipping..."}
    $execute as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-group,limit=1,sort=random] if data entity @s Passengers run ${a`
        # Log the function call
        ${debug.run} {input: "grouping an entity found within selection"}
        $tag @s add ${ns}-vehicle-$(id)
        $data modify entity @s data.easyanimgroupid set value $(id)
        tag @s add ${ns}-group
        $execute on passengers run tag @s add ${ns}-passenger-$(id)
        execute on passengers run tag @s add ${ns}-group
        $execute on passengers run data modify entity @s data.easyanimgroupid set value $(id)
        execute on passengers run ride @s dismount
        execute store result storage ${ns}:temp str.id int 1 run scoreboard players add groupid ${ns}-temp 1
    `} with storage ${ns}:temp str
    $execute as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-group] if data entity @s Passengers run ${recGroupSearch} with storage ${ns}:temp str
`

// Must be ran with xyz and sx sy sz, where xyz represents the neg-neg-neg corner of the frame/selection and sx sy sz represent the size of the frame/selection. This goes through and puts grouped entities back together after they were split for structure saving.
regroupEntities`
    # Log the function call
    $${debug.run} {input: "regroupEntities within $(sx) $(sy) $(sz)"}
    # Log the expected function path.
    ${debug.path} {input: "-> | passenger on vehicle -> | untagging"}
    # Warn if no grouped entities are found within selection in case there should be.
    $execute unless entity @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-group] run ${debug.warn} {input: "No grouped entities found, skipping..."}
    $execute as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-group] run ${a`
        # Log the function call
        $${debug.run} {input: "placing passenger on vehicle in group $(easyanimgroupid)"}
        $execute if entity @s[tag=${ns}-passenger-$(easyanimgroupid)] run ride @s mount @n[tag=${ns}-vehicle-$(easyanimgroupid)]
    `} with entity @s data
    $execute as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-group] run ${a`
        # Log the function call
        $${debug.run} {input: "untagging $(easyanimgroupid)"}
        $execute if entity @s[tag=${ns}-passenger-$(easyanimgroupid)] run tag @s remove ${ns}-passenger-$(easyanimgroupid)
        $execute if entity @s[tag=${ns}-vehicle-$(easyanimgroupid)] run tag @s remove ${ns}-vehicle-$(easyanimgroupid)
        tag @s remove ${ns}-group
        data remove entity @s data.easy-anim-groupid
    `} with entity @s data
`;

// Set up the list that will hold commands for the exitSelection macro.
const exitCommands = [];

// This runs when the player uses the exit item in their inventory. Ran inside the editor dimension.
exitCommands.push(`
    # Log the entry point
    ${debug.entry} {input: "from exit item | from enterEditor"}
    # Log the function call
    $${debug.run} {input: "exitSelection for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> loadInventory -> grabStrBlockPos -> calculateLaneX -> resetCornerBlock -> | unclaimLane -> kill handles -> cleanUpNewAnimationData -> | remove selection data"}
    # Load the player's inventory from storage.
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Load the items into the player's inventory
    ${loadInventory}
    # Replace the structure block in the current selection with its old block from the lane
    ${grabStrBlockPos}
    ${calculateLaneX} {output:"${ns}:temp str.lanex int"}
    ${resetCornerBlock} with storage ${ns}:temp str
    # Free up the player's old editor lane, if the player isn't within the editor.
    execute unless entity @s[tag=${ns}-inEditor] run ${unclaimLane}
    # Create temporary scoreboard for the size increasing functions below.
    scoreboard objectives add ${ns}-exitcommands dummy
`);
// We need to temporarily add 2 to each size on each axis so that the target selector below only selects what we want when we kill off the handles.

function createExitCommands({axis}) {
    return`
        # Warn if str.s${axis} doesn't exist.
        execute unless data storage ${ns}:temp str.s${axis} run ${debug.warn} {input: "Missing size parameter s${axis} from grabStrBlockPos"}
        execute store result score ${axis} ${ns}-exitcommands run data get storage ${ns}:temp str.s${axis}
        execute store result storage ${ns}:temp str.s${axis} double 1 run scoreboard players add ${axis} ${ns}-exitcommands 2
    `;
}

// Toss the commands specified above into the function.
exitCommands.push(...axis.map(createExitCommands));

exitCommands.push(`
    # Remove the temporary scoreboard used above.
    scoreboard objectives remove ${ns}-exitcommands
    # Kill the display item_display entities from the old selection.
    ${a`
        # Log the function call
        $${debug.run} {input: "kill off handles at $(x) $(y) $(z) within $(sx) $(sy) $(sz) located in $(dimension)"}
        $execute in $(dimension) positioned $(x) $(y) $(z) unless entity @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)] run ${debug.warn} {input:"No handles on the selection! Skipping removal..."}
        $execute in $(dimension) positioned $(x) $(y) $(z) run kill @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)]
    `} with storage ${ns}:temp str
    # Remove the temporary data locations.
    data remove storage ${ns}:temp str
    # Set the animation's location to none if we aren't in the editor, and to editor if we are.
    execute unless entity @s[tag=${ns}-inEditor] run data modify storage ${ns}:animation_data new.location set value "none"
    execute if entity @s[tag=${ns}-inEditor] run data modify storage ${ns}:animation_data new.location set value "editor"
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove the new selection from animation_data entirely, unless there are frames associated with it.
    $${a`
        # Log the function call
        $${debug.run} {input: "removing selection data for $(currentAnim)"}
        $execute unless data storage ${ns}:animation_data animations[{name:$(currentAnim)}].data.frames run data remove storage ${ns}:animation_data animations[{name:$(currentAnim)}]
    `} with storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Remove the player's old player data unless they are in the editor.
    $execute unless entity @s[tag=${ns}-inEditor] run data remove storage ${ns}:player_data players[{UUID:$(UUID)}]
`);

// actually create the macro in the menu namespace so that it keeps its original path
exitSelection`${exitCommands.join('\n')}`;

// places data into an output array location dependent on an iterative varible i. It scales down the value by 0.0001 from a scoreboard that is named based on axis, and is in an objective suffixed with math.
storeArrayMacro`
    # Log the function call
    $${debug.run} {input: "storeArrayMacro into $(output)$(i)] from $(namespace)$(axis) ${ns}-$(namespace)math"}
    $execute store result $(output)$(i)] double 0.0001 run scoreboard players get $(namespace)$(axis) ${ns}-$(namespace)math
`;

// places data into an output object location dependent on a string varible axis. It scales down the value by 0.0001 from a scoreboard that is named based on axis, and is in an objective suffixed with math.
storeAxisMacro`
    # Log the function call
    $${debug.run} {input: "storeAxisMacro into $(output)$(axis) from $(namespace)$(axis) ${ns}-$(namespace)math"}
    $execute store result $(output)$(axis) double 0.0001 run scoreboard players get $(namespace)$(axis) ${ns}-$(namespace)math
`;

// Takes an input storage location and calculates the difference between that location and the anchor location from the new selection.
function createAnchorDifferenceCommands({axis, i}) {
    return`
        # Grab the coordinates that need to be converted. They're assumed to be within an array.
        $execute store result score diff${axis} ${ns}-diffmath run data get $(input)${i}] 10000
        # Grab the anchor coordinates.
        execute store result score anchor${axis} ${ns}-diffmath run data get storage ${ns}:animation_data new.anchor[${i}] 10000
        # Subtract anchor from the input coordinates to get the difference.
        scoreboard players operation diff${axis} ${ns}-diffmath -= anchor${axis} ${ns}-diffmath
        # Toss the axis, iterative variable, namespace, and output into temp storage for the macro.
        data modify storage ${ns}:temp anchorDifference.axis set value ${axis}
        data modify storage ${ns}:temp anchorDifference.i set value ${i}
        data modify storage ${ns}:temp anchorDifference.namespace set value "diff"
        $data modify storage ${ns}:temp anchorDifference.output set value "$(output)"
        # Check if output ends with an opening bracket while arrayformat equals 1, if either are wrong then Error.
        data modify storage ${ns}:temp anchorDifference.sanityCheck set string storage ${ns}:temp anchorDifference.output -1
        data modify storage ${ns}:temp anchorDifference.reference set value "["
        ${pullDataStringEquals} {input1: "storage ${ns}:temp anchorDifference.sanityCheck", input2: "storage ${ns}:temp anchorDifference.reference", output: "score sanitycheck ${ns}-diffmath"}
        # arrayformat is 1 when we want to use the arraymacro. sanitycheck is equal to 0 when a bracket is present.
        $execute if score $(arrayformat) ${ns}-diffmath matches 1 if score sanitycheck ${ns}-diffmath matches 1 run return run ${debug.error} {input: "Arrayformat and output format mismatch! Missing bracket."}
        $execute if score $(arrayformat) ${ns}-diffmath matches 0 if score sanitycheck ${ns}-diffmath matches 0 run return run ${debug.error} {input: "Arrayformat and output format mismatch! Trailing bracket."}
        # If arrayformat is 1, use the array macro (place each coordinate into an array with a length of 3), otherwise use the axis macro (apply x, y, and z to the end of output).
        $execute if score $(arrayformat) ${ns}-diffmath matches 1 run ${storeArrayMacro} with storage ${ns}:temp anchorDifference
        $execute if score $(arrayformat) ${ns}-diffmath matches 0 run ${storeAxisMacro} with storage ${ns}:temp anchorDifference
        # Remove temporary data.
        data remove storage ${ns}:temp anchorDifference
    `;
}

// Set up the scoreboard objective and constant values.
anchorDifferenceCommands.push(`
    # Log the function call
    $${debug.run} {input: "anchorDifference with $(input) placing into $(output) depending on arrayformat: $(arrayformat)"}
    # Log the expected function path.
    ${debug.path} {input: "-> [storeArrayMacro | storeAxisMacro] X3"}
    scoreboard objectives add ${ns}-diffmath dummy
    scoreboard players set 0 ${ns}-diffmath 0
    scoreboard players set 1 ${ns}-diffmath 1
`);

anchorDifferenceCommands.push(...axis.map(createAnchorDifferenceCommands));

// Remove the temporary scoreboard.
anchorDifferenceCommands.push(`
    scoreboard objectives remove ${ns}-diffmath
`);

anchorDifference`${anchorDifferenceCommands.join('\n')}`;

// Takes an input storage location and calculates the real world coordinates by adding the anchor coordinates from the new selection.
function createConstructRealCoordinatesCommands({axis, i}) {
    return`
        # Grab the coordinates that need to be converted. They're assumed to be within an array.
        $execute store result score real${axis} ${ns}-realmath run data get $(input)${i}] 10000
        # Grab the anchor coordinates from the new selection.
        execute store result score anchor${axis} ${ns}-realmath run data get storage ${ns}:animation_data new.anchor[${i}] 10000
        # Add the anchor coordinate to the input difference to get the real world coordinate.
        scoreboard players operation real${axis} ${ns}-realmath += anchor${axis} ${ns}-realmath
        # Toss the axis, iterative variable, namespace, and output into temp storage for the macro.
        data modify storage ${ns}:temp constructRealCoordinates.axis set value ${axis}
        data modify storage ${ns}:temp constructRealCoordinates.i set value ${i}
        data modify storage ${ns}:temp constructRealCoordinates.namespace set value "real"
        $data modify storage ${ns}:temp constructRealCoordinates.output set value "$(output)"
        # Check if output ends with an opening bracket while arrayformat equals 1, if either are wrong then Error.
        data modify storage ${ns}:temp constructRealCoordinates.sanityCheck set string storage ${ns}:temp constructRealCoordinates.output -1
        data modify storage ${ns}:temp constructRealCoordinates.reference set value "["
        ${pullDataStringEquals} {input1: "storage ${ns}:temp constructRealCoordinates.sanityCheck", input2: "storage ${ns}:temp constructRealCoordinates.reference", output: "score sanitycheck ${ns}-realmath"}
        # arrayformat is 1 when we want to use the arraymacro. sanitycheck is equal to 0 when a bracket is present.
        $execute if score $(arrayformat) ${ns}-realmath matches 1 if score sanitycheck ${ns}-realmath matches 1 run return run ${debug.error} {input: "Arrayformat and output format mismatch! Missing bracket."}
        $execute if score $(arrayformat) ${ns}-realmath matches 0 if score sanitycheck ${ns}-realmath matches 0 run return run ${debug.error} {input: "Arrayformat and output format mismatch! Trailing bracket."}
        # If arrayformat is 1, use the array macro (place each coordinate into an array with a length of 3), otherwise use the axis macro (apply x, y, and z to the end of output).
        $execute if score $(arrayformat) ${ns}-realmath matches 1 run ${storeArrayMacro} with storage ${ns}:temp constructRealCoordinates
        $execute if score $(arrayformat) ${ns}-realmath matches 0 run ${storeAxisMacro} with storage ${ns}:temp constructRealCoordinates
        # Remove temporary data.
        data remove storage ${ns}:temp constructRealCoordinates
    `;
}

// Set up the scoreboard objective and constant values.
constructRealCoordinatesCommands.push(`
    # Log the function call
    $${debug.run} {input: "constructRealCoordinates with $(input) placing into $(output) depending on arrayformat: $(arrayformat)"}
    # Log the expected function path.
    ${debug.path} {input: "-> [storeArrayMacro | storeAxisMacro] X3"}
    scoreboard objectives add ${ns}-realmath dummy
    scoreboard players set 0 ${ns}-realmath 0
    scoreboard players set 1 ${ns}-realmath 1
`);

constructRealCoordinatesCommands.push(...axis.map(createConstructRealCoordinatesCommands));

// Remove the temporary scoreboard.
constructRealCoordinatesCommands.push(`
    scoreboard objectives remove ${ns}-realmath
`);

constructRealCoordinates`${constructRealCoordinatesCommands.join('\n')}`;

// Grabs size and anchor and toss them into a temporary storage place to be used in other commands. Exports data into ${ns}:temp grabsizeanchor.
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
    scoreboard objectives add ${ns}-grabSizeAnchorEditor dummy
    # Error if animation_data new.frames[$(framenum)] does not exist. (not checking anchor and size individually because 1. floods chat and 2. can run without them. Would be a warn) (contains the function name due to missing run log, because it runs every frame.)
    $execute unless data storage ${ns}:animation_data new.frames[$(framenum)] run return run ${debug.error} {input: "grabSizeAnchorEditor: No data found in new.frames[$(framenum)]"}
`);

grabSizeAnchorEditorCommands.push(...axis.map(createGrabSizeAnchorEditorCommands));

grabSizeAnchorEditorCommands.push(`
    scoreboard objectives remove ${ns}-grabSizeAnchorEditor
`);

grabSizeAnchorEditor`${grabSizeAnchorEditorCommands.join('\n')}`;

function createTwoPointCommands({axis, i}) {
    mcf[`selection/two_point_pos/calc_size_current_pos_${axis}`]`
        # Log the function call
        ${debug.run} {input: "calcSizeCurrentPos_${axis}"}
        # Calculate size by subtracting the newly selected point by anchor.
        scoreboard players operation size${axis} ${ns}-twopoint = current${axis} ${ns}-twopoint
        scoreboard players operation size${axis} ${ns}-twopoint -= anchor${axis} ${ns}-twopoint
    `
    mcf[`selection/two_point_neg/calc_size_current_neg_${axis}`]`
        # Log the function call
        ${debug.run} {input: "calcSizeCurrentNeg_${axis}"}
        # Calculate size by setting size to anchor and then subtracting off the newly selected point.
        scoreboard players operation size${axis} ${ns}-twopoint = anchor${axis} ${ns}-twopoint
        scoreboard players operation size${axis} ${ns}-twopoint -= current${axis} ${ns}-twopoint
        # Make the newly selected point the anchor.
        scoreboard players operation anchor${axis} ${ns}-twopoint = current${axis} ${ns}-twopoint
        execute store result storage ${ns}:animation_data new.anchor[${i}] double 1 run scoreboard players get anchor${axis} ${ns}-twopoint
    `
    return`
        # Store the anchor and current new position in the scoreboard.
        execute store result score anchor${axis} ${ns}-twopoint run data get storage ${ns}:animation_data new.anchor[${i}] 1
        execute store result score current${axis} ${ns}-twopoint run data get entity @s Pos[${i}] 1
        # Initialize size with 0 (it won't change if anchor and size are on the same axis.)
        scoreboard players set size${axis} ${ns}-twopoint 0
        # If the newly selected point on the ${axis} axis is more positive than the anchor,
        execute if score current${axis} ${ns}-twopoint > anchor${axis} ${ns}-twopoint run function ${ns}:selection/two_point_pos/calc_size_current_pos_${axis}
        # If the newly selected point on the ${axis} axis is more negative than the anchor,
        execute if score current${axis} ${ns}-twopoint < anchor${axis} ${ns}-twopoint run function ${ns}:selection/two_point_neg/calc_size_current_neg_${axis}
        # If the new size is greater than 47 (size of 48 after next step), decrease it to exactly 47 so that we stay within the structure block's 48 block limit.
        execute if score size${axis} ${ns}-twopoint matches 48.. run scoreboard players set size${axis} ${ns}-twopoint 47
        # Increase each axis by 1 to fully represent the full box (X1 - X2 = S - 1)
        scoreboard players add size${axis} ${ns}-twopoint 1
        execute store result storage ${ns}:animation_data new.size[${i}] double 1 run scoreboard players get size${axis} ${ns}-twopoint
    `;
}
// Set up a temporary scoreboard to do calculations in
twoPointCommands.push(`
    # Log the function call
    ${debug.run} {input: "twoPointSelection"}
    # Log the expected function path.
    ${debug.path} {input: "-> [calcSizeCurrentPos_\${axis} | calcSizeCurrentNeg_\${axis}] X3"}
    # Check if anchor exists, error if not
    execute unless data storage ${ns}:animation_data new.anchor run return run ${debug.error} {input: "No anchor found within animation_data new!"}

    scoreboard objectives add ${ns}-twopoint dummy
`)
// Add all axis-specific commands from the function above.
twoPointCommands.push(...axis.map(createTwoPointCommands))
// Remove temporary scoreboard.
twoPointCommands.push(`
    scoreboard objectives remove ${ns}-twopoint
`)
twoPointSelection`${twoPointCommands.join('\n')}`;

function createUpdateSelectionCommands({axis, i}) {
    mcf[`selection/update_selection/update_size_${axis}`]`
        # Log the function call
        ${debug.run} {input: "updateSize_${axis}"}
        # If the newly calculated difference is greater than 47 (size of 48 after we add 1 in the next step,) then set it to exactly 47 (prevents passing the 48 block limit on structure blocks.)
        execute if score diff${axis} ${ns}-math matches 48.. run scoreboard players set diff${axis} ${ns}-math 47
        # Increase the new size by 1 so it makes logical sense for a size.
        scoreboard players add diff${axis} ${ns}-math 1
        # Toss this new size into the storage.
        execute store result storage ${ns}:animation_data new.size[${i}] double 1 run scoreboard players get diff${axis} ${ns}-math
    `
    return`
        # for ${axis} axis, grab the new coordinate, anchor coordinate, and size coordinate and place those in scores.
        execute store result score add${axis} ${ns}-math run data get entity @s Pos[${i}]
        execute store result score anchor${axis} ${ns}-math run data get storage ${ns}:animation_data new.anchor[${i}] 1
        execute store result score size${axis} ${ns}-math run data get storage ${ns}:animation_data new.size[${i}] 1
        # Remove 1 from size to better represent real differences between blocks (we add one for the structure block bounding region.)
        scoreboard players remove size${axis} ${ns}-math 1
        # Using size, calculate the pos pos pos corner's coordinates.
        scoreboard players operation poscorner${axis} ${ns}-math = anchor${axis} ${ns}-math
        scoreboard players operation poscorner${axis} ${ns}-math += size${axis} ${ns}-math
        
        # If the new selection is more positive in the ${axis} axis,
        execute if score add${axis} ${ns}-math > poscorner${axis} ${ns}-math run ${a`
            # Log the function call
            ${debug.run} {input: "more pos on ${axis} axis"}
            # Calculate the difference from the new selection and the positive corner, and increase the previous size by that number.
            scoreboard players operation diff${axis} ${ns}-math = add${axis} ${ns}-math
            scoreboard players operation diff${axis} ${ns}-math -= poscorner${axis} ${ns}-math
            scoreboard players operation diff${axis} ${ns}-math += size${axis} ${ns}-math
            function ${ns}:${`selection/update_selection/update_size_${axis}`}
        `}

        # If the new selection is more negative in the ${axis} axis,
        execute if score add${axis} ${ns}-math < anchor${axis} ${ns}-math run ${a`
            # Log the function call
            ${debug.run} {input: "more neg on ${axis} axis"}
            # Set this coordinate to be included in the anchor.
            execute store result storage ${ns}:animation_data new.anchor[${i}] double 1 run scoreboard players get add${axis} ${ns}-math
            # Calculate a new size for this coordinate by setting it equal to the positive corner and subtracting the anchor.
            scoreboard players operation diff${axis} ${ns}-math = poscorner${axis} ${ns}-math
            scoreboard players operation diff${axis} ${ns}-math -= add${axis} ${ns}-math
            function ${ns}:${`selection/update_selection/update_size_${axis}`}
        `}
        
        # If the new selection is within the region on the ${axis} axis, tally this in a temporary scoreboard. If all 3 axis are within the selection, act as if this is a new corner.
        execute if score add${axis} ${ns}-math >= anchor${axis} ${ns}-math if score add${axis} ${ns}-math <= poscorner${axis} ${ns}-math run scoreboard players add inside-cube ${ns}-math 1
    `
}

// Set up a scoreboard for temporary math
updateSelectionCommands.push(`
    # Log the function call
    ${debug.run} {input: "updateSelection"}
    # Log the expected function path.
    ${debug.path} {input: "-> [[ more pos | more neg ] X1-3 -> updateSize_\${axis} X1-3 ] | twoPointSelection"}
    # Check if animation_data new has anchor and size, otherwise error.
    execute unless data storage ${ns}:animation_data new.anchor run return run ${debug.error} {input: "No anchor found within animation_data new!"}
    execute unless data storage ${ns}:animation_data new.size run return run ${debug.error} {input: "No size found within animation_data new!"}
    scoreboard objectives add ${ns}-math dummy
    scoreboard players set inside-cube ${ns}-math 0
`)

// Add all axis-specific commands from the function above.
updateSelectionCommands.push(...axis.map(createUpdateSelectionCommands))

// Remove the temporary scoreboard.
updateSelectionCommands.push(`
    execute if score inside-cube ${ns}-math matches 3 run ${twoPointSelection}
    scoreboard objectives remove ${ns}-math
`)
// Toss all commands into a function
updateSelection`${updateSelectionCommands.join('\n')}`;

// ALL COMMANDS FOR THE DISPLAY BOX. Bounding box continues down below.

// Takes the anchor position and subtracts 1 to find the structure block location. Also tosses some information into the same storage for macros (size)
function calculategrabStrBlockPosCommands({axis, i}){
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

// Set up temporary scoreboard
grabStrBlockPosCommands.push(`
    # Log the function call
    ${debug.run} {input: "grabStrBlockPos"}
    scoreboard objectives add ${ns}-calculategrabStrBlockPosCommands dummy
    # Check if animation_data new has anchor, otherwise error. Warn if size or dimension is missing.
    execute unless data storage ${ns}:animation_data new.anchor run return run ${debug.error} {input: "No anchor found within animation_data new!"}
    execute unless data storage ${ns}:animation_data new.size run ${debug.warn} {input: "No size found within animation_data new! Assuming a value of 1..."}
    execute unless data storage ${ns}:animation_data new.dimension run ${debug.error} {input: "No dimension found within animation_data new! Won't be placed into str.dimension"}
    # Grab dimension from the animation data to toss into temp storage for removing the structure block later.
    data modify storage ${ns}:temp str.dimension set from storage ${ns}:animation_data new.dimension
`);

// Add axis-specific commands from function above.
grabStrBlockPosCommands.push(...axis.map(calculategrabStrBlockPosCommands));

// Remove temporary scoreboard
grabStrBlockPosCommands.push(`
    scoreboard objectives remove ${ns}-calculategrabStrBlockPosCommands
`);

// Compile the grabStrBlockPosCommands into grabStrBlockPos
grabStrBlockPos`${grabStrBlockPosCommands.join('\n')}`;

// Holds all necessary information for each handle. xyz represent how many copies of half of size in that direction that needs to be added to the anchor coordinate to get to the position. dir represents the direction the handle faces, and align represents the axis that is parallel to that side of the selection area.
const handles = [
    {dir:"west", x:0, y:1, z:1, rotation:"[0.0f,0.0f,0.38268346f,0.9238795f]", anchorChange:true},
    {dir:"down", x:1, y:0, z:1, rotation:"[0.65328145f,0.2705981f,0.65328145f,0.2705981f]", anchorChange:true},
    {dir:"north", x:1, y:1, z:0, rotation:"[-0.2705981f,-0.6532815f,0.2705981f,0.6532815f]", anchorChange:true},
    {dir:"south", x:1, y:1, z:2, rotation:"[0.2705981f,0.65328145f,0.2705981f,0.65328145f]", anchorChange:false},
    {dir:"up", x:1, y:2, z:1, rotation:"[-0.2705981f,0.6532815f,-0.2705981f,0.6532815f]", anchorChange:false},
    {dir:"east", x:2, y:1, z:1, rotation:"[0.38268346f,0.9238795f,0.0f,0.0f]", anchorChange:false}
];

// Finds the location of each side of the selection box and moves handles to those points.
function createHandleSummonCommands({dir, x, y, z, rotation}) {
    const axisMultiplyingCommands = [];
    // We localized the mults created inside the matrix and the axis to be one variable for more reusable code
    const axesData = [
        {axis: "x", mult: x, i:0},
        {axis: "y", mult: y, i:1},
        {axis: "z", mult: z, i:2}
    ]

    for (const {axis, mult, i} of axesData) {
        // For each x y and z, we start at the anchor and add either 0 times, 1 times, or 2 times half of the size length in that direction to get to each midpoint of each side, and each corner.
        axisMultiplyingCommands.push(`
            # Finds the side math for axis: ${axis} with a multiplier of: ${mult}.
            # Grabs anchor and size out of storage. If size is missing, assume a size of 1
            execute store result score anchor${axis} ${ns}-handle run data get storage ${ns}:animation_data new.anchor[${i}] 10
            execute if data storage ${ns}:animation_data new.size store result score halfsize${axis} ${ns}-handle run data get storage ${ns}:animation_data new.size[${i}] 10
            execute unless data storage ${ns}:animation_data new.size run scoreboard players set halfsize${axis} ${ns}-handle 10
            # Sets the current position to the anchor and then adds a multiple of half of the side to get to the right coordinates.
            scoreboard players operation currentpos${axis} ${ns}-handle = anchor${axis} ${ns}-handle
            scoreboard players operation halfsize${axis} ${ns}-handle /= 2 ${ns}-handle
            scoreboard players operation additive${axis} ${ns}-handle = halfsize${axis} ${ns}-handle
            scoreboard players operation additive${axis} ${ns}-handle *= ${mult} ${ns}-handle
            scoreboard players operation currentpos${axis} ${ns}-handle += additive${axis} ${ns}-handle
            # Toss the new position directly into the entity we are executing as
            execute store result entity @s Pos[${i}] double 0.1 run scoreboard players get currentpos${axis} ${ns}-handle
            # Set our interaction entity to have the same position
            execute store result entity @n[type=minecraft:interaction,tag=${ns}-handle-${dir}] Pos[${i}] double 0.1 run scoreboard players get currentpos${axis} ${ns}-handle
        `);
    }
    // For each box, we grab the axisMultiplyingCommands from above that generate coordinates, and then summon the display at those coords using a macro.
    return`
        # Summon the new block display and execute as it
        execute summon minecraft:item_display run ${a`
            # Log the function call
            $${debug.run} {input: "Creating handle display for $(name) in direction: ${dir}"}
            # Summon in the interaction entity needed for this handle
            $summon minecraft:interaction ~ ~ ~ {height:0.25f, width:0.50f, Tags:["${ns}-handle", "${ns}-handle-interaction", "${ns}-handle-${dir}"], data:{currentAnim: $(name)}}
            # Find the coordinates needed for the block display handle and set them directly in Pos
            ${axisMultiplyingCommands.join('\n')}
            # Move interactions .125 down to center the hitbox on the arrow
            execute as @n[type=minecraft:interaction,tag=${ns}-handle-${dir}] at @s run tp @s ~ ~-0.125 ~
            # Toss on remaining needed data
            data merge entity @s {item: {id: "minecraft:arrow", count: 1, components:{"minecraft:custom_model_data": {strings: ["${ns}-handle"]}}}, transformation: {left_rotation: ${rotation}, right_rotation: [0.0f, 0.0f, 0.0f, 1.0f], scale: [0.50f, 0.50f, 0.50f], translation: [0.0f,0.0f,0.0f]}, Tags:["${ns}-handle", "${ns}-handle-${dir}"], brightness: {block:15, sky:15}}
        `} with storage ${ns}:animation_data new
    `;
}

// Create a temporary scoreboard objective for math.
handleSummonCommands.push(`
    # Log the function call
    ${debug.run} {input: "handleSummon"}
    # Log the expected function path.
    ${debug.path} {input: "-> creating handle display x6"}
    # Error if anchor or name is missing. Warn if size is missing, and assume a size of 1.
    execute unless data storage ${ns}:animation_data new.anchor run return run ${debug.error} {input: "No anchor found within animation_data new!"}
    execute unless data storage ${ns}:animation_data new.size run ${debug.warn} {input: "No size found within animation_data new! Assuming a size of 1..."}
    execute unless data storage ${ns}:animation_data new.name run return run ${debug.error} {input: "No name found within animation_data new!"}
    scoreboard objectives add ${ns}-handle dummy
    # setup a constant 0, 1, and 2 for division and multiplcation
    scoreboard players set 0 ${ns}-handle 0
    scoreboard players set 1 ${ns}-handle 1
    scoreboard players set 2 ${ns}-handle 2
`);

// Summons the handles on each side of the box.
handleSummonCommands.push(...handles.map(createHandleSummonCommands))

// Remove the temporary scoreboard.
handleSummonCommands.push(`
    scoreboard objectives remove ${ns}-handle
`);

handleSummon`${handleSummonCommands.join('\n')}`;

// Sets up the display box commands before the axis-specifc commands are compiled.
displayBoxCommands.push(`
    # Log the function call
    ${debug.run} {input: "displayBox"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabStrBlockPos -> calculateLaneX -> placeStructureBlock -> handleSummon"}
    # Error if name is missing from animation_data new.
    execute unless data storage ${ns}:animation_data new.name run return run ${debug.error} {input: "No name found within animation_data new!"}
    # Save the block at the neg neg neg corner (outside of region) to the editor dimension and place in a new structure block
    ${grabStrBlockPos}
    ${calculateLaneX} {output:"${ns}:temp str.lanex int"}
    data modify storage ${ns}:temp str.name set from storage ${ns}:animation_data new.name
    ${placeStructureBlock`
        # Log the function call
        $${debug.run} {input: "placeStructureBlock at $(x) $(y) $(z) with size $(sx) $(sy) $(sz) for $(name), storing original block at $(lanex) 0 0"}
        $clone $(x) $(y) $(z) $(x) $(y) $(z) to ${ns}:editor $(lanex) 0 0 strict
        $setblock $(x) $(y) $(z) minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:1,posY:1,posZ:1,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-base",strict:true}
        $summon minecraft:interaction $(x) $(y) $(z) {width:1.01f,height:1.01f,Tags:["${ns}-select-str-block"]}
    `} with storage ${ns}:temp str
    ${handleSummon}
    # Remove the temporary data location.
    data remove storage ${ns}:temp str
`);

displayBox`${displayBoxCommands.join('\n')}`;

// Macro command to replace the structure block with the block it used to have.
resetCornerBlock`
    # Log the function call
    $${debug.run} {input: "resetCornerBlock placing block from $(lanex) 0 0 back to $(dimension) $(x) $(y) $(z)"}
    # Warn if the structure block is missing from the selection, or if the interaction entity is missing.
    $execute unless block $(x) $(y) $(z) minecraft:structure_block run ${debug.warn} {input: "Expected structure block at $(x) $(y) $(z) is missing! Overriding..."}
    $execute positioned $(x) $(y) $(z) unless entity @n[type=minecraft:interaction, tag=${ns}-select-str-block] run ${debug.warn} {input: "Expected interaction entity to block the structure block at $(x) $(y) $(z)."}
    $clone from ${ns}:editor $(lanex) 0 0 $(lanex) 0 0 to $(dimension) $(x) $(y) $(z) strict
    $execute in ${ns}:editor run setblock $(lanex) 0 0 minecraft:air
    # Warn if the interaction entity does not exist.
    $execute positioned $(x) $(y) $(z) unless entity @n[type=minecraft:interaction, tag=${ns}-select-str-block] run ${debug.warn} {input:"No interaction entity covering the structure block! Skipping removal..."}
    $execute positioned $(x) $(y) $(z) run kill @n[type=minecraft:interaction, tag=${ns}-select-str-block]
`

// These commands grab the matrix data from the sides and subtracts one (they line up with the size manipulation needed to get to the target size). Then, we add that to size.
function createHandleExecutionCommands({dir, x, y, z, anchorChange}) {
    const axesData = [
        {axis: "x", mult: x-1, i:0},
        {axis: "y", mult: y-1, i:1},
        {axis: "z", mult: z-1, i:2}
    ]
    for (const {axis, mult, i} of axesData) {
        let executeAnchor = "";
        if (anchorChange) {
            executeAnchor = `
                function ${ns}:selection/handle_execution_math/${dir}_for_${axis}_anchor
            `;
        }
        // Create a method for each side and each axis of size, only if that axis is changing.
        if (`${mult}` != 0) {
            mcf[`selection/handle_execution_math/${dir}_for_${axis}_anchor`]`
                # Log the function call
                ${debug.run} {input: "handleExecutionMath ${dir} ${axis} anchor adjustment."}
                # Grab anchor out of storage.
                execute store result score anchor ${ns}-handle-detect run data get storage ${ns}:animation_data new.anchor[${i}]
                # Change the coordinate in coordination with the previous diff. (Reverse direction)
                scoreboard players operation anchor ${ns}-handle-detect -= diff ${ns}-handle-detect
                # Store back into the data structure.
                execute store result storage ${ns}:animation_data new.anchor[${i}] double 1 run scoreboard players get anchor ${ns}-handle-detect
            `;
            
            mcf[`selection/handle_execution_math/${dir}_for_${axis}`]`
                # Log the function call
                ${debug.run} {input: "handleExecutionMath ${dir} ${axis} size changes."}
                # Pull size out of storage. If none exists, assume a size of 1.
                execute if data storage ${ns}:animation_data new.size store result score size ${ns}-handle-detect run data get storage ${ns}:animation_data new.size[${i}]
                execute unless data storage ${ns}:animation_data new.size run scoreboard players set size ${ns}-handle-detect 1
                # Set diff to a default value of 1 for this axis
                scoreboard players set diff ${ns}-handle-detect 1
                # If the player left clicked, reverse the direction of movement (shrink instead of grow)
                execute if data entity @s attack run scoreboard players operation diff ${ns}-handle-detect *= -1 ${ns}-handle-detect
                # Change size in accordance to the calculated change above
                scoreboard players operation size ${ns}-handle-detect += diff ${ns}-handle-detect
                # If this change made size greater than 48, set diff to 0 so that the anchor doesn't move from the next commands.
                execute if score size ${ns}-handle-detect matches 49.. run scoreboard players set diff ${ns}-handle-detect 0
                # If this change made size greater than 48, set it to 48 to prevent passing the structure block's limitation.
                execute if score size ${ns}-handle-detect matches 49.. run scoreboard players set size ${ns}-handle-detect 48
                # Toss size back into the data structure. If size doesn't exist yet, create it to a base of 1, 1, 1
                execute unless data storage ${ns}:animation_data new.size run data modify storage ${ns}:animation_data new.size set value [1.0d, 1.0d, 1.0d]
                execute store result storage ${ns}:animation_data new.size[${i}] double 1 run scoreboard players get size ${ns}-handle-detect
                # If this direction would change the anchor position, change it
                ${executeAnchor}
            `;
            // Executes the above commands only if the current entity matches in direction
            handleExecutionCommands.push(`
                execute if entity @s[tag=${ns}-handle-${dir}] run function ${ns}:selection/handle_execution_math/${dir}_for_${axis}
            `);
        }
    }
}

handleExecutionCommands.push(`
    # Log the function call
    ${debug.run} {input: "handleExecution"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationData -> removeOldSelection -> grabStrBlockPos -> calculateLaneX -> resetCornerBlock -> kill old handles -> (handleExecutionMath size -> handleExecutionMath anchor) x6 -> displayBox -> cleanUpNewAnimationData"}
    # Pull the current animation's data into animation_data new.
    ${grabAnimationData} with entity @s data
    # Check if animation_data new has anchor, otherwise error. Warn if size is missing, and assume a size of 1.
    execute unless data storage ${ns}:animation_data new.anchor run return run ${debug.error} {input: "No anchor found within animation_data new!"}
    execute unless data storage ${ns}:animation_data new.size run ${debug.warn} {input: "No size found within animation_data new! Assuming size 1..."}
    # Set up the temporary scoreboard with constants needed for multiplication.
    scoreboard objectives add ${ns}-handle-detect dummy
    scoreboard players set -1 ${ns}-handle-detect -1
    scoreboard players set 0 ${ns}-handle-detect 0
    scoreboard players set 1 ${ns}-handle-detect 1
    # Reset the current display structure block.
    ${removeOldSelection`
        scoreboard objectives add ${ns}-remove-handles dummy
        ${grabStrBlockPos}
        ${calculateLaneX} {output:"${ns}:temp str.lanex int"}
        ${resetCornerBlock} with storage ${ns}:temp str
        # Take size s[x, y, z] and increase by 2 so the kill command below only removes handles associated with this selection.
        execute store result score smx ${ns}-remove-handles run data get storage ${ns}:temp str.sx
        execute store result score smy ${ns}-remove-handles run data get storage ${ns}:temp str.sy
        execute store result score smz ${ns}-remove-handles run data get storage ${ns}:temp str.sz
        execute store result storage ${ns}:temp str.smx double 1 run scoreboard players add smx ${ns}-remove-handles 2
        execute store result storage ${ns}:temp str.smy double 1 run scoreboard players add smy ${ns}-remove-handles 2
        execute store result storage ${ns}:temp str.smz double 1 run scoreboard players add smz ${ns}-remove-handles 2
        # Kill the display item_display entities from the old selection. Placed in a new function for macros.
        ${a`
            # Log the function call
            $${debug.run} {input: "killing old handles at $(x) $(y) $(z) within $(smx) $(smy) $(smz)"}
            $execute positioned $(x) $(y) $(z) run kill @e[tag=${ns}-handle, dx=$(smx), dy=$(smy), dz=$(smz)]
        `} with storage ${ns}:temp str
        # Remove the temporary data location.
        data remove storage ${ns}:temp str
        scoreboard objectives remove ${ns}-remove-handles
    `}
`);

handleExecutionCommands.push(...handles.map(createHandleExecutionCommands));

handleExecutionCommands.push(`
    # Clean up the temporary scoreboard
    scoreboard objectives remove ${ns}-handle-detect
    # This function places a structure block and handles with the right size parameters to highlight the selected area.
    ${displayBox}
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
`);

// Compile commands inside of list into one reference.
handleExecution`${handleExecutionCommands.join('\n')}`;

// For both left and right clicks of the interaction entity, run the handle commands.
export const handleDetection = `
    execute as @e[type=interaction, tag=${ns}-handle] if data entity @s interaction run ${handleExecution}
    execute as @e[type=interaction, tag=${ns}-handle] if data entity @s attack run ${handleExecution}
    # Make all handles not glowing by default.
    execute as @e[type=item_display, tag=${ns}-handle] run data merge entity @s {Glowing:0b}
`;

// Thrown into the player raycast command, if the player is looking at a handle, it will highlight. Special method is used here to make sure we are looking at the 0.25 x 0.25 interaction entity. (we check a 1x1x1 cube that is 1 - 0.125 away from our destination and a 1x1x1 cube at this current position.)
handleHighlight`
    execute positioned ~-0.875 ~-0.875 ~-0.875 as @e[dx=0, dy=0, dz=0, type=interaction, tag=${ns}-handle] as @n[type=item_display, tag=${ns}-handle] run tag @s add ${ns}-handle-select1
    execute positioned ~ ~ ~ as @e[dx=0, dy=0, dz=0, type=interaction, tag=${ns}-handle] as @n[type=item_display, tag=${ns}-handle] run tag @s add ${ns}-handle-select2
    execute as @e[type=item_display,tag=${ns}-handle-select1, tag=${ns}-handle-select2] run data merge entity @s {Glowing:1b}
    tag @e[tag=${ns}-handle-select1] remove ${ns}-handle-select1
    tag @e[tag=${ns}-handle-select2] remove ${ns}-handle-select2
`

const hoverBlock = "minecraft:light_blue_stained_glass";

// Places a temporary block intended for players to use to select off of.
placeGhost`
    # Log the function call
    ${debug.run} {input: "placeGhost"}
    # if the block at ~ ~ ~ isn't air, error.
    execute unless block ~ ~ ~ minecraft:air run return run ${debug.error} {input: "Failed to place ghost block, expecting air"}
    setblock ~ ~ ~ ${hoverBlock}
    execute align xyz positioned ~0.5 ~ ~0.5 run summon minecraft:interaction ~ ~ ~ {width:0.99f,height:0.99f,Tags:["${ns}-hover-select"]}
`

// Checks to see if the player is still looking at the temporary block placed by placeGhost. If they are, it keeps the block and interaction entity. If not, it removes both.
keepHoverSelect`
    # Log the function call - Removed for running every frame.
    # ${debug.run} {input: "keepHoverSelect"}
    execute positioned ~-0.505 ~-0.505 ~-0.505 as @e[dx=0, dy=0, dz=0, type=interaction, tag=${ns}-hover-select] run tag @s add ${ns}-hover-select1
    execute positioned ~ ~ ~ as @e[dx=0, dy=0, dz=0, type=interaction, tag=${ns}-hover-select] run tag @s add ${ns}-hover-select2
    execute as @e[type=interaction,tag=${ns}-hover-select1, tag=${ns}-hover-select2] run tag @s remove ${ns}-hover-select-delete
    tag @e[tag=${ns}-hover-select1] remove ${ns}-hover-select1
    tag @e[tag=${ns}-hover-select2] remove ${ns}-hover-select2
`

// Removes the temporary block and interaction entity if the player is no longer looking at it.
removeHovers`
    # Log the function call
    ${debug.run} {input: "removeHovers"}
    # Check if the block at ~ ~ ~ is still light_blue_stained_glass, if not error.
    execute at @s unless block ~ ~ ~ ${hoverBlock} run ${debug.warn} {input: "Hover expected ${hoverBlock} at itself. Block remains unchanged."}
    execute at @s if block ~ ~ ~ ${hoverBlock} run setblock ~ ~ ~ minecraft:air
    kill @s
`

// All nbtdata that needs to be changed (set to true by default) to make an entity "docile".
const entityAttributes = [
    {name:"NoAI"},
    {name:"Silent"},
    {name:"Glowing"},
    {name:"Invulnerable"},
    {name:"PersistenceRequired"},
    {name:"PickupDelay", value:"10s", itemOnly:true,repeated:true},
    {name:"Age", value:"0s", itemOnly:true, repeated:true},
    {name:"Motion", value:"[0.0d,0.0d,0.0d]", repeated:true}
];

// Turn all entities within the selection area "docile" (No AI, No Gravity, Silent, Invulnerable, Persistent, Full Pickup Delay and No Despawn Timer for Items)
// These commands here specifically change all of the attributes required to be docile to the executor.
function createTurnEntityDocileCommands({name, value, itemOnly, repeated}){
    let selector = ``;
    let output = "true";
    if (repeated = null) {
        selector = `unless entity @s[tag=${ns}-entity-turned-docile] `;
    }
    if (itemOnly) {
        selector.concat(`if entity @s[type=item] `);
    }
    if (value) {
        output = value;
    }
    return`
            execute ${selector}store success score ${ns}-${name} ${ns}-entity-docile run data modify entity @s ${name} set value ${output}
            execute ${selector}if score ${ns}-${name} ${ns}-entity-docile matches 1 run tag @s add ${ns}-${name}
    `;
};

turnEntityDocileCommands.push(`
    # Log the function call - Removed for running every frame
    # ${debug.run} {input: "turnEntityDocile"}
    # Warn if the entity is already docile.
    execute unless entity @s[type=item] if entity @s[tag=${ns}-entity-turned-docile] run ${debug.warn} {input: "Non-item entity is already docile, continuing anyway."}

    scoreboard objectives add ${ns}-entity-docile dummy
`);

turnEntityDocileCommands.push(...entityAttributes.map(createTurnEntityDocileCommands));

turnEntityDocileCommands.push(`
    scoreboard objectives remove ${ns}-entity-docile
    execute unless entity @s[tag=${ns}-entity-turned-docile] run tag @s add ${ns}-entity-turned-docile
`);

// These commands here specifically remove all of the attributes that make an entity docile from the executor.
function createRemoveDocileCommands({name, repeated}){
    if (repeated) {
        return`
            execute if entity @s[tag=${ns}-${name}] run tag @s remove ${ns}-${name}
        `;
    } else {
        return`
            execute if entity @s[tag=${ns}-${name}] run data modify entity @s ${name} set value false
            execute if entity @s[tag=${ns}-${name}] run tag @s remove ${ns}-${name}
        `;
    }
}

removeDocileCommands.push(`
    # Log the function call - Removed for running every frame
    # ${debug.run} {input: "removeDocile"}
    # Warn if the entity isn't docile.
    execute unless entity @s[tag=${ns}-entity-turned-docile] run ${debug.warn} {input: "Entity isn't docile, continuing anyway."}
`);

removeDocileCommands.push(...entityAttributes.map(createRemoveDocileCommands));

removeDocileCommands.push(`
    execute if entity @s[tag=${ns}-entity-turned-docile] run tag @s remove ${ns}-entity-turned-docile
`);

turnEntityDocile`${turnEntityDocileCommands.join('\n')}`;
removeDocile`${removeDocileCommands.join('\n')}`;


// This function is extremely inefficient. It is ran every frame, with some of the code only executing if the player places a new selection item frame. This part is fine.
// The issue is that afterwards, a lot of commands execute that aren't needed (like cleaning up new changes from the selections, etc.) These should be consolidated.
selectCommands.push(`
    execute as @n[type=item_frame,tag=${ns}-edge] at @s positioned ^ ^ ^-0.5 align xyz summon minecraft:marker run ${executeAsMarker`
        # Log the entry point
        ${debug.entry} {input: "from placed entity from selection item"}
        # Log the function call
        ${debug.run} {input: "executeAsMarker as a selection is being created"}
        # Log the expected function path.
        ${debug.path} {input: "-> grabAnimationData -> | removeOldSelection -> [updateSelection | createTwoPointSelection | set new selection] -> | grabStrBlockPos -> | calculateLaneX -> | resetCornerBlock -> | twoPointSelection -> displayBox -> cleanUpNewAnimationData"}
        # Pull out animation data for this selection and place it inside new. Add the name to the data temporarily.
        $${grabAnimationData} {currentAnim:$(currentAnim)}
        # If we have an anchor and a preexisting size, we must test to see if the new selection is outside of the current region, and on which axis to update the previous region by.
        execute if data storage ${ns}:animation_data new.anchor run ${removeOldSelection}
        execute if data storage ${ns}:animation_data new.anchor if data storage ${ns}:animation_data new.size run ${updateSelection}
        # If we have an anchor but not a size, calculate a size with this new corner and update the size to match. Anchor might move to stay as the most negative corner.
        execute if data storage ${ns}:animation_data new.anchor unless data storage ${ns}:animation_data new.size run ${createTwoPointSelection`
            # Log the function call
            ${debug.run} {input: "createTwoPointSelection"}
            # Set placeholder values so that they can be set to different values.
            data modify storage ${ns}:animation_data new.size set value [0.0d, 0.0d, 0.0d]
            # This function finds the most negative corner to become the anchor and the most positive corner to calculate box size. It maps through each axis.
            ${twoPointSelection}
        `}
        # If the current animation doesn't have an anchor, set the selection's dimension to the current dimension.
        execute unless data storage ${ns}:animation_data new.anchor run data modify storage ${ns}:animation_data new.dimension set from entity @p Dimension
        # If the current animation doesn't have an anchor, set the new selection position as the anchor. Item frames don't have a dimension tag, but players do, and the nearest player will be in the same dimension as the item frame.
        execute unless data storage ${ns}:animation_data new.anchor run data modify storage ${ns}:animation_data new.anchor set from entity @s Pos
        # This function places a structure block and handles with the right size parameters to highlight the selected area.
        ${displayBox}
        execute as @n[type=item_frame,tag=${ns}-edge] run kill @s
        kill @s
        # Save modifications made to the new selection.
        ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    `} with entity @n[type=item_frame,tag=${ns}-edge] data
    # Tag all HoverSelect boxes for deletion
    tag @e[type=interaction, tag=${ns}-hover-select] add ${ns}-hover-select-delete
    # Remove all docile entities.
    execute as @e[tag=${ns}-entity-turned-docile] run ${removeDocile}
    # If an entity is inside the newly created selection radius, make them docile.
    data modify storage ${ns}:temp docileSearch set from storage ${ns}:animation_data animations
    # Recursive, is called until temporary list docileSearch in animationData is empty. Goes through each animation and turns entities docile within each.
    ${recDocileSearch`
        # If this animation is not displayed anywhere, then there's no entities to be made docile. Skip to next animation.
        execute if data storage ${ns}:temp {docileSearch:[{data:{location:"none"}}]} run return run ${a`
            data remove storage ${ns}:temp docileSearch[0]
            execute if data storage ${ns}:temp docileSearch[0] run ${recDocileSearch}
        `}
        # Pull data and name into the new namespace so that functions work properly.
        data modify storage ${ns}:animation_data new set from storage ${ns}:temp docileSearch[0].data
        data modify storage ${ns}:animation_data new.name set from storage ${ns}:temp docileSearch[0].name
        # If we are in the "real world," we can run the normal grabSizeAnchor function to grab anchor coordinates and size in a macro data space.
        execute if data storage ${ns}:temp {docileSearch:[{data:{location:"anchor"}}]} run ${grabSizeAnchor}
        # If we are in the editor, we need to grab the eanchor and size of the first frame, as well as setup an incrementing variable to go between frames and a max variable to know when to stop searching (framecount)
        execute if data storage ${ns}:temp {docileSearch:[{data:{location:"editor"}}]} run ${a`
            ${grabSizeAnchorEditor} {framenum:0}
            scoreboard objectives add ${ns}-recDocile dummy
            # framenum is set to 1 as an advanced increment so that new data is pulled immediately.
            execute store result score framenum ${ns}-recDocile run data modify storage ${ns}:temp grabsizeanchor.framenum set value 1
            execute store result score totalframe ${ns}-recDocile run data get storage ${ns}:animation_data new.framecount
        `}
        # If we are rendering, we need the lanex to find the original world data to make docile. Grab the other default data for completing macros + size.
        execute if data storage ${ns}:temp {docileSearch:[{data:{location:"render"}}]} run ${a`
            ${grabSizeAnchor}
            $${a`
                $execute store result storage ${ns}:temp grabsizeanchor.ax int 48 run data get storage ${ns}:player_data players[{UUID: $(UUID)}].lane    
            `} with storage ${ns}:animation_data render_queue[{name: $(name)}]
        `} with storage ${ns}:temp docileSearch[0]
        # Use the newly placed macro data in ${ns}:temp grabsizeanchor to target select the entities.
        ${targetSelectInSelection`
            # If we are in the "real world," just execute once on the selection and turn those entities docile.
            $execute if data storage ${ns}:temp {docileSearch:[{data:{location:"anchor"}}]} positioned $(ax) $(ay) $(az) align xyz as @e[type=!player, dx=$(shx), dy=$(shy), dz=$(shz)] run ${turnEntityDocile}
            # If we are in the editor, we will execute within that dimension at the eanchor and specific frame size.
            execute if data storage ${ns}:temp {docileSearch:[{data:{location:"editor"}}]} run ${a`
                $execute in ${ns}:editor positioned $(ax) $(ay) $(az) align xyz as @e[type=!player, dx=$(shx), dy=$(shy), dz=$(shz)] run ${turnEntityDocile}
                # Clear grabsizeanchor for the next frame
                data remove storage ${ns}:temp grabsizeanchor
                # Exit the loop if we have reached the total frame count for this animation.
                execute if score framenum ${ns}-recDocile >= totalframe ${ns}-recDocile run return 1
                # Grab the next frame's eanchor and size (framenum is incremented by 1 in advance)
                $${grabSizeAnchorEditor} {framenum:$(framenum)}
                # Increase framenum by 1 in score and data.
                execute store result storage ${ns}:temp grabsizeanchor.framenum int 1 run scoreboard players add framenum ${ns}-recDocile 1
                # Execute another target selection for the next frame.
                ${targetSelectInSelection} with storage ${ns}:temp grabsizeanchor
            `} with storage ${ns}:temp grabsizeanchor
            # If the animation is currently being rendered, we let the renderer handle entities within the animation
            # But, we can still make the original entities now in the editor docile.
            $execute if data storage ${ns}:temp {docileSearch:[{data:{location:"render"}}]} positioned $(ax) 0 0 align xyz as @e[type=!player, dx=$(shx), dy=$(shy), dz=$(shz)] run ${turnEntityDocile}
        `} with storage ${ns}:temp grabsizeanchor
        # Remove trailing data.
        data remove storage ${ns}:temp grabsizeanchor
        scoreboard objectives remove ${ns}-recDocile
        data remove storage ${ns}:temp docileSearch[0]
        data remove storage ${ns}:animation_data new
        # If we have more selections to turn docile, repeat this function.
        execute if data storage ${ns}:temp docileSearch[0] run ${recDocileSearch}
    `}
    data remove storage ${ns}:temp docileSearch
`);

export const select = selectCommands.join('\n');
