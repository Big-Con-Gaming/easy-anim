// Sets up basic stuff.
import mcf from './mcf.js';
import * as debug from './debug.js';
import { cleanKill } from './entity.js';
import { stringConcat, axis } from './util.js';
const folder = mcf.storage;
export const {
    allocAnimation, storeFrame, retrieveFrame, removeFrame, storeFrameInTemp, retrieveFrameFromTemp, clearOutTempStorage
} = folder;

const {
    recFindNextEmptyLane, macroPlaceFrame, pullStoreCoords, macroStoreFrame, macroRemoveFrame, recRetrieveEntities,
    frameExistenceCheck, grabSizeNamespaceBase, grabSizeNamespaceFrame, anonymous: a
} = folder;
const ns = 'easy-anim';

// Takes the name of an animation, and finds it a new lane within the storage dimension for their frame's structure blocks. Searches by checking for bedrock blocks. Stores the lane within the animation's data.storageid field.
allocAnimation`
    # Log the function call
    ${debug.run} {input: "allocAnimation"}
    # Log the expected function path.
    ${debug.path} {input: "-> recFindNextEmptyLane (found lane)"}
    # Error and return if this animation already has a lane.
    execute if data storage ${ns}:animation_data new.storageid run return run ${debug.error} {input: "Animation already has a lane!"}
    # Remove possibly trailing data.
    data remove storage ${ns}:temp alloca
    scoreboard objectives remove ${ns}-alloca
    scoreboard objectives add ${ns}-alloca dummy
    execute store result storage ${ns}:temp alloca.lane int 1 run scoreboard players set lane ${ns}-alloca 0
    # Find the next available lane by searching the storage dimension for an empty spot (no bedrock).
    execute in ${ns}:storage positioned 0 50 0 run ${recFindNextEmptyLane`
        # Log the function call
    ${debug.run} {input: "recFindNextEmptyLane"}
        forceload add ~ ~
        execute unless block ~ ~ ~ minecraft:bedrock run return run ${a`
            # Log the function call
            ${debug.run} {input: "found empty lane"}
            setblock ~ ~ ~ minecraft:bedrock
            forceload remove ~ ~
        `}
        forceload remove ~ ~
        execute store result storage ${ns}:temp alloca.lane int 1 run scoreboard players add lane ${ns}-alloca 1
        execute positioned ~48 ~ ~ run ${recFindNextEmptyLane}
    `}
    # Store the new lane number into the animation's data
    data modify storage ${ns}:animation_data new.storageid set from storage ${ns}:temp alloca.lane
    # Remove trailing data.
    data remove storage ${ns}:temp alloca
    scoreboard objectives remove ${ns}-alloca
`;

const grabSizeNamespaceBaseCommands = [];

function createGrabSizeNamespaceBase({axis, i}) {
    return`
        $data modify storage ${ns}:temp $(namespace).s${axis} set from storage ${ns}:animation_data new.size[${i}]
    `;
}

grabSizeNamespaceBaseCommands.push(...axis.map(createGrabSizeNamespaceBase));

grabSizeNamespaceBase(grabSizeNamespaceBaseCommands.join('\n'));

const grabSizeNamespaceFrameCommands = [];

function createGrabSizeNamespaceFrame({axis, i}) {
    return`
        $data modify storage ${ns}:temp $(namespace).s${axis} set from storage ${ns}:animation_data new.frames[$(framenum)].size[${i}]
    `;
}

grabSizeNamespaceFrameCommands.push(...axis.map(createGrabSizeNamespaceFrame));

grabSizeNamespaceFrame(grabSizeNamespaceFrameCommands.join('\n'));

