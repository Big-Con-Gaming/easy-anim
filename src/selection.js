// Set up stuff
import mcf from './mcf.js';
import { calculateLaneX } from './inventory.js';
const folder = mcf.selection;
export const { anonymous: a, grabAnimationData, cleanUpNewAnimationData, storeArrayMacro, storeAxisMacro, anchorDifference, constructRealCoordinates, grabSizeAnchor, updateSelection, grabStrBlockPos, handleSummon, displayBox, placeStructureBlock, handleExecution, resetCornerBlock, handleHighlight, placeGhost, keepHoverSelect, removeHovers, turnEntityDocile, removeDocile, executeAsMarker, updateFullSelection, createTwoPointSelection, twoPointSelection, recDocileSearch, targetSelectInSelection } = folder;
// grabAnimationData: Using currentAnim as a macro for the name of the animation, it pulls that out of animation_data into the new namespace.
// cleanUpNewAnimationData: Saves changes made to the new namespace within animation_data to the actual animation's data. Must be ran with storage ${ns}:animation_data new.
// storeArrayMacro: places data into an output array location dependent on an iterative varible i. It scales down the value by 0.0001 from a scoreboard that is named based on axis, and is in an objective suffixed with math.
// storeAxisMacro: places data into an output object location dependent on a string varible axis. It scales down the value by 0.0001 from a scoreboard that is named based on axis, and is in an objective suffixed with math.
// anchorDifference: Takes an input storage location and calculates the difference between that location and the anchor location from the new selection.
// constructRealCoordinates: Takes an input storage location and calculates the real world coordinates by adding the anchor coordinates from the new selection.
// grabSizeAnchor: Throws the anchor position, selection size, and the real size (shrunk by 1) into a temporary storage space for macros.
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
// updateFullSelection: considers the current entity's position as a third point to a current box selection and expands the selection to fit such. Uses updateSelection for the math, but also fixes the handles and the structure block.
// createTwoPointSelection: Assumes that an anchor position is the only thing created for the current selection, and treats the current entity's position as the second corner of this selection. Changes anchor and size to match the new selection.
// twoPointSelection: Finds the most negative corner to become the anchor and the most positive corner to calculate box size. It maps through each axis.
// recDocileSearch: Recursive, is called until temporary list docileSearch in animationData is empty. Goes through each animation and turns entities docile within each.
// targetSelectInSelection: using grabSizeAnchor data, it executes turnEntityDocile on every entity (besides the player) in the selection radius.

const ns = 'easy-anim';

// Set up lists that will hold commands.
const anchorDifferenceCommands = [];
const constructRealCoordinatesCommands = [];
const grabSizeAnchorCommands = [];
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
const axis = [
    {axis:"x",i:"0"},
    {axis:"y",i:"1"},
    {axis:"z",i:"2"}
];


// Using currentAnim as a macro for the name of the animation, it pulls that out of animation_data into the new namespace.
grabAnimationData`
    $data modify storage ${ns}:animation_data new set from storage ${ns}:animation_data animations[{name:$(currentAnim)}].data
    $data modify storage ${ns}:animation_data new.name set value $(currentAnim)
`;

// Saves changes made to the new namespace within animation_data to the actual animation's data. Must be ran with storage ${ns}:animation_data new.
cleanUpNewAnimationData`
    data remove storage ${ns}:animation_data new.name
    $data modify storage ${ns}:animation_data animations[{name:$(name)}].data set from storage ${ns}:animation_data new
    data remove storage ${ns}:animation_data new
`

// places data into an output array location dependent on an iterative varible i. It scales down the value by 0.0001 from a scoreboard that is named based on axis, and is in an objective suffixed with math.
storeArrayMacro`
    $execute store result $(output)$(i)] double 0.0001 run scoreboard players get $(namespace)$(axis) ${ns}-$(namespace)math
`;

// places data into an output object location dependent on a string varible axis. It scales down the value by 0.0001 from a scoreboard that is named based on axis, and is in an objective suffixed with math.
storeAxisMacro`
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
        # If arrayformat is 1, use the array macro (place each coordinate into an array with a length of 3), otherwise use the axis macro (apply x, y, and z to the end of output).
        $execute if score $(arrayformat) ${ns}-diffmath matches 1 run ${storeArrayMacro} with storage ${ns}:temp anchorDifference
        $execute if score $(arrayformat) ${ns}-diffmath matches 0 run ${storeAxisMacro} with storage ${ns}:temp anchorDifference
        # Remove temporary data.
        data remove storage ${ns}:temp anchorDifference
    `;
}

