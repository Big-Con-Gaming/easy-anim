// Set up stuff
import mcf from './mcf.js';
const folder = mcf.menu;
export const { create, exit } = folder;
const ns = 'easy-anim';

// Sets up the lists used to compile commands.
const inventorySaveCommands = [];
const inventoryLoadCommands = [];
const workingHotbarCommands = [];
const rightClickCommands = [];
const selectCommands = [];

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
    data modify storage ${ns}.player_data current.inventory0 set from block 0 -63 0 Items
    data remove block 0 -63 0 Items
`);

// Retrieve the hotbar and armor items from storage on the load side.
inventoryLoadCommands.push(`
    data remove block 0 -63 0 Items
    data modify block 0 -63 0 Items set from storage ${ns}.player_data current.inventory1
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
    data modify storage ${ns}.player_data current.inventory1 set from block 0 -63 0 Items
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
    var itemId = "minecraft:carrot_on_a_stick";
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

selectCommands.push(`
    execute as @n[type=item_frame,tag=easy-anim-edge] at @s positioned ^ ^ ^0.5 align xyz run say to be implemented!
    execute as @n[type=item_frame,tag=easy-anim-edge] run kill @s
`);

export const select = selectCommands.join('\n');

// This runs when the player clicks the "Create New Animation" button in the main menu. Ran inside the editor dimension.
create`
    # Save all inventory items into current, and then append current into players. Key UUID can be used to retrieve.
    setblock 0 -63 0 minecraft:barrel
    ${inventorySaveCommands.join('\n')}
    data modify storage ${ns}.player_data current.UUID set from entity @s UUID
    data modify storage ${ns}.player_data players append from storage ${ns}.player_data current
    setblock 0 -63 0 black_concrete
    # Remove all items and the temporary current player data.
    clear @s *
    data remove storage ${ns}.player_data current
    # Give player our full hotbar.
    ${workingHotbarCommands.join('\n')}
`;

// This runs when the player uses the exit item in their inventory. Ran inside the editor dimension.
exit`
    # Load the player's inventory from storage.
    $data modify storage ${ns}.player_data current set from storage ${ns}.player_data players[{UUID:$(UUID)}]
    setblock 0 -63 0 minecraft:barrel
    data modify block 0 -63 0 Items set from storage ${ns}.player_data current.inventory0
    ${inventoryLoadCommands.join('\n')}
    setblock 0 -63 0 black_concrete
    $data remove storage ${ns}.player_data players[{UUID:$(UUID)}]
    data remove storage ${ns}.player_data current
`;