// Generates the x and z positions of a frame in the storage dimension, using framenum and data from ${ns}:animation_data new.
// Input = framenum: the number of the frame you are querying, namespace: space inside of data and the scoreboard name to insert data into, new: the animation's data, needed to retrieve storageid.
pullStoreCoords`
    # Log the function call
    $${debug.run} {input: "pullStoreCoords for $(namespace) frame $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> [get base data | get frame data -> stringConcat]"}
    # Error if missing a storageid
    execute unless data storage ${ns}:animation_data new.storageid run return run ${debug.error} {input:"Missing storageid for animation_data new!"}
    # Check to see if the animation frame is the base frame.
    $data modify storage ${ns}:temp $(namespace).framenum set value $(framenum)
    $data modify storage ${ns}:temp $(namespace).isbase set value $(framenum)
    $execute store result score isbase ${ns}-$(namespace) run data modify storage ${ns}:temp $(namespace).isbase set value "base"
    # If it's the base frame, set z in data to -48 and set the structure block name prefix to base. Set the frame reference to be empty. Grab the size numbers.
    $execute if score isbase ${ns}-$(namespace) matches 0 run ${a`
        # Log the function call
        ${debug.run} {input: "branch: get base data"}
        $data modify storage ${ns}:temp $(namespace).z set value -48
        $data modify storage ${ns}:temp $(namespace).prefix set value "base"
        $data modify storage ${ns}:temp $(namespace).ref set value ""
        # Warn if size is missing from animation_data
        execute unless data storage ${ns}:animation_data new.size run ${debug.warn} {input:"Base size is missing from animation_data! Skipping..."}
        $${grabSizeNamespaceBase} {namespace: $(namespace)}
    `} {namespace: $(namespace)}
    # If it's a different frame, multiply framenum by 48 to get the z position and set the structure block name prefix to frame#. Set the frame reference to be .frames[framenum]. Grab the size numbers.
    $execute if score isbase ${ns}-$(namespace) matches 1 run ${a`
        # Log the function call
        ${debug.run} {input: "branch: get frame data"}
        # Warn if frame size is missing from animation_data
        $execute unless data storage ${ns}:animation_data new.frames[$(framenum)].size run ${debug.warn} {input:"Frame $(framenum) is missing size! Skipping..."}
        $execute store result storage ${ns}:temp $(namespace).z int 48 run data get storage ${ns}:temp $(namespace).framenum
        $data modify storage ${ns}:temp $(namespace).prefix set value "frame"
        $${stringConcat} {output: "${ns}:temp $(namespace).prefix", front: "${ns}:temp $(namespace).prefix", back: "${ns}:temp $(namespace).framenum"}
        $data modify storage ${ns}:temp $(namespace).ref set value ".frames[$(framenum)]"
        $${grabSizeNamespaceFrame} {namespace: $(namespace), framenum: $(framenum)}
    `} {namespace: $(namespace), framenum: $(framenum)}
    # Grab the x position of the storage lane from the animation data.
    $execute store result storage ${ns}:temp $(namespace).x int 48 run data get storage ${ns}:animation_data new.storageid
`;

