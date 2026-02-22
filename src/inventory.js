// Set up stuff
import mcf from './mcf.js';
import * as debug from './debug.js';
const folder = mcf.inventory;
export const { grabOwnerPlayerData, calculateLaneX, findPlayerAxisOffset, unclaimLane, saveInventory, loadInventory, workingHotbar } = folder;
const { anonymous: a, recEditorSearch, macroUnclaim } = folder;
// grabOwnerPlayerData: Using the owner tag on a selection, it pulls that player's data into current.
// calculateLaneX: Takes the current.lane player data and multiplies by 48 to find the X coordinate. Specify an output storage position to place the number.
// findPlayerAxisOffset: searches the editor dimension recursively to find a "lane" for a player. This will be stored inside of player_data, and this function outputs into current.lane.
// recEditorSearch: The recursively looped function that looks for the lane to assign a new player. Repeats until current.lane exists in ${ns}:player_data.
// unclaimLane: Removes all data indicating the player's assignment to a lane in the editor. Uses lane data from ${ns}:player_data current.lane.
// macroUnclaim: uses the x coordinate that is placed into a macro storage to remove the bedrock block and forceloaded chunk to remove a player's lane.
// saveInventory: places the inventory of the player running this function and tosses it into player_data.current.
// loadInventory: takes the player data in player_data.current and applies it to the inventory of the player running this function.
// workingHotbar: places all of the creating a selection tools into the entity's inventory who ran the function.
const ns = 'easy-anim';

// Set up arrays for tossing commands into.
const inventorySaveCommands = [];
const inventoryLoadCommands = [];
const workingHotbarCommands = [];
const rightClickCommands = [];

// Using the owner tag on a selection, it pulls that player's data into current.

grabOwnerPlayerData`
    ${a`
        # Log the function call
        $${debug.run} {input: "grabOwnerPlayerData for $(owner)"}
        # Error if no player data exists.
        $execute unless data storage ${ns}:player_data players[{UUID:$(owner)}] run return run ${debug.error} {input: "No player data exists for $(owner)!"}
        $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(owner)}]
    `} with storage ${ns}:animation_data new
`;

// Calculates the x position from the lane value placed in the current player's data. Output is a specified path with the output macro, and the type to save the number as.

calculateLaneX`
    # Log the function call
    $${debug.run} {input: "calculateLaneX outputting to $(output)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabOwnerPlayerData"}
    ${grabOwnerPlayerData}
    # Error if the player doesn't have a lane.
    execute unless data storage ${ns}:player_data current.lane run return run ${debug.error} {input:"Player does not have an editor lane!"}
    scoreboard objectives add ${ns}-lane dummy
    scoreboard players set 48 ${ns}-lane 48
    execute store result score current-lane ${ns}-lane run data get storage ${ns}:player_data current.lane
    scoreboard players operation blocks ${ns}-lane = current-lane ${ns}-lane
    scoreboard players operation blocks ${ns}-lane *= 48 ${ns}-lane
    # Warn if output already has data. This would work except $(output) currently provides a type, which can't be used here...
    # $execute if data storage $(output) run ${debug.warn} {input:"$(output) already has data! Overwriting..."}
    $execute store result storage $(output) 1 run scoreboard players get blocks ${ns}-lane
    scoreboard objectives remove ${ns}-lane
    data remove storage ${ns}:player_data current
`;

// Searches the editor dimension recursively to find a "lane" for a player. This will be stored inside of player_data, and this function outputs into current.lane.

