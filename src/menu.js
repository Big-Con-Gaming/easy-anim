// Set up stuff
import mcf from './mcf.js';
import * as debug from './debug.js';
import { saveInventory, loadInventory, workingHotbar, unclaimLane, calculateLaneX } from './inventory.js';
import { grabStrBlockPos, resetCornerBlock, cleanUpNewAnimationData, handleSummon, regroupEntities, removeDocile, axis, grabAnimationFromUuid } from './selection.js';
import { allocAnimation, storeFrame } from './storage.js';
import { replaceAllInString, toLowerCase } from './util.js';
const folder = mcf.menu;
export const { setName, createSelection, createAnimation, exitSelection, saveStructure, recGroupSearch } = folder;
const { anonymous: a } = folder;
const ns = 'easy-anim';

// Sets up the lists used to compile commands.
const exitCommands = [];

// Sets up the name and base data needed for a new animation.
setName`
    # Log the entry point
    ${debug.entry} {input: "from set_name dialog"}
    # Log the function call
    $${debug.run} {input: "setName with $(name)"}
    # Log the expected function path.
    ${debug.path} {input: "-> replaceAllInString -> toLowerCase -> ^ check duplicate -> set up data -> createSelection"}
    $${replaceAllInString} {input:"$(name)", find:" ", replace:"_", output:"storage ${ns}:temp formatted.name"}
    ${a`
        # Log the function call
        $${debug.run} {input: "formatted: $(name)"}
        $${toLowerCase} {input:"$(name)", output:"storage ${ns}:temp formatted.name"}
    `} with storage ${ns}:temp formatted
    ${a`
        # Log the function call
        $${debug.run} {input: "checking duplicate: $(name)"}
        # Warn if this name already exists
        $execute if data storage ${ns}:animation_data animations[{name:$(name)}] run ${debug.warn} {input:"Animation $(name) already exists! Try a new name"}
        $execute if data storage ${ns}:animation_data animations[{name:$(name)}] run dialog show @s ${ns}:retry_name
        $execute unless data storage ${ns}:animation_data animations[{name:$(name)}] run ${a`
            # Log the function call
            $${debug.run} {input: "setting up data for $(name)"}
            $data modify storage ${ns}:animation_data animations[{name:$(name)}].data set value {}
            $data modify storage ${ns}:player_data current.currentAnim set value $(name)
            $execute in ${ns}:editor run ${createSelection} {name:$(name)}
        `} {name:$(name)}
    `} with storage ${ns}:temp formatted
    data remove storage ${ns}:temp formatted
`;


// This runs when the player clicks the "Create New Animation" button in the main menu. Ran inside the editor dimension.
createSelection`
    # Log the function call
    $${debug.run} {input: "createSelection for $(name)"}
    # Log the expected function path.
    ${debug.path} {input: "-> saveInventory -> workingHotbar"}
    # Save all inventory items into current, and then append current into players. Key UUID can be used to retrieve.
    ${saveInventory}
    # Remove all items and the temporary current player data.
    clear @s *
    data remove storage ${ns}:player_data current
    # Give player our full hotbar.
    $${workingHotbar} {name:$(name)}
    # Add the owner to the newly created animation
    $data modify storage ${ns}:animation_data animations[{name:$(name)}].data.owner set from entity @s UUID
    # Specify that the new animation is currently at the anchor location
    $data modify storage ${ns}:animation_data animations[{name:$(name)}].data.location set value "anchor"
`;

