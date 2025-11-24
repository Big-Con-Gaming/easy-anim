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
    execute as @a at @s anchored eyes positioned ^ ^ ^ summon minecraft:interaction run ${raycast} with entity @p
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
// Executes commands that have to run for each raycast iteration (we start at the player and move out 0.25 blocks more each time, until we are 5 blocks away.)
for (let i = 0.25; i < 5.5; i += 0.25) {
    raycastCommands.push(`
        execute at @s run ${handleHighlight}
        $execute at @a[nbt={UUID:$(UUID)}] positioned ~ ~1.6 ~ run tp @s ^ ^ ^${i}
    `);
}

// this is executed as an interaction entity at the player's eyes. We just gotta make sure we're facing the same direction as the player, that we have a size of 0.25, and that we kill this interaction after its use.
raycast`
    data modify entity @s Rotation set from entity @p Rotation
    data merge entity @s {width:0.25f,height:0.25f}
    ${raycastCommands.join('\n')}
    kill @s
`;