// Functions here work with animations, like creation, deletion, and ones that specifically need abstraction to call operateOnselectedFrames (since that function is used to do almost everything with animations.)

// Sets up basic stuff.
import mcf from './mcf.js';
import * as debug from './debug.js';
import { operationOnSelectedFrames } from './animation/operate.js';
import { calculateLaneX } from './editor/lane.js';
import { regroupEntities, removeDocile, recSplitGroups } from './entity.js';
import { grabStrBlockPos } from './selection/data.js';
import { handleSummon } from './selection/handle.js';
import { allocAnimation, storeFrame } from './storage.js';
import { grabAnimationFromUuid, cleanUpNewAnimationData } from './data.js';
import { cameraSaveFrame } from './camera/frame.js';
import { noticeAnimInUse, errorNoAnchor } from './error.js';
const folder = mcf.animation;
export const {
    createAnimation, deleteAnimation, cameraSaveFrameEnterIterate, grabOffsetAndOperate
} = folder;
const {
    anonymous: a, recRemoveFrameData, macroRemoveAnimationStorage, saveStructure
} = folder;
const ns = 'easy-anim';

// This takes the current selection and turns it into frame 0 of an animation, as well as the base layer for the animation.
createAnimation`
    # Log the entry point
    ${debug.entry} {input: "from create_animation item"}
    # Log the function call
    $${debug.run} {input: "createAnimation for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> ^ camera and selection check -> grabStrBlockPos -> calculateLaneX -> saveStructure -> recSplitGroups (| grouping entity) -> macro context update -> | removeDocile -> allocAnimation -> storeFrame X2 -> regroupEntities -> handleSummon -> cleanUpNewAnimationData"}
    # Load the player's inventory from storage.
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Error if animation_data new is missing: name or anchor. Name should realistically never happen.
    execute unless data storage ${ns}:animation_data new.name run return run ${debug.error} {input:"Missing name data from current animation!"}
    execute unless data storage ${ns}:animation_data new.anchor run return run ${errorNoAnchor}
    # If size doesn't exist, but anchor does, then we can assume a size of 1, 1, 1, as that is default for selecting 1 block.
    execute unless data storage ${ns}:animation_data new.size run data modify storage ${ns}:animation_data new.size set value [1.0d, 1.0d, 1.0d]
    # If there is no camera set, tell the player to set one first and stop.
    execute unless data storage ${ns}:animation_data new.camera run return run ${a`
        data modify storage ${ns}:temp cs.reenteranim set value true
        data remove storage ${ns}:animation_data new
        dialog show @s ${ns}:no_camera_saved    
    `}
    # Remove the possibly trailing data locations.
    data remove storage ${ns}:temp str
    # Save the block at the neg neg neg corner (outside of region) to the editor dimension and place in a new structure block
    ${grabStrBlockPos}
    ${calculateLaneX} {output:"${ns}:temp str.lanex int"}
    data modify storage ${ns}:temp str.name set from storage ${ns}:animation_data new.name
    # Warn if the animation currently has framecount or frames.
    execute if data storage ${ns}:animation_data new.framecount run ${debug.warn} {input: "Animation has framecount! Overwriting..."}
    execute if data storage ${ns}:animation_data new.frames run ${debug.warn} {input: "Animation has frame data! Overwriting..."}
    # Insert frame 0 data into the new animation. Take all data from the base selection.
    data modify storage ${ns}:animation_data new.framecount set value 1
    data modify storage ${ns}:animation_data new.frames set value []
    data modify storage ${ns}:animation_data new.frames append value {}
    data modify storage ${ns}:animation_data new.frames[0].duration set value 20
    data modify storage ${ns}:animation_data new.frames[0].camera set from storage ${ns}:animation_data new.camera
    data modify storage ${ns}:animation_data new.frames[0].anchor set from storage ${ns}:animation_data new.anchor
    data modify storage ${ns}:animation_data new.frames[0].size set from storage ${ns}:animation_data new.size
    ${saveStructure`
        # Log the function call
        $${debug.run} {input: "saveStructure at $(x) $(y) $(z) within $(sx) $(sy) $(sz) for $(name)"}
        # Warn if we're replacing a non-air block
        $execute in ${ns}:editor unless block $(lanex) 3 0 minecraft:air run ${debug.warn} {input: "Non-air block in editor at $(lanex) 3 0! Replacing..."}
        $execute positioned $(x) $(y) $(z) run clone ~ ~1 ~ ~ ~1 ~ to ${ns}:editor $(lanex) 3 0 strict
        # Warn if no interactions or handles are present.
        $execute positioned $(x) $(y) $(z) unless entity @n[type=minecraft:interaction,tag=${ns}-select-str-block,distance=..1] run ${debug.warn} {input:"No interaction blocking the structure block! Skipping removal..."}
        $execute positioned $(x) $(y) $(z) unless entity @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)] run ${debug.warn} {input:"No handles on the selection! Skipping removal..."}
        $execute positioned $(x) $(y) $(z) run kill @n[type=minecraft:interaction,tag=${ns}-select-str-block,distance=..1]
        $execute positioned $(x) $(y) $(z) run kill @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)]
        # Ungroup any grouped entities and tag them so they can find each other.
        data modify storage ${ns}:temp str.id set value 0
        $execute positioned $(x) $(y) $(z) run ${recSplitGroups} with storage ${ns}:temp str
        # Using the macro, make sure all of the entities within the selection are no longer considered docile
        ${a`
            # Log the function call
            ${debug.run} {input: "removing docile tags within selection"}
            # Warn if no entities are found.
            $execute positioned $(x) $(y) $(z) if entity @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-entity-turned-docile] run ${debug.warn} {input: "No docile entities found! Skipping..."}
            $execute positioned $(x) $(y) $(z) as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-entity-turned-docile] run ${removeDocile}
        `} with storage ${ns}:temp str
        $execute positioned $(x) $(y) $(z) run setblock ~ ~1 ~ minecraft:redstone_block
        $execute positioned $(x) $(y) $(z) run setblock ~ ~1 ~ minecraft:air
        $data modify block $(x) $(y) $(z) name set value "${ns}:$(name)-frame0"
        $execute positioned $(x) $(y) $(z) run setblock ~ ~1 ~ minecraft:redstone_block
        $data modify block $(x) $(y) $(z) name set value "${ns}:$(name)-base"
        # Allocate a lane in storage for this new animation, and place base and frame 0 in there.
        # Warn if animation_data already has a storageid
        execute if data storage ${ns}:animation_data new.storageid run ${debug.warn} {input: "Animation already has a storage lane! Skipping assignment..."}
        execute unless data storage ${ns}:animation_data new.storageid run ${allocAnimation}
        $${storeFrame} {name: $(name), framenum: "base"}
        $${storeFrame} {name: $(name), framenum: 0}
        # Regroup any grouped entities and remove their redundant tags + data. Must be separated so data that is needed to find each other isn't erased yet.
        $execute positioned $(x) $(y) $(z) positioned ~1 ~1 ~1 run ${regroupEntities} with storage ${ns}:temp str
        $execute positioned $(x) $(y) $(z) run clone from ${ns}:editor $(lanex) 3 0 $(lanex) 3 0 ~ ~1 ~ strict
        $summon minecraft:interaction $(x) $(y) $(z) {width:1.01f,height:1.01f,Tags:["${ns}-select-str-block"]}
        $execute in ${ns}:editor run setblock $(lanex) 3 0 minecraft:air
    `} with storage ${ns}:temp str
    # Place the previously deleted handles back.
    ${handleSummon}
    # Save modifications made to the animation.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove the temporary data locations.
    data remove storage ${ns}:temp str
    # Prompt the user to enter the editor.
    dialog show @s ${ns}:enter_editor
`;

