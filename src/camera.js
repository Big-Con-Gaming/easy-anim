// Sets up basic things.
import mcf from './mcf.js';
import * as debug from './debug.js';
import { grabAnimationFromUuid, cleanUpNewAnimationData } from './data.js';
import { anchorDifference, constructRealCoordinates } from './selection/geometry.js';
import { exitRender } from './render.js';
import { axis } from './util.js';
const folder = mcf.camera;

export const {
    anonymous: a, placeParticleEveryTick, cameraSave, cameraSaveFrame, cameraClosest, cameraLoad, cameraLoadFrame,
    cameraLoadQueueFrame, exitCamera, cameraHighlight, cameraRemoveHighlight, toggleHighlightFrame
} = folder;
const {
    cameraDisplayParticles, cameraSaveFinish, recLoad
} = folder;
const ns = 'easy-anim';

// Takes the player's current position and rotation and saves it into the camera data for the current animation.
cameraSave`
    # Log the entry point
    ${debug.entry} {input: "from hotbar set camera"}
    # Log the function call
    $${debug.run} {input: "cameraSave for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> anchorDifference -> cleanUpNewAnimationData"}
    # Grab the animation's data
    $${grabAnimationFromUuid} {UUID:$(UUID)}
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
`;

// Takes the player's current position and rotation and saves it into the camera data for the current animation.
// Needs: $(framenum) of frame and any notes placed in ${ns}:temp csf.note
cameraSaveFrame`
    # Log the function call
    $${debug.run} {input: "cameraSaveFrame for frame $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> anchorDifference"}
    # Warn if camera data existed beforehand
    $execute if data storage ${ns}:animation__data new.frames[$(framenum)].camera run ${debug.warn} {input: "Camera data already exists! Overwriting..."}
    # If there is carryover information for the camera, use that instead.
    $execute if data storage ${ns}:temp carryover.saveCamera run return run data modify storage ${ns}:animation_data new.frames[$(framenum)].camera set from storage ${ns}:temp carryover.saveCamera
    # Set up default camera position and then calculate the position of the camera relative to the anchor. Store that in camera.pos.
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].camera.pos set value [0.0d, 0.0d, 0.0d]
    $${anchorDifference} {arrayformat:1, input:"entity @s Pos[", output:"storage ${ns}:animation_data new.frames[$(framenum)].camera.pos[", type:"frames[$(framenum)].ea"}
    # Store rotation into camera.rot.
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].camera.rot set from entity @s Rotation
    # Store the note into camera.note.
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].camera.note set from storage ${ns}:temp csf.note
    # Store all of the new camera data into the carryover data.
    $data modify storage ${ns}:temp carryover.saveCamera set from storage ${ns}:animation_data new.frames[$(framenum)].camera
`;

const cameraClosestCommands = [];

function createCameraClosestCommands({axis, i}) {
    return `
        # Place anchor into scores
        execute store result score a${axis} ${ns}-camclose run data get storage ${ns}:temp grabsizeanchor.a${axis} 100000
        # Place size into scores (and divide them by 2)
        execute store result score s${axis} ${ns}-camclose run data get storage ${ns}:temp grabsizeanchor.s${axis} 50000
        # Add anchors with sizes to get coordinates of the center of the selection.
        scoreboard players operation a${axis} ${ns}-camclose += s${axis} ${ns}-camclose
        # Place player coordinates into scores.
        execute store result score p${axis} ${ns}-camclose run data get entity @s Pos[${i}] 100000
        # Subtract center coordinates from player coordinates to get distance.
        scoreboard players operation a${axis} ${ns}-camclose -= p${axis} ${ns}-camclose
        execute if score a${axis} ${ns}-camclose matches ..-1 run scoreboard players operation a${axis} ${ns}-camclose *= -1 ${ns}-camclose
    `
}