// Using the specified frame number and animation name, this places the frame into storage using it's structure block.
storeFrame`
    # Log the function call
    $${debug.run} {input: "storeFrame for $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> pullStoreCoords -> macroPlaceFrame -> | store entity -> | cleanKill x2"}
    # Error if animation is missing name
    execute unless data storage ${ns}:animation_data new.name run return run ${debug.error} {input:"Current animation is missing a name!"}
    # Remove possibly trailing data
    data remove storage ${ns}:temp storeframe
    scoreboard objectives remove ${ns}-storeframe
    # Setup scoreboard
    scoreboard objectives add ${ns}-storeframe dummy
    $${pullStoreCoords} {namespace: "storeframe", framenum: $(framenum)}
    # Toss the name into macro storage
    data modify storage ${ns}:temp storeframe.name set from storage ${ns}:animation_data new.name
    # Using a macro, bring the frame's structure into this dimension at the calculated position.
    ${macroPlaceFrame`
        # Log the function call
        $${debug.run} {input: "macroPlaceFrame at $(x) 0 $(z) within $(sx) $(sy) $(sz) for $(name) $(prefix) with ref $(ref)"}
        # Place the structure inside of the editor dimension (in a forceloaded area for entities)
        $execute in ${ns}:editor run place template ${ns}:$(name)-$(prefix) 0 0 -48 none none 1 1 strict
        # Place a structure block so we can save this structure without entities (for storage dimension)
        # Warn if non-air block is at this location
        execute in ${ns}:editor unless block 0 48 -48 minecraft:air run ${debug.warn} {input:"Expected air block in editor at 0 48 -48! Overwriting..."}
        $execute in ${ns}:editor run setblock 0 48 -48 minecraft:structure_block{mode:"SAVE",showboundingbox:false,posX:0,posY:-48,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:true,name:"${ns}:$(name)-$(prefix)",strict:true} strict
        # Power and depower the structure block. Can't be strict otherwise the structure block won't save.
        # Warn if non-air block is at this location
        execute in ${ns}:editor unless block 0 49 -48 minecraft:air run ${debug.warn} {input:"Expected air block in editor at 0 49 -48! Overwriting..."}
        execute in ${ns}:editor run setblock 0 49 -48 minecraft:redstone_block
        execute in ${ns}:editor run setblock 0 49 -48 minecraft:air
        # Remove old structure block
        execute in ${ns}:editor run setblock 0 48 -48 minecraft:air strict
        # Forceload the entire 3 chunks the frame could take up in the storage dimension
        $execute in ${ns}:storage positioned $(x) 0 $(z) run forceload add ~ ~ ~47 ~47
        # Remove old blocks in case of trailing block data
        $execute in ${ns}:storage positioned $(x) 0 $(z) run fill ~ ~ ~ ~47 ~47 ~47 minecraft:air
        # Place the frame in the storage dimension
        $execute in ${ns}:storage run place template ${ns}:$(name)-$(prefix) $(x) 0 $(z) none none 1 1 strict
        # Remove the forceload in the storage dimension
        $execute in ${ns}:storage positioned $(x) 0 $(z) run forceload remove ~ ~ ~47 ~47
        # Resave the structure with entities once again.
        $execute in ${ns}:editor run setblock 0 48 -48 minecraft:structure_block{mode:"SAVE",showboundingbox:false,posX:0,posY:-48,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-$(prefix)",strict:true} strict
        # Power and depower the structure block. Can't be strict otherwise the structure block won't save.
        execute in ${ns}:editor run setblock 0 49 -48 minecraft:redstone_block
        execute in ${ns}:editor run setblock 0 49 -48 minecraft:air
        # Remove old structure block
        execute in ${ns}:editor run setblock 0 48 -48 minecraft:air strict
        # Warn if overwriting previously set entities data.
        $execute if data storage ${ns}:animation_data new$(ref).entities run ${debug.warn} {input:"Entity data exists for new$(ref).entities! Overwriting..."}
        # Clear out previously stored entities from the animation_data
        $data modify storage ${ns}:animation_data new$(ref).entities set value []
        # Warn if no entities are found.
        execute in ${ns}:editor positioned 0 0 -48 unless entity @e[type=!player,dx=47,dy=47,dz=47] run ${debug.warn} {input:"No entities within animation! Skipping in storage..."}
        # Executing as every entity within the frame, store them within the animation data.
        execute in ${ns}:editor positioned 0 0 -48 as @e[type=!player,dx=47,dy=47,dz=47] at @s run ${a`
            # Log the function call
            ${debug.run} {input: "storing an entity into animation data"}
            # Store the entity's Z into scoreboard (scaled up to preserve 2 decimal places)
            execute store result score entz ${ns}-storeframe run data get entity @s Pos[2] 100
            # Ride a block display so that ID is in the entity's data
            execute at @s summon minecraft:block_display run tag @s add ${ns}-temp
            # Hop on the block display
            ride @s mount @n[type=block_display,distance=..1,tag=${ns}-temp]
            # Toss all of the entity's data into the frame's entities data, using the vehicle.
            $execute on vehicle run data modify storage ${ns}:animation_data new$(ref).entities append from entity @s Passengers[0]
            # Remove the UUID
            $data remove storage ${ns}:animation_data new$(ref).entities[-1].UUID
            # Add 48 to Z so that the coordinates represent relative coordinates to the anchor. Store this in the Pos tag that is already in entity data.
            $execute store result storage ${ns}:animation_data new$(ref).entities[-1].Pos[2] double 0.01 run scoreboard players add entz ${ns}-storeframe 4800
            # Kill off the vehicle.
            execute on vehicle run ${cleanKill}
            # Kill off the entity.
            ${cleanKill}
        `} with storage ${ns}:temp storeframe
        # Clear the blocks from the editor
        execute in ${ns}:editor run fill 0 0 -48 47 47 -1 minecraft:air strict
    `} with storage ${ns}:temp storeframe
    # Remove trailing data
    data remove storage ${ns}:temp storeframe
    scoreboard objectives remove ${ns}-storeframe
`;

// Retrieves a frame from storage, saving it into structure memory
// Flag ${ns}:temp retrieveframe.forceOverwrite -> skips the existence check, overwriting data.
retrieveFrame`
    # Log the function call
    $${debug.run} {input: "retrieveFrame for $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> pullStoreCoords -> ^ frameExistenceCheck -> | non-base frame -> macroStoreFrame -> | recRetrieveFrames (place and configure) -> | cleanKill"}
    # Error if animation is missing name
    execute unless data storage ${ns}:animation_data new.name run return run ${debug.error} {input:"Current animation is missing a name!"}
    # Remove possibly trailing data
    data remove storage ${ns}:temp retrieveframe
    scoreboard objectives remove ${ns}-retrieveframe
    # Setup scoreboard
    scoreboard objectives add ${ns}-retrieveframe dummy
    # Grab the necessary data to know where in the storage dimension the frame is.
    $${pullStoreCoords} {namespace: "retrieveframe", framenum: $(framenum)}
    # Attempt to place a structure within a protected spot like editor. If it succeeds, then retrieving is not necessary.
    # Toss the name into macro storage
    data modify storage ${ns}:temp retrieveframe.name set from storage ${ns}:animation_data new.name
    execute unless data storage ${ns}:temp retrieveframe.forceOverwrite run ${frameExistenceCheck`
        # Log the function call
        $${debug.run} {input: "frameExistenceCheck for $(name)-$(prefix)"}
        # Log the expected function path.
        ${debug.path} {input: "-> | cleanKill"}
        $execute in ${ns}:editor store success score frameExistenceCheck ${ns}-retrieveframe run place template ${ns}:$(name)-$(prefix) 0 0 -48 none none 1 1 strict
        # Kill off any entities and clear any blocks
        execute in ${ns}:editor positioned 0 0 -48 as @e[type=!player,dx=47,dy=47,dz=47] run ${cleanKill}
        execute in ${ns}:editor run fill 0 0 -48 47 47 -1 minecraft:air strict
    `} with storage ${ns}:temp retrieveframe
    # If the placement succeeded, warn and exit (and clean data.)
    execute if score frameExistenceCheck ${ns}-retrieveframe matches 1 run return run ${a`
        ${debug.warn} {input:"Frame already exists within scope! Exiting..."}
        data remove storage ${ns}:temp retrieveframe
        scoreboard objectives remove ${ns}-retrieveframe
    `}
    # Clone the entity list into temporary macro storage so it can be recursively searched through. Make sure to use proper frame data, or the base data if applicable. Has to be a separate command so that the function validates after the macro insertion.
    $execute if score isbase ${ns}-retrieveframe matches 1 run ${a`
        # Log the function call
        ${debug.run} {input: "grabbing entity data from non-base frame"}
        $data modify storage ${ns}:temp retrieveframe.entities set from storage ${ns}:animation_data new.frames[$(framenum)].entities
    `} {framenum: $(framenum)}
    execute if score isbase ${ns}-retrieveframe matches 0 run data modify storage ${ns}:temp retrieveframe.entities set from storage ${ns}:animation_data new.entities
    # Warn if no entities are found.
    execute unless data storage ${ns}:temp retrieveframe.entities[0] run ${debug.warn} {input:"No entities found to load back in! Skipping..."}
    # Pull the first entity's ID, if it exists.
    execute if data storage ${ns}:temp retrieveframe.entities[0] run data modify storage ${ns}:temp retrieveframe.id set from storage ${ns}:temp retrieveframe.entities[0].id
    # Use the macro to place the structure block needed to resave the frame.
    ${macroStoreFrame`
        # Log the function call
        $${debug.run} {input: "macroStoreFrame at $(x) 0 $(z) within $(sx) $(sy) $(sz) for $(name) $(prefix)"}
        # Forceload the entire 3 chunks the frame could take up
        $execute in ${ns}:storage positioned $(x) 0 $(z) run forceload add ~ ~ ~47 ~47
        # Clone the storage blocks into the editor for adding the entities.
        $execute in ${ns}:storage positioned $(x) 0 $(z) run clone ~ ~ ~ ~47 ~47 ~47 to ${ns}:editor 0 0 -48 strict
        # Remove the forceload
        $execute in ${ns}:storage positioned $(x) 0 $(z) run forceload remove ~ ~ ~47 ~47
        # Recursively go through and place in all missing entities, if they exist.
        execute if data storage ${ns}:temp retrieveframe.entities[0] run ${recRetrieveEntities`
            # Log the function call
            $${debug.run} {input: "recRetrieveEntities for $(id)"}
            # Place the stored entity's position into scoreboards
            execute store result score entz ${ns}-retrieveframe run data get storage ${ns}:temp retrieveframe.entities[0].Pos[2]
            # Summon in the new entity
            $execute in ${ns}:editor positioned 0 0 -48 summon $(id) run ${a`
                # Log the function call
                ${debug.run} {input: "placing and configuring entity"}
                # Remove no longer necessary remaining data
                data remove storage ${ns}:temp retrieveframe.entities[0].id
                # Merge the remaining data onto the entity
                data modify entity @s {} merge from storage ${ns}:temp retrieveframe.entities[0]
                # Place the entity at the correct position.
                execute store result entity @s Pos[2] int 1 run scoreboard players remove entz ${ns}-retrieveframe 48
                data modify entity @s Rotation set from storage ${ns}:temp retrieveframe.entities[0].Rotation
            `}
            # Remove the entity's data from the temporary list.
            data remove storage ${ns}:temp retrieveframe.entities[0]
            # If there's no more entities in the list, return the function to end the loop.
            execute unless data storage ${ns}:temp retrieveframe.entities[0] run return 1
            # Grab the next entity's ID and place it into macro storage.
            # Warn if it doesn't exist
            execute unless data storage ${ns}:temp retrieveframe.entities[0].id run ${debug.warn} {input:"Missing ID for entity! Skipping..."}
            data modify storage ${ns}:temp retrieveframe.id set from storage ${ns}:temp retrieveframe.entities[0].id
            # Run this function again.
            ${recRetrieveEntities} with storage ${ns}:temp retrieveframe
        `} with storage ${ns}:temp retrieveframe
        # Place the structure block
        # Warn if non-air block is at this location
        execute in ${ns}:editor unless block 0 48 -48 minecraft:air run ${debug.warn} {input:"Expected air block in editor at 0 48 -48! Overwriting..."}
        $execute in ${ns}:editor run setblock 0 48 -48 minecraft:structure_block{mode:"SAVE",showboundingbox:false,posX:0,posY:-48,posZ:0,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-$(prefix)",strict:true} strict
        # Power and depower the structure block. Can't be strict otherwise the structure block won't save.
        # Warn if non-air block is at this location
        execute in ${ns}:editor unless block 0 49 -48 minecraft:air run ${debug.warn} {input:"Expected air block in editor at 0 49 -48! Overwriting..."}
        execute in ${ns}:editor run setblock 0 49 -48 minecraft:redstone_block
        execute in ${ns}:editor run setblock 0 49 -48 minecraft:air
        # Remove the structure block
        execute in ${ns}:editor run setblock 0 48 -48 minecraft:air strict
        # Kill off the entities
        execute in ${ns}:editor positioned 0 0 -48 as @e[dx=47,dy=47,dz=47] run ${cleanKill}
        # Remove the leftover blocks
        execute in ${ns}:editor run fill 0 0 -48 47 47 -1 minecraft:air strict
    `} with storage ${ns}:temp retrieveframe
    # Remove trailing data
    data remove storage ${ns}:temp retrieveframe
    scoreboard objectives remove ${ns}-retrieveframe
`;

// Removes a frame from the storage dimension (can't remove entities here)
// Needs: framenum macro
removeFrame`
    # Log the function call
    $${debug.run} {input: "removeFrame for $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input: "-> pullStoreCoords -> macroRemoveFrame"}
    # Remove possibly trailing data
    data remove storage ${ns}:temp removeframe
    scoreboard objectives remove ${ns}-removeframe
    # Setup scoreboard
    scoreboard objectives add ${ns}-removeframe dummy
    # Grab the necessary data to know where in the storage dimension the frame is.
    $${pullStoreCoords} {namespace: "removeframe", framenum: $(framenum)}
    ${macroRemoveFrame`
        # Log the function call
        $${debug.run} {input: "macroRemoveFrame at $(x) 0 $(z)"}
        # Forceload the entire 3 chunks the frame could take up in the storage dimension
        $execute in ${ns}:storage positioned $(x) 0 $(z) run forceload add ~ ~ ~47 ~47
        # Clear the blocks in the storage
        $execute in ${ns}:storage positioned $(x) 0 $(z) run fill ~ ~ ~ ~47 ~47 ~47 minecraft:air strict
        # Remove the forceload in the storage dimension
        $execute in ${ns}:storage positioned $(x) 0 $(z) run forceload remove ~ ~ ~47 ~47
    `} with storage ${ns}:temp removeframe
    # Remove trailing data
    data remove storage ${ns}:temp removeframe
    scoreboard objectives remove ${ns}-removeframe
`;

// Takes a frame from the current animation and places it in a temporary location to save it from being overwritten
storeFrameInTemp`
    # Log the function call
    $${debug.run} {input: "storeFrameInTemp for $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input:"-> pullStoreCoords -> copy blocks to"}
    # Clear possibly trailing data
    data remove storage ${ns}:temp storetemp
    scoreboard objectives remove ${ns}-storetemp
    # Setup scoreboard
    scoreboard objectives add ${ns}-storetemp dummy
    # Grab the necessary data to know where in the storage dimension the frame is.
    $${pullStoreCoords} {namespace: "storetemp", framenum: $(framenum)}
    # Pull name into storage
    data modify storage ${ns}:temp storetemp.name set from storage ${ns}:animation_data new.name
    ${a`
        # Log the function call
        $${debug.run} {input: "Copy blocks to temp at $(x) 0 $(z), spanning $(sx) $(sy) $(sz) in $(name)"}
        # Error if temp already has data (no overwriting allowed)
        $execute if data storage ${ns}:animation_data storetemp.$(name) run return run ${debug.error} {input: "Temp storage in use!"}
        # Forceload the 3 chunks in the storage dimension
        $execute in ${ns}:storage positioned $(x) 0 $(z) run forceload add ~ ~ ~47 ~47
        # Forceload the temporary location
        $execute in ${ns}:storage positioned $(x) 0 -96 run forceload add ~ ~ ~47 ~47
        # Clone blocks over
        $execute in ${ns}:storage positioned $(x) 0 $(z) run clone ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) $(x) 0 -96
        # Clone entity data
        $data modify storage ${ns}:animation_data storetemp.$(name).entities set from storage ${ns}:animation_data new.frames[$(framenum)].entities
        # Place anything in data location just in case there are no entities the temp data check above will still hit
        $data modify storage ${ns}:animation_data storetemp.$(name).inuse set value true
    `} with storage ${ns}:temp storetemp
    # Clear trailing data
    data remove storage ${ns}:temp storetemp
    scoreboard objectives remove ${ns}-storetemp
`

// Retrieves the frame stored in temporary storage in the current animation into a specific frame's location in storage, overwritting any data in the process.
retrieveFrameFromTemp`
    # Log the function call
    $${debug.run} {input: "retrieveFrameFromTemp at $(framenum)"}
    # Log the expected function path.
    ${debug.path} {input:"-> pullStoreCoords -> copy blocks from"}
    # Clear possibly trailing data
    data remove storage ${ns}:temp retrievetemp
    scoreboard objectives remove ${ns}-retrievetemp
    # Setup scoreboard
    scoreboard objectives add ${ns}-retrievetemp dummy
    # Grab the necessary data to know where in the storage dimension the frame is.
    $${pullStoreCoords} {namespace: "retrievetemp", framenum: $(framenum)}
    # Pull name into storage
    data modify storage ${ns}:temp retrievetemp.name set from storage ${ns}:animation_data new.name
    ${a`
        # Log the function call
        $${debug.run} {input: "Copy blocks from temp to $(x) 0 $(z), spanning $(sx) $(sy) $(sz) in $(name)"}
        # Error if temp has no data
        $execute unless data storage ${ns}:animation_data storetemp.$(name) run return run ${debug.error} {input: "Temp storage is empty!"}
        # Forceload the 3 chunks in the storage dimension
        $execute in ${ns}:storage positioned $(x) 0 $(z) run forceload add ~ ~ ~47 ~47
        # Forceload the temporary location
        $execute in ${ns}:storage positioned $(x) 0 -96 run forceload add ~ ~ ~47 ~47
        # Clone blocks over
        $execute in ${ns}:storage positioned $(x) 0 -96 run clone ~ ~ ~ ~$(sx) ~$(sy) ~$(sz) $(x) 0 $(z)
        # Clone entity data (if it exists)
        $execute if data storage ${ns}:animation_data storetemp.$(name).entities run data modify storage ${ns}:animation_data new.frames[$(framenum)].entities set from storage ${ns}:animation_data storetemp.$(name).entities
    `} with storage ${ns}:temp retrievetemp
    # Clear trailing data
    data remove storage ${ns}:temp retrievetemp
    scoreboard objectives remove ${ns}-retrievetemp
`

// Clears all data related to the temporary storage
clearOutTempStorage`
    # Log the function call
    ${debug.run} {input: "clearOutTempStorage for current anim"}
    # Log the expected function path.
    ${debug.path} {input:"-> removing blocks and data"}
    # Error if this animation has no name.
    execute unless data storage ${ns}:animation_data new.name run return run ${debug.error} {input: "Animation in new has no name! Returning..."}
    # Error if this animation has no storageid
    execute unless data storage ${ns}:animation_data new.storageid run return run ${debug.error} {input: "Animation in new has no storageid! Returning..."}
    # Clear possibly trailing data
    data remove storage ${ns}:temp cleartemp
    # Grab the x of this animation
    execute store result storage ${ns}:temp cleartemp.x int 48 run data get storage ${ns}:animation_data new.storageid
    # Grab the animation's name
    data modify storage ${ns}:temp cleartemp.name set from storage ${ns}:animation_data new.name
    # Macro time
    ${a`
        # Log the function call
        $${debug.run} {input: "removing blocks and data at $(x) 0 -96 for $(name)"}
        # Forceload the area
        $execute positioned $(x) 0 -96 run forceload add ~ ~ ~47 ~47
        # Fill everything with air
        $execute positioned $(x) 0 -96 run fill ~ ~ ~ ~47 ~47 ~47 minecraft:air strict
        # Unforceload the area
        $execute positioned $(x) 0 -96 run forceload remove ~ ~ ~47 ~47
        # Remove the entity data
        $data remove storage ${ns}:animation_data storetemp.$(name)
    `} with storage ${ns}:temp cleartemp
    # Clear trailing data
    data remove storage ${ns}:temp cleartemp
`
