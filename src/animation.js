// Sets up basic stuff.
import mcf from './mcf.js';
import * as debug from './debug.js';
import { calculateLaneX, unclaimLane, findPlayerAxisOffset } from './inventory.js';
import { recGroupSearch, regroupEntities, removeDocile, grabSizeAnchorEditor, cleanUpNewAnimationData, grabAnimationFromUuid, grabPlayerAndAnimation, exitSelection, appendAllDataChanges } from './selection.js';
import { storeFrame, retrieveFrame, removeFrame } from './storage.js';
import { cameraSaveFrame, cameraLoadFrame, toggleHighlightFrame } from './camera.js';
import { cleanKill } from './util.js';
const folder = mcf.animation;
export const {
    enterEditor, findPlayerInFrame, recPlaceFrames, editorAnchorInData, tpIntoEditor, clean, saveCurrentFrame,
    saveCameraCurrentFrame, recPlayerSearch, saveSpecificFrame, clearCurrentFrame, clearSpecificFrame, pullNextFrameData,
    recPushBackFrames, loadCurrentFrame, loadSpecificFrame, addBaseFrame, placeFrame, loadCameraCurrentFrame,
    toggleHighlightCurrentFrame, exit, recRemoveFrames, renumberFrame, modifyCurrentFrameDuration
} = folder;
const { anonymous: a, cleanRemainder, newPlayerLane, modifyFrameDurationDialog, setFrameDuration } = folder;
const ns = 'easy-anim';

const editor_menu_item = 'minecraft:carrot_on_a_stick[item_name={italic:false,text:"Editor Menu"}, item_model="minecraft:test_instance_block"]';

