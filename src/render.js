// The purpose of this file is to render out animations into the real world from their animation data.

// Sets up basic things.
import mcf from './mcf.js';
import * as debug from './debug.js';
import { removeDocile, recSplitGroups, regroupEntities } from './entity.js';
import { constructRealCoordinates } from './selection/geometry.js';
import { grabSizeAnchorEditor, grabStrBlockPos } from './selection/data.js'
import { grabPlayerData, grabPlayerAndAnimation, grabAnimationData, cleanUpNewAnimationData, cleanUpCurrentPlayerData } from './data.js';
import { calculateLaneX, unclaimLane, findPlayerAxisOffset } from './editor/lane.js';
import { cleanKill } from './util.js';
import { retrieveFrame } from './storage.js';
const folder = mcf.render;
export const { startRender, renderCheck, specificFrameRender, exitRender } = folder;
const { recCheck, anonymous: a } = folder;
const ns = 'easy-anim';

// Starts the render for an animation. This will take place inside the animation's dimension, at the animation's anchor.
// Expects the player to be outside of the editor, and to have this animation as their currentAnim.
startRender`
    # Log the function call
    ${debug.run} {input:"startRender"}
    # Log the expected function path
    ${debug.path} {input:"-> grabPlayerAndAnimation -> findPlayerAxisOffset -> cleanUpCurrentPlayerData -> grabPlayerData -> grabStrBlockPos -> calculateLaneX -> move original stuff -> specificFrameRender -> cleanUpNewAnimationData"}
    # Grab animation data.
    ${grabPlayerAndAnimation} with entity @s
    # Error if missing size, anchor, or camera in base frame
    execute unless data storage ${ns}:animation_data new.anchor run return run ${debug.error} {input: "Player's currentAnim is missing anchor data!"}
    execute unless data storage ${ns}:animation_data new.size run return run ${debug.error} {input: "Player's currentAnim is missing size data!"}
    execute unless data storage ${ns}:animation_data new.camera run return run ${debug.error} {input: "Player's currentAnim is missing camera data!"}
    # Set this animation's location to "render"
    data modify storage ${ns}:animation_data new.location set value "render"
    # Give the player an editor lane, if missing.
    ${findPlayerAxisOffset}
    # Save this new lane
    ${cleanUpCurrentPlayerData} with entity @s
    # Take player data back out
    ${grabPlayerData} with entity @s
    # Structure block save the anchor location in the overworld
    ${grabStrBlockPos}
    ${calculateLaneX} {output: "${ns}:temp str.lanex int"}
    # Place this executor's UUID into the macro namespace
    data modify storage ${ns}:temp str.UUID set from entity @s UUID
    # Place name into the macro namespace
    data modify storage ${ns}:temp str.name set from storage ${ns}:animation_data new.name
    # NOTE TO FUTURE SELF: If size ever changes between frames, we'll need to calculate the largest frame size and store that, instead of base.
    ${a`
        # Log the function call
        $${debug.run} {input: "move original stuff at $(x) $(y) $(z) in $(dimension) with size $(sx) $(sy) $(sz) for $(name), storing original block at $(lanex) 0 0 for $(UUID)"}
        # Forceload the entire region that this frame can be inside of.
        $execute in ${ns}:editor positioned $(lanex) 0 0 run forceload add ~ ~ ~47 ~47
        # Forceload the entire animation just in case
        $execute in $(dimension) positioned $(x) $(y) $(z) run forceload add ~ ~
        $execute in $(dimension) positioned $(x) $(y) $(z) positioned ~1 ~1 ~1 run forceload add ~ ~ ~$(sx) ~$(sz)
        # Clone over the block we will be replacing in the overworld.
        # Warn if we're replacing anything that isn't air
        $execute in ${ns}:editor unless block $(lanex) 0 0 minecraft:air run ${debug.warn} {input: "Non-air block in editor at $(lanex) 0 0! Replacing..."}
        $execute in $(dimension) run clone $(x) $(y) $(z) $(x) $(y) $(z) to ${ns}:editor $(lanex) 0 0 strict
        # Clone over the block we will use to power the structure block to the editor dimension
        # Warn if we're replacing anything that isn't air
        $execute in ${ns}:editor unless block $(lanex) 3 0 minecraft:air run ${debug.warn} {input: "Non-air block in editor at $(lanex) 3 0! Replacing..."}
        $execute in $(dimension) positioned $(x) $(y) $(z) run clone ~ ~1 ~ ~ ~1 ~ to ${ns}:editor $(lanex) 3 0 strict
        # Place the structure block to save the original 
        $execute in $(dimension) run setblock $(x) $(y) $(z) minecraft:structure_block{mode:"SAVE",showboundingbox:false,posX:1,posY:1,posZ:1,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-original",strict:true}
        # Ungroup entities
        data modify storage ${ns}:temp str.id set value 0
        $execute in $(dimension) positioned $(x) $(y) $(z) positioned ~1 ~1 ~1 run ${recSplitGroups} with storage ${ns}:temp str
        # Save the frame
        $execute in $(dimension) positioned $(x) $(y) $(z) run setblock ~ ~1 ~ minecraft:redstone_block
        # Replace this block with what was there beforehand, and remove that block from the editor
        $execute in $(dimension) positioned $(x) $(y) $(z) run clone from ${ns}:editor $(lanex) 3 0 $(lanex) 3 0 ~ ~1 ~ strict
        $execute in ${ns}:editor run setblock $(lanex) 3 0 minecraft:air
        # Remove the structure block
        $execute in $(dimension) positioned $(x) $(y) $(z) run clone from ${ns}:editor $(lanex) 0 0 $(lanex) 0 0 ~ ~ ~ strict
        $execute in ${ns}:editor run setblock $(lanex) 0 0 minecraft:air
        # Fill a layer under this original stuff so we don't lose any gravity blocks
        $execute in ${ns}:editor positioned $(lanex) 15 0 run fill ~ ~ ~ ~47 ~ ~47 minecraft:glass
        # Place the original stuff in the editor
        $execute in ${ns}:editor run place template ${ns}:$(name)-original $(lanex) 16 0 none none 1 1 strict
        # tag all entities currently in the frame so they'll be removed.
        $execute in $(dimension) positioned $(x) $(y) $(z) positioned ~1 ~1 ~1 as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz)] run tag @s add ${ns}-render
        # The iterative frame render command will handle clearing previous frames, so now we have to set up for that.
        # Set up the counter scoreboard for the frame number that's currently being rendered (-1 so it will render frame 0)
        $scoreboard players set #$(name)_frame ${ns} -1
        # Place this animation into the render list (all animations being rendered.)
        $data modify storage ${ns}:animation_data render_queue append value {name: $(name), player: $(UUID)}
        # Render the next frame, the first frame.
        $${specificFrameRender} {name: $(name)}
    `} with storage ${ns}:temp str
    # Clean up data and save all changes
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    data remove storage ${ns}:temp str
`;

