// Contains functions that deal with generating the display for a selection.

// Sets up basic stuff.
import mcf from '../mcf.js';
// Import functions needed here:
import * as debug from '../debug.js';
import { grabStrBlockPos } from './data.js';
import { calculateLaneX } from '../editor/lane.js';
const folder = mcf.selection.display;

// Define functions you want other files to use here:
export const {
    displayBox
} = folder;

// Define local functions here:
const {
    anonymous: a, placeStructureBlock
} = folder;

const ns = 'easy-anim';

// Commands that sets up the selection box when someone changes the selection region.
const displayBoxCommands = [];

// Sets up the display box commands before the axis-specifc commands are compiled.
displayBoxCommands.push(`
    # Log the function call
    ${debug.run} {input: "displayBox"}
    # Log the expected function path.
    ${debug.path} {input: "-> grabStrBlockPos -> calculateLaneX -> placeStructureBlock -> handleSummon"}
    # Error if name is missing from animation_data new.
    execute unless data storage ${ns}:animation_data new.name run return run ${debug.error} {input: "No name found within animation_data new!"}
    # Remove possibly trailing data.
    data remove storage ${ns}:temp str
    # Save the block at the neg neg neg corner (outside of region) to the editor dimension and place in a new structure block
    ${grabStrBlockPos}
    ${calculateLaneX} {output:"${ns}:temp str.lanex int"}
    data modify storage ${ns}:temp str.name set from storage ${ns}:animation_data new.name
    ${placeStructureBlock`
        # Log the function call
        $${debug.run} {input: "placeStructureBlock at $(x) $(y) $(z) with size $(sx) $(sy) $(sz) for $(name), storing original block at $(lanex) 0 0"}
        $clone $(x) $(y) $(z) $(x) $(y) $(z) to ${ns}:editor $(lanex) 0 0 strict
        $setblock $(x) $(y) $(z) minecraft:structure_block{mode:"SAVE",showboundingbox:true,posX:1,posY:1,posZ:1,sizeX:$(sx),sizeY:$(sy),sizeZ:$(sz),ignoreEntities:false,name:"${ns}:$(name)-base",strict:true}
        $summon minecraft:interaction $(x) $(y) $(z) {width:1.01f,height:1.01f,Tags:["${ns}-select-str-block"]}
    `} with storage ${ns}:temp str
    # Remove the temporary data location.
    data remove storage ${ns}:temp str
`);

displayBox`${displayBoxCommands.join('\n')}`;
