// This file contains helper functions for the animation system. These are used by functions to manipulate specific data for frames.

// Sets up basic stuff.
import mcf from '../mcf.js';
import * as debug from '../debug.js';
import { retrieveFrame, removeFrame, storeFrame } from '../storage.js';
import { cleanKill, recSplitGroups, regroupEntities } from '../entity.js';
import { axis } from '../util.js';

const folder = mcf.animation.helpers;

// Define functions you want other files to use here:
export const {
    renumberFrame, pullNextFrameData, recMoveFrames, insertSpace, calculateSelectedFrameBounds, moveFrame
} = folder;

// Define local functions here:
const {
    anonymous: a
} = folder;

const ns = 'easy-anim';

// Takes an input frame number and an output frame number, and renumbers the frame's structure data accordingly. Also needs the name of the animation and the size of the output frame.
renumberFrame`
    # Log the function call
    $${debug.run} {input: "renumberFrame placing $(input) at $(output) for $(name) within $(sx) $(sy) $(sz)"}
    # Log the expected function path.
    ${debug.path} {input: "-> retrieveFrame -> removeFrame -> cleanKill -> storeFrame"}
    # Remove possibly trailing data.
    data remove storage ${ns}:temp renumber
    # Make sure the area we're going to place the structures is forceloaded.
    execute in ${ns}:editor positioned 0 0 -48 run forceload add ~ ~ ~47 ~47
    # Retrieve structure data in case it was unloaded.
    $${retrieveFrame} {framenum: $(input)}
    # Remove the old frame from storage.
    $${removeFrame} {framenum: $(input)}
    # Place the structure template of the input frame.
    $execute in ${ns}:editor run place template ${ns}:$(name)-frame$(input) 0 1 -48 none none 1 1 strict
    # Warn if the structure block will replace a non-air block
    execute in ${ns}:editor unless block 0 0 -48 minecraft:air run ${debug.warn} {input: "Non-air block at 0 0 -48! Overwriting with structure block..."}
    # Place the structure block for this frame with the output frame number.
    $execute in ${ns}:editor run setblock 0 0 -48 minecraft:structure_block{mode:"SAVE",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(output)",strict:true} strict
    # Warn if the powering block will replace a non-air block
    execute in ${ns}:editor unless block 1 0 -48 minecraft:air run ${debug.warn} {input: "Non-air block at 1 0 -48! Overwriting with powering block..."}
    # Save the structure.
    execute in ${ns}:editor run setblock 1 0 -48 minecraft:redstone_block
    execute in ${ns}:editor run setblock 1 0 -48 minecraft:air
    # Remove the blocks.
    execute in ${ns}:editor run fill 0 0 -48 48 50 -1 minecraft:air strict
    # Warn if there are no entites to kill.
    execute in ${ns}:editor positioned 0 0 -48 unless entity @e[type=!player,dx=48,dy=50,dz=48] run ${debug.warn} {input: "No entities to kill! Skipping..."}
    # Remove the entities.
    execute in ${ns}:editor positioned 0 0 -48 as @e[type=!player,dx=48,dy=50,dz=48] run ${cleanKill}
    # This feels dirty, there has to be a better way to do this. We copy over Size from input into output temporarily so that storeFrame can use it.
    # Why doesn't this function do the data copying itself? Well I think it depends on its use case and we can't cover multiple use cases in one function, right?
    # Temporarily store the size for output frame
    $data modify storage ${ns}:temp renumber.size set from storage ${ns}:animation_data new.frames[$(output)].size
    # Set output's size to inputs so that storeFrame grabs the correct size
    $execute unless data storage ${ns}:animation_data new.frames[$(output)] run data modify storage ${ns}:animation_data new.frames append value {temp:true}
    $data modify storage ${ns}:animation_data new.frames[$(output)].size set from storage ${ns}:animation_data new.frames[$(input)].size
    # Store structure data since it changed.
    $${storeFrame} {framenum: $(output)}
    # Restore previous size for output and remove the temporary storage
    $data modify storage ${ns}:animation_data new.frames[$(output)].size set from storage ${ns}:temp renumber.size
    data remove storage ${ns}:temp renumber
    # If the data we added was temporary, remove it
    $execute if data storage ${ns}:animation_data new.frames[$(output)].temp run data remove storage ${ns}:animation_data new.frames[$(output)]
    # Remove the forceload.
    execute in ${ns}:editor positioned 0 0 -48 run forceload remove ~ ~ ~47 ~47
`;

