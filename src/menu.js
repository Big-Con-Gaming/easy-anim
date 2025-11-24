// Set up stuff
import mcf from './mcf.js';
const folder = mcf.menu;
export const { create, exit, handleExecution, handleHighlight, place_ghost, keepHoverSelect, removeHovers, resetCornerBlock, placeStructureBlock, execute_as_marker, update_selection, create_two_point_selection, anonymous: a } = folder;
const ns = 'easy-anim';

// Sets up the lists used to compile commands.
const inventorySaveCommands = [];
const inventoryLoadCommands = [];
const workingHotbarCommands = [];
const rightClickCommands = [];
const selectCommands = [];
const twoPointCommands = [];
const displayBoxCommands = [];
const handleSummonCommands = [];
const grabStrBlockPos = [];
const updateSelectionCommands = [];
const handleExecutionCommands = [];

// INVENTORY SAVE AND LOAD COMMANDS

// Place the inventory into a barrel on the save side, and replace the player's inventory with the contents of the barrel on the load side.
for (let i = 0; i < 27; i++) {
    inventorySaveCommands.push(`
        item replace block 0 -63 0 container.${i} from entity @s inventory.${i}
    `);
    inventoryLoadCommands.push(`
        item replace entity @s inventory.${i} from block 0 -63 0 container.${i}
    `);
}

// Toss the inventory items into storage on the save side.
inventorySaveCommands.push(`
    data modify storage ${ns}:player_data current.inventory0 set from block 0 -63 0 Items
    data remove block 0 -63 0 Items
`);

// Retrieve the hotbar and armor items from storage on the load side.
inventoryLoadCommands.push(`
    data remove block 0 -63 0 Items
    data modify block 0 -63 0 Items set from storage ${ns}:player_data current.inventory1
`);

// Place the hotbar into a barrel on the save side, and retrieve the hotbar on the load side.
for (let i = 0; i < 9; i++) {
    inventorySaveCommands.push(`
        item replace block 0 -63 0 container.${i} from entity @s hotbar.${i}
    `);
    inventoryLoadCommands.push(`
        item replace entity @s hotbar.${i} from block 0 -63 0 container.${i}
    `);
}

// Place the armor into a barrel on the save side.
inventorySaveCommands.push(`
    item replace block 0 -63 0 container.9 from entity @s armor.head
    item replace block 0 -63 0 container.10 from entity @s armor.chest
    item replace block 0 -63 0 container.11 from entity @s armor.legs
    item replace block 0 -63 0 container.12 from entity @s armor.feet
    item replace block 0 -63 0 container.13 from entity @s weapon.offhand
`);

// Retrieve the armor on the load side.
inventoryLoadCommands.push(`
    item replace entity @s armor.head from block 0 -63 0 container.9
    item replace entity @s armor.chest from block 0 -63 0 container.10
    item replace entity @s armor.legs from block 0 -63 0 container.11
    item replace entity @s armor.feet from block 0 -63 0 container.12
    item replace entity @s weapon.offhand from block 0 -63 0 container.13
`);

// Toss the hotbar and armor items into storage.
inventorySaveCommands.push(`
    data modify storage ${ns}:player_data current.inventory1 set from block 0 -63 0 Items
`);

// HOTBAR TOOLS CREATION
// Specify the hotbar tools with their display item, name, slot within the hotbar, and the function that is ran on right click.
const hotbarTools = [
    {display:`minecraft:barrier`, name:"Exit", slot:8, action: `exit with entity @s`, dimension: `easy-anim:editor`},
    {display:`minecraft:structure_void`, name:"Select", slot:0, placeable:true, entity_data:`{id:"minecraft:item_frame",Invisible:1b,Tags:["easy-anim-edge"]}`, on_hover:`anchored eyes positioned ^ ^ ^5 if block ~ ~ ~ minecraft:air run function ${ns}:menu/place_ghost`, on_not_hover:`as @e[type=interaction,tag=${ns}-hover-select] run function ${ns}:menu/remove_hovers`}
];