// Set up the scoreboard objective and constant values.
anchorDifferenceCommands.push(`
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
        # If arrayformat is 1, use the array macro (place each coordinate into an array with a length of 3), otherwise use the axis macro (apply x, y, and z to the end of output).
        $execute if score $(arrayformat) ${ns}-realmath matches 1 run ${storeArrayMacro} with storage ${ns}:temp constructRealCoordinates
        $execute if score $(arrayformat) ${ns}-realmath matches 0 run ${storeAxisMacro} with storage ${ns}:temp constructRealCoordinates
        # Remove temporary data.
        data remove storage ${ns}:temp constructRealCoordinates
    `;
}

// Set up the scoreboard objective and constant values.
constructRealCoordinatesCommands.push(`
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
        scoreboard players remove s${axis} ${ns}-grabSizeAnchor 1
        execute store result storage ${ns}:temp grabsizeanchor.sh${axis} int 1 run scoreboard players get s${axis} ${ns}-grabSizeAnchor
    `;
}

grabSizeAnchorCommands.push(`
    scoreboard objectives add ${ns}-grabSizeAnchor dummy
`);

grabSizeAnchorCommands.push(...axis.map(createGrabSizeAnchorCommands));

grabSizeAnchorCommands.push(`
    scoreboard objectives remove ${ns}-grabSizeAnchor
`);

grabSizeAnchor`${grabSizeAnchorCommands.join('\n')}`;

function createTwoPointCommands({axis, i}) {
    mcf[`selection/two_point_pos/calc_size_current_pos_${axis}`]`
        # Calculate size by subtracting the newly selected point by anchor.
        scoreboard players operation size${axis} ${ns}-twopoint = current${axis} ${ns}-twopoint
        scoreboard players operation size${axis} ${ns}-twopoint -= anchor${axis} ${ns}-twopoint
    `
    mcf[`selection/two_point_neg/calc_size_current_neg_${axis}`]`
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
        # Increase each axis by 1 to fully represent the full box (X1 - X2 = S - 1)
        scoreboard players add size${axis} ${ns}-twopoint 1
        execute store result storage ${ns}:animation_data new.size[${i}] double 1 run scoreboard players get size${axis} ${ns}-twopoint
    `;
}
// Set up a temporary scoreboard to do calculations in
twoPointCommands.push(`
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
            # Calculate the difference from the new selection and the positive corner, and increase the previous size by that number.
            scoreboard players operation diff${axis} ${ns}-math = add${axis} ${ns}-math
            scoreboard players operation diff${axis} ${ns}-math -= poscorner${axis} ${ns}-math
            scoreboard players operation diff${axis} ${ns}-math += size${axis} ${ns}-math
            function ${ns}:${`selection/update_selection/update_size_${axis}`}
        `}
        # If the new selection is more negative in the ${axis} axis,
        execute if score add${axis} ${ns}-math < anchor${axis} ${ns}-math run ${a`
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
        # Give size an initial value of 1 (in case there isn't one set yet, in case there's only the anchor selected)
        data modify storage ${ns}:temp str.s${axis} set value 1
        # Toss the structure block coordinates into a temporary storage to be macroed into the command.
        execute store result storage ${ns}:temp str.${axis} int 1 run scoreboard players get str${axis} ${ns}-calculategrabStrBlockPosCommands
        # Toss the size of the selection into a temporary storage to be macroed into the command.
        data modify storage ${ns}:temp str.s${axis} set from storage ${ns}:animation_data new.size[${i}]
    `;
}
// Set up temporary scoreboard
grabStrBlockPosCommands.push(`
    scoreboard objectives add ${ns}-calculategrabStrBlockPosCommands dummy
    # Set the dimension based on the closest player, because this command can either be executed by: the player (so @p = @s), or an item frame, which doesn't have dimension. However, the closest player will always be in the same dimension as the item frame.
    data modify storage ${ns}:temp str.dimension set from entity @p Dimension
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
            # Grabs anchor and size out of storage
            execute store result score anchor${axis} ${ns}-handle run data get storage ${ns}:animation_data new.anchor[${i}] 10
            execute store result score halfsize${axis} ${ns}-handle run data get storage ${ns}:animation_data new.size[${i}] 10
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
    # Save the block at the neg neg neg corner (outside of region) to the editor dimension and place in a new structure block
    ${grabStrBlockPos}
    ${calculateLaneX} {output:"${ns}:temp str.lanex"}
    data modify storage ${ns}:temp str.name set from storage ${ns}:animation_data new.name
    ${placeStructureBlock`
        $clone $(x) $(y) $(z) $(x) $(y) $(z) to ${ns}:editor $(lanex) 0 0 strict
        $setblock $(x) $(y) $(z) minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:1,posY:1,posZ:1,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)",strict:true}
        $summon minecraft:interaction $(x) $(y) $(z) {width:1.01f,height:1.01f,Tags:["${ns}-select-str-block"]}
    `} with storage ${ns}:temp str
    ${handleSummon}
    # Remove the temporary data location.
    data remove storage ${ns}:temp str
`);

