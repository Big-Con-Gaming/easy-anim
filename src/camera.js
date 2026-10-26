// Sets up basic things.
import mcf from './mcf.js';
import * as debug from './debug.js';

import { exitRender } from './render.js';
import { quaternionToEulerNbt } from './util.js';
const folder = mcf.camera;

export const {
    placeParticleEveryTick, exitCamera, cameraDisplayParticles
} = folder;
const {
    anonymous: a, cameraApplyRotation
} = folder;
const ns = 'easy-anim';

// Only thing different from a totally normal transformation is the left rotation, it's 180 degrees around.
export const defaultCameraTransformation = "{left_rotation:[0.0f,1.0f,0.0f,0.0f],right_rotation:[0.0f,0.0f,0.0f,1.0f],scale:[1.0f,1.0f,1.0f],translation:[0.0f,0.0f,0.0f]}";

// When the player moves from being in a camera, it brings them back to creative and removes their tag.
exitCamera`
    # Log the function call
    ${debug.run} {input: "exitCamera"}
    gamemode creative @s
    # Warn if the tag is already missing.
    execute unless entity @s[tag=${ns}-camera-view] run ${debug.warn} {input: "Player is missing ${ns}-camera-view tag! Skipping..."}
    tag @s[tag=${ns}-camera-view] remove ${ns}-camera-view
    # Check if the player is within a render, and if so, exit the render. Same if they are in a load queue.
    ${a`
        $execute if data storage ${ns}:animation_data render_queue[{player: $(UUID)}] run ${exitRender} with storage ${ns}:animation_data render_queue[{player: $(UUID)}]
        $execute if data storage ${ns}:animation_data load_queue[{UUID: $(UUID)}] run ${a`
            $scoreboard players reset #$(name)_load_duration
            $data remove storage ${ns}:animation_data load_queue[{UUID: $(UUID)}]  
        `} with storage ${ns}:animation_data load_queue[{UUID: $(UUID)}]
    `} with entity @s
`;

cameraDisplayParticles`
    # Log the function call - except this will be running every tick in the editor dimension.
    # ${debug.run} {input: "cameraDisplayParticles"}
    particle minecraft:dust{scale:1,color:[1d,0d,0d]} ^ ^ ^0.5 0 0 0 0.01 0 force @a
    particle minecraft:dust{scale:1,color:[0.75d,0d,0.25d]} ^ ^ ^1 0 0 0 0.01 0 force @a
    particle minecraft:dust{scale:1,color:[0.5d,0d,0.5d]} ^ ^ ^1.5 0 0 0 0.01 0 force @a
    particle minecraft:dust{scale:1,color:[0.25d,0d,0.75d]} ^ ^ ^2 0 0 0 0.01 0 force @a
    particle minecraft:dust{scale:1,color:[0d,0d,1d]} ^ ^ ^2.5 0 0 0 0.01 0 force @a
`

cameraApplyRotation`
    # Log the function call
    ${debug.run} {input: "cameraApplyRotation"}
    # Log the function path
    ${debug.path} {input: "-> quaternionToEulerNbt"}
    # Clear possibly trailing data
    data remove storage ${ns}:temp car
    scoreboard objectives remove ${ns}-car
    # Set up scoreboard
    scoreboard objectives add ${ns}-car dummy
    # Add a constant we will use
    scoreboard players set -1 ${ns}-car -1
    # Convert quaterntion to euler and store that rotation.
    ${quaternionToEulerNbt} {input: "entity @s transformation.left_rotation", output: "storage ${ns}:temp car.Rotation"}
    # Grab the rotations and place them in scoreboard. (Could be a function but it is literally 2 things)
    execute store result score yaw ${ns}-car run data get storage ${ns}:temp car.Rotation[0] 1000
    execute store result score pitch ${ns}-car run data get storage ${ns}:temp car.Rotation[1] 1000
    # Since the camera has a 180 rotation applied in it's quaternions by default, we need to reverse the given yaw and pitch.
    # add 180 to yaw
    scoreboard players add yaw ${ns}-car 180000
    # If over 360 (360000), then subtract 360 (360000)
    execute if score yaw ${ns}-car matches 360001.. run scoreboard players remove yaw ${ns}-car 360000
    # flip the sign of pitch
    scoreboard players operation pitch ${ns}-car *= -1 ${ns}-car
    ${debug.info} {source: "storage", location: "${ns}:temp", path:"car"}
    # Place these scores into storage for the macro.
    execute store result storage ${ns}:temp car.yaw float 0.001 run scoreboard players get yaw ${ns}-car
    execute store result storage ${ns}:temp car.pitch float 0.001 run scoreboard players get pitch ${ns}-car
    # Apply the obtained rotation onto the current rotation. (Additive since the quaternion we give assumes base rotation of 0)
    ${a`
        $tp @s ~ ~ ~ ~$(yaw) ~$(pitch)    
    `} with storage ${ns}:temp car
    # Reset the full transformation. This way, any scaling or extra changes won't be retained.
    data modify entity @s transformation set value ${defaultCameraTransformation}
    # Clear trailing data
    data remove storage ${ns}:temp car
    scoreboard objectives remove ${ns}-car
`

placeParticleEveryTick`
    $execute at @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}] run ${cameraDisplayParticles}
    $execute as @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}] unless data entity @s transformation{left_rotation:[0.0f, 0.0f, 0.0f, 1.0f]} at @s run ${cameraApplyRotation}
    $execute as @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}] unless data entity @s item run data modify entity @s item set value {components: {"minecraft:profile": {id: [I; 797692767, 214648518, -2094961131, -1410769773], properties: [{name: "textures", value: "eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvMTQ0MjJhODJjODk5YTljMTQ1NDM4NGQzMmNjNTRjNGFlN2ExYzRkNzI0MzBlNmU0NDZkNTNiOGIzODVlMzMwIn19fQ=="}]}}, count: 1, id: "minecraft:player_head"}
`;
