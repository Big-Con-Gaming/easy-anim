// Set up stuff
import mcf from './mcf.js';
import * as debug from './debug.js';
import { findPlayerAxisOffset } from './editor/lane.js';

const folder = mcf.inventory;
export const { saveInventory, loadInventory } = folder;
const { anonymous: a } = folder;

// saveInventory: places the inventory of the player running this function and tosses it into player_data.current.
// loadInventory: takes the player data in player_data.current and applies it to the inventory of the player running this function.
// workingHotbar: places all of the creating a selection tools into the entity's inventory who ran the function.
const ns = 'easy-anim';

// Set up arrays for tossing commands into.
const inventorySaveCommands = [];
const inventoryLoadCommands = [];

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