displayBox`${displayBoxCommands.join('\n')}`;

// Macro command to replace the structure block with the block it used to have.
resetCornerBlock`
    $clone from ${ns}:editor $(lanex) 0 0 $(lanex) 0 0 to $(dimension) $(x) $(y) $(z) strict
    $execute in ${ns}:editor run setblock $(lanex) 0 0 minecraft:air
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
                # Grab anchor out of storage.
                execute store result score anchor ${ns}-handle-detect run data get storage ${ns}:animation_data new.anchor[${i}]
                # Change the coordinate in coordination with the previous diff. (Reverse direction)
                scoreboard players operation anchor ${ns}-handle-detect -= diff ${ns}-handle-detect
                # Store back into the data structure.
                execute store result storage ${ns}:animation_data new.anchor[${i}] double 1 run scoreboard players get anchor ${ns}-handle-detect
            `;
            
            mcf[`selection/handle_execution_math/${dir}_for_${axis}`]`
                # Pull size out of storage
                execute store result score size ${ns}-handle-detect run data get storage ${ns}:animation_data new.size[${i}]
                # Set diff to a default value of 1 for this axis
                scoreboard players set diff ${ns}-handle-detect 1
                # If the player left clicked, reverse the direction of movement (shrink instead of grow)
                execute if data entity @s attack run scoreboard players operation diff ${ns}-handle-detect *= -1 ${ns}-handle-detect
                # Change size in accordance to the calculated change above
                scoreboard players operation size ${ns}-handle-detect += diff ${ns}-handle-detect
                # Toss size back into the data structure
                execute store result storage ${ns}:animation_data new.size[${i}] double 1 run scoreboard players get size ${ns}-handle-detect
                # If this direction would change the anchor position, changei t
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
    # Pull the current animation's data into animation_data new.
    ${grabAnimationData} with entity @s data
    # Set up the temporary scoreboard with constants needed for multiplication.
    scoreboard objectives add ${ns}-handle-detect dummy
    scoreboard players set -1 ${ns}-handle-detect -1
    scoreboard players set 0 ${ns}-handle-detect 0
    scoreboard players set 1 ${ns}-handle-detect 1
    # Reset the current display structure block.
    ${grabStrBlockPos}
    ${calculateLaneX} {output:"${ns}:temp str.lanex"}
    ${resetCornerBlock} with storage ${ns}:temp str
    # Kill the display item_display entities from the old selection.
    kill @e[tag=${ns}-handle]
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
// Places a temporary block intended for players to use to select off of.
placeGhost`
    setblock ~ ~ ~ minecraft:light_blue_stained_glass
    execute align xyz positioned ~0.5 ~ ~0.5 run summon minecraft:interaction ~ ~ ~ {width:0.99f,height:0.99f,Tags:["${ns}-hover-select"]}
`
keepHoverSelect`
    execute positioned ~-0.505 ~-0.505 ~-0.505 as @e[dx=0, dy=0, dz=0, type=interaction, tag=${ns}-hover-select] run tag @s add ${ns}-hover-select1
    execute positioned ~ ~ ~ as @e[dx=0, dy=0, dz=0, type=interaction, tag=${ns}-hover-select] run tag @s add ${ns}-hover-select2
    execute as @e[type=interaction,tag=${ns}-hover-select1, tag=${ns}-hover-select2] run tag @s remove ${ns}-hover-select-delete
    tag @e[tag=${ns}-hover-select1] remove ${ns}-hover-select1
    tag @e[tag=${ns}-hover-select2] remove ${ns}-hover-select2
`
removeHovers`
    execute at @s run setblock ~ ~ ~ minecraft:air
    kill @s
`

// All nbtdata that needs to be changed (set to true by default) to make an entity "docile".
const entityAttributes = [
    {name:"NoAI"},
    {name:"NoGravity"},
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
        selector.concat(`if entity @s[type=item]` );
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
    scoreboard objectives add ${ns}-entity-docile dummy
`);

turnEntityDocileCommands.push(...entityAttributes.map(createTurnEntityDocileCommands));