// Run when the player wants to enter the editor for an existing animation. Must be executed with the player as context.
enterEditor`
    # Log the entry point
    ${debug.entry} {input: "from dialog enter_editor | from dialog main_menu editExistinAnimation"}
    # Log the function call
    $${debug.run} {input: "enterEditor for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabPlayerAndAnimation -> | newPlayerLane -> | findPlayerAxisOffset -> calculateLaneX -> recPlaceFrames (retrieveFrame -> editorAnchorInData -> regroupEntities) -> [exitSelection | cleanRemainder -> appendAllDataChanges] -> tpIntoEditor"}
    # Error if the player doesn't have a current animation.
    $execute unless data storage ${ns}:player_data players[{UUID:$(UUID)}].currentAnim run return run ${debug.error} {input: "Player has no current animation!"}
    # Load the player's and animation's data.
    $${grabPlayerAndAnimation} {UUID:$(UUID)}
    # Warn if the player doesn't have a lane, and assign them one if so.
    $execute unless data storage ${ns}:player_data current.lane run ${newPlayerLane`
        ${debug.warn} {input: "Player doesn't have an editor lane! Assigning a new one..."}
        ${findPlayerAxisOffset}
        $data modify storage ${ns}:player_data players[{UUID:$(UUID)}].lane set from storage ${ns}:player_data current.lane
    `} {UUID:$(UUID)}
    # Warn if the animation has no frames, but still allow them to enter the editor.
    execute unless data storage ${ns}:animation_data new.frames[0] run ${debug.warn} {input: "Player's current animation has no frames! Continuing entry..."}
    # Set the player's real world location into storage to be used when they exit the editor.
    $data modify storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos set from entity @s Pos
    # Set the player's current dimension into storage to be used when they exit the editor.
    $data modify storage ${ns}:player_data players[{UUID:$(UUID)}].prevDim set from entity @s Dimension
    # Toss the name of the of the animation into macro data.
    data modify storage ${ns}:temp eemacro.name set from storage ${ns}:player_data current.currentAnim
    # Grab the lane's X and store it within temporary storage for a macro.
    ${calculateLaneX} {output: "${ns}:temp eemacro.x int"}
    # Store a list of all of the frames within the macro.
    data modify storage ${ns}:temp eemacro.frames set from storage ${ns}:animation_data new.frames
    # Set y to 0 so that the regrouping macro knows where to go.
    data modify storage ${ns}:temp eemacro.y set value 1
    # Grab the x size of the first frame and store that into the macro.
    data modify storage ${ns}:temp eemacro.sx set from storage ${ns}:temp eemacro.frames[0].size[0]
    # Grab the y size of the first frame and store that into the macro.
    data modify storage ${ns}:temp eemacro.sy set from storage ${ns}:temp eemacro.frames[0].size[1]
    # Grab the z size of the first frame and store that into the macro.
    data modify storage ${ns}:temp eemacro.sz set from storage ${ns}:temp eemacro.frames[0].size[2]
    # Set the first Z offset to 2.
    data modify storage ${ns}:temp eemacro.z set value 2
    # Set i (frame #) to 0, representing the first frame:
    data modify storage ${ns}:temp eemacro.i set value 0
    # Set up a temporary scoreboard to be able to calculate offset and the iterative variable on the fly, and set its first value to 2.
    scoreboard objectives add ${ns}-temp dummy
    scoreboard players set offset ${ns}-temp 2
    scoreboard players set i ${ns}-temp 0
    execute if data storage ${ns}:animation_data new.frames[0] run ${recPlaceFrames`
        # Log the function call
        $${debug.run} {input: "recPlaceFrames at $(x) 0 $(z) for frame $(i) of animation $(name) with size $(sx) $(sy) $(sz)"}
        # Makes sure this entire animation is loaded
        $execute in ${ns}:editor positioned $(x) 0 $(z) run forceload add ~ ~ ~47 ~47
        # Retrieve structure data in case it was unloaded.
        $${retrieveFrame} {framenum: $(i)}
        # Place the frame's structure in. i = frame#
        $execute in ${ns}:editor run place template ${ns}:$(name)-frame$(i) $(x) 1 $(z) none none 1 1 strict
        # Toss the editor's anchor point for this frame into storage. We use a temporary marker's position to place it in.
        $execute in ${ns}:editor positioned $(x) 1 $(z) align xyz summon minecraft:marker run ${editorAnchorInData`
            # Log the function call
            ${debug.run} {input: "editorAnchorInData"}
            $data modify storage ${ns}:animation_data new.frames[$(i)].eanchor set from entity @s Pos
            kill @s
        `} with storage ${ns}:temp eemacro
        # Regroup all grouped entities
        $execute in ${ns}:editor positioned $(x) 1 $(z) run ${regroupEntities} with storage ${ns}:temp eemacro
        # Warn if the structure block will replace a non-air block
        $execute in ${ns}:editor unless block $(x) 0 $(z) minecraft:air run ${debug.warn} {input: "Non-air block at $(x) 0 $(z)! Overwriting with structure block..."} 
        # Place in the frame's structure block
        $execute in ${ns}:editor run setblock $(x) 0 $(z) minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(i)",strict:true}
        # Store the current size along the z axis for this frame.
        execute store result score zadd ${ns}-temp run data get storage ${ns}:temp eemacro.frames[0].size[2]
        # Remove the current frame from the list.
        data remove storage ${ns}:temp eemacro.frames[0]
        # If there's no more frames, return and end the recursive loop.
        execute unless data storage ${ns}:temp eemacro.frames[0] run return 1
        # Grab the x size and store that into the macro.
        data modify storage ${ns}:temp eemacro.sx set from storage ${ns}:temp eemacro.frames[0].size[0]
        # Grab the y size and store that into the macro.
        data modify storage ${ns}:temp eemacro.sy set from storage ${ns}:temp eemacro.frames[0].size[1]
        # Grab the z size and store that into the macro.
        data modify storage ${ns}:temp eemacro.sz set from storage ${ns}:temp eemacro.frames[0].size[2]
        # Combine the current offset with the newly found one from the size's z axis, and add 1 for more separation. Store directly into the macro storage.
        scoreboard players operation offset ${ns}-temp += zadd ${ns}-temp
        execute store result storage ${ns}:temp eemacro.z int 1 run scoreboard players add offset ${ns}-temp 1
        # Increment i and store that as well.
        execute store result storage ${ns}:temp eemacro.i int 1 run scoreboard players add i ${ns}-temp 1
        # Execute this recursive function once more.
        ${recPlaceFrames} with storage ${ns}:temp eemacro
        # Remove this forceloaded area
        $execute in ${ns}:editor positioned $(x) 0 $(z) run forceload remove ~ ~ ~47 ~47
    `} with storage ${ns}:temp eemacro
    # Just in case 0 0 was unforceloaded, add it back
    execute in ${ns}:editor run forceload add 0 0
    # Tag the player with inEditor so it is easier to track.
    tag @s add ${ns}-inEditor
    # Return the player's original inventory (in case they were coming from the selection menu).
    # This also cleans up almost all of our extra data, and sets the animation's location to editor.
    execute if data storage ${ns}:animation_data {new:{location:"anchor"}} run ${a`
        ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
        ${exitSelection} with entity @s
    `}
    execute unless data storage ${ns}:animation_data {new:{location:"anchor"}} run ${cleanRemainder`
        data modify storage ${ns}:animation_data new.location set value "editor"
        ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    `}
    
    # Teleport the player into the editor dimension.
    ${tpIntoEditor`
        # Log the function call
        ${debug.run} {input: "tpIntoEditor"}
        $execute in ${ns}:editor run tp @s $(x) 3 0 0 0
    `} with storage ${ns}:temp eemacro
    # Remove temporary data.
    data remove storage ${ns}:temp eemacro
    scoreboard objectives remove ${ns}-temp
    # Give them the quick menu item. This item's data is stored as a constant above.
    execute unless items entity @s inventory.* ${editor_menu_item} unless items entity @s hotbar.* ${editor_menu_item} unless items entity @s weapon.* ${editor_menu_item} run give @s ${editor_menu_item}
`;

