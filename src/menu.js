// Set up stuff
import mcf from './mcf.js';
import { saveInventory, loadInventory, workingHotbar, unclaimLane, calculateLaneX } from './inventory.js';
import { grabAnimationData, grabStrBlockPos, resetCornerBlock, cleanUpNewAnimationData, handleSummon } from './selection.js';
import { replaceAllInString, toLowerCase } from './util.js';
const folder = mcf.menu;
export const { setName, createSelection, createAnimation, exit, saveStructure, enterEditor, anonymous: a } = folder;
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
    # Save the block at the neg neg neg corner (outside of region) to the editor dimension and place in a new structure block
    ${grabStrBlockPos}
    ${calculateLaneX} {output:"${ns}:temp str.lanex"}
    scoreboard objectives add ${ns}-temp dummy
    execute store result score y-increase ${ns}-temp run data get storage ${ns}:temp str.y
    execute store result storage ${ns}:temp str.upy int 1 run scoreboard players add y-increase ${ns}-temp 1
    scoreboard objectives remove ${ns}-temp
    data modify storage ${ns}:temp str.name set from storage ${ns}:animation_data new.name
    ${saveStructure`
        $clone $(x) $(upy) $(z) $(x) $(upy) $(z) to ${ns}:editor $(lanex) 3 0 strict
        $execute positioned $(x) $(y) $(z) run kill @n[type=minecraft:interaction,tag=${ns}-select-str-block]
        $execute positioned $(x) $(y) $(z) run kill @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)]
        $setblock $(x) $(upy) $(z) minecraft:redstone_block
        $setblock $(x) $(upy) $(z) minecraft:air
        $data modify block $(x) $(y) $(z) name set value "${ns}:$(name)-frame0"
        $setblock $(x) $(upy) $(z) minecraft:redstone_block
        $data modify block $(x) $(y) $(z) name set value "${ns}:$(name)-base"
        $clone from easy-anim:editor $(lanex) 3 0 $(lanex) 3 0 $(x) $(upy) $(z) strict
        $summon minecraft:interaction $(x) $(y) $(z) {width:1.01f,height:1.01f,Tags:["${ns}-select-str-block"]}
        $execute in ${ns}:editor run setblock $(lanex) 3 0 minecraft:air
    `} with storage ${ns}:temp str
    # Insert frame 0 data into the new animation. Take all data from the base selection.
    data modify storage ${ns}:animation_data new.framecount set value 1
    data modify storage ${ns}:animation_data new.frames set value []
    data modify storage ${ns}:animation_data new.frames append value {}
    data modify storage ${ns}:animation_data new.frames[0].duration set value 0.25
    data modify storage ${ns}:animation_data new.frames[0].camera set from storage ${ns}:animation_data new.camera
    data modify storage ${ns}:animation_data new.frames[0].anchor set from storage ${ns}:animation_data new.anchor
    data modify storage ${ns}:animation_data new.frames[0].size set from storage ${ns}:animation_data new.size
    # Place the previously deleted handles back.
    ${handleSummon}
    # Save modifications made to the animation.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove the temporary data locations.
    data remove storage ${ns}:temp str
    data remove storage ${ns}:player_data current
    # Prompt the user to enter the editor.
    dialog show @s ${ns}:enter_editor
`;

// Run when the player wants to enter the editor for an existing animation.
enterEditor`

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
        $execute unless storage ${ns}:animation_data animations[{name:$(currentAnim)}].data.frames run data remove storage ${ns}:animation_data animations[{name:$(currentAnim)}]
    `} with storage ${ns}:player_data current
    data remove storage ${ns}:player_data current
    # Kill the display item_display entities from the old selection.
    kill @e[tag=${ns}-handle]
`;