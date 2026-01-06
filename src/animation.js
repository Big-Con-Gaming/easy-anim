// Sets up basic stuff.
import mcf from './mcf.js';
import { calculateLaneX, unclaimLane } from './inventory.js';
import { grabAnimationData, regroupEntities, turnEntityDocile, removeDocile, grabSizeAnchorEditor, cleanUpNewAnimationData } from './selection.js';
import { exitSelection, recGroupSearch } from './menu.js';
const folder = mcf.animation;
export const { enterEditor, findPlayerInFrame, recPlaceFrames, editorAnchorInData, tpIntoEditor, clean, saveCurrentFrame, recPlayerSearch, saveSpecificFrame, clearCurrentFrame, clearSpecificFrame, pullNextFrameData, recPushBackFrames, loadCurrentFrame, loadSpecificFrame, addBaseFrame, placeFrame, exit, recRemoveFrames, renumberFrame, cleanKill, anonymous: a } = folder;
const ns = 'easy-anim';

const editor_menu_item = 'minecraft:carrot_on_a_stick[item_name={italic:false,text:"Editor Menu"}, item_model="minecraft:test_instance_block"]';

// Run when the player wants to enter the editor for an existing animation. Must be executed with the player as context.
enterEditor`
    # Set the player's real world location into storage to be used when they exit the editor.
    $data modify storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos set from entity @s Pos
    # Load the player's inventory from storage.
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Set animation_data new to the player's animation
    ${grabAnimationData} with storage ${ns}:player_data current
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
    ${recPlaceFrames`
        # Makes sure this entire animation is loaded
        $execute in ${ns}:editor positioned $(x) 0 $(z) run forceload add ~ ~ ~47 ~47
        
        # Place the frame's structure in. i = frame#
        $execute in ${ns}:editor run place template ${ns}:$(name)-frame$(i) $(x) 1 $(z)
        # Toss the editor's anchor point for this frame into storage. We use a temporary marker's position to place it in.
        $execute in ${ns}:editor positioned $(x) 1 $(z) align xyz summon minecraft:marker run ${editorAnchorInData`
            $data modify storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(i)].eanchor set from entity @s Pos
            kill @s
        `} with storage ${ns}:temp eemacro
        # Regroup all grouped entities
        execute in ${ns}:editor run ${regroupEntities} with storage ${ns}:temp eemacro
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
    # Return the player's original inventory (in case they were coming from the selection menu). This also cleans up almost all of our extra data, and sets the animation's location to editor.
    ${exitSelection} with entity @s
    # Teleport the player into the editor dimension.
    ${tpIntoEditor`
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
    # Place the funccall into grabsizeanchor so it can be macroed in later on.
    $data modify storage ${ns}:temp grabsizeanchor.funccall set value "$(funccall)"
    # Load the player's inventory from storage.
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Set animation_data new to the player's animation
    ${grabAnimationData} with storage ${ns}:player_data current
    # Grab the animation name
    data modify storage ${ns}:temp grabsizeanchor.name set from storage ${ns}:animation_data new.name
    # Set up a scoreboard for the iterative var used within the saveSpecificFrame macro
    scoreboard objectives add ${ns}-fpif dummy
    execute store result storage ${ns}:temp grabsizeanchor.framenum int 1 run scoreboard players set i ${ns}-fpif 0
    # Grab the framecount
    execute store result score framecount ${ns}-fpif store result storage ${ns}:temp grabsizeanchor.framecount int 1 run data get storage ${ns}:animation_data new.framecount
    # Pull specific data into the macro for the first frame.
    ${grabSizeAnchorEditor} {framenum: 0}
    ${recPlayerSearch`
        # If the player is within this frame's bounding box, execute the function to save this specific frame. Exit the loop afterwards as well.
        $execute in ${ns}:editor positioned $(ax) $(ay) $(az) if entity @p[dx=$(sx), dy=$(sy), dz=$(sz)] run return run $(funccall) {name: $(name), framenum: $(framenum), framecount: $(framecount), ax: $(ax), ay: $(ay), az: $(az), sx: $(sx), sy: $(sy), sz: $(sz)}
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
    data remove storage ${ns}:animation_data new
    data remove storage ${ns}:player_data current
`;

// Iterates through each frame and checks to see which one the player is within. For that frame, it will ungroup all entities, make sure they aren't docile, and then save the structure, regrouping entities afterwards using saveSpecificFrame.
saveCurrentFrame`
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
    # Ungroup all of the entities within the frame, reusing functions from the create animation function within menu.
    scoreboard objectives add ${ns}-temp dummy
    execute store result storage ${ns}:temp str.id int 1 run scoreboard players set groupid ${ns}-temp 0
    # All important data needs to be placed into str for the old recGroupSearch function to work. I feel like there's a better way to do this.
    $data modify storage ${ns}:temp str.x set value $(ax)
    $data modify storage ${ns}:temp str.y set value $(ay)
    $data modify storage ${ns}:temp str.z set value $(az)
    $data modify storage ${ns}:temp str.sx set value $(sx)
    $data modify storage ${ns}:temp str.sy set value $(sy)
    $data modify storage ${ns}:temp str.sz set value $(sz)
    execute in ${ns}:editor run ${recGroupSearch} with storage ${ns}:temp str
    # Remove docile for all entities within the frame. 
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-entity-turned-docile] run ${removeDocile}
    # Make sure the frame's structure block is there.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~ minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
    # Save the frame
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~-1 ~-1 ~ minecraft:redstone_block
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~-1 ~-1 ~ minecraft:air
    # Regroup all entities.
    execute in ${ns}:editor run ${regroupEntities} with storage ${ns}:temp str
    # Remove all trailing data.
    data remove storage ${ns}:temp str
    scoreboard objectives remove ${ns}-temp
