// Set up stuff
import mcf from './mcf.js';
import { saveInventory, loadInventory, workingHotbar, unclaimLane, calculateLaneX } from './inventory.js';
import { grabAnimationData, grabStrBlockPos, resetCornerBlock, cleanUpNewAnimationData } from './selection.js';
import { replaceAllInString, toLowerCase } from './util.js';
const folder = mcf.menu;
export const { setName, createSelection, createAnimation, exit, anonymous: a } = folder;
const ns = 'easy-anim';

// Sets up the lists used to compile commands.

// Sets up the name and base data needed for a new animation.
setName`
    $${replaceAllInString} {input:"$(name)", find:" ", replace:"_", output:"storage ${ns}:temp formatted.name"}
    ${a`
        $${toLowerCase} {input:"$(name)", output:"storage ${ns}:temp formatted.name"}
    `} with storage ${ns}:temp formatted
    ${a`
        $execute if data storage ${ns}:animation_data animations[{name:$(name)}] run dialog show @s ${ns}:retry_name
        $execute unless data storage ${ns}:animation_data animations[{name:$(name)}] run ${a`
            $data modify storage ${ns}:animation_data animations[{name:$(name)}].data set value {}
            $data modify storage ${ns}:player_data current.currentAnim set value $(name)
            $execute in ${ns}:editor run ${createSelection} {name:$(name)}
        `} {name:$(name)}
    `} with storage ${ns}:temp formatted
    data remove storage ${ns}:temp formatted
`;


// This runs when the player clicks the "Create New Animation" button in the main menu. Ran inside the editor dimension.
createSelection`
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

//
createAnimation`
    # Load the player's inventory from storage.
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Set animation_data new to the player's animation
    ${grabAnimationData} with storage ${ns}:player_data current
    # If there is no selected blocks, tell the player to create one first and stop.
    execute unless data storage ${ns}:animation_data new.size run return run tellraw @s {text:"You must create a selection before creating this animation!",color:"red"}
    # If there is no camera set, tell the player to set one first and stop.
    execute unless data storage ${ns}:animation_data new.camera run return run tellraw @s {text:"You must set a camera position before creating this animation!",color:"red"}

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