// Checks through the render_queue to see which animations need to render their next frames, and executes those if so.
// Ran within tick, so all logs commands are commented out.
renderCheck`
    # Log the entry point
    # ${debug.entry} {input: "from: tick"}
    # Log the function call
    # ${debug.run} {input: "renderCheck"}
    # Log the expected function path
    # ${debug.path} {input: "-> ^ render_queue empty -> recCheck ( | specificFrameRender)"}
    # Exit this function entirely if the render_queue is empty. (I would have a warn but we're entering from tick)
    execute unless data storage ${ns}:animation_data render_queue[0] run return 0
    # Set up a recursive function to go through all animations within render_queue, passing their names as a macro
    data modify storage ${ns}:temp rendercheck.queue set from storage ${ns}:animation_data render_queue
    data modify storage ${ns}:temp rendercheck.name set from storage ${ns}:temp rendercheck.queue[0].name
    ${recCheck`
        # Check if duration is 0, if so, specificFrameRender
        $execute if score #$(name)_render_duration ${ns} matches 0 run ${specificFrameRender} {name: $(name)}
        # If not, decrease duration by 1 (these represent ticks)
        $execute if score #$(name)_render_duration ${ns} matches 1.. run scoreboard players remove #$(name)_render_duration ${ns} 1
        # Remove this animation from temporary queue
        data remove storage ${ns}:temp rendercheck.queue[0]
        # If there's no more, exit
        execute unless data storage ${ns}:temp rendercheck.queue[0] run return 1
        # Update storage for next animation
        data modify storage ${ns}:temp rendercheck.name set from storage ${ns}:temp rendercheck.queue[0].name
        # Recursively call self
        ${recCheck} with storage ${ns}:temp rendercheck
    `} with storage ${ns}:temp rendercheck
    # Remove temporary data
    data remove storage ${ns}:temp rendercheck
`;

