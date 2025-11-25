// Set up stuff
import { saveInventory, loadInventory, workingHotbar } from './inventory.js';
import mcf from './mcf.js';
import { grabStrBlockPos, resetCornerBlock } from './selection.js';
const folder = mcf.menu;
export const { create, exit, anonymous: a,  } = folder;
const ns = 'easy-anim';

// Sets up the lists used to compile commands.

// This runs when the player clicks the "Create New Animation" button in the main menu. Ran inside the editor dimension.
create`
    # Save all inventory items into current, and then append current into players. Key UUID can be used to retrieve.
    ${saveInventory}
    # Remove all items and the temporary current player data.
    clear @s *
    data remove storage ${ns}:player_data current
    # Give player our full hotbar.
    ${workingHotbar}
    # Set up the data section for the new animation.
    data modify storage ${ns}:animation_data new set value {}
`;


// This runs when the player uses the exit item in their inventory. Ran inside the editor dimension.
exit`
    # Load the player's inventory from storage.
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    ${loadInventory}
    
    $data remove storage ${ns}:player_data players[{UUID:$(UUID)}]
    data remove storage ${ns}:player_data current
    ${grabStrBlockPos}
    ${resetCornerBlock} with storage ${ns}:temp str
    # Remove the temporary data locations.
    setblock 0 0 0 minecraft:air
    data remove storage ${ns}:temp str
    # Remove the new selection.
    data remove storage ${ns}:animation_data new
    # Kill the display item_display entities from the old selection.
    kill @e[tag=${ns}-handle]
`;