// Finds which frame the player is currently located in and executes a specified command with this information.
// Input: UUID = player's UUID, funccall = the function call to run once the player is found, macros are provided for the latter function.
// Macros available to the latter function: a[x, y, z] = anchor's position, s[x, y, z] = frame's size, name = animation's name, framenum = the current frame's number, framecount = total number of frames.
findPlayerInFrame`
    # Log the function call
    $${debug.run} {input: "findPlayerInFrame for $(UUID) to execute $(funccall)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> grabSizeAnchorEditor -> recPlayerSearch ({funccall} -> grabSizeAnchorEditor) -> cleanUpNewAnimationData"}
    # Place the funccall into grabsizeanchor so it can be macroed in later on.
    $data modify storage ${ns}:temp grabsizeanchor.funccall set value "$(funccall)"
    # Grab animation_data using UUID
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Error but don't return if the animation has no frames.
    execute unless data storage ${ns}:animation_data new.frames[0] run ${debug.error} {input: "Player's current animation has no frames!"}
    # Grab the animation name
    data modify storage ${ns}:temp grabsizeanchor.name set from storage ${ns}:animation_data new.name
    # Place UUID into macro
    $data modify storage ${ns}:temp grabsizeanchor.UUID set value $(UUID)
    # Set up a scoreboard for the iterative var used within the saveSpecificFrame macro
    scoreboard objectives add ${ns}-fpif dummy
    execute store result storage ${ns}:temp grabsizeanchor.framenum int 1 run scoreboard players set i ${ns}-fpif 0
    # Grab the framecount
    execute store result score framecount ${ns}-fpif store result storage ${ns}:temp grabsizeanchor.framecount int 1 run data get storage ${ns}:animation_data new.framecount
    # Pull specific data into the macro for the first frame.
    execute if score framecount ${ns}-fpif matches 1.. run ${grabSizeAnchorEditor} {framenum: 0}
    execute if score framecount ${ns}-fpif matches 1.. run ${recPlayerSearch`
        # Log the function call
        $${debug.run} {input: "recPlayerSearch at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz) for $(name) frame $(framenum) out of $(framecount) player $(UUID)"}
        # If the player is within this frame's bounding box, execute the function to save this specific frame. Exit the loop afterwards as well.
        $execute in ${ns}:editor positioned $(ax) $(ay) $(az) if entity @p[dx=$(sx), dy=$(sy), dz=$(sz)] run return run $(funccall) {name: $(name), framenum: $(framenum), framecount: $(framecount), ax: $(ax), ay: $(ay), az: $(az), sx: $(sx), sy: $(sy), sz: $(sz), UUID: $(UUID)}
        # Iterate framenum
        execute store result storage ${ns}:temp grabsizeanchor.framenum int 1 run scoreboard players add i ${ns}-fpif 1
        # Grab the next frame's data
        ${grabSizeAnchorEditor} with storage ${ns}:temp grabsizeanchor
        # Unless framecount is equal or greater than the iterative variable, do another recursive search.
        execute unless score i ${ns}-fpif >= framecount ${ns}-fpif run ${recPlayerSearch} with storage ${ns}:temp grabsizeanchor
    `} with storage ${ns}:temp grabsizeanchor
    # Clean up remaining data
    data remove storage ${ns}:temp grabsizeanchor
    scoreboard objectives remove ${ns}-fpif
    # Set animation_data new to the player's animation
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
`;

// Iterates through each frame and checks to see which one the player is within. For that frame, it will ungroup all entities, make sure they aren't docile, and then save the structure, regrouping entities afterwards using saveSpecificFrame.
saveCurrentFrame`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog"}
    # Log the function call
    ${debug.run} {input: "saveCurrentFrame"}
    # Log the expected function path.
    ${debug.path} {input: "-> findPlayerInFrame -> | saveSpecificFrame"}
    # Store the player's UUID in a macro location.
    data modify storage ${ns}:temp macro.UUID set from entity @s UUID
    # Store the function execution call within a macro location.
    data modify storage ${ns}:temp macro.funccall set value "${saveSpecificFrame}"
    # Execute the function that will find the player within a frame using our specific frame function call.
    ${findPlayerInFrame} with storage ${ns}:temp macro
    # Remove trailing data
    data remove storage ${ns}:temp macro
`;

// Saves a specific frame within the editor to the structure file. Ungroups entities beforehand and regroups them after.
// Needs this input from a macro: a[x, y, z] = anchor coordinates, s[x, y, z] = size parameters, name = animation name, framenum = frame number. 
saveSpecificFrame`
    # Log the function call
    $${debug.run} {input: "saveSpecificFrame at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz) for $(name) frame $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> recGroupSearch -> removeDocile -> storeFrame -> regroupEntities"}
    # Ungroup all of the entities within the frame, reusing functions from the create animation function within menu.
    scoreboard objectives add ${ns}-temp dummy
    execute store result storage ${ns}:temp str.id int 1 run scoreboard players set groupid ${ns}-temp 0
    # All important data needs to be placed into str for the old recGroupSearch function to work. I feel like there's a better way to do this.
    $data modify storage ${ns}:temp str.sx set value $(sx)
    $data modify storage ${ns}:temp str.sy set value $(sy)
    $data modify storage ${ns}:temp str.sz set value $(sz)
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run ${recGroupSearch} with storage ${ns}:temp str
    # Remove docile for all entities within the frame. 
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
    # Store structure data since it changed.
    $${storeFrame} {framenum: $(framenum)}
    # Regroup all entities.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run ${regroupEntities} with storage ${ns}:temp str
    # Remove all trailing data.
    data remove storage ${ns}:temp str
    scoreboard objectives remove ${ns}-temp
`;

// Iterates through each frame and checks to see which one the player is within. For that frame, it will clear all blocks and kill all entities. This is done using clearSpecificFrame.
clearCurrentFrame`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog"}
    # Log the function call
    ${debug.run} {input: "clearCurrentFrame"}
    # Log the expected function path.
    ${debug.path} {input: "-> findPlayerInFrame -> | clearSpecificFrame"}
    # Store the player's UUID in a macro location.
    data modify storage ${ns}:temp macro.UUID set from entity @s UUID
    # Store the function execution call within a macro location.
    data modify storage ${ns}:temp macro.funccall set value "${clearSpecificFrame}"
    # Set a value in storage so that clearSpecificFrame will remove the data from storage.
    data modify storage ${ns}:temp csf.removeData set value true
    # Set a value in storage so that clearSpecificFrame will move each subsequent frame over.
    data modify storage ${ns}:temp csf.shift set value true
    # Execute the function that will find the player within a frame using our specific frame function call.
    ${findPlayerInFrame} with storage ${ns}:temp macro
    # Remove trailing data
    data remove storage ${ns}:temp macro
    data remove storage ${ns}:temp csf
`;