findPlayerAxisOffset`
    # Log the function call
    ${debug.run} {input: "findPlayerAxisOffset"}
    # Log the expected function path.
    ${debug.path} {input: "-> recEditorSearch (^ found empty lane)"}
    # Error if the player already has a lane
    execute if data storage ${ns}:player_data current.lane run ${debug.error} {input:"Player already has a lane!"}
    scoreboard objectives add ${ns}-lane dummy
    scoreboard players set current-lane ${ns}-lane 0
    execute unless data storage ${ns}:player_data current.lane in ${ns}:editor positioned 0 1 0 run ${recEditorSearch`
        # Log the function call
        ${debug.run} {input: "recEditorSearch"}
        forceload add ~ ~
        execute unless block ~ ~ ~ minecraft:bedrock run return run ${a`
            # Log the function call
            ${debug.run} {input: "found empty lane"}
            execute store result storage ${ns}:player_data current.lane int 1 run scoreboard players get current-lane ${ns}-lane
            # Warn if a non-air block is located here.
            execute unless block ~ ~ ~ minecraft:air run ${debug.warn} {input: "Non-air block found in lane! Overwriting..."}
            setblock ~ ~ ~ minecraft:bedrock
            forceload remove ~ ~
        `}
        forceload remove ~ ~
        scoreboard players add current-lane ${ns}-lane 1
        execute positioned ~48 ~ ~ run ${recEditorSearch}
    `}
    scoreboard objectives remove ${ns}-lane
`;

// Removes a player's lane by deleting the bedrock block and by unforceloading the chunk. current.lane is used and must be provided.

unclaimLane`
    # Log the function call
    ${debug.run} {input: "unclaimLane"}
    # Log the expected function path.
    ${debug.path} {input: "-> calculateLaneX -> macroUnclaim"}
    ${calculateLaneX} {output:"${ns}:temp macro_unclaim.pos int"}
    ${macroUnclaim`
        # Log the function call
        $${debug.run} {input: "macroUnclaim at x value: $(pos)"}
        # Warn if non-bedrock block is placed here.
        $execute unless block $(pos) 1 0 minecraft:bedrock run ${debug.warn} {input:"Expected bedrock at $(pos) 1 0! Overwriting..."}
        $setblock $(pos) 1 0 minecraft:air
        # Warn if we're in the first lane.
        $execute if block $(pos) 2 0 minecraft:obsidian run ${debug.warn} {input:"This is the initial lane! Skipping unload..."}
        $execute unless block $(pos) 2 0 minecraft:obsidian run forceload remove $(pos) 0
    `} with storage ${ns}:temp macro_unclaim
    data remove storage ${ns}:temp macro_unclaim
`;

// INVENTORY SAVE AND LOAD COMMANDS

// Set up barrel in editor to use for saving and loading, on load fill it preemptively with the first set of items.
inventorySaveCommands.push(`
    # Log the function call
    ${debug.run} {input: "saveInventory"}
    # Log the expected function path.
    ${debug.path} {input: "-> findPlayerAxisOffset"}
    # If the player already has data, set it into the current namespace as a base, and remove it from the list.
    ${a`
        $execute if ${ns}:player_data players[UUID:$(UUID)] run ${debug.warn} {input:"Player already has data! Merging..."}
        $execute if ${ns}:player_data players[UUID:$(UUID)] run data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[UUID:$(UUID)]
        $execute if ${ns}:player_data players[UUID:$(UUID)] run data remove storage ${ns}:player_data players[UUID:$(UUID)]
    `} with entity @s
    # Warn if overriding non-ground.
    execute in ${ns}:editor unless block 0 -31 0 minecraft:black_concrete unless block 0 -31 0 minecraft:barrel run ${debug.warn} {input:"Non-Black Concrete at barrel location! Overwriting..."}
    execute in ${ns}:editor unless block 0 -31 0 minecraft:barrel run setblock 0 -31 0 minecraft:barrel
`);