`;

// Iterates through each frame and checks to see which one the player is within. For that frame, it will clear all blocks and kill all entities. This is done using clearSpecificFrame.
clearCurrentFrame`
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
    # data remove storage ${ns}:temp csf
`;

// Clears a specific frame within the editor. This removes all blocks and entities within the frame's area.
// Needs this input from a macro: a[x, y, z] = anchor coordinates, s[x, y, z] = size parameters, name = animation name, framenum = frame number, framecount = total number of frames.
clearSpecificFrame`
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
        $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run fill ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) minecraft:air strict
    `} with storage ${ns}:temp csf
    
    # Kill all entities within the area, using cleanKill to make sure nothing is left behind.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-entity-turned-docile] run ${cleanKill}
    
    # Place name into macro storage for future use.
    $data modify storage ${ns}:temp csf.name set value $(name)

    # Remove the structure block.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~ minecraft:air strict
    
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
        $data modify storage ${ns}:temp csf.ax set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor[0]
        $data modify storage ${ns}:temp csf.ay set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor[1]
        $data modify storage ${ns}:temp csf.az set from storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor[2]
        execute store result score az ${ns}-csf run data get storage ${ns}:temp csf.az
        $execute store result score x ${ns}-csf store result storage ${ns}:temp csf.shx int 1 run data get storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size[0]
        $execute store result score y ${ns}-csf store result storage ${ns}:temp csf.shy int 1 run data get storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size[1]
        $execute store result score z ${ns}-csf store result storage ${ns}:temp csf.shz int 1 run data get storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].size[2]
        execute store result storage ${ns}:temp csf.sx int 1 run scoreboard players remove x ${ns}-csf 1
        execute store result storage ${ns}:temp csf.sy int 1 run scoreboard players remove y ${ns}-csf 1
        execute store result storage ${ns}:temp csf.sz int 1 run scoreboard players remove z ${ns}-csf 1
        $execute store result storage ${ns}:temp csf.newz int 1 store result storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(nextframe)].eanchor[2] double 1 run scoreboard players operation az ${ns}-csf -= diff ${ns}-csf
    `} with storage ${ns}:temp csf
    # Renumber all subsequent frames recursively.
    execute in ${ns}:editor if data storage ${ns}:temp {csf:{shift:true}} if score remainder ${ns}-csf matches 1.. run ${recPushBackFrames`
        # Run the renumbering function for this frame.
        $${renumberFrame} {input: $(nextframe), output: $(currentframe), name: $(name), sx: $(shx), sy: $(shy), sz: $(shz)}
        # Add forceloads to make sure the area is loaded.
        $execute positioned $(ax) $(ay) $(az) run forceload add ~ ~ ~47 ~47
        execute positioned 0 0 -48 run forceload add ~ ~ ~47 ~47
        # Remove the old structure block.
        $execute positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~ minecraft:air strict
        # Clone the frames over the difference of the size of the removed frame's z axis. Must be done twice since source and destination areas cannot overlap.
        $execute positioned $(ax) $(ay) $(az) run clone ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) 0 1 -48 strict masked move
        $execute positioned 0 1 -48 run clone ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) 0 1 $(newz) strict masked move
        # Teleport all entities in subsequent frames backwards by the size of the removed frame's z axis.
        $execute positioned $(ax) $(ay) $(az) as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz), tag=${ns}-entity-turned-docile] at @s run tp @s ~ ~ ~-$(diff)
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
        $data remove storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(framenum)]
        $execute store result score framecount ${ns}-csf run data get storage ${ns}:animation_data animations[{name:$(name)}].data.framecount
        $execute store result storage ${ns}:animation_data animations[{name:$(name)}].data.framecount int 1 run scoreboard players remove framecount ${ns}-csf 1
    `} {name: $(name), framenum: $(framenum)}

    # Clear trailing data.
    # scoreboard objectives remove ${ns}-csf
    data remove storage ${ns}:temp csf
