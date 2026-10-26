// Contains the camera functions intended to be used on selections in the overworld.
// Separated to remove a circular reference call between camera.js and animation.js

// Sets up basic stuff.
import mcf from '../mcf.js';
// Import functions needed here:
import * as debug from '../debug.js';
import { grabAnimationFromUuid, cleanUpNewAnimationData } from '../data.js';
import { anchorDifference, constructRealCoordinates } from '../selection/geometry.js';
import { cameraDisplayParticles, defaultCameraTransformation } from '../camera.js';
import { createAnimation } from '../animation.js';

const folder = mcf.camera.selection;

// Define functions you want other files to use here:
export const {
    cameraSave, cameraSaveFinish, cameraLoad, cameraHighlight, cameraRemoveHighlight, cameraSaveForEntity
} = folder;

// Define local functions here:
const {
    anonymous: a, checkMovedCamera, clearCrhData
} = folder;

const ns = 'easy-anim';

// Takes the player's current position and rotation and saves it into the camera data for the current animation.
cameraSave`
    # Log the entry point
    ${debug.entry} {input: "from hotbar set camera"}
    # Log the function call
    ${debug.run} {input: "cameraSave for"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> anchorDifference -> cleanUpNewAnimationData"}
    # Grab the animation's data
    ${grabAnimationFromUuid} with entity @s
    # Warn if camera data existed beforehand
    execute if data storage ${ns}:animation__data new.camera run ${debug.warn} {input: "Camera data already exists! Overwriting..."}
    # Set up default camera position and then calculate the position of the camera relative to the anchor. Store that in camera.pos.
    data modify storage ${ns}:animation_data new.camera.pos set value [0.0d, 0.0d, 0.0d]
    ${anchorDifference} {arrayformat:1, input:"entity @s Pos[", output:"storage ${ns}:animation_data new.camera.pos[", type:"a"}
    # Store rotation into camera.rot.
    data modify storage ${ns}:animation_data new.camera.rot set from entity @s Rotation
    # Show the dialog to enter a note for the camera.
    dialog show @s ${ns}:camera_info
    # Remove all temporary data.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
`;

// Grabs the note wrote by the player in a dialog and places that into the camera's data within the animation data.
cameraSaveFinish`
    # Log the entry point
    ${debug.entry} {input: "from camera_info dialog"}
    # Log the function call
    $${debug.run} {input: "cameraSaveFinish with note $(note)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> cleanUpNewAnimationData"}
    # Grab the player's animation data and insert it into new.
    ${grabAnimationFromUuid} with entity @s
    # Store the note into camera.note.
    $data modify storage ${ns}:animation_data new.camera.note set value "$(note)"
    # Remove all temporary data.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # If cs.reenteranim is set, then the player was trying to save an animation without a camera, so we let them do that right now.
    execute if data storage ${ns}:temp cs.reenteranim run ${createAnimation} with entity @s
    execute if data storage ${ns}:temp cs.reenteranim run data remove storage ${ns}:temp cs
`;

// Takes the camera data from the animation_data and places the player at that position and rotation, along with displaying the note if there is one. Finally, puts the player into spectator mode and adds the camera view tag.
cameraLoad`
    # Log the entry point
    ${debug.entry} {input: "from hotbar load camera"}
    # Log the function call
    $${debug.run} {input: "cameraLoad for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "grabAnimationFromUuid -> constructRealCoordinates -> place player at camera -> cleanUpNewAnimationData"}
    # Remove all possibly trailing data.
    data remove storage ${ns}:temp camera
    # Grab the player's animation data and insert it into new.
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Error if no camera data exists yet.
    execute unless data storage ${ns}:animation_data new.camera run return run ${debug.error} {input: "No camera data to load!"}
    # Convert camera position into real world coordinates, stored as object tags so the macro works.
    ${constructRealCoordinates} {arrayformat:0, input:"storage ${ns}:animation_data new.camera.pos[", output:"storage ${ns}:temp camera.", type:"a"}
    # Toss in yaw, pitch, and the note into a temporary storage for macros.
    data modify storage ${ns}:temp camera.yaw set from storage ${ns}:animation_data new.camera.rot[0]
    data modify storage ${ns}:temp camera.pitch set from storage ${ns}:animation_data new.camera.rot[1]
    data modify storage ${ns}:temp camera.note set from storage ${ns}:animation_data new.camera.note
    # Using a macro, teleport the player to the camera position and rotation, and display the note if there is one.
    ${a`
        $${debug.run} {input: "place player at camera at $(x) $(y) $(z) with rotation $(yaw) $(pitch) displaying note $(note)"}
        $tp @s $(x) $(y) $(z) $(yaw) $(pitch)
        $execute unless data storage ${ns}:temp {camera:{note:""}} run tellraw @s {text:"Camera Note: $(note)",bold:true}
    `} with storage ${ns}:temp camera
    # Remove all temporary data.
    data remove storage ${ns}:temp camera
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Place the player into spectator mode and add the camera view tag.
    gamemode spectator @s
    tag @s add ${ns}-camera-view
`;