// Sets up each item in the hotbar.
function createHotbarCommands({slot, name, display, action, dimension, placeable, entity_data, on_hover, on_not_hover}) {
    // Sets up right click detection to execute functions under the same name as action within the menu folder.
    
    // Assume the item ID is a carrot on a stick, but if the item is placeable, change it to an item frame. If an item frame, do not run right click detection.
    let itemId = "minecraft:carrot_on_a_stick";
    if (placeable) {
        itemId = "minecraft:item_frame";
    } else {
        // This command sets up the right click action for the item, but it's executed in tick back in index.js. If a dimension is specified, the command is executed in that dimension.
        if (dimension != null) {
            rightClickCommands.push(`
                execute in ${dimension} as @a[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}, scores={${ns}-right-click=1..}] run function ${ns}:menu/${action}
            `);
        } else {
            rightClickCommands.push(`
                execute as @a[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}, scores={${ns}-right-click=1..}] at @s run function ${ns}:menu/${action}
            `);
        }
    }
    // Throws specified commands into the rightClick section of commands but only executes if the item is selected, not right clicked.
    if (on_hover != null) {
        rightClickCommands.push(`
            execute as @a[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}] at @s ${on_hover}
        `);
    }
    if (on_not_hover != null) {
        rightClickCommands.push(`
            execute unless entity @a[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}] ${on_not_hover}
        `);
    }
    // This command places the item in the player's hotbar.
    if (entity_data != null) {
        return `
            item replace entity @s hotbar.${slot} with ${itemId}[item_model="${display}",item_name={text:"${name}"}, entity_data=${entity_data}]
        `;
    } else {
        return `
            item replace entity @s hotbar.${slot} with ${itemId}[item_model="${display}",item_name={text:"${name}"}]
        `;
    }
}
workingHotbarCommands.push(...hotbarTools.map(createHotbarCommands));

// All right click detections were declared above but will run in index.js and the tick function.

export const rightClick = rightClickCommands.join('\n');

// ALL COMMANDS FOR THE SELECT TOOL

// These commands construct the bounding box for the selection tool. This is done by finding the most negative and positive corners between the anchor and the newly selected block.
const axis = [
    {axis:"x",i:"0"},
    {axis:"y",i:"1"},
    {axis:"z",i:"2"}
];

function createTwoPointCommands({axis, i}) {
    mcf[`menu/two_point_pos/calc_size_current_pos_${axis}`]`
        # Calculate size by subtracting the newly selected point by anchor.
        scoreboard players operation size${axis} ${ns}-math = current${axis} ${ns}-math
        scoreboard players operation size${axis} ${ns}-math -= anchor${axis} ${ns}-math
    `
    mcf[`menu/two_point_neg/calc_size_current_neg_${axis}`]`
        # Calculate size by setting size to anchor and then subtracting off the newly selected point.
        scoreboard players operation size${axis} ${ns}-math = anchor${axis} ${ns}-math
        scoreboard players operation size${axis} ${ns}-math -= current${axis} ${ns}-math
        # Make the newly selected point the anchor.
        scoreboard players operation anchor${axis} ${ns}-math = current${axis} ${ns}-math
        execute store result storage ${ns}:animation_data new.anchor[${i}] double 1 run scoreboard players get anchor${axis} ${ns}-math
    `
    return`
        # Store the anchor and current new position in the scoreboard.
        execute store result score anchor${axis} ${ns}-math run data get storage ${ns}:animation_data new.anchor[${i}] 1
        execute store result score current${axis} ${ns}-math run data get entity @s Pos[${i}] 1
        # Initialize size with 0 (it won't change if anchor and size are on the same axis.)
        scoreboard players set size${axis} ${ns}-math 0
        # If the newly selected point on the ${axis} axis is more positive than the anchor,
        execute if score current${axis} ${ns}-math > anchor${axis} ${ns}-math run function ${ns}:menu/two_point_pos/calc_size_current_pos_${axis}
        # If the newly selected point on the ${axis} axis is more negative than the anchor,
        execute if score current${axis} ${ns}-math < anchor${axis} ${ns}-math run function ${ns}:menu/two_point_neg/calc_size_current_neg_${axis}
        # Increase each axis by 1 to fully represent the full box (X1 - X2 = S - 1)
        scoreboard players add size${axis} ${ns}-math 1
        execute store result storage ${ns}:animation_data new.size[${i}] double 1 run scoreboard players get size${axis} ${ns}-math
    `;
}
// Set up a temporary scoreboard to do calculations in
twoPointCommands.push(`
    scoreboard objectives add ${ns}-math dummy
`)
// Add all axis-specific commands from the function above.
twoPointCommands.push(...axis.map(createTwoPointCommands))
// Remove temporary scoreboard.
twoPointCommands.push(`
    scoreboard objectives remove ${ns}-math
`)