inventoryLoadCommands.push(`
    # Log the function call
    ${debug.run} {input: "loadInventory"}
    # Warn if current.inventory0 or 1 does not exist. (Can be entirely empty if player has no items)
    execute unless data storage ${ns}:player_data current.inventory0 run ${debug.warn} {input:"inventory0 is missing! Skipping..."}
    execute unless data storage ${ns}:player_data current.inventory1 run ${debug.warn} {input:"inventory1 is missing! Skipping..."}
    # Warn if overriding non-ground.
    execute in ${ns}:editor unless block 0 -31 0 minecraft:black_concrete unless block 0 -31 0 minecraft:barrel run ${debug.warn} {input:"Non-Black Concrete at barrel location! Overwriting..."}
    execute in ${ns}:editor unless block 0 -31 0 minecraft:barrel run setblock 0 -31 0 minecraft:barrel
    execute in ${ns}:editor run data modify block 0 -31 0 Items set from storage ${ns}:player_data current.inventory0    
`);

// Place the inventory into a barrel on the save side, and replace the player's inventory with the contents of the barrel on the load side.
for (let i = 0; i < 27; i++) {
    inventorySaveCommands.push(`
        execute in ${ns}:editor run item replace block 0 -31 0 container.${i} from entity @s inventory.${i}
    `);
    inventoryLoadCommands.push(`
        execute in ${ns}:editor run item replace entity @s inventory.${i} from block 0 -31 0 container.${i}
    `);
}

// Toss the inventory items into storage on the save side.
inventorySaveCommands.push(`
    execute in ${ns}:editor run data modify storage ${ns}:player_data current.inventory0 set from block 0 -31 0 Items
    execute in ${ns}:editor run data remove block 0 -31 0 Items
`);

// Retrieve the hotbar and armor items from storage on the load side.
inventoryLoadCommands.push(`
    execute in ${ns}:editor run data remove block 0 -31 0 Items
    execute in ${ns}:editor run data modify block 0 -31 0 Items set from storage ${ns}:player_data current.inventory1
`);

// Place the hotbar into a barrel on the save side, and retrieve the hotbar on the load side.
for (let i = 0; i < 9; i++) {
    inventorySaveCommands.push(`
        execute in ${ns}:editor run item replace block 0 -31 0 container.${i} from entity @s hotbar.${i}
    `);
    inventoryLoadCommands.push(`
        execute in ${ns}:editor run item replace entity @s hotbar.${i} from block 0 -31 0 container.${i}
    `);
}

// Place the armor into a barrel on the save side.
inventorySaveCommands.push(`
    execute in ${ns}:editor run item replace block 0 -31 0 container.9 from entity @s armor.head
    execute in ${ns}:editor run item replace block 0 -31 0 container.10 from entity @s armor.chest
    execute in ${ns}:editor run item replace block 0 -31 0 container.11 from entity @s armor.legs
    execute in ${ns}:editor run item replace block 0 -31 0 container.12 from entity @s armor.feet
    execute in ${ns}:editor run item replace block 0 -31 0 container.13 from entity @s weapon.offhand
`);

// Retrieve the armor on the load side.
inventoryLoadCommands.push(`
    execute in ${ns}:editor run item replace entity @s armor.head from block 0 -31 0 container.9
    execute in ${ns}:editor run item replace entity @s armor.chest from block 0 -31 0 container.10
    execute in ${ns}:editor run item replace entity @s armor.legs from block 0 -31 0 container.11
    execute in ${ns}:editor run item replace entity @s armor.feet from block 0 -31 0 container.12
    execute in ${ns}:editor run item replace entity @s weapon.offhand from block 0 -31 0 container.13
`);

// Toss the hotbar and armor items into storage.
inventorySaveCommands.push(`
    execute in ${ns}:editor run data modify storage ${ns}:player_data current.inventory1 set from block 0 -31 0 Items
    execute unless data storage ${ns}:player_data current.UUID run data modify storage ${ns}:player_data current.UUID set from entity @s UUID
    ${findPlayerAxisOffset}
    data modify storage ${ns}:player_data players append from storage ${ns}:player_data current
    execute in ${ns}:editor run setblock 0 -31 0 black_concrete
`);

inventoryLoadCommands.push(`
    execute in ${ns}:editor run setblock 0 -31 0 black_concrete
`);

