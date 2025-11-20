// Set up stuff
import mcf from './mcf.js';
const folder = mcf.menu;
export const { create, exit, displaySummon, anonymous: a } = folder;
const ns = 'easy-anim';

// Sets up the lists used to compile commands.
const inventorySaveCommands = [];
const inventoryLoadCommands = [];
const workingHotbarCommands = [];
const rightClickCommands = [];
const selectCommands = [];
const boundingBoxCommands = [];
const displayBoxCommands = [];
const displayBoxSummonCommands = [];
const structureBlockPosition = [];

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
    {display:"minecraft:barrier", name:"Exit", slot:8, action: "exit with entity @s", dimension: "easy-anim:editor"},
    {display:"minecraft:structure_void", name:"Select", slot:0, placeable:true, entity_data:'{id:"minecraft:item_frame",Invisible:1b,Tags:["easy-anim-edge"]}'}
];

// Sets up each item in the hotbar.
function createHotbarCommands({slot, name, display, action, dimension, placeable, entity_data}) {
    // Sets up right click detection to execute functions under the same name as action within the menu folder.
    
    // Assume the item ID is a carrot on a stick, but if the item is placeable, change it to an item frame. If an item frame, do not run right click detection.
    let itemId = "minecraft:carrot_on_a_stick";
    if (placeable) {
        itemId = "minecraft:item_frame";
    } else {
        // This command sets up the right click action for the item, but it's executed in tick back in index.js. If a dimension is specified, the command is executed in that dimension.
        if (dimension != null) {
            rightClickCommands.push(`
                execute in ${dimension} as @a[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}, scores={easy-anim-right-click=1..}] run function ${ns}:menu/${action}
            `);
        } else {
            rightClickCommands.push(`
                execute as @a[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}, scores={easy-anim-right-click=1..}] run function ${ns}:menu/${action}
            `);
        }
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
const axis = ["x", "y", "z"];

function createBoundingBoxCommands(axis) {
    let i = 0;
    if (axis == "y") {i = 1};
    if (axis == "z") {i = 2};
    return`
        # Store the anchor and current new position in the scoreboard.
        execute store result score anchor${axis} easy-anim-math run data get storage easy-anim:animation_data new.anchor[${i}] 1
        execute store result score current${axis} easy-anim-math run data get entity @s Pos[${i}] 1
        # Copy the anchor to newanchor for comparison to get the most negative corner.
        scoreboard players operation newanchor${axis} easy-anim-math = anchor${axis} easy-anim-math
        # Compare the current position to the anchor and update the anchor to be the most negative corner.
        scoreboard players operation newanchor${axis} easy-anim-math < current${axis} easy-anim-math
        # Calculate the furthest positive corner from the anchor and the new position.
        scoreboard players operation poscorner${axis} easy-anim-math = current${axis} easy-anim-math
        scoreboard players operation poscorner${axis} easy-anim-math > anchor${axis} easy-anim-math
        # Calculate the size of the box by subtracting the furthest positive corner from the new anchor.
        scoreboard players operation size${axis} easy-anim-math = poscorner${axis} easy-anim-math
        scoreboard players operation size${axis} easy-anim-math -= newanchor${axis} easy-anim-math
        # Store the new anchor and size in the animation data.
        execute store result storage easy-anim:animation_data new.anchor[${i}] double 1 run scoreboard players get newanchor${axis} easy-anim-math
        execute store result storage easy-anim:animation_data new.size[${i}] double 1 run scoreboard players get size${axis} easy-anim-math
    `;
}

boundingBoxCommands.push(...axis.map(createBoundingBoxCommands))

// ALL COMMANDS FOR THE DISPLAY BOX. Bounding box continues down below.

// These commands calculate the different sides of the selector box using the different axes. mainly, just the half of size for each axis and anchor and size in 10x precision.
function createDisplayBoxCommands(axis){
    let i = 0;
    if (axis == "y") {i = 1};
    if (axis == "z") {i = 2};
    return`
        execute store result score anchor${axis} easy-anim-math run data get storage easy-anim:animation_data new.anchor[${i}] 10
        execute store result score size${axis} easy-anim-math run data get storage easy-anim:animation_data new.size[${i}] 10
        scoreboard players operation halfsize${axis} easy-anim-math = size${axis} easy-anim-math
        scoreboard players operation halfsize${axis} easy-anim-math /= 2 easy-anim-math
    `;
};

// Takes the anchor position and subtracts 1 to find the structure block location. Also tosses some information into the same storage for macros (size)
function calculateStructureBlockPosition(axis){
    let i = 0;
    if (axis == "y") {i = 1};
    if (axis == "z") {i = 2};
    return`
        execute store result score str${axis} easy-anim-math run data get storage easy-anim:animation_data new.anchor[${i}] 1
        scoreboard players remove str${axis} easy-anim-math 1
        execute store result storage easy-anim:temp str.${axis} int 1 run scoreboard players get str${axis} easy-anim-math
        data modify storage easy-anim:temp str.s${axis} set from storage easy-anim:animation_data new.size[${i}]
    `;
}

structureBlockPosition.push(...axis.map(calculateStructureBlockPosition));

// Sets up the display box commands before the axis-specifc commands are compiled.
displayBoxCommands.push(`
    # Save the block at the neg neg neg corner (outside of region) to the editor dimension and place in a new structure block
    ${a`
        $clone $(x) $(y) $(z) $(x) $(y) $(z) to easy-anim:editor 0 0 0 strict
        $setblock $(x) $(y) $(z) minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:1,posY:1,posZ:1,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"test",strict:true}
    `} with storage easy-anim:temp str
    # create a constant value of 0, 1, and 2 inside of the scoreboard.
    scoreboard players set 0 easy-anim-math 0
    scoreboard players set 1 easy-anim-math 1
    scoreboard players set 2 easy-anim-math 2
`);

// Calculates the different half size steps for each axis and their anchor and size components, scaled 10x.
// displayBoxCommands.push(...axis.map(createDisplayBoxCommands));

// The goal is to start at the anchor and then add each x, y, and z size to get to the different sides and corners of the bounding box. We'll add a half at a time, scaling x2 to get fully across. This matrix holds each combination of scaling.
const multiplicationMatrix = [];
for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
            multiplicationMatrix.push({xmult:i,ymult:j,zmult:k});
        }
    }
}