// Removes old frame data and places in the next frame, while updating scoreboards to execute the next frame to render.
// Requires $(name) of the animation as a macro.
specificFrameRender`
    # Log the entry point
    ${debug.entry} {input:"from: startRender | tick, frame duration hit 0"}
    # Log the function call.
    $${debug.run} {input:"specificFrameRender for $(name)"}
    # Log the expected function path
    ${debug.path} {input:"-> grabAnimationData -> ^ exitRender -> grab old frame size -> grabSizeAnchorEditor -> constructRealCoordinates -> grab camera -> changing frame -> retrieveFrame"}
    # Pull animation data
    $${grabAnimationData} {currentAnim: $(name)}
    # Error if missing anchor, size, or frames.
    execute unless data storage ${ns}:animation_data new.anchor run return run ${debug.error} {input: "This animation is missing anchor data!"}
    execute unless data storage ${ns}:animation_data new.size run return run ${debug.error} {input: "This animation is missing size data!"}
    execute unless data storage ${ns}:animation_data new.frames run return run ${debug.error} {input: "This animation is missing frame data!"}
    # Pull the framenum from the scoreboard, increase it, and place it into storage
    # Error if there's no framenum to pull from.
    $execute unless score #$(name)_frame ${ns} matches -1.. run return run ${debug.error} {input: "#$(name)_frame score is missing!"}
    $execute store result storage ${ns}:temp grabsizeanchor.framenum int 1 run scoreboard players add #$(name)_frame ${ns} 1
    # If this framenum exceeds the animation's total frames, then we'll need to exit the render.
    scoreboard objectives add ${ns}-render dummy
    execute store result score framecount ${ns}-render run data get storage ${ns}:animation_data new.framecount
    $execute if score #$(name)_frame ${ns} = framecount ${ns}-render run return run ${exitRender} {name: $(name)}
    # Pull frame's data into macroable storage
    ${grabSizeAnchorEditor} with storage ${ns}:temp grabsizeanchor
    # Since the above set anchor to an editor anchor value that didn't exist, we need to pull anchor on our own.
    data modify storage ${ns}:temp grabsizeanchor.ax set from storage ${ns}:animation_data new.anchor[0]
    data modify storage ${ns}:temp grabsizeanchor.ay set from storage ${ns}:animation_data new.anchor[1]
    data modify storage ${ns}:temp grabsizeanchor.az set from storage ${ns}:animation_data new.anchor[2]    
    # Place the animation name into macro storage.
    data modify storage ${ns}:temp grabsizeanchor.name set from storage ${ns}:animation_data new.name
    # Place the player's UUID into macro storage.
    $data modify storage ${ns}:temp grabsizeanchor.UUID set from storage ${ns}:animation_data render_queue[{name:$(name)}].player
    # Place the animation's dimension into macro storage.
    data modify storage ${ns}:temp grabsizeanchor.dimension set from storage ${ns}:animation_data new.dimension
    # Toss in camera position, yaw, pitch, and the note into a temporary storage for macros.
    ${a`
        # Log the function call.
        $${debug.run} {input: "grab camera for $(framenum)"}
        # Convert camera position into real world coordinates, stored as object tags so the macro works.
        $${constructRealCoordinates} {arrayformat:0, input:"storage ${ns}:animation_data new.frames[$(framenum)].camera.pos[", output:"storage ${ns}:temp grabsizeanchor.camera", type: "a"}
        $data modify storage ${ns}:temp grabsizeanchor.camerayaw set from storage ${ns}:animation_data new.frames[$(framenum)].camera.rot[0]
        $data modify storage ${ns}:temp grabsizeanchor.camerapitch set from storage ${ns}:animation_data new.frames[$(framenum)].camera.rot[1]
        $data modify storage ${ns}:temp grabsizeanchor.cameranote set from storage ${ns}:animation_data new.frames[$(framenum)].camera.note
    `} with storage ${ns}:temp grabsizeanchor
    # Execute within a macro to utilize coordinates.
    ${a`
        # Log the function call.
        $${debug.run} {input: "changing frame for $(framenum) in $(dimension) at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz) for $(UUID), camera at $(camerax) $(cameray) $(cameraz) $(camerayaw) $(camerapitch) showing note $(cameranote)"}
        # Clear all remaining blocks and entities from old frame (using this frame's size coordinates because we want any differing size changes to remain)
        $execute in $(dimension) positioned $(ax) $(ay) $(az) as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-render] run ${cleanKill}
        $execute in $(dimension) positioned $(ax) $(ay) $(az) run fill ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) minecraft:air strict
        # Retreive the frame from storage in case it is unloaded
        $${retrieveFrame} {framenum: $(framenum)}
        # Place the frame down from the structure
        $execute in $(dimension) run place template ${ns}:$(name)-frame$(framenum) $(ax) $(ay) $(az) none none 1 1 strict
        # Modify the data of all of the entities so that they won't move and they'll have the ${ns}-render tag
        $execute in $(dimension) positioned $(ax) $(ay) $(az) as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz)] run ${a`
            data modify entity @s NoAI set value true
            tag @s add ${ns}-render
        `}
        # Place the player at the camera, tell them their note, place them in spectator, and tag them with camera.
        $tp @a[nbt={UUID: $(UUID)}] $(camerax) $(cameray) $(cameraz) $(camerayaw) $(camerapitch)
        $execute unless data storage ${ns}:temp {camera:{note:""}} run tellraw @a[nbt={UUID: $(UUID)}] {text:"Camera Note: $(cameranote)",bold:true}
        $gamemode spectator @a[nbt={UUID: $(UUID)}]
        $tag @a[nbt={UUID: $(UUID)}] add ${ns}-camera-view
        # Set the duration scoreboard to this frame's duration.
        $execute store result score #$(name)_render_duration ${ns} run data get storage ${ns}:animation_data new.frames[$(framenum)].duration
        # Increase this score by 1 since the same function call that runs this will decrease it by 1 same frame.
        $scoreboard players add #$(name)_render_duration ${ns} 1
    `} with storage ${ns}:temp grabsizeanchor
    # Remove temporary data
    data remove storage ${ns}:animation_data new
    data remove storage ${ns}:temp grabsizeanchor
    scoreboard objectives remove ${ns}-render
`;