// Pulls and sets up all of the data required for recMoveFrames, which specifically needs eanchor, size, and size - 1 = sh[x-z]. Newz also has to be calculated.
// Also sets eanchor's z to the new value.
const pullNextFrameDataCommands = [];

pullNextFrameDataCommands.push(`
    # Log the function call
    $${debug.run} {input: "pullNextFrameData for one frame ahead: $(nextframe) for $(name) placed in $(namespace) shifting $(neg)$(diff)"}
    # Error if there's no eanchor on this frame.
    $execute unless data storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor run ${debug.error} {input: "No eanchor data for next frame!"}
        # Error if there's no size data on this frame.
    $execute unless data storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size run ${debug.error} {input: "No size data for next frame!"}
`);

function createPullNextFrameData({axis, i}) {
    return`
        $data modify storage ${ns}:temp $(namespace).a${axis} set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor[${i}]
        $execute store result score ${axis} ${ns}-$(namespace) store result storage ${ns}:temp $(namespace).sh${axis} int 1 run data get storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size[${i}]
        $execute store result storage ${ns}:temp $(namespace).s${axis} int 1 run scoreboard players remove ${axis} ${ns}-$(namespace) 1
    `;
}

pullNextFrameDataCommands.push(...axis.map(createPullNextFrameData));

pullNextFrameDataCommands.push(`
    $execute store result score az ${ns}-$(namespace) run data get storage ${ns}:temp $(namespace).az
    # Set diff using neg so that if negative it's subtracted but if positive it is added
    $scoreboard players set diff ${ns}-$(namespace) $(neg)$(diff)
    $execute store result storage ${ns}:temp $(namespace).newz int 1 store result storage ${ns}:animation_data new.frames[$(nextframe)].eanchor[2] double 1 run scoreboard players operation az ${ns}-$(namespace) += diff ${ns}-$(namespace)
    # Set selected to false by default but then true if it does exist on this frame.
    $data modify storage ${ns}:temp $(namespace).selected set value false
    $data modify storage ${ns}:temp $(namespace).selected set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].selected
`);

pullNextFrameData(pullNextFrameDataCommands.join('\n'));