// Clears a specific frame within the editor. This removes all blocks and entities within the frame's area.
// Needs this input from a macro: a[x, y, z] = anchor coordinates, s[x, y, z] = size parameters, name = animation name, framenum = frame number.
clearSpecificFrame`
    # Log the function call
    $${debug.run} {input: "clearSpecificFrame at $(ax) $(ay) $(az) within $(sx) $(sy) $(sz) for $(name) frame $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> /fill air -> cleanKill -> | pullNextFrameData -> | recPushBackFrames (renumberFrame -> pullNextFrameData) -> | removeFrameData"}
    # Create a scoreboard and shrink size by 1 in each axis to be accurate for relative coordinates.
    scoreboard objectives add ${ns}-csf dummy
    $scoreboard players set x ${ns}-csf $(sx)
    $scoreboard players set y ${ns}-csf $(sy)
    $scoreboard players set z ${ns}-csf $(sz)
    execute store result storage ${ns}:temp csf.sx int 1 run scoreboard players remove x ${ns}-csf 1
    execute store result storage ${ns}:temp csf.sy int 1 run scoreboard players remove y ${ns}-csf 1
    execute store result storage ${ns}:temp csf.sz int 1 run scoreboard players remove z ${ns}-csf 1
    # Place anchor into the new macro storage.
    $data modify storage ${ns}:temp csf.ax set value $(ax)
    $data modify storage ${ns}:temp csf.ay set value $(ay)
    $data modify storage ${ns}:temp csf.az set value $(az)
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
    $execute store result score remainder ${ns}-csf store result score length ${ns}-csf run data get storage ${ns}:animation_data animations[{name:$(name)}].data.framecount
    # Subtract by the current frame number to see how many frames are left. We remove one since framenum starts at 0 while length starts at 1.
    scoreboard players operation remainder ${ns}-csf -= nextframe ${ns}-csf
    scoreboard players remove remainder ${ns}-csf 1
    # Calculate the next frame.
    execute if score remainder ${ns}-csf matches 1.. store result storage ${ns}:temp csf.nextframe int 1 run scoreboard players add nextframe ${ns}-csf 1
    # Store the data for the next frame into macro storage for quick access. Used in the recursive function below as well.
    execute if data storage ${ns}:temp {csf:{shift:true}} if score remainder ${ns}-csf matches 1.. run ${pullNextFrameData`
        # Log the function call
        $${debug.run} {input: "pullNextFrameData for one frame ahead: $(nextframe)"}
        # Error if there's no eanchor on this frame.
        $execute unless data storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor run ${debug.error} {input: "No eanchor data for next frame!"}
        $data modify storage ${ns}:temp csf.ax set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor[0]
        $data modify storage ${ns}:temp csf.ay set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor[1]
        $data modify storage ${ns}:temp csf.az set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor[2]
        execute store result score az ${ns}-csf run data get storage ${ns}:temp csf.az
        # Error if there's no size data on this frame.
        $execute unless data storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size run ${debug.error} {input: "No size data for next frame!"}
        $execute store result score x ${ns}-csf store result storage ${ns}:temp csf.shx int 1 run data get storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size[0]
        $execute store result score y ${ns}-csf store result storage ${ns}:temp csf.shy int 1 run data get storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size[1]
        $execute store result score z ${ns}-csf store result storage ${ns}:temp csf.shz int 1 run data get storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size[2]
        execute store result storage ${ns}:temp csf.sx int 1 run scoreboard players remove x ${ns}-csf 1
        execute store result storage ${ns}:temp csf.sy int 1 run scoreboard players remove y ${ns}-csf 1
        execute store result storage ${ns}:temp csf.sz int 1 run scoreboard players remove z ${ns}-csf 1
        $execute store result storage ${ns}:temp csf.newz int 1 store result storage ${ns}:animation_data new.frames[$(nextframe)].eanchor[2] double 1 run scoreboard players operation az ${ns}-csf -= diff ${ns}-csf
    `} with storage ${ns}:temp csf
    # Renumber all subsequent frames recursively.
    execute in ${ns}:editor if data storage ${ns}:temp {csf:{shift:true}} if score remainder ${ns}-csf matches 1.. run ${recPushBackFrames`
        # Log the function call
        $${debug.run} {input: "recPushBackFrames extending $(shx) $(shy) $(shz) shifting back $(diff) placing at $(newz) for $(name) frame $(currentframe) <- $(nextframe)"}
        # Run the renumbering function for this frame.
        $${renumberFrame} {input: $(nextframe), output: $(currentframe), name: $(name), sx: $(shx), sy: $(shy), sz: $(shz)}
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
        # Teleport all entities in subsequent frames backwards by the size of the removed frame's z axis.
        $execute positioned $(ax) $(ay) $(az) as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-entity-turned-docile] at @s run tp @s ~ ~ ~-$(diff)
        # Warn if the structure block will replace a non-air block
        $execute positioned $(ax) $(ay) $(az) unless block ~ ~-1 ~-$(diff) minecraft:air run ${debug.warn} {input: "Non-air block at $(ax) ($(ay) - 1) ($(az) - $(diff))! Overwriting with structure block..."}
        # Place a new structure block with the updated frame number.
        $execute positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~-$(diff) minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(shx),sizeY:$(shy),sizeZ:$(shz),ignoreEntities:false,name:"${ns}:$(name)-frame$(currentframe)",strict:true}
        # Remove forceloads to cleanup.
        $execute positioned $(ax) $(ay) $(az) run forceload remove ~ ~ ~47 ~47
        execute positioned 0 0 -48 run forceload remove ~ ~ ~47 ~47
        # Increment currentframe and nextframe.
        execute store result storage ${ns}:temp csf.currentframe int 1 run scoreboard players get nextframe ${ns}-csf
        execute store result storage ${ns}:temp csf.nextframe int 1 run scoreboard players add nextframe ${ns}-csf 1
        # Check if there's more frames to renumber.
        execute if score nextframe ${ns}-csf >= length ${ns}-csf run return 1
        # Pull the next frame's data into macro storage.
        ${pullNextFrameData} with storage ${ns}:temp csf
        # Execute this recursive function again.
        ${recPushBackFrames} with storage ${ns}:temp csf
    `} with storage ${ns}:temp csf

    # If removeData is true, then remove the frame's data from storage and decrease framecount.
    $execute if data storage ${ns}:temp {csf:{removeData:true}} run ${a`
        # Log the function call
        $${debug.run} {input: "removing frame data for $(framenum)"}
        # error if there's no frame data to remove.
        $execute unless data storage ${ns}:animation_data new.frames[$(framenum)] run return run ${debug.error} {input: "No frame data to remove for frame $(framenum)!"}
        # Remove frame data from command storage.
        $data remove storage ${ns}:animation_data new.frames[$(framenum)]
        execute store result score framecount ${ns}-csf run data get storage ${ns}:animation_data new.framecount
        execute store result storage ${ns}:animation_data new.framecount int 1 run scoreboard players remove framecount ${ns}-csf 1
        # If shift is true, remove the frame at the end from storage. If shift was false, remove this framenum's frame.
        execute if data storage ${ns}:temp {csf:{shift:true}} run ${a`
            $${removeFrame} {framenum:$(framecount)}
        `} with storage ${ns}:animation_data new
        $execute unless data storage ${ns}:temp {csf:{shift:true}} run ${removeFrame} {framenum:$(framenum)}
    `} {framenum: $(framenum)}

    # Clear trailing data.
    scoreboard objectives remove ${ns}-csf
    data remove storage ${ns}:temp csf
`;