turnEntityDocileCommands.push(`
    scoreboard objectives remove ${ns}-entity-docile
    execute unless entity @s[tag=${ns}-entity-turned-docile] run tag @s add ${ns}-entity-turned-docile
`);

// These commands here specifically remove all of the attributes that make an entity docile from the executor.
function createRemoveDocileCommands({name, itemOnly}){
    if (itemOnly) {
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

removeDocileCommands.push(...entityAttributes.map(createRemoveDocileCommands));

removeDocileCommands.push(`
    execute if entity @s[tag=${ns}-entity-turned-docile] run tag @s remove ${ns}-entity-turned-docile
`);

turnEntityDocile`${turnEntityDocileCommands.join('\n')}`;
removeDocile`${removeDocileCommands.join('\n')}`;

selectCommands.push(`
    execute as @n[type=item_frame,tag=${ns}-edge] at @s positioned ^ ^ ^-0.5 align xyz summon minecraft:marker run ${executeAsMarker`
        # Pull out animation data for this selection and place it inside new. Add the name to the data temporarily.
        $${grabAnimationData} {currentAnim:$(currentAnim)}
        # If we have an anchor and a preexisting size, we must test to see if the new selection is outside of the current region, and on which axis to update the previous region by.
        execute if data storage ${ns}:animation_data new.anchor if data storage ${ns}:animation_data new.size run ${updateFullSelection`
            # Reset the current display structure block.
            ${grabStrBlockPos}
            ${calculateLaneX} {output:"${ns}:temp str.lanex"}
            ${resetCornerBlock} with storage ${ns}:temp str
            # Kill the display item_display entities from the old selection.
            kill @e[tag=${ns}-handle]
            # Remove the temporary data location.
            data remove storage ${ns}:temp str
            # Update the new selection.
            ${updateSelection}
        `}
        # If we have an anchor but not a size, calculate a size with this new corner and update the size to match. Anchor might move to stay as the most negative corner.
        execute if data storage ${ns}:animation_data new.anchor unless data storage ${ns}:animation_data new.size run ${createTwoPointSelection`
            # Reset the current display structure block. (It's currently only highlighting the anchor.)
            ${grabStrBlockPos}
            ${calculateLaneX} {output:"${ns}:temp str.lanex"}
            ${resetCornerBlock} with storage ${ns}:temp str
            # Kill the display item_display entities from the old selection.
            kill @e[tag=${ns}-handle]
            # Set placeholder values so that they can be set to different values.
            data modify storage ${ns}:animation_data new.size set value [0.0d, 0.0d, 0.0d]
            # This function finds the most negative corner to become the anchor and the most positive corner to calculate box size. It maps through each axis.
            ${twoPointSelection}
        `}
        # If the current animation doesn't have an anchor, set the new selection position as the anchor.
        execute unless data storage ${ns}:animation_data new.anchor run data modify storage ${ns}:animation_data new.anchor set from entity @s Pos
        # This function places a structure block and handles with the right size parameters to highlight the selected area.
        ${displayBox}
        kill @s
    `} with entity @n[type=item_frame,tag=${ns}-edge] data
    # Save modifications made to the new selection.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    execute as @n[type=item_frame,tag=${ns}-edge] run kill @s
    # Tag all HoverSelect boxes for deletion
    tag @e[type=interaction, tag=${ns}-hover-select] add ${ns}-hover-select-delete
    # Remove all docile entities
    execute as @e[tag=${ns}-entity-turned-docile] run ${removeDocile}
    # If an entity is inside the newly created selection radius, make them docile.
    data modify storage ${ns}:temp docileSearch set from storage ${ns}:animation_data animations
    # Recursive, is called until temporary list docileSearch in animationData is empty. Goes through each animation and turns entities docile within each.
    ${recDocileSearch`
        data modify storage ${ns}:animation_data new set from storage ${ns}:temp docileSearch[0].data
        data modify storage ${ns}:animation_data new.name set from storage ${ns}:temp docileSearch[0].name
        ${grabSizeAnchor}
        ${targetSelectInSelection`
            $execute positioned $(ax) $(ay) $(az) align xyz as @e[type=!player, dx=$(shx), dy=$(shy), dz=$(shz)] run ${turnEntityDocile}
            data remove storage ${ns}:temp grabsizeanchor
        `} with storage ${ns}:temp grabsizeanchor
        data remove storage ${ns}:temp grabsizeanchor
        data remove storage ${ns}:temp docileSearch[0]
        data remove storage ${ns}:animation_data new
        execute if data storage ${ns}:temp docileSearch[] run ${recDocileSearch}
    `}
    data remove storage ${ns}:temp docileSearch
`);

export const select = selectCommands.join('\n');
