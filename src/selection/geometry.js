// Contains all functions that relate to the bounding box / display box shown around selections

// Sets up basic stuff.
import mcf from '../mcf.js';
// Import functions needed here:
import * as debug from '../debug.js';
import { grabStrBlockPos } from './data.js';
import { calculateLaneX } from '../editor/lane.js';
import { pullDataStringEquals, axis } from '../util.js';

const folder = mcf.selection.geometry;

// Define functions you want other files to use here:
export const {
    anchorDifference, constructRealCoordinates, resetCornerBlock, twoPointSelection, updateSelection, removeOldSelection
} = folder;

// Define local functions here:
const {
    anonymous: a, storeArrayMacro, storeAxisMacro
} = folder;

const ns = 'easy-anim';

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
// Needs macro: $(type) = "a" or "frames[0].ea" to refer to either the animation's anchor or a frame's editor anchor.
const anchorDifferenceCommands = [];

function createAnchorDifferenceCommands({axis, i}) {
    return`
        # Grab the coordinates that need to be converted. They're assumed to be within an array.
        $execute store result score diff${axis} ${ns}-diffmath run data get $(input)${i}] 10000
        # Grab the anchor coordinates.
        $execute store result score anchor${axis} ${ns}-diffmath run data get storage ${ns}:animation_data new.$(type)nchor[${i}] 10000
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
    $${debug.run} {input: "anchorDifference with $(input) placing into $(output) depending on arrayformat: $(arrayformat), anchor from: $(type)"}
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
// Needs macro: $(type) = "a" or "frames[0].ea" to refer to either the animation's anchor or a frame's editor anchor.
const constructRealCoordinatesCommands = [];

function createConstructRealCoordinatesCommands({axis, i}) {
    return`
        # Grab the coordinates that need to be converted. They're assumed to be within an array.
        $execute store result score real${axis} ${ns}-realmath run data get $(input)${i}] 10000
        # Grab the anchor coordinates from the new selection.
        $execute store result score anchor${axis} ${ns}-realmath run data get storage ${ns}:animation_data new.$(type)nchor[${i}] 10000
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
    $${debug.run} {input: "constructRealCoordinates with $(input) placing into $(output) depending on arrayformat: $(arrayformat), anchor from: $(type)"}
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

// Macro command to replace the structure block with the block it used to have.
resetCornerBlock`
    # Log the function call
    $${debug.run} {input: "resetCornerBlock placing block from $(lanex) 0 0 back to $(dimension) $(x) $(y) $(z)"}
    # Warn if the structure block is missing from the selection, or if the interaction entity is missing.
    $execute unless block $(x) $(y) $(z) minecraft:structure_block run ${debug.warn} {input: "Expected structure block at $(x) $(y) $(z) is missing! Overriding..."}
    $execute positioned $(x) $(y) $(z) unless entity @n[type=minecraft:interaction, tag=${ns}-select-str-block] run ${debug.warn} {input: "Expected interaction entity to block the structure block at $(x) $(y) $(z). Skipping removal..."}
    $clone from ${ns}:editor $(lanex) 0 0 $(lanex) 0 0 to $(dimension) $(x) $(y) $(z) strict
    $execute in ${ns}:editor run setblock $(lanex) 0 0 minecraft:air
    $execute positioned $(x) $(y) $(z) run kill @n[type=minecraft:interaction, tag=${ns}-select-str-block]
`

// Does the math for creating a selection from an existing selection point and an additional selection point.
const twoPointCommands = [];

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

// updateSelection: changes size and anchor to fit in a new selection point into preexisting selection box. Selections within the box run twoPointSelection.
// Does the math to create a new volume based on 2 pre-existing corners and a new selection point to consider.
// If inside, this new point will limit the volume to this corner.
// If outside, the volume will be expanded to include this new point.
const updateSelectionCommands = [];

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

// removeOldSelection: finds and removes the old selection's structure block and any loose handles.
removeOldSelection`
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
`