// Iterates through each frame and checks to see which one the player is within. For that frame, it will clear all blocks and kill all entities. This is done using clearSpecificFrame.
loadCurrentFrame`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog"}
    # Log the function call
    ${debug.run} {input: "loadCurrentFrame"}
    # Log the expected function path.
    ${debug.path} {input: "-> findPlayerInFrame -> | loadSpecificFrame"}
    # Store the player's UUID in a macro location.
    data modify storage ${ns}:temp macro.UUID set from entity @s UUID
    # Store the function execution call within a macro location.
    data modify storage ${ns}:temp macro.funccall set value "${loadSpecificFrame}"
    # Execute the function that will find the player within a frame using our specific frame function call.
    ${findPlayerInFrame} with storage ${ns}:temp macro
    # Remove trailing data
    data remove storage ${ns}:temp macro
`;

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
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~ minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
    # Regroup all grouped entities
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run ${regroupEntities} {sx: $(sx), sy: $(sy), sz: $(sz)}
`;

// Saves the camera position of the player within whichever frame they're in
saveCameraCurrentFrame`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog"}
    # Log the function call
    ${debug.run} {input: "saveCameraCurrentFrame"}
    # Log the expected function path.
    ${debug.path} {input: "-> findPlayerInFrame-> | cameraSaveFrame"}
    # Store the player's UUID in a macro location.
    data modify storage ${ns}:temp macro.UUID set from entity @s UUID
    # Store the function execution call within a macro location.
    data modify storage ${ns}:temp macro.funccall set value "${cameraSaveFrame}"
    # Execute the function that will find the player within a frame using our specific frame function call.
    ${findPlayerInFrame} with storage ${ns}:temp macro
    # Remove trailing data
    data remove storage ${ns}:temp macro
`

// Loads the camera position of the player within whichever frame they're in
loadCameraCurrentFrame`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog"}
    # Log the function call
    ${debug.run} {input: "loadCameraCurrentFrame"}
    # Log the expected function path.
    ${debug.path} {input: "-> findPlayerInFrame-> | cameraLoadFrame"}
    # Store the player's UUID in a macro location.
    data modify storage ${ns}:temp macro.UUID set from entity @s UUID
    # Store the function execution call within a macro location.
    data modify storage ${ns}:temp macro.funccall set value "${cameraLoadFrame}"
    # Execute the function that will find the player within a frame using our specific frame function call.
    ${findPlayerInFrame} with storage ${ns}:temp macro
    # Remove trailing data
    data remove storage ${ns}:temp macro
`

// Highlights the camera of the current frame the player is in
toggleHighlightCurrentFrame`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog"}
    # Log the function call
    ${debug.run} {input: "highlightCameraCurrentFrame"}
    # Log the expected function path.
    ${debug.path} {input: "-> findPlayerInFrame -> | toggleHighlightFrame"}
    # Store the player's UUID in a macro location.
    data modify storage ${ns}:temp macro.UUID set from entity @s UUID
    # Store the function execution call within a macro location.
    data modify storage ${ns}:temp macro.funccall set value "${toggleHighlightFrame}"
    # Execute the function that will find the player within a frame using our specific frame function call.
    ${findPlayerInFrame} with storage ${ns}:temp macro
    # Remove trailing data
    data remove storage ${ns}:temp macro
`

// Shows the dialog for modifying the frame's duration that the player is in.
modifyCurrentFrameDuration`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog"}
    # Log the function call
    ${debug.run} {input: "modifyCurrentFrameDuration"}
    # Log the expected function path.
    ${debug.path} {input: "-> findPlayerInFrame -> | modifyFrameDurationDialog"}
    # Store the player's UUID in a macro location.
    data modify storage ${ns}:temp macro.UUID set from entity @s UUID
    # Store the function execution call within a macro location.
    data modify storage ${ns}:temp macro.funccall set value "${modifyFrameDurationDialog}"
    # Execute the function that will find the player within a frame using our specific frame function call.
    ${findPlayerInFrame} with storage ${ns}:temp macro
    # Remove trailing data
    data remove storage ${ns}:temp macro
