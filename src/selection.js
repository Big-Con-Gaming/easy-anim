// This file should ONLY deal with the creation and management, which are currently only used when creating an animation from a selection which becomes the base and first frame.
// ALL other functionality SHOULD be in sub-files.

// Set up stuff
import mcf from './mcf.js';
import * as debug from './debug.js';
import { resetCornerBlock, twoPointSelection, updateSelection, removeOldSelection } from './selection/geometry.js';
import { grabStrBlockPos } from './selection/data.js';
import { displayBox } from './selection/display.js';
import { handleSummon } from './selection/handle.js';
import { grabAnimationFromUuid, grabAnimationData, cleanUpNewAnimationData } from './data.js';
import { calculateLaneX, unclaimLane } from './editor/lane.js';
import { mainDocileLoop } from './entity.js';
import { loadInventory } from './inventory.js';
import { axis } from './util.js';
const folder = mcf.selection;
export const { exitSelection } = folder;
const { executeAsMarker, anonymous: a, createTwoPointSelection } = folder;

// executeAsMarker: ran as a marker in the world, depicting the center of the block that a player first selects. Runs the decision tree to determine which selection command to execute.

export const ns = 'easy-anim';

// Set up lists that will hold commands.
export const selectCommands = [];

// Set up the list that will hold commands for the exitSelection macro.
const exitCommands = [];

// This runs when the player uses the exit item in their inventory. Ran inside the editor dimension.
exitCommands.push(`
    # Log the entry point
    ${debug.entry} {input: "from exit item | from enterEditor"}
    # Log the function call
    $${debug.run} {input: "exitSelection for $(UUID)"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabAnimationFromUuid -> loadInventory -> grabStrBlockPos -> calculateLaneX -> resetCornerBlock -> | unclaimLane -> kill handles -> cleanUpNewAnimationData -> | remove selection data"}
    # Remove possibly trailing data.
    data remove storage ${ns}:temp str
    # Load the player's inventory from storage.
    ${grabAnimationFromUuid} with entity @s
    # Load the items into the player's inventory
    ${loadInventory}
    # Replace the structure block in the current selection with its old block from the lane
    ${grabStrBlockPos}
    ${calculateLaneX} {output:"${ns}:temp str.lanex int"}
    ${resetCornerBlock} with storage ${ns}:temp str
    # Free up the player's old editor lane, if the player isn't within the editor.
    execute unless entity @s[tag=${ns}-inEditor] unless entity @s[tag=${ns}-waitLoadEditor] run ${unclaimLane}
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
        $execute in $(dimension) positioned $(x) $(y) $(z) align xyz unless entity @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)] run ${debug.warn} {input:"No handles on the selection! Skipping removal..."}
        $execute in $(dimension) positioned $(x) $(y) $(z) align xyz run kill @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)]
    `} with storage ${ns}:temp str
    # Remove the temporary data locations.
    data remove storage ${ns}:temp str
    # Set the animation's location to none if we aren't in the editor, and to editor if we are.
    execute unless entity @s[tag=${ns}-inEditor] unless entity @s[tag=${ns}-waitLoadEditor] run data modify storage ${ns}:animation_data new.location set value "none"
    execute if entity @s[tag=${ns}-waitLoadEditor] run data modify storage ${ns}:animation_data new.location set value "editor"
    ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    # Remove the new selection from animation_data entirely, unless there are frames associated with it.
    $${a`
        # Log the function call
        $${debug.run} {input: "removing selection data for $(currentAnim)"}
        $execute unless data storage ${ns}:animation_data animations[{name:$(currentAnim)}].data.frames run data remove storage ${ns}:animation_data animations[{name:$(currentAnim)}]
    `} with storage ${ns}:player_data players[{UUID:$(UUID)}]
    # Remove the player's old player data unless they are in the editor.
    $execute unless entity @s[tag=${ns}-inEditor] unless entity @s[tag=${ns}-waitLoadEditor] run data remove storage ${ns}:player_data players[{UUID:$(UUID)}]
`);

// actually create the macro in the menu namespace so that it keeps its original path
exitSelection`${exitCommands.join('\n')}`;

// This function is extremely inefficient. It is ran every frame, with some of the code only executing if the player places a new selection item frame. This part is fine.
// The issue is that afterwards, a lot of commands execute that aren't needed (like cleaning up new changes from the selections, etc.) These should be consolidated.
selectCommands.push(`
    # Log the entry point (commented out since it is tick)
    # ${debug.entry} {input: "tick"}
    execute as @n[type=item_frame,tag=${ns}-edge] at @s positioned ^ ^ ^-0.5 align xyz summon minecraft:marker run ${executeAsMarker`
        # Log the entry point
        ${debug.entry} {input: "from placed entity from selection item"}
        # Log the function call
        ${debug.run} {input: "executeAsMarker as a selection is being created"}
        # Log the expected function path.
        ${debug.path} {input: "-> grabAnimationData -> | removeOldSelection -> [updateSelection | createTwoPointSelection | set new selection] -> | grabStrBlockPos -> | calculateLaneX -> | resetCornerBlock -> | twoPointSelection -> displayBox -> cleanUpNewAnimationData"}
        # Pull out animation data for this selection and place it inside new. Add the name to the data temporarily.
        $${grabAnimationData} {currentAnim:$(currentAnim)}
        # If we have an anchor and a preexisting size, we must test to see if the new selection is outside of the current region, and on which axis to update the previous region by.
        execute if data storage ${ns}:animation_data new.anchor run ${removeOldSelection}
        execute if data storage ${ns}:animation_data new.anchor if data storage ${ns}:animation_data new.size run ${updateSelection}
        # If we have an anchor but not a size, calculate a size with this new corner and update the size to match. Anchor might move to stay as the most negative corner.
        execute if data storage ${ns}:animation_data new.anchor unless data storage ${ns}:animation_data new.size run ${createTwoPointSelection`
            # Log the function call
            ${debug.run} {input: "createTwoPointSelection"}
            # Set placeholder values so that they can be set to different values.
            data modify storage ${ns}:animation_data new.size set value [0.0d, 0.0d, 0.0d]
            # This function finds the most negative corner to become the anchor and the most positive corner to calculate box size. It maps through each axis.
            ${twoPointSelection}
        `}
        # If the current animation doesn't have an anchor, set the selection's dimension to the current dimension.
        execute unless data storage ${ns}:animation_data new.anchor run data modify storage ${ns}:animation_data new.dimension set from entity @p Dimension
        # If the current animation doesn't have an anchor, set the new selection position as the anchor. Item frames don't have a dimension tag, but players do, and the nearest player will be in the same dimension as the item frame.
        execute unless data storage ${ns}:animation_data new.anchor run data modify storage ${ns}:animation_data new.anchor set from entity @s Pos
        # This function places a structure block and handles with the right size parameters to highlight the selected area.
        ${displayBox}
        ${handleSummon}
        execute as @n[type=item_frame,tag=${ns}-edge] run kill @s
        kill @s
        # Save modifications made to the new selection.
        ${cleanUpNewAnimationData} with storage ${ns}:animation_data new
    `} with entity @n[type=item_frame,tag=${ns}-edge] data
    # Tag all HoverSelect boxes for deletion
    tag @e[type=interaction, tag=${ns}-hover-select] add ${ns}-hover-select-delete
    # Enter the main docile loop.
    ${mainDocileLoop}
`);

export const select = selectCommands.join('\n');
