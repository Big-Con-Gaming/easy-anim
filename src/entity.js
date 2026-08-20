// This file deals with entities becoming "docile" and entity grouping, used in animation frames and selections.

// Set up stuff
import mcf from './mcf.js';
import * as debug from './debug.js';

const folder = mcf.entity;

// Define functions you want other files to use here:
export const { recSplitGroups, regroupEntities, turnEntityDocile, removeDocile } = folder;

// Define local functions here:
const { anonymous: a } = folder;

const ns = 'easy-anim';

// Separates groups within a selection/frame using tags so that they can be recreated after a structure block loads.
recSplitGroups`
    # Log the function call
    $${debug.run} {input: "recSplitGroups with id $(id) within $(sx) $(sy) $(sz)"}
    # Create the objective used to count groupid if it doesn't already exist.
    scoreboard objectives add ${ns}-rsg dummy
    $execute store result storage ${ns}:temp rsg.id int 1 run scoreboard players set groupid ${ns}-rsg $(id)
    $data modify storage ${ns}:temp rsg.sx set value $(sx)
    $data modify storage ${ns}:temp rsg.sy set value $(sy)
    $data modify storage ${ns}:temp rsg.sz set value $(sz)
    # Warn if no entities are present within the selection
    $execute unless entity @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-group,limit=1,sort=random] run ${debug.warn} {input:"No entities can be grouped! Skipping..."}
    $execute as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-group,limit=1,sort=random] if data entity @s Passengers run ${a`
        # Log the function call
        ${debug.run} {input: "grouping an entity found within selection"}
        $tag @s add ${ns}-vehicle-$(id)
        $data modify entity @s data.easyanimgroupid set value $(id)
        tag @s add ${ns}-group
        $execute on passengers run tag @s add ${ns}-passenger-$(id)
        execute on passengers run tag @s add ${ns}-group
        $execute on passengers run data modify entity @s data.easyanimgroupid set value $(id)
        execute on passengers run ride @s dismount
        execute store result storage ${ns}:temp rsg.id int 1 run scoreboard players add groupid ${ns}-rsg 1
    `} with storage ${ns}:temp rsg
    $execute as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=!${ns}-group] if data entity @s Passengers run ${recSplitGroups} with storage ${ns}:temp rsg
    # Remove the created objective.
    scoreboard objectives remove ${ns}-rsg
    data remove storage ${ns}:temp rsg
`

// Must be ran at xyz and with sx sy sz, where xyz represents the neg-neg-neg corner of the frame/selection and sx sy sz represent the size of the frame/selection. This goes through and puts grouped entities back together after they were split for structure saving.
regroupEntities`
    # Log the function call
    $${debug.run} {input: "regroupEntities within $(sx) $(sy) $(sz)"}
    # Log the expected function path.
    ${debug.path} {input: "-> | passenger on vehicle -> | untagging"}
    # Warn if no grouped entities are found within selection in case there should be.
    $execute unless entity @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-group] run ${debug.warn} {input: "No grouped entities found, skipping..."}
    $execute as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-group] run ${a`
        # Log the function call
        $${debug.run} {input: "placing passenger on vehicle in group $(easyanimgroupid)"}
        $execute if entity @s[tag=${ns}-passenger-$(easyanimgroupid)] run ride @s mount @n[tag=${ns}-vehicle-$(easyanimgroupid)]
    `} with entity @s data
    $execute as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-group] run ${a`
        # Log the function call
        $${debug.run} {input: "untagging $(easyanimgroupid)"}
        $execute if entity @s[tag=${ns}-passenger-$(easyanimgroupid)] run tag @s remove ${ns}-passenger-$(easyanimgroupid)
        $execute if entity @s[tag=${ns}-vehicle-$(easyanimgroupid)] run tag @s remove ${ns}-vehicle-$(easyanimgroupid)
        tag @s remove ${ns}-group
        data remove entity @s data.easy-anim-groupid
    `} with entity @s data
`;

// Define arrays that are built below.
const turnEntityDocileCommands = [];
const removeDocileCommands = [];

// All nbtdata that needs to be changed (set to true by default) to make an entity "docile".
const entityAttributes = [
    {name:"NoAI"},
    {name:"Silent"},
    {name:"Glowing", selectOnly: true},
    {name:"Invulnerable"},
    {name:"PersistenceRequired"},
    {name:"PickupDelay", value:"10s", itemOnly:true,repeated:true},
    {name:"Age", value:"0s", itemOnly:true, repeated:true},
    {name:"Motion", value:"[0.0d,0.0d,0.0d]", repeated:true}
];

// Turn all entities within the selection area "docile" (No AI, No Gravity, Silent, Invulnerable, Persistent, Full Pickup Delay and No Despawn Timer for Items)
// These commands here specifically change all of the attributes required to be docile to the executor.
function createTurnEntityDocileCommands({name, value, itemOnly, repeated, selectOnly}){
    let selector = ``;
    let output = "true";
    if (repeated === null) {
        selector = `unless entity @s[tag=${ns}-entity-turned-docile] `;
    }
    if (itemOnly) {
        selector = selector.concat(`if entity @s[type=item] `);
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