// Compile the save and load commands into one function reference.
saveInventory`${inventorySaveCommands.join('\n')}`;
loadInventory`${inventoryLoadCommands.join('\n')}`;

// HOTBAR TOOLS CREATION

// Specify the hotbar tools with their display item, name, slot within the hotbar, and the function that is ran on right click.
const hotbarTools = [
    {display:`minecraft:structure_void`, name:"Select", slot:0, placeable:true, entity_data:`{id:"minecraft:item_frame",Invisible:1b,Tags:["${ns}-edge"],data:{currentAnim:$(name)}}`, on_hover:`anchored eyes positioned ^ ^ ^5 if block ~ ~ ~ minecraft:air run function ${ns}:selection/place_ghost`, on_not_hover:`as @e[type=interaction,tag=${ns}-hover-select] run function ${ns}:selection/remove_hovers`},
    {display:`minecraft:dispenser`, name:"Set Camera", slot:1, action:`camera/camera_save with entity @s`},
    {display:`minecraft:observer`, name:"Load Camera", slot:2, action:`camera/camera_load with entity @s`, on_hover:`run function ${ns}:camera/camera_highlight with entity @s`, on_not_hover:`run function ${ns}:camera/camera_remove_highlight with entity @s`},
    {display:`minecraft:paper`, name:"Create Animation", slot:7, action:`menu/create_animation with entity @s`},
    {display:`minecraft:barrier`, name:"Exit", slot:8, action: `menu/exit_selection with entity @s`, dimension: `${ns}:editor`}
];

// Sets up each item in the hotbar.
function createHotbarCommands({slot, name, display, action, dimension, placeable, entity_data, on_hover, on_not_hover}) {
    // Sets up right click detection to execute functions defined in the action field.
    
    // Assume the item ID is a carrot on a stick, but if the item is placeable, change it to an item frame. If an item frame, do not run right click detection.
    let itemId = "minecraft:carrot_on_a_stick";
    if (placeable) {
        itemId = "minecraft:item_frame";
    } else {
        // This command sets up the right click action for the item, but it's executed in tick back in index.js. If a dimension is specified, the command is executed in that dimension.
        if (dimension != null) {
            rightClickCommands.push(`
                execute in ${dimension} as @a[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}, scores={${ns}-right-click=1..}] run function ${ns}:${action}
            `);
        } else {
            rightClickCommands.push(`
                execute as @a[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}, scores={${ns}-right-click=1..}] at @s run function ${ns}:${action}
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
            execute as @a unless entity @s[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}] ${on_not_hover}
        `);
    }
    // This command places the item in the player's hotbar.
    // Creating a warn item that will be added to the start of every item replace command in case it is overwriting data.
    var itemReplaceWarn = `execute if items entity @s hotbar.${slot} * run ${debug.warn} {input:"hotbar.${slot} contains an item! Replacing..."}`;
    if (entity_data != null) {
        if (entity_data.includes("$(")) {
            return `
                ${itemReplaceWarn}
                $item replace entity @s hotbar.${slot} with ${itemId}[item_model="${display}",item_name={text:"${name}"}, entity_data=${entity_data}]
            `;
        } else {
            return `
                ${itemReplaceWarn}
                item replace entity @s hotbar.${slot} with ${itemId}[item_model="${display}",item_name={text:"${name}"}, entity_data=${entity_data}]
            `;
        }
        
    } else {
        return `
            ${itemReplaceWarn}
            item replace entity @s hotbar.${slot} with ${itemId}[item_model="${display}",item_name={text:"${name}"}]
        `;
    }
}
workingHotbarCommands.push(`
    # Log the function call
    ${debug.run} {input: "workingHotbar"}
`);
// Loop through each hotbar tool and create the commands for it.

workingHotbarCommands.push(...hotbarTools.map(createHotbarCommands));

workingHotbar`${workingHotbarCommands.join('\n')}`;

// All right click detections were declared above but will run in index.js and the tick function.

export const toolbarRightClick = rightClickCommands.join('\n');