// Recursively moves frames over by the size of the removed frame's z axis, and renumbers them accordingly.
// FOR DEPENDENCIES BELOW: USE pullNextFrameData ABOVE.
// a[x-z]: the eanchor of the frame being moved. s[x-z]: the size of the frame being moved. sh[x-z]: the size - 1 of the frame being moved.
// neg: sign of the diff. diff: the size of the removed frame's z axis + 1. newz: the new z coordinate of the frame being moved. name: name of animation.
// currentframe: frame # where nextframe is being placed at. nextframe: frame # being moved. namespace: location where all data is stored.
// selected: whether or not the frame being moved is selected. 
// SCOREBOARD: target in ${ns}-$(namespace) must be set to a frame index where once reached, stops the loop. Set it to the first index you DO NOT want moved!
recMoveFrames`
    # Log the function call
    $${debug.run} {input: "recMoveFrames at $(ax) $(ay) $(az) extending $(shx) ($(sx)) $(shy) ($(sy)) $(shz) ($(sz)) shifting $(neg)$(diff) placing at $(newz) for $(name) frame $(currentframe) <- $(nextframe) inside of $(namespace) selected? $(selected)"}
    # Log the expected function path
    ${debug.path} {input: "-> renumberFrame -> recSplitGroups -> regroupEntities -> pullNextFrameData -> ^ recMoveFrames"}
    # Run the renumbering function for this frame.
    $${renumberFrame} {input: $(nextframe), output: $(currentframe), name: $(name), sx: $(shx), sy: $(shy), sz: $(shz)}
    # Set up some constants used in math
    $scoreboard players set 1 ${ns}-$(namespace) 1
    $scoreboard players set -1 ${ns}-$(namespace) -1
    # Add forceloads to make sure the area is loaded.
    $execute positioned $(ax) $(ay) $(az) run forceload add ~ ~ ~47 ~47
    execute positioned 0 0 -48 run forceload add ~ ~ ~47 ~47
    # Warn if there's no structure block to remove.
    $execute positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~ minecraft:structure_block run ${debug.warn} {input: "No structure block to remove at $(ax) ($(ay) - 1) $(az)! Skipping..."}
    # Remove the old structure block.
    $execute positioned $(ax) $(ay) $(az) if block ~ ~-1 ~ minecraft:structure_block run setblock ~ ~-1 ~ minecraft:air strict
    # Clone the frames over the difference of the size of the removed frame's z axis. Must be done twice since source and destination areas cannot overlap.
    $execute positioned $(ax) $(ay) $(az) run clone ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) 0 1 -48 strict masked move
    $execute positioned 0 1 -48 run clone ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) 0 1 $(newz) strict masked move
    # Ungroup all entities so that teleporting them doesn't erase who goes with who
    $data modify storage ${ns}:temp $(namespace).id set value 0
    $execute positioned $(ax) $(ay) $(az) run ${recSplitGroups} with storage ${ns}:temp $(namespace)
    # Teleport all entities in subsequent frames backwards by the size of the removed frame's z axis.
    $execute positioned $(ax) $(ay) $(az) as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-entity-turned-docile] at @s run tp @s ~ ~ ~$(neg)$(diff)
    # Regroup all entities.
    $execute positioned $(ax) $(ay) $(az) positioned ~ ~ ~$(neg)$(diff) run ${regroupEntities} with storage ${ns}:temp $(namespace)
    # Warn if the structure block will replace a non-air block
    $execute positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~$(neg)$(diff) minecraft:air run ${debug.warn} {input: "Non-air block at $(ax) ($(ay) - 1) ($(az) + $(neg)$(diff))! Overwriting with structure block..."}
    # Place a new structure block with the updated frame number.
    $execute positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~$(neg)$(diff) minecraft:structure_block{mode:"LOAD",showboundingbox:$(selected),posX:0,posY:1,posZ:0,sizeX:$(shx),sizeY:$(shy),sizeZ:$(shz),ignoreEntities:false,name:"${ns}:$(name)-frame$(currentframe)",strict:true}
    # Remove forceloads to cleanup.
    $execute positioned $(ax) $(ay) $(az) run forceload remove ~ ~ ~47 ~47
    execute positioned 0 0 -48 run forceload remove ~ ~ ~47 ~47
    # Increment currentframe and nextframe. (remove is used in conjunction with neg so that if we're moving backwards, we're increasing framenums, and if we're moving forwards we're decreasing framenums. This prevents collision with other frames.)
    $execute store result storage ${ns}:temp $(namespace).currentframe int 1 run scoreboard players get nextframe ${ns}-$(namespace)
    $execute store result storage ${ns}:temp $(namespace).nextframe int 1 run scoreboard players operation nextframe ${ns}-$(namespace) -= $(neg)1 ${ns}-$(namespace)
    # Check if there's more frames to renumber.
    $execute if score nextframe ${ns}-$(namespace) = target ${ns}-$(namespace) run return 1
    # Pull the next frame's data into macro storage.
    $${pullNextFrameData} with storage ${ns}:temp $(namespace)
    # Execute this recursive function again.
    $${recMoveFrames} with storage ${ns}:temp $(namespace)
`

// Given the SZ of a frame and a position (framenum), it will shift all preceding frames in the editor by that amount and renumber them one framenum ahead.
insertSpace`
    # Log the function call
    $${debug.run} {input: "insertSpace at $(framenum) size $(sz)"}
    # Log the expected function path
    ${debug.path} {input: " -> pullNextFrameData -> (recMoveFrames)"}
    # Clean up possibly trailing data
    scoreboard objectives remove ${ns}-is
    data remove storage ${ns}:temp is
    # Create a temporary scoreboard.
    scoreboard objectives add ${ns}-is dummy
    # Set up required data for pullNextFrameData and recMoveFrames
    data modify storage ${ns}:temp is.currentframe set from storage ${ns}:animation_data new.framecount
    execute store result score nextframe ${ns}-is run data get storage ${ns}:temp is.currentframe
    execute store result storage ${ns}:temp is.nextframe int 1 run scoreboard players remove nextframe ${ns}-is 1
    data modify storage ${ns}:temp is.namespace set value "is"
    data modify storage ${ns}:temp is.neg set value ""
    data modify storage ${ns}:temp is.name set from storage ${ns}:animation_data new.name
    # Diff is equal to sz + 1 because all frames are separated by 1 block on each side.
    $scoreboard players set diff ${ns}-is $(sz)
    execute store result storage ${ns}:temp is.diff int 1 run scoreboard players add diff ${ns}-is 1
    $scoreboard players set target ${ns}-is $(framenum)
    # Removing 1 to our target so that itself is still moved over by one but no frames past it (decreased by 1). Target stops when nextframe is equal to this value. Nextframe is the frame being moved.
    scoreboard players remove target ${ns}-is 1
    # Pull our data and begin iterating with recMoveFrames
    ${pullNextFrameData} with storage ${ns}:temp is
    ${recMoveFrames} with storage ${ns}:temp is
    # Clean up trailing data
    scoreboard objectives remove ${ns}-is
    data remove storage ${ns}:temp is
`;

