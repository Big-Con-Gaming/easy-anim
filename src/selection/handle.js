// Contains the main functions that make handles on selections work.

// Sets up basic stuff.
import mcf from '../mcf.js';
// Import functions needed here:
import * as debug from '../debug.js';
import { grabAnimationData, cleanUpNewAnimationData } from '../data.js';
import { removeOldSelection } from './geometry.js';
import { displayBox } from './display.js';

const folder = mcf.selection.handle;

// Define functions you want other files to use here:
export const {
    handleSummon, handleExecution, handleHighlight, handleDetection
} = folder;

// Define local functions here:
const {
    anonymous: a
} = folder;

const ns = 'easy-anim';

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

const handleSummonCommands = [];

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

const handleExecutionCommands = [];

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
    ${removeOldSelection}
`);

handleExecutionCommands.push(...handles.map(createHandleExecutionCommands));

handleExecutionCommands.push(`
    # Clean up the temporary scoreboard
    scoreboard objectives remove ${ns}-handle-detect
    # This function places a structure block and handles with the right size parameters to highlight the selected area.
    ${displayBox}
    ${handleSummon}
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
`);

// Compile commands inside of list into one reference.
handleExecution`${handleExecutionCommands.join('\n')}`;

// For both left and right clicks of the interaction entity, run the handle commands.
handleDetection`
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
