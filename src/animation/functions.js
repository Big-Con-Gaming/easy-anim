// Has the different functions that can operated on a specific selected frame or multiple selected frames for an animation. Examples: Saving, loading, clearing, etc.

// Sets up basic stuff.
import mcf from '../mcf.js';
import * as debug from '../debug.js';
import { pullNextFrameData, recMoveFrames, insertSpace, moveFrame } from './helpers.js';
import { toggleSelectionState } from './selecting.js';
import { grabAnimationFromUuid, cleanUpNewAnimationData } from '../data.js';
import { recSplitGroups, regroupEntities, removeDocile, cleanKill, turnEntityDocile } from '../entity.js';
import { calculateLaneX } from '../editor/lane.js';
import { storeFrame, removeFrame, retrieveFrame, clearOutTempStorage, retrieveFrameFromTemp, storeFrameInTemp } from '../storage.js';
import { stringEquals, arrayMoveEntry, axis } from '../util.js';

const folder = mcf.animation.functions;

// Define functions you want other files to use here:
export const {
    saveSpecificFrame, clearSpecificFrame, loadSpecificFrame, setFrameDuration, addNewFrame, duplicateFrame, moveSelectedFrames
} = folder;

// Define local functions here:
const {
    anonymous: a, grabFromRef, placeFrame, pullTargetFrameData
} = folder;
const ns = 'easy-anim';

// Saves a specific frame within the editor to the structure file. Ungroups entities beforehand and regroups them after.
// Needs this input from a macro: a[x, y, z] = anchor coordinates, s[x, y, z] = size parameters, name = animation name, framenum = frame number. 
const saveSpecificFrameCommands = [];

saveSpecificFrameCommands.push(`
    # Log the function call
    $${debug.run} {input: "saveSpecificFrame at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz) for $(name) frame $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> recSplitGroups -> removeDocile -> storeFrame -> regroupEntities"}
    # Ungroup all of the entities within the frame, reusing functions from the create animation function within menu.
    data modify storage ${ns}:temp str.id set value 0
    # All important data needs to be placed into str for the old recSplitGroups function to work. I feel like there's a better way to do this.
`);

function createSaveSpecificFrame({axis}) {
    return `
        $data modify storage ${ns}:temp str.s${axis} set value $(s${axis})
    `;
}

saveSpecificFrameCommands.push(...axis.map(createSaveSpecificFrame));

saveSpecificFrameCommands.push(`
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run ${recSplitGroups} with storage ${ns}:temp str
    # Untag them from selected and remove docile for all entities within the frame.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run tag @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-selected] remove ${ns}-selected
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-entity-turned-docile] run ${removeDocile}
    # Warn if the structure block will replace a non-air block
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~ minecraft:air unless block ~ ~-1 ~ minecraft:structure_block run ${debug.warn} {input: "Non-air and Non-structure block at $(ax) ($(ay) - 1) $(az)! Overwriting with structure block..."}
    # Make sure the frame's structure block is there.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~ minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
    # Warn if the redstone block will be replacing a non-air block
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) unless block ~-1 ~-1 ~ minecraft:air run ${debug.warn} {input: "Non-air block at ($(ax) - 1) ($(ay) - 1) $(az)! Overwriting with redstone block..."}
    # Save the frame
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~-1 ~-1 ~ minecraft:redstone_block
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~-1 ~-1 ~ minecraft:air
    # Place back into LOAD mode for visual bounding box toggle.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~ minecraft:structure_block{mode:"LOAD",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
    # Store structure data since it changed.
    $${storeFrame} {framenum: $(framenum)}
    # Tag them all again with selected.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run tag @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-selected] add ${ns}-selected
    # Regroup all entities.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run ${regroupEntities} with storage ${ns}:temp str
    # Remove all trailing data.
    data remove storage ${ns}:temp str
`)

saveSpecificFrame(saveSpecificFrameCommands.join('\n'));

// Clears a specific frame within the editor. This removes all blocks and entities within the frame's area.
// Needs this input from a macro: a[x, y, z] = anchor coordinates, s[x, y, z] = size parameters, name = animation name, framenum = frame number.
const clearSpecificFrameCommands = [];

clearSpecificFrameCommands.push(`
    # Log the function call
    $${debug.run} {input: "clearSpecificFrame at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz) for $(name) frame $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> /fill air -> cleanKill -> | pullNextFrameData -> (| recMoveFrames) -> | removeFrameData"}
    # Create a scoreboard and shrink size by 1 in each axis to be accurate for relative coordinates.
    scoreboard objectives add ${ns}-csf dummy
`);

function createClearSpecificFrame({axis}) {
    return`
        $scoreboard players set ${axis} ${ns}-csf $(s${axis})
        execute store result storage ${ns}:temp csf.s${axis} int 1 run scoreboard players remove ${axis} ${ns}-csf 1
        # Place anchor into the new macro storage.
        $data modify storage ${ns}:temp csf.a${axis} set value $(a${axis})
    `;
}

clearSpecificFrameCommands.push(...axis.map(createClearSpecificFrame));

