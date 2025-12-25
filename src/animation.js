// Sets up basic stuff.
import mcf from './mcf.js';
import { calculateLaneX } from './inventory.js';
import { grabAnimationData, regroupEntities, turnEntityDocile, removeDocile, grabSizeAnchorEditor } from './selection.js';
import { exitSelection, recGroupSearch } from './menu.js';
const folder = mcf.animation;
export const { enterEditor, findPlayerInFrame, recPlaceFrames, editorAnchorInData, tpIntoEditor, clean, saveCurrentFrame, recPlayerSearch, saveSpecificFrame, exit, anonymous: a } = folder;
const ns = 'easy-anim';

const editor_menu_item = 'minecraft:carrot_on_a_stick[item_name={italic:false,text:"Editor Menu"}, item_model="minecraft:test_instance_block"]';

// Run when the player wants to enter the editor for an existing animation. Must be executed with the player as context.
enterEditor`
    # Load the player's inventory from storage.
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Set animation_data new to the player's animation
    ${grabAnimationData} with storage ${ns}:player_data current
    # Toss the name of the of the animation into macro data.
    data modify storage ${ns}:temp eemacro.name set from storage ${ns}:player_data current.currentAnim
    # Grab the lane's X and store it within temporary storage for a macro.
    ${calculateLaneX} {output: "${ns}:temp eemacro.x"}
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
        $execute in ${ns}:editor positioned $(x) 0 $(z) run forceload add ~ ~ ~3 ~3
        
        # Place the frame's structure in. i = frame#
        $execute in ${ns}:editor run place template ${ns}:$(name)-frame$(i) $(x) 1 $(z)
        # Toss the editor's anchor point for this frame into storage. We use a temporary marker's position to place it in.
        $execute in ${ns}:editor positioned $(x) 1 $(z) align xyz summon minecraft:marker run ${editorAnchorInData`
            $data modify storage ${ns}:animation_data animations[{name:$(name)}].data.frames[$(i)].eanchor set from entity @s Pos
            kill @s
        `} with storage ${ns}:temp eemacro
        # Regroup all grouped entities
        execute in ${ns}:editor run ${regroupEntities} with storage ${ns}:temp eemacro
        # Turn all entities docile that were summmoned within the structure.
        # $execute in ${ns}:editor positioned $(x) 1 $(z) as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz)] run ${turnEntityDocile}

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
        $execute in ${ns}:editor positioned $(x) 0 $(z) run forceload remove ~ ~ ~3 ~3
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
// Macros available to the latter function: a[x, y, z] = anchor's position, s[x, y, z] = frame's size, name = animation's name, framenum = the current frame's number.
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
    scoreboard objectives add ${ns}-saveCurrentFrame dummy
    execute store result score i ${ns}-saveCurrentFrame run data modify storage ${ns}:temp grabsizeanchor.framenum set value 0
    # Grab the framecount
    execute store result score framecount ${ns}-saveCurrentFrame run data get storage ${ns}:animation_data new.framecount
    # Pull specific data into the macro for the first frame.
    ${grabSizeAnchorEditor} {framenum: 0}
    ${recPlayerSearch`
        # If the player is within this frame's bounding box, execute the function to save this specific frame.
        $execute in ${ns}:editor positioned $(ax) $(ay) $(az) if entity @p[dx=$(sx), dy=$(sy), dz=$(sz)] run $(funccall) {name: $(name), frame: $(framenum), ax: $(ax), ay: $(ay), az: $(az), sx: $(sx), sy: $(sy), sz: $(sz)}
        # Iterate framenum
        execute store result storage ${ns}:temp grabsizeanchor.framenum int 1 run scoreboard players add ${ns}-saveCurrentFrame i 1
        # Grab the next frame's data
        ${grabSizeAnchorEditor} with storage ${ns}:temp grabsizeanchor
        # Unless framecount is equal or greater than the iterative variable, do another recursive search.
        execute unless score i ${ns}-saveCurrentFrame >= framecount ${ns}-saveCurrentFrame run ${recPlayerSearch} with storage ${ns}:temp grabsizeanchor
    `} with storage ${ns}:temp grabsizeanchor
    # Clean up remaining data
    data remove storage ${ns}:temp grabsizeanchor
    scoreboard objectives remove ${ns}-saveCurrentFrame
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
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~ ~-1 ~ minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:0,posY:1,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-frame$(frame)",strict:true}
    # Save the frame
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~-1 ~-1 ~ minecraft:redstone_block
    $execute in ${ns}:editor positioned $(ax) $(ay) $(az) run setblock ~-1 ~-1 ~ minecraft:air
    # Regroup all entities.
    execute in ${ns}:editor run ${regroupEntities} with storage ${ns}:temp str
    # Remove all trailing data.
    data remove storage ${ns}:temp str
    scoreboard objectives remove ${ns}-temp
`;

// Allows the player to exit the editor dimension.
exit`
    
`;

// Temporary cleanup function to help with testing
clean`
    tag @s remove ${ns}-inEditor
    execute in ${ns}:editor run setblock 0 1 0 minecraft:air
    data remove storage ${ns}:animation_data animations[]
    data remove storage ${ns}:player_data players[]
    execute in minecraft:overworld run tp @s -99 100 -42 -90 0
`;