`;

// Iterates through each frame and checks to see which one the player is within. For that frame, it will clear all blocks and kill all entities. This is done using clearSpecificFrame.
loadCurrentFrame`
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
    # First, clear the specific frame so that there are no overlapping entities or blocks.
    $${clearSpecificFrame} {name: $(name), framenum: $(framenum), ax: $(ax), ay: $(ay), az: $(az), sx: $(sx), sy: $(sy), sz: $(sz)}
    # Place the frame's structure in.
    $execute in ${ns}:editor run place template ${ns}:$(name)-frame$(framenum) $(ax) $(ay) $(az)
    # Place in the structure block.
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~ minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
    # Regroup all grouped entities
    $execute in ${ns}:editor run ${regroupEntities} {x: $(ax), y: $(ay), z: $(az), sx: $(sx), sy: $(sy), sz: $(sz)}
`;

// Allows the player to exit the editor dimension.
exit`
    # Load the player's inventory from storage.
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Set animation_data new to the player's animation
    ${grabAnimationData} with storage ${ns}:player_data current
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
    ${recRemoveFrames`
        # Remove the frame's structure from the editor.
        ${clearSpecificFrame} with storage ${ns}:temp exit
        # Remove the first frame from the list.
        data remove storage ${ns}:temp exit.frames[0]
        # If there's no more frames, return and end the recursive loop.
        execute unless data storage ${ns}:temp exit.frames[0] run return 1
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
    data modify storage ${ns}:temp exit.dimension set from storage ${ns}:animation_data new.dimension
    $data modify storage ${ns}:temp exit.px set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos[0]
    $data modify storage ${ns}:temp exit.py set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos[1]
    $data modify storage ${ns}:temp exit.pz set from storage ${ns}:player_data players[{UUID:$(UUID)}].prevPos[2]
    ${a`
        $execute in $(dimension) run tp @s $(px) $(py) $(pz)
    `} with storage ${ns}:temp exit
    # Remove the inEditor tag.
    tag @s remove ${ns}-inEditor
    # Remove the editor item from their inventory.
    clear @s ${editor_menu_item}
    # Set the animation's location to "none".
    data modify storage ${ns}:animation_data new.location set value "none"
    # Save modifications made to the animation.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove trailing data.
    data remove storage ${ns}:temp exit
`;

// Adds the base frame to the end of the animation. Needs to be executed with the player as context.
addBaseFrame`
    # Load the player's data from storage.
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Set animation_data new to the player's animation
    ${grabAnimationData} with storage ${ns}:player_data current
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
    data modify storage ${ns}:animation_data new.frames[-1].duration set value 0.25
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
        # Makes sure this entire animation is loaded
        $execute in ${ns}:editor positioned $(x) 0 $(z) run forceload add ~ ~ ~47 ~47
        # Place the frame's structure in. i = frame#
        $execute in ${ns}:editor run place template ${ns}:$(name)-base $(x) 1 $(z)
        # Regroup all grouped entities
        $execute in ${ns}:editor run ${regroupEntities} {x: $(x), y: 1, z: $(z), sx: $(sx), sy: $(sy), sz: $(sz)}
        # Place in the frame's structure block
        $execute in ${ns}:editor run setblock $(x) 0 $(z) minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(framenum)",strict:true}
        # Power and unpower the structure block to save the structure.
        $execute in ${ns}:editor positioned $(x) 0 $(z) run setblock ~1 ~ ~ minecraft:redstone_block
        $execute in ${ns}:editor positioned $(x) 0 $(z) run setblock ~1 ~ ~ minecraft:air
        # Remove this forceloaded area
        $execute in ${ns}:editor positioned $(x) 0 $(z) run forceload remove ~ ~ ~47 ~47
    `} with storage ${ns}:temp abf
    # Save frame changes to animation data.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove temporary data.
    data remove storage ${ns}:temp abf
    scoreboard objectives remove ${ns}-abf