// This takes the current selection and turns it into frame 0 of an animation, as well as the base layer for the animation.
createAnimation`
    # Log the entry point
    ${debug.entry} {input: "from create_animation item"}
    # Log the function call
    $${debug.run} {input: "createAnimation for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> ^ camera and selection check -> grabStrBlockPos -> calculateLaneX -> saveStructure -> recGroupSearch (| grouping entity) -> macro context update -> | removeDocile -> allocAnimation -> storeFrame X2 -> regroupEntities -> handleSummon -> cleanUpNewAnimationData"}
    # Load the player's inventory from storage.
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Error if animation_data new is missing: name or anchor
    execute unless data storage ${ns}:animation_data new.anchor run return run ${debug.error} {input:"Missing anchor data from current animation!"}
    execute unless data storage ${ns}:animation_data new.name run return run ${debug.error} {input:"Missing name data from current animation!"}
    # If there is no selected blocks, tell the player to create one first and stop.
    execute unless data storage ${ns}:animation_data new.size run return run tellraw @s {text:"You must create a selection before creating this animation!",color:"red"}
    # If there is no camera set, tell the player to set one first and stop.
    execute unless data storage ${ns}:animation_data new.camera run return run tellraw @s {text:"You must set a camera position before creating this animation!",color:"red"}
    # Save the block at the neg neg neg corner (outside of region) to the editor dimension and place in a new structure block
    ${grabStrBlockPos}
    ${calculateLaneX} {output:"${ns}:temp str.lanex int"}
    scoreboard objectives add ${ns}-temp dummy
    execute store result score y-increase ${ns}-temp run data get storage ${ns}:temp str.y
    execute store result storage ${ns}:temp str.upy int 1 run scoreboard players add y-increase ${ns}-temp 1
    data modify storage ${ns}:temp str.name set from storage ${ns}:animation_data new.name
    # Warn if the animation currently has framecount or frames.
    execute if data storage ${ns}:animation_data new.framecount run ${debug.warn} {input: "Animation has framecount! Overwriting..."}
    execute if data storage ${ns}:animation_data new.frames run ${debug.warn} {input: "Animation has frame data! Overwriting..."}
    # Insert frame 0 data into the new animation. Take all data from the base selection.
    data modify storage ${ns}:animation_data new.framecount set value 1
    data modify storage ${ns}:animation_data new.frames set value []
    data modify storage ${ns}:animation_data new.frames append value {}
    data modify storage ${ns}:animation_data new.frames[0].duration set value 0.25
    data modify storage ${ns}:animation_data new.frames[0].camera set from storage ${ns}:animation_data new.camera
    data modify storage ${ns}:animation_data new.frames[0].anchor set from storage ${ns}:animation_data new.anchor
    data modify storage ${ns}:animation_data new.frames[0].size set from storage ${ns}:animation_data new.size
    ${saveStructure`
        # Log the function call
        $${debug.run} {input: "saveStructure at $(x) $(y) $(z) within $(sx) $(sy) $(sz) for $(name)"}
        $clone $(x) $(upy) $(z) $(x) $(upy) $(z) to ${ns}:editor $(lanex) 3 0 strict
        # Warn if no interactions or handles are present.
        $execute positioned $(x) $(y) $(z) unless entity @n[type=minecraft:interaction,tag=${ns}-select-str-block,distance=..1] run ${debug.warn} {input:"No interaction blocking the structure block! Skipping removal..."}
        $execute positioned $(x) $(y) $(z) unless entity @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)] run ${debug.warn} {input:"No handles on the selection! Skipping removal..."}
        $execute positioned $(x) $(y) $(z) run kill @n[type=minecraft:interaction,tag=${ns}-select-str-block,distance=..1]
        $execute positioned $(x) $(y) $(z) run kill @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)]
        # Ungroup any grouped entities and tag them so they can find each other.
        execute store result storage ${ns}:temp str.id int 1 run scoreboard players set groupid ${ns}-temp 0
        ${recGroupSearch`
            # Log the function call
            $${debug.run} {input: "recGroupSearch with id $(id)"}
            # Warn if no entities are present within the selection
            $execute positioned $(x) $(y) $(z) unless entity @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-group,limit=1,sort=random] run ${debug.warn} {input:"No entities can be grouped! Skipping..."}
            $execute positioned $(x) $(y) $(z) as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-group,limit=1,sort=random] if data entity @s Passengers run ${a`
                # Log the function call
                ${debug.run} {input: "grouping an entity found within selection"}
                $tag @s add ${ns}-vehicle-$(id)
                $data modify entity @s data.easyanimgroupid set value $(id)
                tag @s add ${ns}-group
                $execute on passengers run tag @s add ${ns}-passenger-$(id)
                execute on passengers run tag @s add ${ns}-group
                $execute on passengers run data modify entity @s data.easyanimgroupid set value $(id)
                execute on passengers run ride @s dismount
                execute store result storage ${ns}:temp str.id int 1 run scoreboard players add groupid ${ns}-temp 1
            `} with storage ${ns}:temp str
            $execute positioned $(x) $(y) $(z) as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-group] if data entity @s Passengers run ${recGroupSearch} with storage ${ns}:temp str
        `} with storage ${ns}:temp str
        # Using the macro, make sure all of the entities within the selection are no longer considered docile
        ${a`
            # Log the function call
            ${debug.run} {input: "removing docile tags within selection"}
            # Warn if no entities are found.
            $execute positioned $(x) $(y) $(z) if entity @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-entity-turned-docile] run ${debug.warn} {input: "No docile entities found! Skipping..."}
            $execute positioned $(x) $(y) $(z) as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-entity-turned-docile] run ${removeDocile}
        `} with storage ${ns}:temp str
        $setblock $(x) $(upy) $(z) minecraft:redstone_block
        $setblock $(x) $(upy) $(z) minecraft:air
        $data modify block $(x) $(y) $(z) name set value "${ns}:$(name)-frame0"
        $setblock $(x) $(upy) $(z) minecraft:redstone_block
        $data modify block $(x) $(y) $(z) name set value "${ns}:$(name)-base"
        # Allocate a lane in storage for this new animation, and place base and frame 0 in there.
        # Warn if animation_data already has a storageid
        execute if data storage ${ns}:animation_data new.storageid run ${debug.warn} {input: "Animation already has a storage lane! Skipping assignment..."}
        execute unless data storage ${ns}:animation_data new.storageid run ${allocAnimation}
        $${storeFrame} {name: $(name), framenum: "base"}
        $${storeFrame} {name: $(name), framenum: 0}
        # Regroup any grouped entities and remove their redundant tags + data. Must be separated so data that is needed to find each other isn't erased yet.
        ${regroupEntities} with storage ${ns}:temp str
        $clone from easy-anim:editor $(lanex) 3 0 $(lanex) 3 0 $(x) $(upy) $(z) strict
        $summon minecraft:interaction $(x) $(y) $(z) {width:1.01f,height:1.01f,Tags:["${ns}-select-str-block"]}
        $execute in ${ns}:editor run setblock $(lanex) 3 0 minecraft:air
    `} with storage ${ns}:temp str
    # Place the previously deleted handles back.
    ${handleSummon}
    # Save modifications made to the animation.
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove the temporary data locations.
    data remove storage ${ns}:temp str
    scoreboard objectives remove ${ns}-temp
    # Prompt the user to enter the editor.
    dialog show @s ${ns}:enter_editor
`;


