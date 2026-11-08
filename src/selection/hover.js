// Sets up basic stuff.
import mcf from '../mcf.js';
// Import functions needed here:
import * as debug from '../debug.js';

const folder = mcf.selection.hover;

// Define functions you want other files to use here:
export const {
    placeGhost, keepHoverSelect, removeHovers
} = folder;

// Define local functions here:
const {
    anonymous: a
} = folder;

const ns = 'easy-anim';

// Block used in place of the "hover" block, could become a future setting?
const hoverBlock = "minecraft:light_blue_stained_glass";

// Places a temporary block intended for players to use to select off of.
placeGhost`
    # Log the function call
    ${debug.run} {input: "placeGhost"}
    # if the block at ~ ~ ~ isn't air, error.
    execute unless block ~ ~ ~ minecraft:air run return run ${debug.error} {input: "Failed to place ghost block, expecting air"}
    setblock ~ ~ ~ ${hoverBlock}
    execute align xyz positioned ~0.5 ~ ~0.5 run summon minecraft:interaction ~ ~ ~ {width:0.99f,height:0.99f,Tags:["${ns}-hover-select"]}
`

// Checks to see if the player is still looking at the temporary block placed by placeGhost. If they are, it keeps the block and interaction entity. If not, it removes both.
keepHoverSelect`
    # Log the entry point - Removed for running every frame.
    # ${debug.entry} {input: "raycast, from tick"}
    # Log the function call
    # ${debug.run} {input: "keepHoverSelect"}
    execute positioned ~-0.505 ~-0.505 ~-0.505 as @e[dx=0, dy=0, dz=0, type=interaction, tag=${ns}-hover-select] run tag @s add ${ns}-hover-select1
    execute positioned ~ ~ ~ as @e[dx=0, dy=0, dz=0, type=interaction, tag=${ns}-hover-select] run tag @s add ${ns}-hover-select2
    execute as @e[type=interaction,tag=${ns}-hover-select1, tag=${ns}-hover-select2] run tag @s remove ${ns}-hover-select-delete
    tag @e[tag=${ns}-hover-select1] remove ${ns}-hover-select1
    tag @e[tag=${ns}-hover-select2] remove ${ns}-hover-select2
`

// Removes the temporary block and interaction entity if the player is no longer looking at it.
removeHovers`
    # Log the entry point - commented out since it is every tick
    # ${debug.entry} {input: "tick"}
    # Log the function call
    # ${debug.run} {input: "removeHovers"}
    # Check if the block at ~ ~ ~ is still light_blue_stained_glass, if not error.
    execute at @s unless block ~ ~ ~ ${hoverBlock} run ${debug.warn} {input: "Hover expected ${hoverBlock} at itself. Block remains unchanged."}
    execute at @s if block ~ ~ ~ ${hoverBlock} run setblock ~ ~ ~ minecraft:air
    kill @s
`