function createUpdateSelectionCommands({axis, i}) {
    mcf[`menu/update_selection/update_size_${axis}`]`
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
            function ${ns}:${`menu/update_selection/update_size_${axis}`}
        `}
        # If the new selection is more negative in the ${axis} axis,
        execute if score add${axis} ${ns}-math < anchor${axis} ${ns}-math run ${a`
            # Set this coordinate to be included in the anchor.
            execute store result storage ${ns}:animation_data new.anchor[${i}] double 1 run scoreboard players get add${axis} ${ns}-math
            # Calculate a new size for this coordinate by setting it equal to the positive corner and subtracting the anchor.
            scoreboard players operation diff${axis} ${ns}-math = poscorner${axis} ${ns}-math
            scoreboard players operation diff${axis} ${ns}-math -= add${axis} ${ns}-math
            function ${ns}:${`menu/update_selection/update_size_${axis}`}
        `}
    `
}

// Set up a scoreboard for temporary math
updateSelectionCommands.push(`
    scoreboard objectives add ${ns}-math dummy
`)

// Add all axis-specific commands from the function above.
updateSelectionCommands.push(...axis.map(createUpdateSelectionCommands))

// Remove the temporary scoreboard.
updateSelectionCommands.push(`
    scoreboard objectives remove ${ns}-math
`)

// ALL COMMANDS FOR THE DISPLAY BOX. Bounding box continues down below.

// Takes the anchor position and subtracts 1 to find the structure block location. Also tosses some information into the same storage for macros (size)
function calculateGrabStrBlockPos({axis, i}){
    return`
        # Take anchor out of storge and subtract one on all axis (position of structure block)
        execute store result score str${axis} ${ns}-calculateGrabStrBlockPos run data get storage ${ns}:animation_data new.anchor[${i}] 1
        scoreboard players remove str${axis} ${ns}-calculateGrabStrBlockPos 1
        # Give size an initial value of 1 (in case there isn't one set yet, in case there's only the anchor selected)
        data modify storage ${ns}:temp str.s${axis} set value 1
        # Toss the structure block coordinates into a temporary storage to be macroed into the command.
        execute store result storage ${ns}:temp str.${axis} int 1 run scoreboard players get str${axis} ${ns}-calculateGrabStrBlockPos
        # Toss the size of the selection into a temporary storage to be macroed into the command.
        data modify storage ${ns}:temp str.s${axis} set from storage ${ns}:animation_data new.size[${i}]
    `;
}
// Set up temporary scoreboard
grabStrBlockPos.push(`
    scoreboard objectives add ${ns}-calculateGrabStrBlockPos dummy
    # Set the dimension based on the closest player, because this command can either be executed by: the player (so @p = @s), or an item frame, which doesn't have dimension. However, the closest player will always be in the same dimension as the item frame.
    data modify storage ${ns}:temp str.dimension set from entity @p Dimension
`);
// Add axis-specific commands from function above.
grabStrBlockPos.push(...axis.map(calculateGrabStrBlockPos));
// Remove temporary scoreboard
grabStrBlockPos.push(`
    scoreboard objectives remove ${ns}-calculateGrabStrBlockPos
