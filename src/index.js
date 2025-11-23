// index.js
// This is the main entry point for your datapack generation.
// Import your mcf context and any functions you want to use.

import mcf from './mcf.js';
import { rightClick, select, handleDetection, handleHighlight } from './menu.js';

// Declare the functions you want to use
const { tick, load, menu, raycast, anonymous: a } = mcf;
const raycastCommands = [];

const ns = 'easy-anim';

// These commands will run every tick.
tick`
    ${rightClick}
    execute as @a[scores={${ns}-right-click=1..}] run scoreboard players set @s ${ns}-right-click 0
    ${select}
    ${handleDetection}
    execute as @e[type=interaction, tag=${ns}-handle] if data entity @s interaction run data remove entity @s interaction
    execute as @e[type=interaction, tag=${ns}-handle] if data entity @s attack run data remove entity @s attack
    execute as @a at @s anchored eyes positioned ^ ^ ^ summon minecraft:marker run ${raycast}
`;

// These commands run when the datapack has been loaded in.
load`
    # Set up the scoreboard for detecting right clicks.
    scoreboard objectives add ${ns}-right-click minecraft.used:minecraft.carrot_on_a_stick
    # Forceload the main chunk in the editor dimension so the inventory barrel at the bottom of the world is always loaded and can be used.
    execute in ${ns}:editor run forceload add 0 0
    # Let operators know the datapack has been loaded.
    say Easy Animations Datapack Loaded!
`;

menu`
    dialog show @s ${ns}:main_menu
`;

for (let i = 0; i < 6; i++) {
    raycastCommands.push(`
        ${handleHighlight}
        tp @s ^ ^ ^1
    `);
}

raycastCommands.push(`
    data modify storage ${ns}:temp temp.x set from entity @s Pos[0]
    data modify storage ${ns}:temp temp.y set from entity @s Pos[1]
    data modify storage ${ns}:temp temp.z set from entity @s Pos[2]
    data modify storage ${ns}:temp temp.yaw set from entity @s Rotation[0]
    data modify storage ${ns}:temp temp.pitch set from entity @s Rotation[1]
    ${a`$say x: $(x) y: $(y) z: $(z) yaw: $(yaw) pitch: $(pitch)`} with storage ${ns}:temp temp
    data remove storage ${ns}:temp temp
    
`);

raycast`
    data modify entity @s Rotation set from entity @p Rotation
    ${raycastCommands.join('\n')}
    kill @s
`;