// This runs when the player uses the exit item in their inventory. Ran inside the editor dimension.
exitCommands.push(`
    # Log the entry point
    ${debug.entry} {input: "from exit item | from enterEditor"}
    # Log the function call
    $${debug.run} {input: "exitSelection for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> loadInventory -> grabStrBlockPos -> calculateLaneX -> resetCornerBlock -> | unclaimLane -> kill handles -> cleanUpNewAnimationData -> | remove selection data"}
    # Load the player's inventory from storage.
    $${grabAnimationFromUuid} {UUID:$(UUID)}
    # Load the items into the player's inventory
    ${loadInventory}
    # Replace the structure block in the current selection with its old block from the lane
    ${grabStrBlockPos}
    ${calculateLaneX} {output:"${ns}:temp str.lanex int"}
    ${resetCornerBlock} with storage ${ns}:temp str
    # Free up the player's old editor lane, if the player isn't within the editor.
    execute unless entity @s[tag=${ns}-inEditor] run ${unclaimLane}
    # Create temporary scoreboard for the size increasing functions below.
    scoreboard objectives add ${ns}-exitcommands dummy
`);
// We need to temporarily add 2 to each size on each axis so that the target selector below only selects what we want when we kill off the handles.

function createExitCommands({axis}) {
    return`
        # Warn if str.s${axis} doesn't exist.
        execute unless data storage ${ns}:temp str.s${axis} run ${debug.warn} {input: "Missing size parameter s${axis} from grabStrBlockPos"}
        execute store result score ${axis} ${ns}-exitcommands run data get storage ${ns}:temp str.s${axis}
        execute store result storage ${ns}:temp str.s${axis} double 1 run scoreboard players add ${axis} ${ns}-exitcommands 2
    `;
}

// Toss the commands specified above into the function.
exitCommands.push(...axis.map(createExitCommands));

exitCommands.push(`
    # Remove the temporary scoreboard used above.
    scoreboard objectives remove ${ns}-exitcommands
    # Kill the display item_display entities from the old selection.
    ${a`
        # Log the function call
        $${debug.run} {input: "kill off handles at $(x) $(y) $(z) within $(sx) $(sy) $(sz) located in $(dimension)"}
        $execute in $(dimension) positioned $(x) $(y) $(z) unless entity @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)] run ${debug.warn} {input:"No handles on the selection! Skipping removal..."}
        $execute in $(dimension) positioned $(x) $(y) $(z) run kill @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)]
    `} with storage ${ns}:temp str
    # Remove the temporary data locations.
    data remove storage ${ns}:temp str
    # Set the animation's location to none if we aren't in the editor, and to editor if we are.
    execute unless entity @s[tag=${ns}-inEditor] run data modify storage ${ns}:animation_data new.location set value "none"
    execute if entity @s[tag=${ns}-inEditor] run data modify storage ${ns}:animation_data new.location set value "editor"
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove the new selection from animation_data entirely, unless there are frames associated with it.
    $${a`
        # Log the function call
        $${debug.run} {input: "removing selection data for $(currentAnim)"}
        $execute unless data storage ${ns}:animation_data animations[{name:$(currentAnim)}].data.frames run data remove storage ${ns}:animation_data animations[{name:$(currentAnim)}]
    `} with storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Remove the player's old player data unless they are in the editor.
    $execute unless entity @s[tag=${ns}-inEditor] run data remove storage ${ns}:player_data players[{UUID:$(UUID)}]
`);

exitSelection`${exitCommands.join('\n')}`;