clearSpecificFrameCommands.push(` 
    # Fill the area with air.
    ${a`
        # Log the function call
        $${debug.run} {input: "/fill air within ${ns}:editor at $(ax) $(ay) $(az) to $(sx) $(sy) $(sz)"}
        $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run fill ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) minecraft:air strict
    `} with storage ${ns}:temp csf
    # Warn if there are no entites to kill.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) unless entity @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-entity-turned-docile] run ${debug.warn} {input: "No entities within frame! Skipping..."}
    # Kill all entities within the area, using cleanKill to make sure nothing is left behind.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-entity-turned-docile] run ${cleanKill}
    # Place name into macro storage for future use.
    $data modify storage ${ns}:temp csf.name set value $(name)
    # Warn if there's no structure block to remove.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~ minecraft:structure_block run ${debug.warn} {input: "No structure block to remove at $(ax) ($(ay) - 1) $(az)! Skipping..."}
    # Remove the structure block.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) if block ~ ~-1 ~ minecraft:structure_block run setblock ~ ~-1 ~ minecraft:air strict
    # Store this frame's z size for offseting the rest of the frames.
    execute store result score diff ${ns}-csf run data get storage ${ns}:temp csf.sz
    execute store result storage ${ns}:temp csf.diff int 1 run scoreboard players add diff ${ns}-csf 2
    # Grab the current frame number into scoreboard and storage.
    $execute store result storage ${ns}:temp csf.currentframe int 1 run scoreboard players set nextframe ${ns}-csf $(framenum)
    # grab the framecount.
    $execute store result score remainder ${ns}-csf store result score target ${ns}-csf run data get storage ${ns}:animation_data animations[{name:$(name)}].data.framecount
    # Subtract by the current frame number to see how many frames are left. We remove one since framenum starts at 0 while length starts at 1.
    scoreboard players operation remainder ${ns}-csf -= nextframe ${ns}-csf
    scoreboard players remove remainder ${ns}-csf 1
    # Calculate the next frame.
    execute if score remainder ${ns}-csf matches 1.. store result storage ${ns}:temp csf.nextframe int 1 run scoreboard players add nextframe ${ns}-csf 1
    # Place the namespace into storage
    data modify storage ${ns}:temp csf.namespace set value "csf"
    # Make sure recFrames operates backwards using neg
    data modify storage ${ns}:temp csf.neg set value "-"
    # Store the data for the next frame into macro storage for quick access. Used in the recursive function below as well.
    execute if data storage ${ns}:temp {csf:{shift:true}} if score remainder ${ns}-csf matches 1.. run ${pullNextFrameData} with storage ${ns}:temp csf
    # Renumber and move all subsequent frames recursively.
    execute in ${ns}:editor if data storage ${ns}:temp {csf:{shift:true}} if score remainder ${ns}-csf matches 1.. run ${recMoveFrames} with storage ${ns}:temp csf
    # If removeData is true, then remove the frame's data from storage and decrease framecount.
    $execute if data storage ${ns}:temp {csf:{removeData:true}} run ${a`
        # Log the function call
        $${debug.run} {input: "removing frame data for $(framenum)"}
        execute store result score framecount ${ns}-csf run data get storage ${ns}:animation_data new.framecount
        execute store result storage ${ns}:animation_data new.framecount int 1 run scoreboard players remove framecount ${ns}-csf 1
        # If shift is true, remove the frame at the end from storage. If shift was false, remove this framenum's frame.
        execute if data storage ${ns}:temp {csf:{shift:true}} run ${a`
            $${removeFrame} {framenum:$(framecount)}
        `} with storage ${ns}:animation_data new
        # error if there's no frame data to remove.
        $execute unless data storage ${ns}:animation_data new.frames[$(framenum)] run return run ${debug.error} {input: "No frame data to remove for frame $(framenum)!"}
        $execute unless data storage ${ns}:temp {csf:{shift:true}} run ${removeFrame} {framenum:$(framenum)}
        # Remove frame data from command storage. Has to be after so that framecount uses the correct data to remove the frame at the end.
        $data remove storage ${ns}:animation_data new.frames[$(framenum)]
    `} {framenum: $(framenum)}

    # Clear trailing data.
    scoreboard objectives remove ${ns}-csf
    data remove storage ${ns}:temp csf
`);

clearSpecificFrame(clearSpecificFrameCommands.join('\n'));

// Loads a specific frame within the editor. This places all blocks and entities back into the world.
// Needs this input from a macro: a[x, y, z] = anchor coordinates, s[x, y, z] = size parameters, name = animation name, framenum = frame number.
loadSpecificFrame`
    # Log the function call
    $${debug.run} {input: "loadSpecificFrame at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz) for $(name) frame $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> clearSpecificFrame -> retrieveFrame -> regroupEntities"}
    # First, clear the specific frame so that there are no overlapping entities or blocks.
    $${clearSpecificFrame} {name: $(name), framenum: $(framenum), ax: $(ax), ay: $(ay), az: $(az), sx: $(sx), sy: $(sy), sz: $(sz)}
    # Retrieve structure data in case it was unloaded.
    $${retrieveFrame} {framenum: $(framenum)}
    # Place the frame's structure in.
    $execute in ${ns}:editor run place template ${ns}:$(name)-frame$(framenum) $(ax) $(ay) $(az) none none 1 1 strict
    # Warn if the structure block will replace a non-air block
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~ minecraft:air run ${debug.warn} {input: "Non-air block at $(ax) ($(ay) - 1) $(az)! Overwriting with structure block..."}
    # Place in the structure block.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~ minecraft:structure_block{mode:"LOAD",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
    # Tag all of the entities with selected.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run tag @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-selected] add ${ns}-selected
    # Regroup all grouped entities
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run ${regroupEntities} {sx: $(sx), sy: $(sy), sz: $(sz)}
`;