`

// Creates a dialog for modifying an animation's frame's duration.
modifyFrameDurationDialog`
    # Log the function call
    $${debug.run} {input: "modifyFrameDurationDialog for $(name) frame $(framenum)"}
    # Create temporary scoreboard
    scoreboard objectives add ${ns}-temp-mfdd dummy
    # Set up certain macro elements that are within the dynamic command but aren't keys within the dialog.
    $data modify storage ${ns}:temp ddialog.name set value $(name)
    $data modify storage ${ns}:temp ddialog.framenum set value $(framenum)
    # Check if this frame has a duration, and if it doesn't, set it to 20 ticks by default. (oops directly modified animation_data, sue me)
    $execute unless data storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(framenum)].duration run ${debug.warn} {input: "No duration currently set for this frame! Defaulting to 20 ticks..."}
    $execute unless data storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(framenum)].duration run data modify storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(framenum)].camera.duration set value 20
    # Initial is used for the slider, so it has to be capped at 600 ticks (30 seconds) or if negative, set to default 20 ticks.
    $execute store result score initial ${ns}-temp-mfdd run data get storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(framenum)].duration
    $execute if score initial ${ns}-temp-mfdd matches 0..600 run data modify storage ${ns}:temp ddialog.initial set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(framenum)].duration
    execute if score initial ${ns}-temp-mfdd matches 601.. run data modify storage ${ns}:temp ddialog.initial set value 600
    execute if score initial ${ns}-temp-mfdd matches ..-1 run ${debug.warn} {input: "Negative duration for this frame! Defaulting to 20 ticks..."}
    execute if score initial ${ns}-temp-mfdd matches ..-1 run data modify storage ${ns}:temp ddialog.initial set value 20
    # To allow for duration to be a key, it'll be parsed in as a macro, while it is text to be macroed in later.
    data modify storage ${ns}:temp ddialog.forcekey set value "$(duration)"
    data modify storage ${ns}:temp ddialog.forcekey2 set value "$(duration2)"
    # Show dialog, it's within a macro so we retrieve macros set above.
    ${a`
        $dialog show @s {type:"minecraft:multi_action",title:"Set frame $(framenum)'s duration",external_title:"Set frame's duration",body:{type:"minecraft:plain_message",contents:"Choose a length with the slider, or input a number into the text field (supercedes slider). To help with conversion: 1 tick is 0.05 seconds, or 20 ticks is 1 second."},inputs:[{type:"minecraft:number_range",key:"duration",label:"length (in ticks)",start:1,end:600,step:1,initial:$(initial)},{type:"minecraft:text",key:"duration2",initial:"0",label:"Positive Integer (in ticks):"}],actions:[{label:"Set",action:{type:"minecraft:dynamic/run_command",template:"/function ${ns}:animation/set_frame_duration {name: $(name), framenum: $(framenum), duration: $(forcekey), duration2: $(forcekey2)}"}}]}
    `} with storage ${ns}:temp ddialog
    # clean up remaining data
    scoreboard objectives remove ${ns}-temp-mfdd
    data remove storage ${ns}:temp ddialog
`;

// Performs the action of the duration dialog generated above. Either sets it to the value of the slider or the value of the text input if one exists.
setFrameDuration`
    # Log the entry point
    ${debug.entry} {input: "from modifyFrameDurationDialog"}
    # Log the function call
    $${debug.run} {input: "setFrameDuration for $(name) frame $(framenum) to $(duration) or $(duration2) ticks, if latter is set"}
    # Create temporary scoreboard
    scoreboard objectives add ${ns}-temp-sfd dummy
    # Set a player within the objective to the value of the text input. If the text input is empty or invalid, it will be set to 0.
    $scoreboard players set check ${ns}-temp-sfd $(duration2)
    # Set the frame's duration to the slider's value if check is 0.
    $execute if score check ${ns}-temp-sfd matches 0 run data modify storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(framenum)].duration set value $(duration)
    # Set the frame's duration to the text input's value if check is greater than 0.
    $execute if score check ${ns}-temp-sfd matches 1.. run data modify storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(framenum)].duration set value $(duration2)
    # Clean up scoreboard
    scoreboard objectives remove ${ns}-temp-sfd