// Exits the render by replacing all of the data to how it was before rendering.
// Name is passed in by a macro, this is executed by specificFrameRender so animation_data new is already set.
// We also have a score to handle, framecount in ${ns}-render
exitRender`
    # Log the function call.
    $${debug.run} {input:"exitRender for $(name)"}
    # Log the expected function path
    ${debug.path} {input:"-> grabStrBlockPos -> calculateLaneX -> replace original stuff -> grabPlayerData -> cleanUpNewAnimationData"}
    # Pull animation data if it is missing
    $execute unless data storage ${ns}:animation_data new run ${grabAnimationData} {currentAnim: $(name)}
    # Structure block save the anchor location in the overworld
    ${grabStrBlockPos}
    ${calculateLaneX} {output: "${ns}:temp str.lanex int"}
    # Place name into the macro namespace
    data modify storage ${ns}:temp str.name set from storage ${ns}:animation_data new.name
    # Place the player's UUID into macro storage.
    $data modify storage ${ns}:temp str.UUID set from storage ${ns}:animation_data render_queue[{name: $(name)}].player
    ${a`
        # Log function call
        $${debug.run} {input: "replace original stuff at $(x) $(y) $(z) in $(dimension) within $(sx) $(sy) $(sz) for $(name), pulling blocks from $(lanex) 0 0 for $(UUID)"}
        # Clear remaining blocks and entities once again
        $execute in $(dimension) positioned $(x) $(y) $(z) positioned ~1 ~1 ~1 as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-render] run ${cleanKill}
        $execute in $(dimension) positioned $(x) $(y) $(z) positioned ~1 ~1 ~1 run fill ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) minecraft:air strict
        # Grab all of the blocks from the editor and store them into a structure
        $execute in ${ns}:editor run setblock $(lanex) 15 0 minecraft:structure_block{mode:"SAVE",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-original",strict:true} strict
        # Make sure all of these entities are not docile.
        $execute in ${ns}:editor positioned $(lanex) 16 0 as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-entity-turned-docile] run ${removeDocile}
        # Warn if powering this structure block is replacing a non-air block
        $execute in ${ns}:editor unless block $(lanex) 14 0 minecraft:air run ${debug.warn} {input: "Expected air at $(lanex) 15 0! Replacing..."}
        $execute in ${ns}:editor run setblock $(lanex) 14 0 minecraft:redstone_block
        $execute in ${ns}:editor run setblock $(lanex) 14 0 minecraft:air strict
        # Remove the blocks and entities from the editor
        $execute in ${ns}:editor positioned $(lanex) 16 0 as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz)] run ${cleanKill}
        $execute in ${ns}:editor positioned $(lanex) 16 0 run fill ~ ~ ~ ~47 ~47 ~47 minecraft:air strict
        # Remove the glass holding up the original blocks
        $execute in ${ns}:editor positioned $(lanex) 15 0 run fill ~ ~ ~ ~47 ~ ~47 minecraft:air strict
        # Replace the original structure in the overworld
        $execute in $(dimension) positioned $(x) $(y) $(z) run place template ${ns}:$(name)-original ~1 ~1 ~1 none none 1 1 strict
        # Regroup entities
        $execute in $(dimension) positioned $(x) $(y) $(z) positioned ~1 ~1 ~1 run ${regroupEntities} with storage ${ns}:temp str
        # Unforceload the player lane
        $execute in ${ns}:editor positioned $(lanex) 0 0 run forceload remove ~ ~ ~47 ~47
        # Unclaim the player's lane
        $${grabPlayerData} {UUID: $(UUID)}
        execute in ${ns}:editor run ${unclaimLane}
        # Remove this animation from currentAnim
        $data remove storage ${ns}:player_data players[{UUID: $(UUID)}].currentAnim
        # Unforceload the entire animation
        $execute in $(dimension) positioned $(x) $(y) $(z) run forceload remove ~ ~
        $execute in $(dimension) positioned $(x) $(y) $(z) positioned ~1 ~1 ~1 run forceload remove ~ ~ ~$(sx) ~$(sz)
    `} with storage ${ns}:temp str
    # Set this animation's location to none
    data modify storage ${ns}:animation_data new.location set value "none"
    # Remove animation from render_queue and any related scoreboards
    $data remove storage ${ns}:animation_data render_queue[{name: $(name)}]
    $scoreboard players reset #$(name)_frame ${ns}
    $scoreboard players reset #$(name)_render_duration ${ns}
    # Save data changes and remove temporary data
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    data remove storage ${ns}:temp str
    scoreboard objectives remove ${ns}-render
`;
