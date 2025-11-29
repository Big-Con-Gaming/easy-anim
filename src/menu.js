// Set up stuff
import mcf from './mcf.js';
import { saveInventory, loadInventory, workingHotbar, unclaimLane, calculateLaneX } from './inventory.js';
import { grabAnimationData, grabStrBlockPos, resetCornerBlock, cleanUpNewAnimationData } from './selection.js';
const folder = mcf.menu;
export const { setName, create, exit, anonymous: a } = folder;
const ns = 'easy-anim';

// Sets up the lists used to compile commands.

// Sets up the name and base data needed for a new animation.
setName`
    $execute if data storage ${ns}:animation_data animations[{name:$(name)}] run dialog show @s ${ns}:retry_name
    $execute unless data storage ${ns}:animation_data animations[{name:$(name)}] run ${a`
        $data modify storage ${ns}:animation_data animations[{name:$(name)}].data set value {}
        $data modify storage ${ns}:player_data current.currentAnim set value $(name)
        $execute in ${ns}:editor run ${create} {name:$(name)}
    `} {name:$(name)}
`;


// This runs when the player clicks the "Create New Animation" button in the main menu. Ran inside the editor dimension.
create`
    # Save all inventory items into current, and then append current into players. Key UUID can be used to retrieve.
    ${saveInventory}
    # Remove all items and the temporary current player data.
    clear @s *
    data remove storage ${ns}:player_data current
    # Give player our full hotbar.
    $${workingHotbar} {name:$(name)}
    # Add the owner to the newly created animation
    $data modify storage ${ns}:animation_data animations[{name:$(name)}].data.owner set from entity @s UUID
`;

// This runs when the player uses the exit item in their inventory. Ran inside the editor dimension.
exit`
    # Load the player's inventory from storage.
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Set animation_data new to the player's animation
    ${grabAnimationData} with storage ${ns}:player_data current
    # Load the items into the player's inventory
    ${loadInventory}
    # Replace the structure block in the current selection with its old block from the lane
    ${grabStrBlockPos}
    ${calculateLaneX} {output:"${ns}:temp str.lanex"}
    ${resetCornerBlock} with storage ${ns}:temp str
    # Free up the player's old lane
    ${unclaimLane}
    # Remove the temporary data locations.
    data remove storage ${ns}:temp str
    # Bring back current data to be used to remove animation data
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Remove the player's old player data (currently still in current)
    $data remove storage ${ns}:player_data players[{UUID:$(UUID)}]
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove the new selection from animation_data entirely.
    ${a`
        $data remove storage ${ns}:animation_data animations[{name:$(currentAnim)}]
    `} with storage ${ns}:player_data current
    data remove storage ${ns}:player_data current
    # Kill the display item_display entities from the old selection.
    kill @e[tag=${ns}-handle]
`;