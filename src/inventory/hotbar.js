// Contains the camera functions intended to be used on frames within the editor dimension.
// Separated to remove a circular reference call between camera.js and animation.js

// Sets up basic stuff.
import mcf from '../mcf.js';
// Import functions needed here:
import * as debug from '../debug.js';
import { cameraSave, cameraLoad, cameraHighlight, cameraRemoveHighlight } from '../camera/selection.js';
import { exitSelection } from '../selection.js';
import { createAnimation } from '../animation.js';
import { placeGhost, removeHovers } from '../selection/hover.js';

const folder = mcf.camera.frame;

// Define functions you want other files to use here:
export const {
    workingHotbar, toolbarRightClick
} = folder;

// Define local functions here:
const {
    anonymous: a
} = folder;

const ns = 'easy-anim';

const workingHotbarCommands = [];
const rightClickCommands = [];

// Specify the hotbar tools with their display item, name, slot within the hotbar, and the function that is ran on right click.
const hotbarTools = [
    {display:`minecraft:structure_void`, name:"Select", slot:0, placeable:true, entity_data:`{id:"minecraft:item_frame",Invisible:1b,Tags:["${ns}-edge"],data:{currentAnim:$(name)}}`, on_hover:`anchored eyes positioned ^ ^ ^5 if block ~ ~ ~ minecraft:air run ${placeGhost}`, on_not_hover:`as @e[type=interaction,tag=${ns}-hover-select] run ${removeHovers}`},
    {display:`minecraft:dispenser`, name:"Set Camera", slot:1, action:`${cameraSave} with entity @s`},
    {display:`minecraft:observer`, name:"Load Camera", slot:2, action:`${cameraLoad} with entity @s`, on_hover:`run ${cameraHighlight} with entity @s`, on_not_hover:`unless entity @s[tag=${ns}-inEditor] run ${cameraRemoveHighlight} with entity @s`},
    {display:`minecraft:paper`, name:"Create Animation", slot:7, action:`${createAnimation} with entity @s`},
    {display:`minecraft:barrier`, name:"Exit", slot:8, action: `${exitSelection} with entity @s`, dimension: `${ns}:editor`}
];

// Sets up each item in the hotbar.
function createHotbarCommands({slot, name, display, action, dimension, placeable, entity_data, on_hover, on_not_hover}) {
    // Sets up right click detection to execute functions defined in the action field.
    
    // Assume the item ID is a carrot on a stick, but if the item is placeable, change it to an item frame. If an item frame, do not run right click detection.
    let itemId = "minecraft:carrot_on_a_stick";
    if (placeable) {
        itemId = "minecraft:item_frame";
    } else {
        // This command sets up the right click action for the item, but it's executed in tick back in index.js. If a dimension is specified, the command is executed in that dimension.
        if (dimension != null) {
            rightClickCommands.push(`
                execute in ${dimension} as @a[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}, scores={${ns}-right-click=1..}] run ${action}
            `);
        } else {
            rightClickCommands.push(`
                execute as @a[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}, scores={${ns}-right-click=1..}] at @s run ${action}
            `);
        }
    }

    // Throws specified commands into the rightClick section of commands but only executes if the item is selected, not right clicked.
    if (on_hover != null) {
        rightClickCommands.push(`
            execute as @a[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}] at @s ${on_hover}
        `);
    }
    if (on_not_hover != null) {
        rightClickCommands.push(`
            execute as @a unless entity @s[nbt={SelectedItem:{id:"${itemId}", components:{"minecraft:item_model":"${display}","minecraft:item_name":"${name}"}}}] ${on_not_hover}
        `);
    }
    // This command places the item in the player's hotbar.
    // Creating a warn item that will be added to the start of every item replace command in case it is overwriting data.
    var itemReplaceWarn = `execute if items entity @s hotbar.${slot} * run ${debug.warn} {input:"hotbar.${slot} contains an item! Replacing..."}`;
    if (entity_data != null) {
        if (entity_data.includes("$(")) {
            return `
                ${itemReplaceWarn}
                $item replace entity @s hotbar.${slot} with ${itemId}[item_model="${display}",item_name={text:"${name}"}, entity_data=${entity_data}]
            `;
        } else {
            return `
                ${itemReplaceWarn}
                item replace entity @s hotbar.${slot} with ${itemId}[item_model="${display}",item_name={text:"${name}"}, entity_data=${entity_data}]
            `;
        }
        
    } else {
        return `
            ${itemReplaceWarn}
            item replace entity @s hotbar.${slot} with ${itemId}[item_model="${display}",item_name={text:"${name}"}]
        `;
    }
}
workingHotbarCommands.push(`
    # Log the function call
    ${debug.run} {input: "workingHotbar"}
`);
// Loop through each hotbar tool and create the commands for it.

workingHotbarCommands.push(...hotbarTools.map(createHotbarCommands));

workingHotbar(workingHotbarCommands.join('\n'));

// All right click detections were declared above but will run in index.js and the tick function.

toolbarRightClick(rightClickCommands.join('\n'));