// Calculates how far a frame is from 0 and the last frame's index and stores those values in csfbounds.
calculateSelectedFrameBounds`
    # Log the function call
    $${debug.run} {input: "calculateSelectedFrameBounds with frame $(framenum)"}
    # Clear the scoreboard in case it has trailing data.
    scoreboard objectives remove ${ns}-csfb
    # Create a scoreboard
    scoreboard objectives add ${ns}-csfb dummy
    # Save the framenum as a score
    $scoreboard players set framenum ${ns}-csfb $(framenum)
    # Save the framecount as a score
    execute store result score framecount ${ns}-csfb run data get storage ${ns}:animation_data new.framecount
    # Subtract framecount by 1 to get the last frame's index
    scoreboard players remove framecount ${ns}-csfb 1
    # Subtract framecount score by framenum to get distance from last frame
    scoreboard players operation framecount ${ns}-csfb -= framenum ${ns}-csfb
    # Store the distance from 0 (framenum itself) and the distance from last frame in csfbounds (if there is none to begin with)
    execute unless data storage ${ns}:temp csfbounds.lower store result storage ${ns}:temp csfbounds.lower int 1 run scoreboard players get framenum ${ns}-csfb
    execute unless data storage ${ns}:temp csfbounds.upper store result storage ${ns}:temp csfbounds.upper int 1 run scoreboard players get framecount ${ns}-csfb
    # If there is carryover data, store it as a score
    execute if data storage ${ns}:temp csfbounds.lower store result score lower ${ns}-csfb run data get storage ${ns}:temp csfbounds.lower
    execute if data storage ${ns}:temp csfbounds.upper store result score upper ${ns}-csfb run data get storage ${ns}:temp csfbounds.upper
    # If these new distances are smaller, save those instead.
    execute if score framenum ${ns}-csfb < lower ${ns}-csfb store result storage ${ns}:temp csfbounds.lower int 1 run scoreboard players get framenum ${ns}-csfb
    execute if score framecount ${ns}-csfb < upper ${ns}-csfb store result storage ${ns}:temp csfbounds.upper int 1 run scoreboard players get framecount ${ns}-csfb
    # Clear the scoreboard
    scoreboard objectives remove ${ns}-csfb
`

// Moves the specified framenum to the specified targetframe within the editor dimension.
// I think this function will cause major issues if frame sizes aren't equal, mainly because a bigger
// frame can be placed at a smaller frame's anchor and it wouldn't check if other frames in sequence are within that range.
// to fix this, you would have to calc the size diff and shift EVERYTHING ahead by that diff. Not gonna do that now lol.
const moveFrameCommands = [];

moveFrameCommands.push(`
    # Log the function call
    $${debug.run} {input: "moveFrame $(framenum) to $(targetframe)"}
    # Log the expected path
    ${debug.path} {input: "-> moving the frame -> recSplitGroups -> regroupEntities -> renumberFrame"}
    # Clean up possibly trailing data
    data remove storage ${ns}:temp moveFrame
    scoreboard objectives remove ${ns}-mf
    # We're going to make the assumption that this method is being used elsewhere where animation_data is open already and will be closed on its own
    # Open a scoreboard
    scoreboard objectives add ${ns}-mf dummy
    # Set a default value of selected to false for macro insert later (for creating structure block)
    data modify storage ${ns}:temp moveFrame.frameData.selected set value false
    # Pull needed data (Use macros once and then not again). Also warn if this data is missing
    $data modify storage ${ns}:temp moveFrame.frameData merge from storage ${ns}:animation_data new.frames[$(framenum)]
    $data modify storage ${ns}:temp moveFrame.frameDataTarget set from storage ${ns}:animation_data new.frames[$(targetframe)]
    # Using input and output namespaces for renumberFrame function (also needs a macro for name)
    $data modify storage ${ns}:temp moveFrame.frameData.input set value $(framenum)
    $data modify storage ${ns}:temp moveFrame.frameData.output set value $(targetframe)
    data modify storage ${ns}:temp moveFrame.frameData.name set from storage ${ns}:animation_data new.name
    execute unless data storage ${ns}:temp moveFrame.frameData run return run ${debug.error} {input: "Missing frameData for moving frame!"}
    execute unless data storage ${ns}:temp moveFrame.frameDataTarget run return run ${debug.error} {input: "Missing frameDataTarget for target frame!"}
    execute unless data storage ${ns}:temp moveFrame.frameData.name run return run ${debug.error} {input: "Missing name for target animation!"}
    # Pull sx-z and id for grouping for frameData, Create coords for anchor for frameData, Create coords for anchor for frameDataTarget
`);