// Sets the duration for every given frame (typically selected) based on the duration specified in the carryover information (${ns}:temp carryover.duration)
setFrameDuration`
    # Log the function call
    $${debug.run} {input: "setFrameDuration for $(name) frame $(framenum)"}
    # Set duration based on carryover information
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].duration set from storage ${ns}:temp carryover.duration
`

const grabFromRefCommands = [];

grabFromRefCommands.push(`
    # Log the function call
    $${debug.run} {input: "grabFromRef from $(ref)"}
    # Using ref, place all needed data into temporary storage.
    # Size
`);

function createGrabFromRef({axis, i}) {
    return`
        $data modify storage ${ns}:temp anf.s${axis} set from storage ${ns}:animation_data new.$(ref)size[${i}]
    `;
}

grabFromRefCommands.push(...axis.map(createGrabFromRef));

grabFromRefCommands.push(`
    $data modify storage ${ns}:temp anf.size set from storage ${ns}:animation_data new.$(ref)size
    # Anchor
    $data modify storage ${ns}:temp anf.anchor set from storage ${ns}:animation_data new.$(ref)anchor
    # Camera
    $data modify storage ${ns}:temp anf.camera set from storage ${ns}:animation_data new.$(ref)camera
    # Target x and z for duplicating frame (not used with base frame)
    $execute if score basecheck ${ns}-anf matches 1 run data modify storage ${ns}:temp anf.tx set from storage ${ns}:animation_data new.$(ref)eanchor[0]
    $execute if score basecheck ${ns}-anf matches 1 run data modify storage ${ns}:temp anf.tz set from storage ${ns}:animation_data new.$(ref)eanchor[2]
`);

grabFromRef(grabFromRefCommands.join('\n'));