// Deletes all of the data related to a specific animation. Requires macro of anim for the name of the animation.
deleteAnimation`
    # Log the entry point
    ${debug.entry} {input:"from: displayAnimationsDialog specified execution from main_menu dialog"}
    # Log the function call
    $${debug.run} {input:"deleteAnimation for $(anim)"}
    # Log the expected function path
    ${debug.path} {input: "-> macroRemoveAnimationStorage -> recRemoveFrameData"}
    # If the animation doesn't exist, error
    $execute unless data storage ${ns}:animation_data animations[{name:$(anim)}].data run return run ${debug.error} {input: "$(anim) doesn't exist!"}
    # If the animation is being displayed somewhere (location != none), then return and tell the player.
    $execute unless data storage ${ns}:animation_data animations[{name:$(anim),data:{location:"none"}}] run return run ${noticeAnimInUse}
    # Possible extension of function: If location is editor, run exit editor on owner. (In multiplayer, permission check?)
    # Remove possibly trailing placeholder data
    data remove storage ${ns}:temp deleteAnimation
    # Clear all of the frames from storage (removeFrame works on a one frame at a time basis)
    # Warn if the animation has no frames
    $execute unless data storage ${ns}:animation_data animations[{name:$(anim)}].data.frames run ${debug.warn} {input: "Animation has no frames! Skipping deletion..."}
    # Grab all frames into a temporary location to iterate through.
    $data modify storage ${ns}:temp deleteAnimation.frames set from storage ${ns}:animation_data animations[{name:$(anim)}].data.frames
    # Grab the animation's storage lane X
    $execute store result storage ${ns}:temp deleteAnimation.x int 48 run data get storage ${ns}:animation_data animations[{name:$(anim)}].data.storageid
    # Execute the loop setup command as a macro to use the lane x value (trying to avoid repetitive macros)
    execute in ${ns}:storage run ${macroRemoveAnimationStorage`
        # Log the function call
        $${debug.run} {input: "macroRemoveAnimationStorage at x: $(x)"}
        # Clear the storage's lane
        $execute if data storage ${ns}:temp deleteAnimation.frames[0] positioned $(x) 0 0 run ${recRemoveFrameData`
            # Log the function call
            ${debug.run} {input: "recRemoveFrameData"}
            # Forceload the entire frame
            forceload add ~ ~ ~47 ~47
            # Fill the frame with air
            fill ~ ~ ~ ~47 ~47 ~47 minecraft:air
            # Unforceload the entire frame
            forceload remove ~ ~ ~47 ~47
            # Remove the frame from temp storage
            data remove storage ${ns}:temp deleteAnimation.frames[0]
            # If there's still a frame, execute at the next frame's location another fill command.
            execute if data storage ${ns}:temp deleteAnimation.frames[0] positioned ~ ~ ~48 run ${recRemoveFrameData}
        `}
        # Remove the base frame
        # Forceload the entire frame + the lane block
        $execute positioned $(x) 0 -48 run forceload add ~ ~ ~47 ~48
        # Fill the frame with air
        $execute positioned $(x) 0 -48 run fill ~ ~ ~ ~47 ~47 ~47 minecraft:air
        # Remove the bedrock block denoting the frame.
        # Warn if this block isn't bedrock
        $execute unless block $(x) 50 0 minecraft:bedrock run ${debug.warn} {input: "Expected bedrock to denote storage lane at $(x) 50 0! Replacing with air..."}
        $setblock $(x) 50 0 minecraft:air
        # Unforceload the entire frame
        $execute positioned $(x) 0 -48 run forceload remove ~ ~ ~47 ~48
    `} with storage ${ns}:temp deleteAnimation
    # Remove the data from storage
    $data remove storage ${ns}:animation_data animations[{name:$(anim)}]
    # Possible check for error/warn: Someone has this as currentAnim, must be removed (and the rest of their data)
    $execute if data storage ${ns}:player_data players[{currentAnim:$(anim)}] run ${debug.warn} {input: "Players have this animation as their currentAnim! Removing..."}
    $data remove storage ${ns}:player_data players[{currentAnim:$(anim)}]
    # Tell the player the operation was successful.
    $tellraw @s {text:"$(anim) has been successfully deleted.", color: "green"}
    # Remove temporary placeholder data
    data remove storage ${ns}:temp deleteAnimation
`;

