// Set up stuff
import mcf from './mcf.js';
import { saveInventory, loadInventory, workingHotbar, unclaimLane, calculateLaneX } from './inventory.js';
import { grabAnimationData, grabStrBlockPos, resetCornerBlock, cleanUpNewAnimationData, anchorDifference, constructRealCoordinates } from './selection.js';
const folder = mcf.menu;
export const { setName, create, camera, cameraFinish, cameraLoad, exit, anonymous: a } = folder;
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

// Takes the player's current position and rotation and saves it into the camera data for the current animation.
camera`
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    ${grabAnimationData} with storage ${ns}:player_data current
    data modify storage ${ns}:animation_data new.camera.pos set value [0.0d, 0.0d, 0.0d]
    ${anchorDifference} {arrayformat:1, input:"entity @s Pos[", output:"storage ${ns}:animation_data new.camera.pos["}
    data modify storage ${ns}:animation_data new.camera.rot set from entity @s Rotation
    dialog show @s ${ns}:camera_info
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    data remove storage ${ns}:player_data current
`;

// Grabs the note wrote by the player in a dialog and places that into the camera's data within the animation data.
cameraFinish`
    ${a`
        $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    `} with entity @s
    ${grabAnimationData} with storage ${ns}:player_data current    
    $data modify storage ${ns}:animation_data new.camera.note set value "$(note)"
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    data remove storage ${ns}:player_data current
`;

// Takes the camera data from the animation_data and places the player at that position and rotation, along with displaying the note if there is one. Finally, puts the player into spectator mode and adds the camera view tag.
cameraLoad`
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    ${grabAnimationData} with storage ${ns}:player_data current
    ${constructRealCoordinates} {arrayformat:0, input:"storage ${ns}:animation_data new.camera.pos[", output:"storage ${ns}:temp camera."}
    data modify storage ${ns}:temp camera.yaw set from storage ${ns}:animation_data new.camera.rot[0]
    data modify storage ${ns}:temp camera.pitch set from storage ${ns}:animation_data new.camera.rot[1]
    data modify storage ${ns}:temp camera.note set from storage ${ns}:animation_data new.camera.note
    ${a`
        $tp @s $(x) $(y) $(z) $(yaw) $(pitch)
        $execute unless data storage ${ns}:temp {camera:{note:""}} run tellraw @s {text:"Camera Note: $(note)",bold:true}
    `} with storage ${ns}:temp camera
    data remove storage ${ns}:temp camera
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    data remove storage ${ns}:player_data current
    gamemode spectator @s
    tag @s add ${ns}-camera-view
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