function createMoveFrame({axis, i}) {
    return`
        data modify storage ${ns}:temp moveFrame.frameData.s${axis} set from storage ${ns}:temp moveFrame.frameData.size[${i}]
        data modify storage ${ns}:temp moveFrame.frameData.a${axis} set from storage ${ns}:temp moveFrame.frameData.eanchor[${i}]
        data modify storage ${ns}:temp moveFrame.frameData.ta${axis} set from storage ${ns}:temp moveFrame.frameDataTarget.eanchor[${i}]
    `;
}

moveFrameCommands.push(...axis.map(createMoveFrame));

moveFrameCommands.push(`
    data modify storage ${ns}:temp moveFrame.frameData.id set value 0
    execute store result score anchorz ${ns}-mf run data get storage ${ns}:temp moveFrame.frameData.az 1000
    # grab targetanchor as a score
    execute store result score targetanchor ${ns}-mf run data get storage ${ns}:temp moveFrame.frameData.taz 1000
    # Calculate the difference in the z positions
    execute store result storage ${ns}:temp moveFrame.frameData.diff int 0.001 run scoreboard players operation targetanchor ${ns}-mf -= anchorz ${ns}-mf
    ${a`
        # Log the function call
        ${debug.run} {input: "Moving the frame"}
        # Forceload the frame's area and the target frame's area.
        $execute positioned $(ax) $(ay) $(az) run forceload add ~ ~ ~47 ~47
        $execute positioned $(tax) $(tay) $(taz) run forceload add ~ ~ ~47 ~47
        # Ungroup entities at framenum
        $execute positioned $(ax) $(ay) $(az) run ${recSplitGroups} with storage ${ns}:temp moveFrame.frameData
        # Clone move the blocks over to the new location
        $execute positioned $(ax) $(ay) $(az) run clone ~ ~-1 ~ ~$(sx) ~$(sy) ~$(sz) ~ ~-1 ~$(diff) masked move
        # teleport all entities
        $execute positioned $(ax) $(ay) $(az) as @e[tag=${ns}-entity-turned-docile,dx=$(sx), dy=$(sy), dz=$(sz)] at @s run tp @s ~ ~ ~$(diff)
        # Regroup the entities
        $execute positioned $(tax) $(tay) $(taz) run ${regroupEntities} with storage ${ns}:temp moveFrame.frameData
        # Renumber the frame in data
        ${renumberFrame} with storage ${ns}:temp moveFrame.frameData
        # Warn if replacing a non-structure or air block at the new location.
        $execute positioned $(tax) $(tay) $(taz) unless block ~ ~-1 ~ minecraft:air unless block ~ ~-1 ~ minecraft:structure_block run ${debug.warn} {input: "Non-air or non-structure block found below frame! Overwriting..."}
        # Change the structure block at the new location to have the correct frame number.
        $execute positioned $(tax) $(tay) $(taz) run setblock ~ ~-1 ~ minecraft:structure_block{mode:"LOAD", showboundingbox:$(selected), posX:0, posY:1, posZ:0, sizeX:$(sx), sizeY:$(sy), sizeZ:$(sz), ignoreEntities: false, name:"${ns}:$(name)-frame$(output)", strict: true}
        # Update new frame data since eanchor just changed. (we only changed the Z-coordinate)
        $data modify storage ${ns}:animation_data new.frames[$(input)].eanchor[2] set from storage ${ns}:temp moveFrame.frameData.taz
        # Unforceload the frame's area and the target frame's area.
        $execute positioned $(ax) $(ay) $(az) run forceload remove ~ ~ ~47 ~47
        $execute positioned $(tax) $(tay) $(taz) run forceload remove ~ ~ ~47 ~47
    `} with storage ${ns}:temp moveFrame.frameData
    # Clean up trailing data
    data remove storage ${ns}:temp moveFrame
    scoreboard objectives remove ${ns}-mf
`);

moveFrame(moveFrameCommands.join('\n'));