// Highlights the camera position when hovering over the load camera item.
cameraHighlight`
    # Log the entry point
    ${debug.entry} {input: "from hotbar hover camera_load item"}
    # Log the function call
    $${debug.run} {input: "cameraHighlight for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> ^ if already in camera view -> grabAnimationFromUuid -> ^ exit if no camera -> constructRealCoordinates -> place camera in world -> particles -> cleanUpNewAnimationData"}
    # Remove all possibly trailing data.
    data remove storage ${ns}:temp camera
    # If the player is already in camera view, remove the highlight and exit.
    execute if entity @s[tag=${ns}-camera-view] run return run ${cameraRemoveHighlight} with entity @s
    # Grab Animation Data from UUID
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # If there is no camera data, stop.
    execute unless data storage ${ns}:animation_data new.camera run return run ${a`
        # Log the function call (would be an error except this runs every tick...)
        ${debug.run} {input: "no camera remove data"}
        data remove storage ${ns}:animation_data new
    `}
    data merge storage ${ns}:temp {camera:{pos:[0.0d, 0.0d, 0.0d]}}
    # Turn the data above into real world coordinates.
    ${constructRealCoordinates} {arrayformat:1, input:"storage ${ns}:animation_data new.camera.pos[", output:"storage ${ns}:temp camera.pos[", type:"a"}
    # If a camera isn't already made, summon one and merge on all important data (position, rotation, owner).
    $execute unless entity @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}] summon minecraft:item_display run ${a`
        ${debug.run} {input: "placing camera into world"}
        data merge entity @s {item: {components: {"minecraft:profile": {id: [I; 797692767, 214648518, -2094961131, -1410769773], properties: [{name: "textures", value: "eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvMTQ0MjJhODJjODk5YTljMTQ1NDM4NGQzMmNjNTRjNGFlN2ExYzRkNzI0MzBlNmU0NDZkNTNiOGIzODVlMzMwIn19fQ=="}]}}, count: 1, id: "minecraft:player_head"}, item_display: "ground", transformation: ${defaultCameraTransformation}, Glowing:1b, Tags: ["${ns}-camera-highlight"]}
        data modify entity @s data.owner set from storage ${ns}:animation_data new.owner
        data modify entity @s Pos set from storage ${ns}:temp camera.pos
        data modify entity @s Rotation set from storage ${ns}:animation_data new.camera.rot
        execute at @s run tp @s ~ ~1.6 ~
    `}
    # Create particles in front of the camera to better indicate direction.
    $execute at @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}] run ${cameraDisplayParticles}
    # Remove all of the extra data generated.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    data remove storage ${ns}:temp camera
`;

// Removes the camera position highlight when no longer hovering over the load camera item.

// TODO: Also, if someone just sits on the dialog and someone else runs the same command,
// Won't it just delete the trailing data we need? Might need to make it rely off of UUID

const arrayPosToDataName = [
    {name: "px", location: "pos[0]"},
    {name: "py", location: "pos[1]"},
    {name: "pz", location: "pos[2]"},
    {name: "ry", location: "rot[0]"},
    {name: "rp", location: "rot[1]"}
];

clearCrhData`
    # Log the function call
    $${debug.run} {input: "clearCrhData for $(UUID)"}
    # Remove this user's data
    $data remove storage ${ns}:temp crh.[{UUID: $(UUID)}]
    # If there's no more entries in the array, remove the whole data structure.
    execute unless data storage ${ns}:temp crh.[0] run data remove storage ${ns}:temp crh
    scoreboard objectives remove ${ns}-crhf
`;