`;

// Takes an input frame number and an output frame number, and renumbers the frame's structure data accordingly. Also needs the name of the animation and the size of the output frame.
renumberFrame`
    # Make sure the area we're going to place the structures is forceloaded.
    execute in ${ns}:editor positioned 0 0 -48 run forceload add ~ ~ ~47 ~47
    # Place the structure template of the input frame.
    $execute in ${ns}:editor run place template ${ns}:$(name)-frame$(input) 0 1 -48
    # Place the structure block for this frame with the output frame number.
    $execute in ${ns}:editor run setblock 0 0 -48 minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(output)",strict:true} strict
    # Save the structure.
    execute in ${ns}:editor run setblock 1 0 -48 minecraft:redstone_block
    execute in ${ns}:editor run setblock 1 0 -48 minecraft:air
    # Remove the blocks.
    execute in ${ns}:editor run fill 0 0 -48 48 50 0 minecraft:air strict
    # Remove the entities.
    execute in ${ns}:editor positioned 0 0 -48 as @e[type=!player,dx=48,dy=50,dz=48] run ${cleanKill}
    # Remove the forceload.
    execute in ${ns}:editor positioned 0 0 -48 run forceload remove ~ ~ ~47 ~47
`;

// Execute on an entity to kill it by teleporting it away to the editor dimension, removing it's drops so nothing is left behind.
cleanKill`
    execute in ${ns}:editor run tp @s 0 -63 0
    data modify entity @s DeathLootTable set value "minecraft:air"
    data modify entity @s Glowing set value false
    kill @s
`;

// Temporary cleanup function to help with testing
clean`
    tag @s remove ${ns}-inEditor
    execute in ${ns}:editor run setblock 0 1 0 minecraft:air
    data remove storage ${ns}:animation_data animations[]
    data remove storage ${ns}:player_data players[]
    execute in minecraft:overworld run tp @s -99 100 -42 -90 0
`;