`

// Allows the player to exit the editor dimension.
exit`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog"}
    # Log the function call
    $${debug.run} {input: "exit for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> recRemoveFrames (clearSpecificFrame) -> unclaimLane -> tp out -> cleanUpNewAnimationData"}
    # Error if the player is missing prevPos or prevDim data.
    $execute unless data storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos run return run ${debug.error} {input: "No prevPos data for player!"}
    $execute unless data storage ${ns}:player_data players[{UUID:$(UUID)}].prevDim run return run ${debug.error} {input: "No prevDim data for player!"}
    # Warn if the player is missing the inEditor tag.
    execute unless entity @s[tag=${ns}-inEditor] run ${debug.warn} {input: "Player is missing inEditor tag! Continuing anyway..."} 
    # Grab animation data using UUID.
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Warn if the animation has no frames.
    execute unless data storage ${ns}:animation_data new.frames[0] run ${debug.warn} {input: "Animation has no frames! Skipping frame removal..."}
    # Clone the frames list into temporary storage so we can iterate through it.
    data modify storage ${ns}:temp exit.frames set from storage ${ns}:animation_data new.frames
    # Grab all the info for the first frame and place it in the macro storage.
    data modify storage ${ns}:temp exit.name set from storage ${ns}:animation_data new.name
    data modify storage ${ns}:temp exit.ax set from storage ${ns}:temp exit.frames[0].eanchor[0]
    data modify storage ${ns}:temp exit.ay set from storage ${ns}:temp exit.frames[0].eanchor[1]
    data modify storage ${ns}:temp exit.az set from storage ${ns}:temp exit.frames[0].eanchor[2]
    data modify storage ${ns}:temp exit.sx set from storage ${ns}:temp exit.frames[0].size[0]
    data modify storage ${ns}:temp exit.sy set from storage ${ns}:temp exit.frames[0].size[1]
    data modify storage ${ns}:temp exit.sz set from storage ${ns}:temp exit.frames[0].size[2]
    # Add a placeholder framenum as it is only needed for removing data and we are not doing that.
    data modify storage ${ns}:temp exit.framenum set value 0
    execute if data storage ${ns}:temp exit.frames[0] run ${recRemoveFrames`
        # Log the function call
        ${debug.run} {input: "recRemoveFrames"}
        # Remove the frame's structure from the editor.
        ${clearSpecificFrame} with storage ${ns}:temp exit
        # Remove the first frame from the list.
        data remove storage ${ns}:temp exit.frames[0]
        # If there's no more frames, return and end the recursive loop.
        execute unless data storage ${ns}:temp exit.frames[0] run return 1
        # Error if the next frame is missing eanchor or size, but don't return to remove future frames.
        execute unless data storage ${ns}:temp exit.frames[0].eanchor run ${debug.error} {input: "No eanchor data for next frame!"}
        execute unless data storage ${ns}:temp exit.frames[0].size run ${debug.error} {input: "No size data for next frame!"}
        # Grab all the info for the next frame and place it in the macro storage.
        data modify storage ${ns}:temp exit.ax set from storage ${ns}:temp exit.frames[0].eanchor[0]
        data modify storage ${ns}:temp exit.ay set from storage ${ns}:temp exit.frames[0].eanchor[1]
        data modify storage ${ns}:temp exit.az set from storage ${ns}:temp exit.frames[0].eanchor[2]
        data modify storage ${ns}:temp exit.sx set from storage ${ns}:temp exit.frames[0].size[0]
        data modify storage ${ns}:temp exit.sy set from storage ${ns}:temp exit.frames[0].size[1]
        data modify storage ${ns}:temp exit.sz set from storage ${ns}:temp exit.frames[0].size[2]
        # Loop
        ${recRemoveFrames} with storage ${ns}:temp exit
    `} with storage ${ns}:temp exit
    # Remove lane bedrock
    ${unclaimLane}
    # Return the player to the overworld at the anchor location. Grabs dimension data and the real world anchor coordinates.
    $data modify storage ${ns}:temp exit.dimension set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevDim
    $data modify storage ${ns}:temp exit.px set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos[0]
    $data modify storage ${ns}:temp exit.py set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos[1]
    $data modify storage ${ns}:temp exit.pz set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos[2]
    ${a`
        # Log the function call
        $${debug.run} {input: "tp out of editor to $(dimension) at $(px) $(py) $(pz)"}
        $execute in $(dimension) run tp @s $(px) $(py) $(pz)
    `} with storage ${ns}:temp exit
    # Remove the inEditor tag.
    tag @s remove ${ns}-inEditor
    # Remove the editor item from their inventory.
    clear @s ${editor_menu_item}
    # Set the animation's location to "none".
    data modify storage ${ns}:animation_data new.location set value "none"
    # Warn if the player is missing data
    $execute unless data storage ${ns}:player_data players[{UUID:$(UUID)}] run ${debug.warn} {input:"Player has no data at all! Skipping removal..."}
    # Clear the remainder of the player's data (not needed if not accessing a selection or animation)
    $data remove storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Save modifications made to the animation.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove trailing data.
    data remove storage ${ns}:temp exit