// Loops through all selected frames, finds the closest one to the player, saves the camera relative to that frame, and then applies it to all other frames.
// Requires an input of the camera note.
cameraSaveFrameEnterIterate`
    # Log the entry point
    ${debug.entry} {input: "from camera_info_frame dialog"}
    # Log the function call
    $${debug.run} {input: "cameraSaveFrameEnterIterate with note $(note)"}
    # Log the expected function path.
    ${debug.path} {input: "operationOnSelectedFrames -> grabAnimationFromUuid -> cameraSaveFrame -> cleanUpNewAnimationData -> operationOnSelectedFrames"}
    # Remove the possibly trailing scoreboard and other trailing data.
    data remove storage ${ns}:temp csf
    scoreboard objectives remove ${ns}-camclose
    # Create a temporary scoreboard and store -1 for later.
    scoreboard objectives add ${ns}-camclose dummy
    scoreboard players set -1 ${ns}-camclose -1
    # Calculate which of the selected frames is closest to the player or contains the player.
    ${operationOnSelectedFrames} {mode: "cameraClosest"}
    # Store the note into a special location just for the closest camera save.
    $data modify storage ${ns}:temp csf.note set value "$(note)"
    # Run cameraSaveFrame for the closest frame.
    ${grabAnimationFromUuid} with entity @s
    # Place UUID into csf for this function to work
    data modify storage ${ns}:temp csf.UUID set from entity @s UUID
    ${cameraSaveFrame} with storage ${ns}:temp csf
    # Save changes.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Operate on the rest of the selected frames to add the carryover camera data.
    ${operationOnSelectedFrames} {mode: "saveCamera"}
    # Remove the temporary scoreboard and other trailing data.
    data remove storage ${ns}:temp csf
    scoreboard objectives remove ${ns}-camclose
`
