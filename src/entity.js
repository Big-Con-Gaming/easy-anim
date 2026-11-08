// This file deals with entities becoming "docile" and entity grouping, used in animation frames and selections.

// Set up stuff
import mcf from './mcf.js';
import * as debug from './debug.js';
import { grabSizeAnchor, grabSizeAnchorEditor } from './selection/data.js';
import { axis } from './util.js';

const folder = mcf.entity;

// Define functions you want other files to use here:
export const { splitGroups, regroupEntities, turnEntityDocile, removeDocile, mainDocileLoop, cleanKill } = folder;

// Define local functions here:
const {
    anonymous: a, recDocileSearch, skipDocile, targetSelectInSelection, rideGroup, removeParentData, removeVehicleData
} = folder;

const ns = 'easy-anim';

// Separates groups within a selection/frame using tags so that they can be recreated after a structure block loads.
splitGroups`
    # Log the function call
    $${debug.run} {input: "splitGroups within $(sx) $(sy) $(sz)"}
    # Remove possibly trailing data.
    scoreboard objectives remove ${ns}-rsg
    data remove storage ${ns}:temp rsg
    # Create the objective used to count groupid if it doesn't already exist.
    scoreboard objectives add ${ns}-rsg dummy
    execute store result storage ${ns}:temp rsg.id int 1 run scoreboard players set groupid ${ns}-rsg 0
    # First step: giving all entities the required tags and data.
    $execute align xyz as @e[type=!player, dx=$(sx), dy=$(sy), dz=$(sz)] if data entity @s Passengers[0] run ${a`
        # This might seem stupid, but the nested anonymous functions update the macro context needed when id get's increased,
        # since selectors cause breadth-first function running, this forces depth-first function running.
        ${a`
            # Log the function call
            $${debug.run} {input: "Give Tags, Group: $(id)"}
            # Associate all passengers with this ID.
            $execute on passengers run data modify entity @s data.${ns}.parent set value $(id)
            $execute on passengers run tag @s add ${ns}-passenger-$(id)
            execute on passengers run tag @s add ${ns}-passenger
            execute on passengers run tag @s add ${ns}-this-pass
            # Associate this vehicle with this ID.
            $data modify entity @s data.${ns}.vehicle set value $(id)
            $tag @s add ${ns}-vehicle-$(id)
            tag @s add ${ns}-vehicle
            # Update ID
            execute store result storage ${ns}:temp rsg.id int 1 run scoreboard players add groupid ${ns}-rsg 1
        `} with storage ${ns}:temp rsg
    `}
    # Second step: making all passengers dismount their vehicles.
    # We use temp tag this-pass in case passengers aren't located within the frame but were on vehicles that were.
    execute as @e[type=!player, tag=${ns}-this-pass] run ride @s dismount
    tag @e[type=!player, tag=${ns}-this-pass] remove ${ns}-this-pass
    # Remove trailing data.
    scoreboard objectives remove ${ns}-rsg
    data remove storage ${ns}:temp rsg
`
const placeSizeInRegroupCommands = [];

function placeSizeInRegroupFunc({axis}) {
    return`
        $data modify storage ${ns}:temp regroup.s${axis} set value $(s${axis})
    `
}

placeSizeInRegroupCommands.push(...axis.map(placeSizeInRegroupFunc));