`);

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
            summon minecraft:interaction ~ ~ ~ {height:0.25f, width:0.50f, Tags:["${ns}-handle", "${ns}-handle-interaction", "${ns}-handle-${dir}"]}
            # Find the coordinates needed for the block display handle and set them directly in Pos
            ${axisMultiplyingCommands.join('\n')}
            # Move interactions .125 down to center the hitbox on the arrow
            execute as @n[type=minecraft:interaction,tag=${ns}-handle-${dir}] at @s run tp @s ~ ~-0.125 ~
            # Toss on remaining needed data
            data merge entity @s {item: {id: "minecraft:arrow", count: 1}, transformation: {left_rotation: ${rotation}, right_rotation: [0.0f, 0.0f, 0.0f, 1.0f], scale: [0.50f, 0.50f, 0.50f], translation: [0.0f,0.0f,0.0f]}, Tags:["${ns}-handle", "${ns}-handle-${dir}"], brightness: {block:15, sky:15}}
        `}
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

// Sets up the display box commands before the axis-specifc commands are compiled.
displayBoxCommands.push(`
    # Save the block at the neg neg neg corner (outside of region) to the editor dimension and place in a new structure block
    ${grabStrBlockPos.join('\n')}
    ${placeStructureBlock`
        $clone $(x) $(y) $(z) $(x) $(y) $(z) to ${ns}:editor 0 0 0 strict
        $setblock $(x) $(y) $(z) minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:1,posY:1,posZ:1,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"test",strict:true}
    `} with storage ${ns}:temp str
    ${handleSummonCommands.join('\n')}
    # Remove the temporary data location.
    data remove storage ${ns}:temp str
`);

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
                function ${ns}:menu/handle_execution_math/${dir}_for_${axis}_anchor
            `;
        }
        // Create a method for each side and each axis of size, only if that axis is changing.
        if (`${mult}` != 0) {
            mcf[`menu/handle_execution_math/${dir}_for_${axis}_anchor`]`
                # Grab anchor out of storage.
                execute store result score anchor ${ns}-handle-detect run data get storage ${ns}:animation_data new.anchor[${i}]
                # Change the coordinate in coordination with the previous diff. (Reverse direction)
                scoreboard players operation anchor ${ns}-handle-detect -= diff ${ns}-handle-detect
                # Store back into the data structure.
                execute store result storage ${ns}:animation_data new.anchor[${i}] double 1 run scoreboard players get anchor ${ns}-handle-detect
            `;
            
            mcf[`menu/handle_execution_math/${dir}_for_${axis}`]`
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
                execute if entity @s[tag=${ns}-handle-${dir}] run function ${ns}:menu/handle_execution_math/${dir}_for_${axis}
            `);
        }
    }
}

handleExecutionCommands.push(`
    # Set up the temporary scoreboard with constants needed for multiplication.
    scoreboard objectives add ${ns}-handle-detect dummy
    scoreboard players set -1 ${ns}-handle-detect -1
    scoreboard players set 0 ${ns}-handle-detect 0
    scoreboard players set 1 ${ns}-handle-detect 1
    # Reset the current display structure block.
    ${grabStrBlockPos.join('\n')}
    ${resetCornerBlock} with storage ${ns}:temp str
    # Kill the display item_display entities from the old selection.
    kill @e[tag=${ns}-handle]
`);

handleExecutionCommands.push(...handles.map(createHandleExecutionCommands));

handleExecutionCommands.push(`
    # Clean up the temporary scoreboard
    scoreboard objectives remove ${ns}-handle-detect
    # This function places a structure block and handles with the right size parameters to highlight the selected area.
    ${displayBoxCommands.join('\n')}
`);

// For both left and right clicks of the interaction entity, run the handle commands.
export const handleDetection = `
    execute as @e[type=interaction, tag=${ns}-handle] if data entity @s interaction run ${handleExecution`
        ${handleExecutionCommands.join('\n')}
    `}
    execute as @e[type=interaction, tag=${ns}-handle] if data entity @s attack run ${handleExecution`
        ${handleExecutionCommands.join('\n')}
    `}
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
place_ghost`
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

// Macro command to replace the structure block with the block it used to have.
resetCornerBlock`
    $clone from ${ns}:editor 0 0 0 0 0 0 to $(dimension) $(x) $(y) $(z) strict