// Separated so it can be macroed, this grabs saved coordinates from the easy-anim:temp storage to place lime concrete blocks at each corner and side that are glowing.
displaySummon`
    # $summon minecraft:block_display $(x) $(y) $(z) {block_state: {Name: "minecraft:lime_concrete"}, transformation: {left_rotation: [0.0f, 0.0f, 0.0f, 1.0f], right_rotation: [0.0f, 0.0f, 0.0f, 1.0f], scale: [0.25f, 0.25f, 0.25f], translation: [-0.125f, -0.125f, -0.125f]}, Tags:["easy-anim-outline"], Glowing: true}
    # $summon minecraft:slime $(x) $(y) $(z) {Tags:["easy-anim-outline"], Glowing: true, Size:1, NoAI:true, Size:0, Silent:true, DeathLootTable:"minecraft:air", Invulnerable:true, TicksFrozen:-1, NoGravity:true, PersistenceRequired:true, active_effects:[{id: "minecraft:invisibility", duration: -1, show_particles: 0b, show_icon: 0b}]}
`;

// Creates the coordinates for each side and corner of the selection.
function createDisplayBoxSummonCommands({xmult, ymult, zmult}) {
    const axisMultiplyingCommands = [];
    // We localized the mults created inside the matrix and the axis to be one variable for more reusable code
    const axesData = [
        {axis: "x", mult: xmult},
        {axis: "y", mult: ymult},
        {axis: "z", mult: zmult}
    ]

    for (const {axis, mult} of axesData) {
        // For each x y and z, we start at the anchor and add either 0 times, 1 times, or 2 times half of the size length in that direction to get to each midpoint of each side, and each corner.
        axisMultiplyingCommands.push(`
            # Finds the side math for axis: ${axis} with a multiplier of: ${mult}.
            scoreboard players operation currentpos${axis} easy-anim-math = anchor${axis} easy-anim-math
            scoreboard players operation additive${axis} easy-anim-math = halfsize${axis} easy-anim-math
            scoreboard players operation additive${axis} easy-anim-math *= ${mult} easy-anim-math
        `);
        // We add a half step to the y-coordinate to better center the boxes
        if (axis === "y") {axisMultiplyingCommands.push(`
            scoreboard players add additivey easy-anim-math 5
        `)}
        // All of these coordinates are tossed into a temporary storage container to be mapped into a summon command.
        axisMultiplyingCommands.push(`
            scoreboard players operation currentpos${axis} easy-anim-math += additive${axis} easy-anim-math
            execute store result storage easy-anim:temp display.${axis} double 0.1 run scoreboard players get currentpos${axis} easy-anim-math
        `);
    }
    // For each box, we grab the axisMultiplyingCommands from above that generate coordinates, and then summon the display at those coords using a macro.
    return`
        ${axisMultiplyingCommands.join('\n')}
        ${displaySummon} with storage easy-anim:temp display
    `;
}

// Summons the displays at each corner and side of the area.
// displayBoxSummonCommands.push(...multiplicationMatrix.map(createDisplayBoxSummonCommands))

// Cleans up the display box by removing the temporary scoreboard.
displayBoxCommands.push(`
    # ${displayBoxSummonCommands.join('\n')}
    # Remove the temporary data location.
    data remove storage easy-anim:temp str
`);

selectCommands.push(`
    execute as @n[type=item_frame,tag=easy-anim-edge] at @s positioned ^ ^ ^-0.5 align xyz summon minecraft:marker run ${a`
        # If we have an anchor but not a size, calculate a size with this new corner and update the size to match. Anchor might move to stay as the most negative corner.
        execute if data storage easy-anim:animation_data new.anchor unless data storage easy-anim:animation_data new.size run ${a`
            # Create a temporary scoreboard to store the math.
            scoreboard objectives add easy-anim-math dummy
            # Set placeholder values so that they can be set to different values.
            data modify storage easy-anim:animation_data new.size set value [0.0d, 0.0d, 0.0d]
            # This function finds the most negative corner to become the anchor and the most positive corner to calulate box size. It maps through each axis.
            ${boundingBoxCommands.join('\n')}
            # This function places green block displays at each corner and side that glow to map the area visually to the player.
            ${displayBoxCommands.join('\n')}
            # Remove the temporary scoreboard.
            scoreboard objectives remove easy-anim-math
        `}
        # If the current animation doesn't have an anchor, set the new selection position as the anchor.
        execute unless data storage easy-anim:animation_data new.anchor run data modify storage easy-anim:animation_data new.anchor set from entity @s Pos
        kill @s
    `}
    execute as @n[type=item_frame,tag=easy-anim-edge] run kill @s
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
    # Replace the structure block with the block that was there previously
    ${structureBlockPosition.join('\n')}
    # Remove the new selection.
    data remove storage ${ns}:animation_data new
    # Kill the display block_display entities from the old selection.
    # kill @e[type=minecraft:slime,tag=easy-anim-outline]
`;