// Must be ran at xyz and with sx sy sz, where xyz represents the neg-neg-neg corner of the frame/selection and sx sy sz represent the size of the frame/selection. This goes through and puts grouped entities back together after they were split for structure saving.
regroupEntities`
    # Log the function call
    $${debug.run} {input: "regroupEntities within $(sx) $(sy) $(sz)"}
    # Log the expected function path.
    ${debug.path} {input: "-> | passenger on vehicle -> | untagging"}
    # Remove possibly trailing data.
    data remove storage ${ns}:temp regroup
    ${placeSizeInRegroupCommands.join('\n')}
    # Warn if no grouped entities are found within selection in case there should be.
    $execute align xyz unless entity @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-vehicle] run ${debug.warn} {input: "No vehicle entities found, skipping..."}
    # Pull needed data into a macro
    $execute align xyz as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-passenger] run ${a`
        # Remove possibly trailing data.
        data remove storage ${ns}:temp regroup.id
        # Set ID for this passenger and vehicle group.
        data modify storage ${ns}:temp regroup.id set from entity @s data.${ns}.parent
        ${rideGroup`
            # Log the function call
            $${debug.run} {input: "placing passenger on vehicle in group $(id)"}
            $ride @s mount @n[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-vehicle-$(id)]
        `} with storage ${ns}:temp regroup
        # Remove trailing data.
        data remove storage ${ns}:temp regroup.id
    `}
    $execute align xyz as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-passenger] run ${removeParentData`
        # Log the function call
        $${debug.run} {input: "untagging passenger $(parent)"}
        # Remove stored data
        data remove entity @s data.${ns}.parent
        # If there's no vehicle data, remove the parent data entirely.
        execute unless data entity @s data.${ns}.vehicle run data remove entity @s data.${ns}
        # Remove tags
        $tag @s remove ${ns}-passenger-$(parent)
        tag @s remove ${ns}-passenger
    `} with entity @s data.${ns}
    $execute align xyz as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-vehicle] run ${removeVehicleData`
        # Log the function call
        $${debug.run} {input: "untagging vehicle $(vehicle)"}
        # Remove stored data
        data remove entity @s data.${ns}.vehicle
        # If there's no passenger data, remove the vehicle data entirely.
        execute unless data entity @s data.${ns}.passenger run data remove entity @s data.${ns}
        # Remove tags
        $tag @s remove ${ns}-vehicle-$(vehicle)
        tag @s remove ${ns}-vehicle
    `} with entity @s data.${ns}
    # Remove trailing data.
    data remove storage ${ns}:temp regroup
`;

// Define arrays that are built below.
const turnEntityDocileCommands = [];
const removeDocileCommands = [];

// All nbtdata that needs to be changed (set to true by default) to make an entity "docile".
const entityAttributes = [
    {name:"NoAI"},
    {name:"NoGravity"},
    {name:"Time", value: "0", repeated: true, onlyType: "minecraft:falling_block"},
    {name:"Silent"},
    {name:"Glowing", selectOnly: true},
    {name:"Invulnerable"},
    {name:"PersistenceRequired"},
    {name:"PickupDelay", value:"10s", onlyType:"minecraft:item", repeated:true},
    {name:"Age", value:"0s", onlyType:"minecraft:item", repeated:true},
    {name:"Motion", value:"[0.0d,0.0d,0.0d]", repeated:true}
];

// Turn all entities within the selection area "docile" (No AI, No Gravity, Silent, Invulnerable, Persistent, Full Pickup Delay and No Despawn Timer for Items)
// These commands here specifically change all of the attributes required to be docile to the executor.
function createTurnEntityDocileCommands({name, value, onlyType, repeated, selectOnly}){
    let selector = ``;
    let output = "true";
    if (repeated === null) {
        selector = `unless entity @s[tag=${ns}-entity-turned-docile] `;
    }
    if (onlyType) {
        selector = selector.concat(`if entity @s[type=${onlyType}] `);
    }
    if (value) {
        output = value;
    }
    if (selectOnly) {
        selector = selector.concat(`if entity @s[tag=${ns}-selected] `);
    }
    return`
            execute at @s ${selector}store success score ${ns}-${name} ${ns}-entity-docile run data modify entity @s ${name} set value ${output}
            execute at @s ${selector}if score ${ns}-${name} ${ns}-entity-docile matches 1 run tag @s add ${ns}-${name}
    `;
};