// We are given a[x-z], s[x-z], and framenum from macro input from operationOnSelectedFrames.
cameraClosestCommands.push(`
    # Log the function call
    $${debug.run} {input: "cameraClosest at $(ax) $(ay) $(az) spanning $(sx) $(sy) $(sz) for frame $(framenum)"}
    # If the closest has already been found, exit.
    execute if score closest ${ns}-camclose matches 0 run return 1
    # For this frame, check if the player is within the frame, if so store our framenum as closest.
    $execute positioned $(ax) $(ay) $(az) if entity @s[dx=$(sx),dy=$(sy),dz=$(sz)] run data modify storage ${ns}:temp csf.framenum set value $(framenum)
    $execute positioned $(ax) $(ay) $(az) if entity @s[dx=$(sx),dy=$(sy),dz=$(sz)] run return run scoreboard players set closest ${ns}-camclose 0
    # If not, calculate our distance to the player and compare it to the closest distance so far, if closer, set this as closest.
`);

cameraClosestCommands.push(...axis.map(createCameraClosestCommands));

cameraClosestCommands.push(`
    # Add them together to get a rough distance score.
    scoreboard players operation ax ${ns}-camclose += ay ${ns}-camclose
    scoreboard players operation ax ${ns}-camclose += az ${ns}-camclose
    # If this is the closest so far, store this framenum as closest. (changed to unless so that when closest has no value it still triggers.)
    $execute unless score ax ${ns}-camclose >= closest ${ns}-camclose run data modify storage ${ns}:temp csf.framenum set value $(framenum)
    execute unless score ax ${ns}-camclose >= closest ${ns}-camclose run scoreboard players operation closest ${ns}-camclose = ax ${ns}-camclose
`);

cameraClosest`${cameraClosestCommands.join('\n')}`;

// Takes the camera data from the animation_data and places the player at that position and rotation, along with displaying the note if there is one. Finally, puts the player into spectator mode and adds the camera view tag.
cameraLoad`
    # Log the entry point
    ${debug.entry} {input: "from hotbar load camera"}
    # Log the function call
    $${debug.run} {input: "cameraLoad for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "grabAnimationFromUuid -> constructRealCoordinates -> place player at camera -> cleanUpNewAnimationData"}
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

// Takes the camera data from the animation_data and places the player at that position and rotation, along with displaying the note if there is one. Finally, puts the player into spectator mode and adds the camera view tag.
cameraLoadQueueFrame`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu load camera"}
    # Log the function call
    $${debug.run} {input: "cameraLoadQueueFrame for $(UUID) and $(name) frame $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> constructRealCoordinates"}
    # Error if no camera data exists yet.
    $execute unless data storage ${ns}:animation_data new.frames[$(framenum)].camera run return run ${debug.error} {input: "No camera data to load!"}
    # Create the load_queue if it is missing.
    execute unless data storage ${ns}:animation_data load_queue run data modify storage ${ns}:animation_data load_queue set value []
    # Create an entry for this animation if missing.
    $execute unless data storage ${ns}:animation_data load_queue[{UUID: $(UUID)}] run data modify storage ${ns}:animation_data load_queue append value {UUID: $(UUID), name: $(name), data:[]}
    # Insert a new space for this camera at the BEGINNING of the list. (frames are accessed in later -> earlier order so this reverses that)
    $data modify storage ${ns}:animation_data load_queue[{UUID: $(UUID)}].data prepend value {} 
    # Convert camera position into real world coordinates, stored as object tags so the macro works.
    $${constructRealCoordinates} {arrayformat:0, input:"storage ${ns}:animation_data new.frames[$(framenum)].camera.pos[", output:"storage ${ns}:animation_data load_queue[{UUID: $(UUID)}].data[0].", type:"frames[$(framenum)].ea"}
    # Toss in yaw, pitch, and the note into a temporary storage for macros.
    $data modify storage ${ns}:animation_data load_queue[{UUID: $(UUID)}].data[0].yaw set from storage ${ns}:animation_data new.frames[$(framenum)].camera.rot[0]
    $data modify storage ${ns}:animation_data load_queue[{UUID: $(UUID)}].data[0].pitch set from storage ${ns}:animation_data new.frames[$(framenum)].camera.rot[1]
    $data modify storage ${ns}:animation_data load_queue[{UUID: $(UUID)}].data[0].note set from storage ${ns}:animation_data new.frames[$(framenum)].camera.note
    $data modify storage ${ns}:animation_data load_queue[{UUID: $(UUID)}].data[0].duration set from storage ${ns}:animation_data new.frames[$(framenum)].duration