// Adds a frame to whichever framenum is passed in, or at the end if none are given. Pulls from targetframe for which frame is inserted.
addNewFrame`
    # Log the function call
    $${debug.run} {input: "addNewFrame at $(framenum) from $(targetframe)"}
    # Log the expected function path.
    ${debug.path} {input: "-> stringEquals -> grabFromRef -> retrieveFrame -> | toggleSelectionState -> cleanUpNewAnimationData -> grabAnimationFromUuid -> | insertSpace -> | insert consecutive [-> insertSpace -> moveFrame -> arrayMoveEntry] -> | calculateLaneX -> placeFrame -> regroupEntities -> storeFrame -> toggleSelectionState"}
    # create a temporary scoreboard
    scoreboard objectives add ${ns}-anf dummy
    # Place the framenum into the scoreboard
    $execute store result storage ${ns}:temp anf.framenum int 1 run scoreboard players set framenum ${ns}-anf $(framenum)
    # Grab consecutive frame data if applicable (and place it into a score for comparison)
    $data modify storage ${ns}:temp anf.consecutive set from storage ${ns}:temp carryover.consecutive.$(framenum)
    execute store result score consecutive ${ns}-anf run data get storage ${ns}:temp anf.consecutive
    # Check if it is equal to "base" or a number, and generate a data reference from it
    $${stringEquals} {input1: "base", input2: "$(targetframe)", output: "score basecheck ${ns}-anf"}
    execute if score basecheck ${ns}-anf matches 0 run data modify storage ${ns}:temp anf.ref set value ""
    $execute if score basecheck ${ns}-anf matches 1 run data modify storage ${ns}:temp anf.ref set value "frames[$(targetframe)]."
    # Using reference, copy over the data into the same temp namespace for easy grabbing.
    ${grabFromRef} with storage ${ns}:temp anf
    # Error if the animation is missing specific frame data, but do not return (so we can clear data.)
    $execute unless data storage ${ns}:temp anf.anchor run ${debug.error} {input: "No anchor data for frame $(targetframe)!"}
    $execute unless data storage ${ns}:temp anf.camera run ${debug.error} {input: "No camera data for frame $(targetframe)!"}
    $execute unless data storage ${ns}:temp anf.size run ${debug.error} {input: "No size data for frame $(targetframe)!"}
    # Retrieve structure data in case it was unloaded.
    $${retrieveFrame} {framenum: "$(targetframe)"}
    # Grab the frame count. If this frame is at the end, then skip insertSpace.
    execute store result score framecount ${ns}-anf run data get storage ${ns}:animation_data new.framecount
    # deselect the duplicated frame (baseFrame handles this in operateOnSelectedFrames)
    $execute if score basecheck ${ns}-anf matches 1 run ${toggleSelectionState} {framenum: $(targetframe)}
    # Must save the deselection to raw data so that pullNextFrameData in insertSpace uses the correct data
    execute unless score framenum ${ns}-anf = framecount ${ns}-anf run ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    execute unless score framenum ${ns}-anf = framecount ${ns}-anf run ${grabAnimationFromUuid} with entity @s
    # If we're moving a frame over, grab that frame's eanchor as ours.
    $execute unless score framenum ${ns}-anf = framecount ${ns}-anf run data modify storage ${ns}:temp anf.eanchor set from storage ${ns}:animation_data new.frames[$(framenum)].eanchor
    # Unless we're moving a frame over, grab the z coordinate of the current last frame's eanchor for calc z.
    execute if score framenum ${ns}-anf = framecount ${ns}-anf if data storage ${ns}:animation_data new.frames[-1] store result score lastframez ${ns}-anf run data get storage ${ns}:animation_data new.frames[-1].eanchor[2] 100
    # Unless we're moving a frame over, grab the z size of the current last frame for calc z.
    execute if score framenum ${ns}-anf = framecount ${ns}-anf if data storage ${ns}:animation_data new.frames[-1] store result score lastframesizez ${ns}-anf run data get storage ${ns}:animation_data new.frames[-1].size[2] 100
    # Run insert space to create room for our new frame (skip if at the end OR if frames are consecutive)
    execute unless score framenum ${ns}-anf = framecount ${ns}-anf unless score consecutive ${ns}-anf matches 2.. run ${insertSpace} with storage ${ns}:temp anf
    # Calculate the frame num diff from the consecutive count so that it can be used in the preceeding macro
    execute if score consecutive ${ns}-anf matches 2.. run scoreboard players operation consecutive ${ns}-anf += framenum ${ns}-anf
    execute if score consecutive ${ns}-anf matches 2.. store result storage ${ns}:temp anf.movetoframe int 1 run scoreboard players get consecutive ${ns}-anf
    # Calc frame num behind movetoframe to insert the data at, so that movetoframe # is still in front
    execute if score consecutive ${ns}-anf matches 2.. run scoreboard players operation pushback ${ns}-anf = consecutive ${ns}-anf
    execute if score consecutive ${ns}-anf matches 2.. store result storage ${ns}:temp anf.pushback int 1 run scoreboard players remove pushback ${ns}-anf 1
    # (oh btw, the "matches 2.." check still works after this math because consecutive is >= 2 to begin with [if consecutive] so += framenum will also be >= 2)
    # If there's consecutive frames, we need to insert the space at where the original frame needs to be moved to, and move it there.
    execute if score consecutive ${ns}-anf matches 2.. run ${a`
        # Log the function call
        $${debug.run} {input: "Inserting space after consecutive and moving this frame to $(movetoframe), pushing back $(pushback) and lower"}
        # Save the old az to use in moveFrame only (so that targetframe picks up the eanchor of the gap. This should lowkey be recalculated.)
        $data modify storage ${ns}:temp anf.oldaz set from storage ${ns}:animation_data new.frames[$(movetoframe)].eanchor[2]
        # Insert space at movetoframe
        $${insertSpace} {framenum: $(movetoframe), sz: $(sz)}
        # Save this new az to use after moveframe and for now set it to old
        $data modify storage ${ns}:temp anf.realaz set from storage ${ns}:animation_data new.frames[$(movetoframe)].eanchor[2]
        $data modify storage ${ns}:animation_data new.frames[$(movetoframe)].eanchor[2] set from storage ${ns}:temp anf.oldaz
        # Move frame at framenum to this new position
        $${moveFrame} {framenum: $(framenum), targetframe: $(movetoframe)}
        # Reset eanchorz to be the real value
        $data modify storage ${ns}:animation_data new.frames[$(movetoframe)].eanchor[2] set from storage ${ns}:temp anf.realaz
        # Update the array of frames so that this frame's data is there.
        $${arrayMoveEntry} {array: "${ns}:animation_data new.frames", source: $(framenum), target: $(pushback)}
    `} with storage ${ns}:temp anf
    # Copy the target frame's data into the new frame. Entities aren't copied as storeFrame will generate that for us
    $data modify storage ${ns}:animation_data new.frames insert $(framenum) value {}
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].duration set value 20
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].camera set from storage ${ns}:temp anf.camera
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].anchor set from storage ${ns}:temp anf.anchor
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].size set from storage ${ns}:temp anf.size
    # Create eanchor
    # If we stored one earlier, use that.
    $data modify storage ${ns}:animation_data new.frames[$(framenum)].eanchor set from storage ${ns}:temp anf.eanchor
    # If we don't have any, use the default first frame's eanchor
    $execute unless data storage ${ns}:temp anf.eanchor run data modify storage ${ns}:animation_data new.frames[$(framenum)].eanchor set value [0.0d, 1.0d, 2.0d]
    # And calculate the X needed for this lane.
    $execute unless data storage ${ns}:temp anf.eanchor run ${calculateLaneX} {output: "${ns}:animation_data new.frames[$(framenum)].eanchor[0] double"}
    # Only situation left -> frame is added at the end of the animation so eanchor has incorrect data -> must calc a new Z coordinate from previous frame (+1 for distance between frames.) Also, all is scaled by 100 to retain decimal places.
    execute if score lastframez ${ns}-anf matches 0.. if score lastframesizez ${ns}-anf matches 0.. run scoreboard players operation lastframez ${ns}-anf += lastframesizez ${ns}-anf
    $execute if score lastframez ${ns}-anf matches 0.. store result storage ${ns}:animation_data new.frames[$(framenum)].eanchor[2] double 0.01 run scoreboard players add lastframez ${ns}-anf 100 
    # Store the new framecount (+1)
    execute store result storage ${ns}:animation_data new.framecount int 1 run scoreboard players add framecount ${ns}-anf 1
    # Toss eanchor and name into macro storage. (eanchor of framenum for base frame adding, eanchor of target for duplicating)
    data modify storage ${ns}:temp anf.name set from storage ${ns}:animation_data new.name
    # Set eanchor for both normal and target coords to the same thing (eanchor for framenum) (unless tx and tz already exist, which is true when duplicating as it is set earlier.)
    $data modify storage ${ns}:temp anf.x set from storage ${ns}:animation_data new.frames[$(framenum)].eanchor[0]
    $data modify storage ${ns}:temp anf.z set from storage ${ns}:animation_data new.frames[$(framenum)].eanchor[2]
    execute unless data storage ${ns}:temp anf.tx run data modify storage ${ns}:temp anf.tx set from storage ${ns}:temp anf.x
    execute unless data storage ${ns}:temp anf.tz run data modify storage ${ns}:temp anf.tz set from storage ${ns}:temp anf.z
    # Place targetframe into macro context
    $data modify storage ${ns}:temp anf.targetframe set value "$(targetframe)"
    # Size was set earlier
    ${placeFrame`
        # Log the function call
        $${debug.run} {input: "placeFrame at $(x) 0 $(z) to $(tx) 0 $(tz) within $(sx) $(sy) $(sz) for $(name) frame $(framenum) targeted $(targetframe)"}
        # Log the expected path
        ${debug.path} {input: "-> turnEntityDocile -> regroupEntities -> storeFrame"}
        # Makes sure this entire animation is loaded
        $execute in ${ns}:editor positioned $(tx) 0 $(tz) run forceload add ~ ~ ~47 ~47
        # Place the base frame structure in (only for adding base frame). i = frame#
        $execute if score basecheck ${ns}-anf matches 0 in ${ns}:editor run place template ${ns}:$(name)-base $(x) 1 $(z) none none 1 1 strict
        # Ungroup all of the entities in the duplicating frame (not used if base)
        execute if score basecheck ${ns}-anf matches 1 run data modify storage ${ns}:temp anf.id set value 0
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor positioned $(tx) 1 $(tz) run ${recSplitGroups} with storage ${ns}:temp anf
        # Warn if the structure block will replace a non-air block
        $execute in ${ns}:editor unless block $(tx) 0 $(tz) minecraft:air run ${debug.warn} {input: "Non-air block at $(tx) 0 $(tz)! Overwriting with structure block..."}
        # Place in the frame's structure block
        $execute in ${ns}:editor run setblock $(tx) 0 $(tz) minecraft:structure_block{mode:"SAVE",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
        # Warn if the powering block will replace a non-air block
        $execute in ${ns}:editor positioned $(tx) 0 $(tz) unless block ~1 ~ ~ minecraft:air run ${debug.warn} {input: "Non-air block at ($(tx) + 1) 0 $(tz)! Overwriting with powering block..."}
        # Power and unpower the structure block to save the structure.
        $execute in ${ns}:editor positioned $(tx) 0 $(tz) run setblock ~1 ~ ~ minecraft:redstone_block
        $execute in ${ns}:editor positioned $(tx) 0 $(tz) run setblock ~1 ~ ~ minecraft:air
        # Make the new entities docile (so that recMoveFrames can target it to teleport) (only if base, since if duplicating we're only saving the target)
        $execute if score basecheck ${ns}-anf matches 0 in ${ns}:editor positioned $(tx) 0 $(tz) as @e[dx=$(sx), dy=$(sy), dz=$(sz), type=!minecraft:player] run ${turnEntityDocile}
        # Set back into LOAD mode for visual bounding box toggle. (If duplicating, this has to go back to the targetframe num)
        $execute if score basecheck ${ns}-anf matches 0 in ${ns}:editor run setblock $(tx) 0 $(tz) minecraft:structure_block{mode:"LOAD",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor run setblock $(tx) 0 $(tz) minecraft:structure_block{mode:"LOAD",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(targetframe)",strict:true}
        # Regroup all grouped entities
        $execute in ${ns}:editor positioned $(tx) 1 $(tz) run ${regroupEntities} with storage ${ns}:temp anf
        # Remove this forceloaded area
        $execute in ${ns}:editor positioned $(tx) 0 $(tz) run forceload remove ~ ~ ~47 ~47
        # If duplcating, then at this point forceload the actual spot,
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor positioned $(x) 0 $(z) run forceload add ~ ~ ~47 ~47
        # place the template,
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor run place template ${ns}:$(name)-frame$(framenum) $(x) 1 $(z) none none 1 1 strict
        # place the LOAD structure block,
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor unless block $(x) 0 $(z) minecraft:air run ${debug.warn} {input: "Non-air block at $(x) 0 $(z)! Overwriting with structure block..."}
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor run setblock $(x) 0 $(z) minecraft:structure_block{mode:"LOAD",showboundingbox:false,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
        # make entities docile,
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor positioned $(x) 0 $(z) as @e[dx=$(sx), dy=$(sy), dz=$(sz), type=!minecraft:player] run ${turnEntityDocile}
        # regroup them,
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor positioned $(x) 1 $(z) run ${regroupEntities} with storage ${ns}:temp anf
        # Unforceload
        $execute if score basecheck ${ns}-anf matches 1 in ${ns}:editor positioned $(x) 0 $(z) run forceload remove ~ ~ ~47 ~47
        # Store structure data since it changed.
        $${storeFrame} {framenum: $(framenum)}
    `} with storage ${ns}:temp anf 
    # Select the newly created frame
    ${toggleSelectionState} with storage ${ns}:temp anf
    # Clear trailing data
    data remove storage ${ns}:temp anf
    scoreboard objectives remove ${ns}-anf
`

// Given a framenum and data of consecutive frames from carryover, duplicates a frame using addNewFrame in order of the frames it is consecutive to.
duplicateFrame`
    # Log the function call
    $${debug.run} {input: "duplicateFrame with $(framenum)"}
    # Log the expected path
    ${debug.path} {input: "-> addNewFrame"}
    # Store framenum as a score and in our new namespace for macroing (need to add it with offset)
    scoreboard objectives add ${ns}-df dummy
    $execute store result storage ${ns}:temp df.targetframe int 1 run scoreboard players set framenum ${ns}-df $(framenum)
    # Grab offset from carryover data (generated in operationOnSelectedFrames)
    $execute store result score offset ${ns}-df run data get storage ${ns}:temp carryover.consecutive.$(framenum)
    # Add framenum and offset together and store that as targetframe for addNewFrame
    execute store result storage ${ns}:temp df.framenum int 1 run scoreboard players operation framenum ${ns}-df += offset ${ns}-df
    # addNewFrame using this offset.
    ${addNewFrame} with storage ${ns}:temp df
    # Clean up trailing data
    data remove storage ${ns}:temp df
    scoreboard objectives remove ${ns}-df
`;

const pullTargetFrameDataCommands = [];

pullTargetFrameDataCommands.push(`
    # Log the function call
    $${debug.run} {input: "pulling target frame data for $(targetframe)"}
    # Grab all data to a generic namespace to cut down macros.
    $data modify storage ${ns}:temp msf.targetdata set from storage ${ns}:animation_data new.frames[$(targetframe)]
    # grab eanchor and size for each axis
`);

function createPullTargetFrameData({axis, i}) {
    return`
        data modify storage ${ns}:temp msf.ta${axis} set from storage ${ns}:temp msf.targetdata.eanchor[${i}]
        data modify storage ${ns}:temp msf.ts${axis} set from storage ${ns}:temp msf.targetdata.size[${i}]
    `;
}

pullTargetFrameDataCommands.push(...axis.map(createPullTargetFrameData));

pullTargetFrameDataCommands.push(`
        execute store result score taz ${ns}-msf run data get storage ${ns}:temp msf.taz
        # Add 96 to targetframe's z eanchor so that we can TP it back that amount to the temporary location.
        execute store result storage ${ns}:temp msf.difftotemp int 1 run scoreboard players add taz ${ns}-msf 96
        # Set msf.selected to a default value of false (we need this for placing a structure block way later)
        data modify storage ${ns}:temp msf.selected set value false
        # Set msf.selected to whether or not targetframe is selected
        data modify storage ${ns}:temp msf.selected set from storage ${ns}:temp msf.targetdata.selected
    `);

pullTargetFrameData(pullTargetFrameDataCommands.join('\n'));

// Calculates the frame's target frame using offset and the frame's index, then calls moveFrame and handles all other logic.
moveSelectedFrames`
    # Log the function call
    $${debug.run} {input: "moveSelectedFrames with $(framenum)"}
    ${debug.path} {input: "-> pull target frame data -> moving target temporarily -> recSplitGroups -> storeFrameInTemp -> moveFrame -> | (pullNextFrameData -> recMoveFrames) -> grab pullfrom -> move out of temp -> retrieveFrameFromTemp -> clearOutTempStorage -> retrieveFrame -> arrayMoveEntry"}
    # Create a scoreboard
    scoreboard objectives add ${ns}-msf dummy
    # Pull all framenum data into storage for easy grabbing without macro.
    $data modify storage ${ns}:temp msf merge from storage ${ns}:animation_data new.frames[$(framenum)]
    # Store the framenum (in storage and...) and offset and target # into the scoreboard (probably could grab them from grabsizeanchor storage...)
    $execute store result storage ${ns}:temp msf.framenum int 1 run scoreboard players set framenum ${ns}-msf $(framenum)
    execute store result score offset ${ns}-msf store result score target ${ns}-msf run data get storage ${ns}:temp carryover.offset
    # Calculate the target frame by adding framenum and target together.
    scoreboard players operation target ${ns}-msf += framenum ${ns}-msf
    # Store this target frame into storage for other functions to use.
    execute store result storage ${ns}:temp msf.targetframe int 1 run scoreboard players get target ${ns}-msf
    # Grab target frame data like eanchor and size
    ${pullTargetFrameData} with storage ${ns}:temp msf
    ${a`
        # Log the function call
        $${debug.run} {input: "moving target temporarily, from $(tax) $(tay) $(taz) with size $(tsx) $(tsy) $(tsz)"}
        # Forceload the target frame area and the temporary area. (Possible optimization where we only forceload area bounded by size, but that also adds more macro inserts so.)
        $execute positioned $(tax) $(tay) $(taz) run forceload add ~ ~ ~47 ~47
        execute positioned 0 0 -96 run forceload add ~ ~ ~47 ~47
        # Use this data to ungroup entities at target frame
        $execute positioned $(tax) $(tay) $(taz) run ${recSplitGroups} {sx: $(tsx), sy: $(tsy), sz: $(tsz), id: 0}
        # Clone the blocks at target frame to a temporary location
        # You'll need to grab target frame data to then move them to a place that is different from 0 -48 actually since other functions we'll run will use that region.)
        $execute positioned $(tax) $(tay) $(taz) run clone ~ ~ ~ ~$(tsx) ~$(tsy) ~$(tsz) 0 0 -96 masked move
        # remove the old structure block (warn if not structure block)
        $execute positioned $(tax) $(tay) $(taz) unless block ~ ~-1 ~ minecraft:structure_block run ${debug.warn} {input: "non-structure block found at target's structure block location! Clearing..."}
        $execute positioned $(tax) $(tay) $(taz) run setblock ~ ~-1 ~ minecraft:air
        # Teleport all entities at target frame to this temporary location
        $execute positioned $(tax) $(tay) $(taz) as @e[tag=${ns}-entity-turned-docile,dx=$(tsx), dy=$(tsy), dz=$(tsz)] at @s run tp @s ~ ~ ~-$(difftotemp)
        # Unforceload the target frame area and the temporary area.
        $execute positioned $(tax) $(tay) $(taz) run forceload remove ~ ~ ~47 ~47
        execute positioned 0 0 -96 run forceload remove ~ ~ ~47 ~47
        # We also need to temporarily store this frame's storage data, since it'll be overwritten.
        $${storeFrameInTemp} {framenum: $(targetframe)}
    `} with storage ${ns}:temp msf
    # Move the framenum frame to where target frame is (which is now empty since we moved it to a temporary location).
    ${moveFrame} with storage ${ns}:temp msf
    # Pull data needed to run recMoveFrames.
    # Namespace
    data modify storage ${ns}:temp msf.namespace set value "msf"
    # Name
    data modify storage ${ns}:temp msf.name set from storage ${ns}:animation_data new.name
    # diff (should just be frame sz + 1 that we moved)
    execute store result score sz ${ns}-msf run data get storage ${ns}:temp msf.size[2]
    execute store result storage ${ns}:temp msf.diff int 1 run scoreboard players add sz ${ns}-msf 1
    # Neg (depends on offset score's sign, this is inversed because if we moved the func up in index [along z axis], to close the gap we move the other frames down in index [down on z axis])
    data modify storage ${ns}:temp msf.neg set value ""
    execute if score offset ${ns}-msf matches 0.. run data modify storage ${ns}:temp msf.neg set value "-"
    # Set nextframe to framenum +- 1 so that pullNextFrameData knows what to grab (sign depends on direction we are moving)
    scoreboard players operation nextframe ${ns}-msf = framenum ${ns}-msf
    execute if score offset ${ns}-msf matches 0.. store result storage ${ns}:temp msf.nextframe int 1 run scoreboard players add nextframe ${ns}-msf 1
    execute if score offset ${ns}-msf matches ..-1 store result storage ${ns}:temp msf.nextframe int 1 run scoreboard players remove nextframe ${ns}-msf 1
    # currentframe is just framenum
    data modify storage ${ns}:temp msf.currentframe set from storage ${ns}:temp msf.framenum
    # Target is another dependency of recMoveFrames that we actually set above already.
    # However, if target = nextframe already (the case when we are moving one frame over), then we can skip both of these functions! Set a flag
    execute if score target ${ns}-msf = nextframe ${ns}-msf run data modify storage ${ns}:temp msf.skipInbetweens set value true
    # use pullNextFrameData to create most of this for us
    execute unless data storage ${ns}:temp msf.skipInbetweens run ${pullNextFrameData} with storage ${ns}:temp msf
    # use recMoveFrames to close the gap left by the moved frame.
    execute unless data storage ${ns}:temp msf.skipInbetweens run ${recMoveFrames} with storage ${ns}:temp msf
    # Before target is changed, clone it to find where we are moving target to, later.
    scoreboard players operation targetnewindex ${ns}-msf = target ${ns}-msf
    # Now we gotta move the frame stored at 0 0 -96 back to targetframe - 1's position.
    # Must calculate a new eanchor z location since targetframe - 1 data doesn't exist anymore.
    # If moving upwards on Z, it will be targetframe - 2 (well in data should be targetframe - 1 since the extra -1 is from the physical gap)'s eanchorz + sizez + 1
    # If moving downwards on Z, it will be targetframe (which is now framenum's since we moved it there) eanchorz + sizez + 1
    # However, if we didn't shuffle in between frames (because there were none) we need to decrease targetframe by another 1 (if we are moving upwards on z).
    execute if data storage ${ns}:temp msf.skipInbetweens if score offset ${ns}-msf matches 0.. run scoreboard players remove target ${ns}-msf 1
    # First, change target to be -1 if upwards on z
    execute if score offset ${ns}-msf matches 0.. run scoreboard players remove target ${ns}-msf 1
    # Now, grab that frame's eanchorz and sizez. Should be in animation_data new
    execute store result storage ${ns}:temp msf.pullfrom int 1 run scoreboard players get target ${ns}-msf
    ${a`
        # Log the function call
        $${debug.run} {input: "grabbing data from frame $(pullfrom)"}
        # Store the eanchorz as a score
        $data modify storage ${ns}:temp msf.assembleaz set from storage ${ns}:animation_data new.frames[$(pullfrom)]
    `} with storage ${ns}:temp msf
    # Store eanchorz and sizez into a score
    execute store result score assembleaz ${ns}-msf run data get storage ${ns}:temp msf.assembleaz.eanchor[2]
    execute store result score assemblesz ${ns}-msf run data get storage ${ns}:temp msf.assembleaz.size[2]
    # Add them together
    scoreboard players operation assembleaz ${ns}-msf += assemblesz ${ns}-msf
    # Increase by 1 and store this value to be macroed.
    execute store result storage ${ns}:temp msf.newtaz int 1 run scoreboard players add assembleaz ${ns}-msf 1
    # Increase by 96 and store this as the diff to teleport entities by out of temp storage.
    execute store result storage ${ns}:temp msf.difffromtemp int 1 run scoreboard players add assembleaz ${ns}-msf 96
    # Using targetnewindex which was created earlier, depending on the sign of offset, change it to be the target frame's new index, and store it.
    execute if score offset ${ns}-msf matches 0.. run scoreboard players remove targetnewindex ${ns}-msf 1
    execute if score offset ${ns}-msf matches ..-1 run scoreboard players add targetnewindex ${ns}-msf 1
    execute store result storage ${ns}:temp msf.targetnewindex int 1 run scoreboard players get targetnewindex ${ns}-msf
    # Bring the frame back over
    ${a`
        # Log the function call
        ${debug.run} {input: "Moving frame out of temp storage"}
        # Forceload the areas
        $execute positioned $(tax) $(tay) $(newtaz) run forceload add ~ ~ ~47 ~47
        execute positioned 0 0 -96 run forceload add ~ ~ ~47 ~47
        # Clone the blocks over
        $execute positioned 0 0 -96 run clone ~ ~ ~ ~$(tsx) ~$(tsy) ~$(tsz) $(tax) $(tay) $(newtaz) masked move
        # Teleport the entities over
        $execute positioned 0 0 -96 as @e[tag=${ns}-entity-turned-docile,dx=$(tsx), dy=$(tsy), dz=$(tsz)] at @s run tp @s ~ ~ ~$(difffromtemp)
        # Regroup entities
        $execute positioned $(tax) $(tay) $(newtaz) run ${regroupEntities} {sx: $(tsx), sy: $(tsy), sz: $(tsz)}
        # Place new structure block which will have a new index (warn if replacing non-air)
        $execute positioned $(tax) $(tay) $(newtaz) unless block ~ ~-1 ~ minecraft:air run ${debug.warn} {input: "expected air block at target frame's new structure block position! Overwriting..."}
        $execute positioned $(tax) $(tay) $(newtaz) run setblock ~ ~-1 ~ minecraft:structure_block{mode:"LOAD", showboundingbox: $(selected), posX: 0, posY: 1, posZ: 0, sizeX: $(tsx), sizeY: $(tsy), sizeZ: $(tsz), ignoreEntities: false, name: "${ns}:$(name)-frame$(targetnewindex)", strict: true}
        # Save the change to animation data
        $data modify storage ${ns}:animation_data new.frames[$(targetframe)].eanchor[2] set value $(newtaz).0d
        # Unforceload both regions
        $execute positioned $(tax) $(tay) $(newtaz) run forceload remove ~ ~ ~47 ~47
        execute positioned 0 0 -96 run forceload remove ~ ~ ~47 ~47
        # Retrieve that data we stored earlier in temp
        $${retrieveFrameFromTemp} {framenum: $(targetnewindex)}
        # Clear out temp storage
        ${clearOutTempStorage}
        # Setting a flag so that retrieveFrame skips the existence check (forces overwriting data)
        data modify storage ${ns}:temp retrieveframe.forceOverwrite set value true
        # retrieve frame to update the structure block to what we saved in storage
        $${retrieveFrame} {framenum: $(targetnewindex)}
    `} with storage ${ns}:temp msf
    # Actually move the frames in the array data.
    data modify storage ${ns}:temp msf.array set value "${ns}:animation_data new.frames"
    data modify storage ${ns}:temp msf.source set from storage ${ns}:temp msf.framenum
    data modify storage ${ns}:temp msf.target set from storage ${ns}:temp msf.targetframe
    ${arrayMoveEntry} with storage ${ns}:temp msf
    # Clear trailing data
    data remove storage ${ns}:temp msf
    scoreboard objectives remove ${ns}-msf
`