turnEntityDocileCommands.push(`
    # Log the function call - Removed for running every frame
    # ${debug.run} {input: "turnEntityDocile"}
    # Warn if the entity is already docile.
    execute unless entity @s[type=item] if entity @s[tag=${ns}-entity-turned-docile] run ${debug.warn} {input: "Non-item entity is already docile, continuing anyway."}
    # Remove possibly trailing data
    scoreboard objectives remove ${ns}-entity-docile
    scoreboard objectives add ${ns}-entity-docile dummy
`);

turnEntityDocileCommands.push(...entityAttributes.map(createTurnEntityDocileCommands));

turnEntityDocileCommands.push(`
    scoreboard objectives remove ${ns}-entity-docile
    execute unless entity @s[tag=${ns}-entity-turned-docile] run tag @s add ${ns}-entity-turned-docile
`);

// These commands here specifically remove all of the attributes that make an entity docile from the executor.
function createRemoveDocileCommands({name, repeated}){
    if (repeated) {
        return`
            execute if entity @s[tag=${ns}-${name}] run tag @s remove ${ns}-${name}
        `;
    } else {
        return`
            execute if entity @s[tag=${ns}-${name}] run data modify entity @s ${name} set value false
            execute if entity @s[tag=${ns}-${name}] run tag @s remove ${ns}-${name}
        `;
    }
}

removeDocileCommands.push(`
    # Log the function call - Removed for running every frame
    # ${debug.run} {input: "removeDocile"}
    # Warn if the entity isn't docile.
    execute unless entity @s[tag=${ns}-entity-turned-docile] run ${debug.warn} {input: "Entity isn't docile, continuing anyway."}
`);

removeDocileCommands.push(...entityAttributes.map(createRemoveDocileCommands));

removeDocileCommands.push(`
    execute if entity @s[tag=${ns}-entity-turned-docile] run tag @s remove ${ns}-entity-turned-docile
`);

turnEntityDocile`${turnEntityDocileCommands.join('\n')}`;
removeDocile`${removeDocileCommands.join('\n')}`;

// Helper function to skip a frame in docile check
skipDocile`
    data remove storage ${ns}:temp docileSearch[0]
    execute if data storage ${ns}:temp docileSearch[0] run ${recDocileSearch}
`