`;

// Adds the base frame to the end of the animation. Needs to be executed with the player as context.
addBaseFrame`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog"}
    # Log the function call
    $${debug.run} {input: "addBaseFrame for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> retrieveFrame -> calculateLaneX -> placeFrame -> regroupEntities -> storeFrame -> cleanUpNewAnimationData"}
    # Set animation_data new from UUID
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Error if the animation is missing base frame data.
    execute unless data storage ${ns}:animation_data new.anchor run return run ${debug.error} {input: "No anchor data for animation!"}
    execute unless data storage ${ns}:animation_data new.camera run return run ${debug.error} {input: "No camera data for animation!"}
    execute unless data storage ${ns}:animation_data new.size run return run ${debug.error} {input: "No size data for animation!"}
    # Retrieve structure data in case it was unloaded.
    ${retrieveFrame} {framenum: "base"}
    # Create temporary scoreboard for math.
    scoreboard objectives add ${ns}-abf dummy
    # Get the current framecount, and store a copy for macro use.
    execute store result score framecount ${ns}-abf store result storage ${ns}:temp abf.framenum int 1 run data get storage ${ns}:animation_data new.framecount
    # Grab the z coordinate of the current last frame's eanchor.
    execute store result score lastframez ${ns}-abf run data get storage ${ns}:animation_data new.frames[-1].eanchor[2]
    # Grab the z size of the current last frame.
    execute store result score lastframesizez ${ns}-abf run data get storage ${ns}:animation_data new.frames[-1].size[2]
    # Copy the base frame's data into the new frame.
    data modify storage ${ns}:animation_data new.frames append value {}
    data modify storage ${ns}:animation_data new.frames[-1].duration set value 20
    data modify storage ${ns}:animation_data new.frames[-1].camera set from storage ${ns}:animation_data new.camera
    data modify storage ${ns}:animation_data new.frames[-1].anchor set from storage ${ns}:animation_data new.anchor
    data modify storage ${ns}:animation_data new.frames[-1].size set from storage ${ns}:animation_data new.size
    # Set eanchor for the new frame to a placeholder value so we can modify it easier.
    data modify storage ${ns}:animation_data new.frames[-1].eanchor set value [0.0d, 0.0d, 0.0d]
    # Grab the lane's X and store it within eanchor's x position.
    ${calculateLaneX} {output: "${ns}:animation_data new.frames[-1].eanchor[0] double"}
    # Set eanchor's y position to 1.
    data modify storage ${ns}:animation_data new.frames[-1].eanchor[1] set value 1.0d
    # Set eanchor's z position to the calculated value.
    # Add eanchor and size together, plus 1 for spacing, to get the new frame's eanchor z coordinate.
    scoreboard players operation lastframez ${ns}-abf += lastframesizez ${ns}-abf
    execute store result storage ${ns}:animation_data new.frames[-1].eanchor[2] double 1 run scoreboard players add lastframez ${ns}-abf 1
    # Increase framecount by 1, and store it for the macro.
    execute store result storage ${ns}:animation_data new.framecount int 1 run scoreboard players add framecount ${ns}-abf 1
    # Toss anchor, name and size info into macro storage.
    data modify storage ${ns}:temp abf.name set from storage ${ns}:animation_data new.name
    data modify storage ${ns}:temp abf.x set from storage ${ns}:animation_data new.frames[-1].eanchor[0]
    data modify storage ${ns}:temp abf.z set from storage ${ns}:animation_data new.frames[-1].eanchor[2]
    data modify storage ${ns}:temp abf.sx set from storage ${ns}:animation_data new.frames[-1].size[0]
    data modify storage ${ns}:temp abf.sy set from storage ${ns}:animation_data new.frames[-1].size[1]
    data modify storage ${ns}:temp abf.sz set from storage ${ns}:animation_data new.frames[-1].size[2]
    # Place the base frame's structure into the editor dimension at the calculated position, and set up its structure block.
    ${placeFrame`
        # Log the function call
        $${debug.run} {input: "placeFrame at $(x) 0 $(z) within $(sx) $(sy) $(sz) for $(name) frame $(framenum)"}
        # Makes sure this entire animation is loaded
        $execute in ${ns}:editor positioned $(x) 0 $(z) run forceload add ~ ~ ~47 ~47
        # Place the frame's structure in. i = frame#
        $execute in ${ns}:editor run place template ${ns}:$(name)-base $(x) 1 $(z) none none 1 1 strict
        # Warn if the structure block will replace a non-air block
        $execute in ${ns}:editor unless block $(x) 0 $(z) minecraft:air run ${debug.warn} {input: "Non-air block at $(x) 0 $(z)! Overwriting with structure block..."}
        # Place in the frame's structure block
        $execute in ${ns}:editor run setblock $(x) 0 $(z) minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
        # Warn if the powering block will replace a non-air block
        $execute in ${ns}:editor positioned $(x) 0 $(z) unless block ~1 ~ ~ minecraft:air run ${debug.warn} {input: "Non-air block at ($(x) + 1) 0 $(z)! Overwriting with powering block..."}
        # Power and unpower the structure block to save the structure.
        $execute in ${ns}:editor positioned $(x) 0 $(z) run setblock ~1 ~ ~ minecraft:redstone_block
        $execute in ${ns}:editor positioned $(x) 0 $(z) run setblock ~1 ~ ~ minecraft:air
        # Regroup all grouped entities
        $execute in ${ns}:editor positioned $(x) 1 $(z) run ${regroupEntities} with storage ${ns}:temp abf
        # Remove this forceloaded area
        $execute in ${ns}:editor positioned $(x) 0 $(z) run forceload remove ~ ~ ~47 ~47
        # Store structure data since it changed.
        $${storeFrame} {framenum: $(framenum)}
    `} with storage ${ns}:temp abf
    # Save frame changes to animation data.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove temporary data.
    data remove storage ${ns}:temp abf
    scoreboard objectives remove ${ns}-abf
`;

// Takes an input frame number and an output frame number, and renumbers the frame's structure data accordingly. Also needs the name of the animation and the size of the output frame.
renumberFrame`
    # Log the function call
    $${debug.run} {input: "renumberFrame placing $(input) at $(output) for $(name) within $(sx) $(sy) $(sz)"}
    # Log the expected function path.
    ${debug.path} {input: "-> retrieveFrame -> removeFrame -> cleanKill -> storeFrame"}
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
    $execute in ${ns}:editor run setblock 0 0 -48 minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(output)",strict:true} strict
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
    # Store structure data since it changed.
    $${storeFrame} {framenum: $(output)}
    # Remove the forceload.
    execute in ${ns}:editor positioned 0 0 -48 run forceload remove ~ ~ ~47 ~47
`;

// Temporary cleanup function to help with testing
clean`
    # Warning to remove this function at somepoint
    ${debug.warn} {input: "remove clean function before release, within animation"}
    tag @s remove ${ns}-inEditor
    function ${ns}:menu/delete_animation {anim:"test"}
    execute in ${ns}:editor run setblock 0 1 0 minecraft:air
    data remove storage ${ns}:animation_data animations[]
    data remove storage ${ns}:player_data players[]
    execute in minecraft:overworld run tp @s -99 100 -42 -90 0
`;