cameraRemoveHighlight`
    # No log since this runs every tick within overworld.
    # ${debug.run} {input: "cameraRemoveHighlight"}
    # Tag the camera we are working with to simplify selectors
    $execute as @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}] run tag @s add ${ns}-camera-remove
    # If still alive, check if position or rotation changed from what is stored.
    $execute if entity @e[type=minecraft:item_display,tag=${ns}-camera-remove] run ${checkMovedCamera} {UUID: $(UUID)}
    # Kill the entity
    kill @e[type=minecraft:item_display,tag=${ns}-camera-remove]
`;

const checkMovedCameraCommands = [];

checkMovedCameraCommands.push(`
    # Log the function call
    $${debug.run} {input: "Check Moved Camera for $(UUID)"}
    # Log the function path
    ${debug.path} {input: "-> grabAnimationFromUuid -> anchorDifference -> | camera_move_selection dialog"}
    # Grab the animation data from uuid.
    ${grabAnimationFromUuid} with entity @s
    # Clear possibly trailing data
    ${clearCrhData} with entity @s
    # Pull the camera data we care about out of new.
    $data modify storage ${ns}:temp crh.[{UUID: $(UUID)}].current set from storage ${ns}:animation_data new.camera
    # Setup scoreboard
    scoreboard objectives add ${ns}-crh dummy
    # Send the camera down 1.6 on the Y to make its coordinates accurate.
    execute as @n[type=minecraft:item_display,tag=${ns}-camera-remove] at @s run tp @s ~ ~-1.6 ~
    # Set up placeholder data to replace.
    $data modify storage ${ns}:temp crh.[{UUID: $(UUID)}].pos set value [0.0f, 0.0f, 0.0f]
    # Convert pos of entity into relatives to the anchor.
    $${anchorDifference} {input: "entity @n[type=minecraft:item_display,tag=${ns}-camera-remove] Pos[", output:"storage ${ns}:temp crh.[{UUID: $(UUID)}].pos[", arrayformat: 1, type: "a"}
    # Pull all rotation data now.
    $data modify storage ${ns}:temp crh.[{UUID: $(UUID)}].rot set from entity @n[type=minecraft:item_display,tag=${ns}-camera-remove] Rotation
    # Remove trailing data
    data remove storage ${ns}:animation_data new
    # Grab all of the coordinates and rotations into scores so that they round. We LOVE floating point errors, and compare Pos and rot to see which have changed.
`);

function cmcEachAttribute({name, location}) {
    return`
        $execute store result score new${name} ${ns}-crh run data get storage ${ns}:temp crh.[{UUID: $(UUID)}].${location} 1000
        $execute store result score old${name} ${ns}-crh run data get storage ${ns}:temp crh.[{UUID: $(UUID)}].current.${location} 1000
        execute unless score new${name} ${ns}-crh = old${name} ${ns}-crh run return run dialog show @s ${ns}:camera_move_selection
    `
}

checkMovedCameraCommands.push(...arrayPosToDataName.map(cmcEachAttribute));

checkMovedCameraCommands.push(`
    # Remove trailing now useless data. This is only executed if pos and rot did NOT change
    ${clearCrhData} with entity @s
`);

checkMovedCamera(checkMovedCameraCommands.join('\n'));

cameraSaveForEntity`
    # Log the entry point
    ${debug.entry} {input: "from camera_move_selection dialog"}
    # Log the function call
    ${debug.run} {input: "cameraSaveForEntity"}
    # Log the call path
    ${debug.path} {input: "-> grabAnimationFromUuid -> cleanUpNewAnimationData"}
    # Grab the animation data from uuid.
    ${grabAnimationFromUuid} with entity @s
    # Set camera position from the stuff we calculated earlier, and grab rotation now.
    ${a`
        $data modify storage ${ns}:animation_data new.camera.pos set from storage ${ns}:temp crh.[{UUID: $(UUID)}].pos
        $data modify storage ${ns}:animation_data new.camera.rot set from storage ${ns}:temp crh.[{UUID: $(UUID)}].rot
    `} with entity @s
    # Save camera changes
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove trailing data
    ${clearCrhData} with entity @s
`;