`;

// Places the player from a load_queue at their next camera position
// Logs are commented out since entry point is tick
cameraLoadFrame`
    # Log the entry point
    # ${debug.entry} {input: "from: tick"}
    # Log the function call
    # ${debug.run} {input: "cameraLoadFrame"}
    # Log the expected function path
    # ${debug.path} {input: "-> ^ load_queue empty -> (recLoad -> | place camera)"}
    # If the load_queue is empty, instantly return to save processing power
    execute unless data storage ${ns}:animation_data load_queue[0] run return 0
    # Otherwise, recursively go through each entry and either place the player at their camera or decrease their duration if duration is present.
    data modify storage ${ns}:temp clf.queue set from storage ${ns}:animation_data load_queue
    # Temporary scoreboard
    scoreboard objectives add ${ns}-clf dummy
    ${recLoad`
        # Log the function call
        # $${debug.run} {input: "recLoad for $(UUID) and $(name)"}
        # Pass name and UUID down to the macro below
        $data modify storage ${ns}:temp clf.queue[0].data[0].name set value $(name)
        $data modify storage ${ns}:temp clf.queue[0].data[0].UUID set value $(UUID)
        # Place the player at the frame if duration ran out
        $execute unless score #$(name)_load_duration ${ns} matches 1.. run ${a`
            $${debug.run} {input: "place $(UUID) at camera at $(x) $(y) $(z) with rotation $(yaw) $(pitch) displaying note $(note) for anim $(name) for $(duration) ticks"}
            $execute in ${ns}:editor run tp @a[nbt={UUID: $(UUID)}] $(x) $(y) $(z) $(yaw) $(pitch)
            # Place the player into spectator mode and add the camera view tag.
            $gamemode spectator @a[nbt={UUID: $(UUID)}]
            $tag @a[nbt={UUID: $(UUID)}] add ${ns}-camera-view
            # Storing the result of the note stores it's length, if it's greater than 0 then we show it to the player.
            execute store result score length ${ns}-clf run data get storage ${ns}:temp clf.queue[0].data[0].note
            $execute if score length ${ns}-clf matches 1.. run tellraw @a[nbt={UUID: $(UUID)}] {text:"Camera Note: $(note)",bold:true}
            $scoreboard players set #$(name)_load_duration ${ns} $(duration)
            # Increase score by 1 since same frame this command will also decrease it by 1
            $scoreboard players add #$(name)_load_duration ${ns} 1
            $data remove storage ${ns}:animation_data load_queue[{name: $(name)}].data[0]
            # If there's no more camera datas, then we can remove this animation from the load_queue (and get rid of duration.)
            $execute unless data storage ${ns}:animation_data load_queue[{name: $(name)}].data[0] run data remove storage ${ns}:animation_load load_queue[{name: $(name)}]
            $execute unless data storage ${ns}:animation_data load_queue[{name: $(name)}] run scoreboard players reset #$(name)_load_duration ${ns}
        `} with storage ${ns}:temp clf.queue[0].data[0]
        # Otherwise, decrease duration.
        $execute if score #$(name)_load_duration ${ns} matches 1.. run scoreboard players remove #$(name)_load_duration ${ns} 1
        # Remove this animation from the temporary queue
        data remove storage ${ns}:temp clf.queue[0]
        # If there is more data, recursive call
        execute if data storage ${ns}:temp clf.queue[0] run ${recLoad} with storage ${ns}:temp clf.queue[0]
    `} with storage ${ns}:temp clf.queue[0]
    # Clean up trailing data
    scoreboard objectives remove ${ns}-clf
    data remove storage ${ns}:temp clf
`;

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

// Removes the camera position highlight when no longer hovering over the load camera item.
cameraRemoveHighlight`
    # No log since this runs every tick within overworld.
    $kill @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}]
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

placeParticleEveryTick`
    $execute at @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}] run ${cameraDisplayParticles}
`;