`

selectCommands.push(`
    execute as @n[type=item_frame,tag=${ns}-edge] at @s positioned ^ ^ ^-0.5 align xyz summon minecraft:marker run ${execute_as_marker`
        # If we have an anchor and a preexisting size, we must test to see if the new selection is outside of the current region, and on which axis to update the previous region by.
        execute if data storage ${ns}:animation_data new.anchor if data storage ${ns}:animation_data new.size run ${update_selection`
            # Reset the current display structure block.
            ${grabStrBlockPos.join('\n')}
            ${resetCornerBlock} with storage ${ns}:temp str
            # Kill the display item_display entities from the old selection.
            kill @e[tag=${ns}-handle]
            # Remove the temporary data location.
            data remove storage ${ns}:temp str
            # Update the new selection.
            ${updateSelectionCommands.join('\n')}
        `}
        # If we have an anchor but not a size, calculate a size with this new corner and update the size to match. Anchor might move to stay as the most negative corner.
        execute if data storage ${ns}:animation_data new.anchor unless data storage ${ns}:animation_data new.size run ${create_two_point_selection`
            # Reset the current display structure block. (It's currently only highlighting the anchor.)
            ${grabStrBlockPos.join('\n')}
            ${resetCornerBlock} with storage ${ns}:temp str
            # Kill the display item_display entities from the old selection.
            kill @e[tag=${ns}-handle]
            # Set placeholder values so that they can be set to different values.
            data modify storage ${ns}:animation_data new.size set value [0.0d, 0.0d, 0.0d]
            # This function finds the most negative corner to become the anchor and the most positive corner to calulate box size. It maps through each axis.
            ${twoPointCommands.join('\n')}
        `}
        # If the current animation doesn't have an anchor, set the new selection position as the anchor.
        execute unless data storage ${ns}:animation_data new.anchor run data modify storage ${ns}:animation_data new.anchor set from entity @s Pos
        # This function places a structure block and handles with the right size parameters to highlight the selected area.
        ${displayBoxCommands.join('\n')}
        kill @s
    `}
    execute as @n[type=item_frame,tag=${ns}-edge] run kill @s
    # Tag all HoverSelect boxes for deletion
    tag @e[type=interaction, tag=${ns}-hover-select] add ${ns}-hover-select-delete
`);

export const select = selectCommands.join('\n');

// This runs when the player clicks the "Create New Animation" button in the main menu. Ran inside the editor dimension.
create`
    # Save all inventory items into current, and then append current into players. Key UUID can be used to retrieve.
    setblock 0 -63 0 minecraft:barrel
    ${inventorySaveCommands.join('\n')}
    data modify storage ${ns}:player_data current.UUID set from entity @s UUID
    data modify storage ${ns}:player_data players append from storage ${ns}:player_data current
    setblock 0 -63 0 black_concrete
    # Remove all items and the temporary current player data.
    clear @s *
    data remove storage ${ns}:player_data current
    # Give player our full hotbar.
    ${workingHotbarCommands.join('\n')}
    # Set up the data section for the new animation.
    data modify storage ${ns}:animation_data new set value {}
`;


// This runs when the player uses the exit item in their inventory. Ran inside the editor dimension.
exit`
    # Load the player's inventory from storage.
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    setblock 0 -63 0 minecraft:barrel
    data modify block 0 -63 0 Items set from storage ${ns}:player_data current.inventory0
    ${inventoryLoadCommands.join('\n')}
    setblock 0 -63 0 black_concrete
    $data remove storage ${ns}:player_data players[{UUID:$(UUID)}]
    data remove storage ${ns}:player_data current
    ${grabStrBlockPos.join('\n')}
    ${resetCornerBlock} with storage ${ns}:temp str
    # Remove the temporary data locations.
    setblock 0 0 0 minecraft:air
    data remove storage ${ns}:temp str
    # Remove the new selection.
    data remove storage ${ns}:animation_data new
    # Kill the display item_display entities from the old selection.
    kill @e[tag=${ns}-handle]
`;