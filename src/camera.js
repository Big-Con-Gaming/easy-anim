// Sets up basic things.
import mcf from './mcf.js';
import {grabAnimationData, cleanUpNewAnimationData, anchorDifference, constructRealCoordinates} from './selection.js';
const folder = mcf.camera;
export const { anonymous: a, cameraSave, cameraSaveFinish, cameraLoad, exitCamera, cameraHighlight, cameraRemoveHighlight } = folder;
const ns = 'easy-anim';

// Takes the player's current position and rotation and saves it into the camera data for the current animation.
cameraSave`
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
cameraSaveFinish`
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

// When the player moves from being in a camera, it brings them back to creative and removes their tag.
exitCamera`
    gamemode creative @s
    tag @s remove ${ns}-camera-view
`;

// Removes the camera position highlight when no longer hovering over the load camera item.
cameraRemoveHighlight`
    $kill @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}]
`;

// Highlights the camera position when hovering over the load camera item.
cameraHighlight`
    execute if entity @s[tag=${ns}-camera-view] run return run ${cameraRemoveHighlight} with entity @s
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    ${grabAnimationData} with storage ${ns}:player_data current
    data merge storage ${ns}:temp {camera:{pos:[0.0d, 0.0d, 0.0d]}}
    ${constructRealCoordinates} {arrayformat:1, input:"storage ${ns}:animation_data new.camera.pos[", output:"storage ${ns}:temp camera.pos["}
    $execute unless entity @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}] summon minecraft:item_display run ${a`
        data merge entity @s {item: {components: {"minecraft:profile": {id: [I; 797692767, 214648518, -2094961131, -1410769773], properties: [{name: "textures", value: "eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvMTQ0MjJhODJjODk5YTljMTQ1NDM4NGQzMmNjNTRjNGFlN2ExYzRkNzI0MzBlNmU0NDZkNTNiOGIzODVlMzMwIn19fQ=="}]}}, count: 1, id: "minecraft:player_head"}, item_display: "ground", transformation: {left_rotation: [0.0f, 1.0f, 0.0f, 0.0f], right_rotation: [0.0f, 0.0f, 0.0f, 1.0f], scale: [1.0f, 1.0f, 1.0f], translation: [0.0f, 0.0f, 0.0f]}, Glowing:1b, Tags: ["${ns}-camera-highlight"]}
        data modify entity @s data.owner set from storage ${ns}:animation_data new.owner
        data modify entity @s Pos set from storage ${ns}:temp camera.pos
        data modify entity @s Rotation set from storage ${ns}:animation_data new.camera.rot
        execute at @s run tp @s ~ ~1.6 ~
    `}
    $execute at @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}] run ${a`
        particle minecraft:dust{scale:1,color:[1d,0d,0d]} ^ ^ ^0.5 0 0 0 0.01 0 force @a
        particle minecraft:dust{scale:1,color:[0.75d,0d,0.25d]} ^ ^ ^1 0 0 0 0.01 0 force @a
        particle minecraft:dust{scale:1,color:[0.5d,0d,0.5d]} ^ ^ ^1.5 0 0 0 0.01 0 force @a
        particle minecraft:dust{scale:1,color:[0.25d,0d,0.75d]} ^ ^ ^2 0 0 0 0.01 0 force @a
        particle minecraft:dust{scale:1,color:[0d,0d,1d]} ^ ^ ^2.5 0 0 0 0.01 0 force @a
    `}
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    data remove storage ${ns}:player_data current
    data remove storage ${ns}:temp camera
`;