// Highlights the camera position when hovering over the load camera item.
cameraHighlight`
    # Log the entry point
    ${debug.entry} {input: "from hotbar hover camera_load item"}
    # Log the function call
    $${debug.run} {input: "cameraHighlight for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> ^ if already in camera view -> grabAnimationFromUuid -> ^ exit if no camera -> constructRealCoordinates -> place camera in world -> particles -> cleanUpNewAnimationData"}
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
        data merge entity @s {item: {components: {"minecraft:profile": {id: [I; 797692767, 214648518, -2094961131, -1410769773], properties: [{name: "textures", value: "eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvMTQ0MjJhODJjODk5YTljMTQ1NDM4NGQzMmNjNTRjNGFlN2ExYzRkNzI0MzBlNmU0NDZkNTNiOGIzODVlMzMwIn19fQ=="}]}}, count: 1, id: "minecraft:player_head"}, item_display: "ground", transformation: {left_rotation: [0.0f, 1.0f, 0.0f, 0.0f], right_rotation: [0.0f, 0.0f, 0.0f, 1.0f], scale: [1.0f, 1.0f, 1.0f], translation: [0.0f, 0.0f, 0.0f]}, Glowing:1b, Tags: ["${ns}-camera-highlight"]}
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

// Toggles whether or not a camera is highlighted within a frame in the editor.
toggleHighlightFrame`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu highlight camera"}
    # Log the function call
    $${debug.run} {input: "toggleHighlightFrame for $(UUID) and frame $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> ^ if already in camera view -> grabAnimationFromUuid -> ^ exit if no camera -> constructRealCoordinates -> place camera in world -> particles -> cleanUpNewAnimationData"}
    # If the player is already in camera view, remove the highlight and exit.
    $execute if entity @s[tag=${ns}-camera-view] run return run kill @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID), framenum: $(framenum)}}]
    # If a camera does exist for this frame, delete the existing highlight and exit.
    $execute as @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID), framenum:$(framenum)}}] run return run kill @s
    # If there is no camera data, stop.
    $execute unless data storage ${ns}:animation_data new.frames[$(framenum)].camera run return run ${a`
        # Log the function call (in this case an error)
        ${debug.error} {input: "No camera data to highlight for frame!"}
        tellraw @s {text:"No camera data to highlight for this frame!",color:red}
    `}
    data merge storage ${ns}:temp {camera:{pos:[0.0d, 0.0d, 0.0d]}}
    # Turn the data above into real world coordinates.
    $${constructRealCoordinates} {arrayformat:1, input:"storage ${ns}:animation_data new.frames[$(framenum)].camera.pos[", output:"storage ${ns}:temp camera.pos[", type:"frames[$(framenum)].ea"}
    # If a camera isn't already made, summon one and merge on all important data (position, rotation, owner).
    $execute unless entity @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID), framenum:$(framenum)}}] summon minecraft:item_display run ${a`
        ${debug.run} {input: "placing camera into world"}
        data merge entity @s {item: {components: {"minecraft:profile": {id: [I; 797692767, 214648518, -2094961131, -1410769773], properties: [{name: "textures", value: "eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvMTQ0MjJhODJjODk5YTljMTQ1NDM4NGQzMmNjNTRjNGFlN2ExYzRkNzI0MzBlNmU0NDZkNTNiOGIzODVlMzMwIn19fQ=="}]}}, count: 1, id: "minecraft:player_head"}, item_display: "ground", transformation: {left_rotation: [0.0f, 1.0f, 0.0f, 0.0f], right_rotation: [0.0f, 0.0f, 0.0f, 1.0f], scale: [1.0f, 1.0f, 1.0f], translation: [0.0f, 0.0f, 0.0f]}, Glowing:1b, Tags: ["${ns}-camera-highlight"]}
        data modify entity @s data.owner set from storage ${ns}:animation_data new.owner
        $data modify entity @s data.framenum set value $(framenum)
        data modify entity @s Pos set from storage ${ns}:temp camera.pos
        $data modify entity @s Rotation set from storage ${ns}:animation_data new.frames[$(framenum)].camera.rot
        execute at @s run tp @s ~ ~1.6 ~
    `} {framenum: $(framenum)}
    # Create particles in front of the camera to better indicate direction.
    $execute at @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}] run ${cameraDisplayParticles}
    # Remove all of the extra data generated.
    data remove storage ${ns}:temp camera
`;