// The main stack that goes through all entities that should be docile and makes them docile. Called every frame from selection.
mainDocileLoop`
    # Remove all docile entities.
    execute as @e[tag=${ns}-entity-turned-docile] run ${removeDocile}
    # Remove possibly trailing data.
    data remove storage ${ns}:temp docileSearch
    # If an entity is inside the newly created selection radius, make them docile.
    data modify storage ${ns}:temp docileSearch set from storage ${ns}:animation_data animations
    # Recursive, is called until temporary list docileSearch in animationData is empty. Goes through each animation and turns entities docile within each.
    ${recDocileSearch`
        # If this animation is not displayed anywhere, then there's no entities to be made docile. Skip to next animation.
        execute if data storage ${ns}:temp docileSearch[0].data{location:"none"} run return run ${skipDocile}
        # Pull data and name into the new namespace so that functions work properly.
        data modify storage ${ns}:animation_data new set from storage ${ns}:temp docileSearch[0].data
        data modify storage ${ns}:animation_data new.name set from storage ${ns}:temp docileSearch[0].name
        # If we are in the "real world," we can run the normal grabSizeAnchor function to grab anchor coordinates and size in a macro data space.
        execute if data storage ${ns}:temp docileSearch[0].data{location:"anchor"} run ${grabSizeAnchor}
        # If we are in the editor, we need to grab the eanchor and size of the first frame, as well as setup an incrementing variable to go between frames and a max variable to know when to stop searching (framecount)
        # return early and remove this frame from the search if location is editor but there's no frames in the animation.
        execute if data storage ${ns}:temp docileSearch[0].data{location:"editor"} unless data storage ${ns}:temp docileSearch[0].data.frames[0] run return run ${skipDocile}
        execute if data storage ${ns}:temp docileSearch[0].data{location:"editor"} run ${a`
            ${grabSizeAnchorEditor} {framenum:0}
            # Remove possibly trailing data.
            scoreboard objectives remove ${ns}-recDocile
            scoreboard objectives add ${ns}-recDocile dummy
            # framenum is set to 1 as an advanced increment so that new data is pulled immediately.
            execute store result score framenum ${ns}-recDocile run data modify storage ${ns}:temp grabsizeanchor.framenum set value 1
            execute store result score totalframe ${ns}-recDocile run data get storage ${ns}:animation_data new.framecount
        `}
        # If we are rendering, we need the lanex to find the original world data to make docile. Grab the other default data for completing macros + size.
        execute if data storage ${ns}:temp docileSearch[0].data{location:"render"} run ${a`
            ${grabSizeAnchor}
            $${a`
                $execute store result storage ${ns}:temp grabsizeanchor.ax int 48 run data get storage ${ns}:player_data players[{UUID: $(UUID)}].lane    
            `} with storage ${ns}:animation_data render_queue[{name: $(name)}]
        `} with storage ${ns}:temp docileSearch[0]
        # Use the newly placed macro data in ${ns}:temp grabsizeanchor to target select the entities.
        ${targetSelectInSelection`
            # If we are in the "real world," just execute once on the selection and turn those entities docile.
            $execute if data storage ${ns}:temp docileSearch[0].data{location:"anchor"} positioned $(ax) $(ay) $(az) align xyz as @e[type=!player, dx=$(shx), dy=$(shy), dz=$(shz)] run ${turnEntityDocile}
            # If we are in the editor, we will execute within that dimension at the eanchor and specific frame size.
            execute if data storage ${ns}:temp docileSearch[0].data{location:"editor"} run ${a`                
                $execute in ${ns}:editor positioned $(ax) $(ay) $(az) align xyz as @e[type=!player, dx=$(shx), dy=$(shy), dz=$(shz)] run ${turnEntityDocile}
                # Clear grabsizeanchor for the next frame
                data remove storage ${ns}:temp grabsizeanchor
                # Exit the loop if we have reached the total frame count for this animation.
                execute if score framenum ${ns}-recDocile >= totalframe ${ns}-recDocile run return 1
                # Grab the next frame's eanchor and size (framenum is incremented by 1 in advance)
                $${grabSizeAnchorEditor} {framenum:$(framenum)}
                # Increase framenum by 1 in score and data.
                execute store result storage ${ns}:temp grabsizeanchor.framenum int 1 run scoreboard players add framenum ${ns}-recDocile 1
                # Execute another target selection for the next frame.
                ${targetSelectInSelection} with storage ${ns}:temp grabsizeanchor
            `} with storage ${ns}:temp grabsizeanchor
            # If the animation is currently being rendered, we let the renderer handle entities within the animation
            # But, we can still make the original entities now in the editor docile.
            $execute if data storage ${ns}:temp docileSearch[0].data{location:"render"} positioned $(ax) 0 0 align xyz as @e[type=!player, dx=$(shx), dy=$(shy), dz=$(shz)] run ${turnEntityDocile}
        `} with storage ${ns}:temp grabsizeanchor
        # Remove trailing data.
        data remove storage ${ns}:temp grabsizeanchor
        scoreboard objectives remove ${ns}-recDocile
        data remove storage ${ns}:temp docileSearch[0]
        data remove storage ${ns}:animation_data new
        # If we have more selections to turn docile, repeat this function.
        execute if data storage ${ns}:temp docileSearch[0] run ${recDocileSearch}
    `}
    data remove storage ${ns}:temp docileSearch
`
// Execute on an entity to kill it by teleporting it away to the editor dimension, removing it's drops so nothing is left behind.
cleanKill`
    # Log the function call
    ${debug.run} {input: "cleanKill"}
    data modify entity @s DeathLootTable set value "minecraft:air"
    data modify entity @s Glowing set value false
    kill @s
    execute in ${ns}:editor run tp @s 0 -30 0
`;
