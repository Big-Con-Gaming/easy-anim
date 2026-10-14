// index.js
// This is the main entry point for your datapack generation.
// Import your mcf context and any functions you want to use.

import mcf from './mcf.js';
import * as debug from './debug.js';
import './data.js';
import './editor.js';
import './entity.js';
import { toolbarRightClick } from './inventory/hotbar.js';
import { handleDetection, handleHighlight } from './selection/handle.js';
import { select } from './selection.js';
import { keepHoverSelect, removeHovers } from './selection/hover.js';
import './menu.js';
import { placeParticleEveryTick, exitCamera } from './camera.js';
import { cameraLoadFrame } from './camera/frame.js';
import './camera/selection.js';
import './util.js';
import './storage.js';
import './animation.js';
import './debug.js';
import { renderCheck } from './render.js';

// Declare the functions you want to use
const { tick, load, menu, raycast } = mcf;
const raycastCommands = [];

const ns = 'easy-anim';

// These commands will run every tick.
tick`
    # Forceload the main chunk in the editor dimension so the inventory barrel at the bottom of the world is always loaded and can be used.
    execute in ${ns}:editor unless loaded 0 0 0 run forceload add 0 0
    # Forceload 3 chunks in the editor for storing and retrieving frames from storage.
    execute in ${ns}:editor run forceload add 0 -48 48 0
    # Place a block at 0 2 0 in the editor to indicate it is the first lane (needed for recursive functions and to prevent forceload from being removed)
    execute in ${ns}:editor unless block 0 2 0 minecraft:obsidian run setblock 0 2 0 minecraft:obsidian
    # Place a warning block inside of the editor so that the player knows not to trust the blocks and entities further north.
    execute in ${ns}:editor unless block 0 3 0 minecraft:pale_oak_sign run setblock 0 3 0 minecraft:pale_oak_sign{back_text:{color:"black",has_glowing_text:0b,messages:["Warning: Blocks","and entities","further North","may be modified"]},components:{},front_text:{color:"black",has_glowing_text:0b,messages:["Warning: Blocks","and entities","further North","may be modified"]},id:"minecraft:sign",is_waxed:0b,x:0,y:3,z:0} strict
    # Give players in the editor night vision in case the world is night.
    effect give @a[tag=${ns}-inEditor] minecraft:night_vision 5 0 true
    # Checks through all animations in the render_queue to update to the next frame if ready. Also decreases all of their durations.
    ${renderCheck}
    # Similar to rendercheck, cameraLoadFrame will update the player's position in the editor to the next frame accurately, while also decreasing durations.
    ${cameraLoadFrame}
    # This part handles any changes made to a selection
    ${select}
    # This part will update selections if changes were made using handles
    # This will increase right-click score if items were used on handles, so it needs to happen BEFORE right click commands are ran.
    ${handleDetection}
    # Resets all handles interactions.
    execute as @e[type=interaction, tag=${ns}-handle] if data entity @s interaction run data remove entity @s interaction
    execute as @e[type=interaction, tag=${ns}-handle] if data entity @s attack run data remove entity @s attack
    # Checks if the player has right-clicked with any of the selection items, and executes commands based on that.
    ${toolbarRightClick}
    # Manually added the editor menu item here. Opens the editor menu within the editor, and the main menu outside of it.
    execute as @a[nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick", components:{"minecraft:item_model":"minecraft:test_instance_block","minecraft:item_name":{italic:false,text:"Editor Menu"}}}}, scores={${ns}-right-click=1..}] at @s if dimension ${ns}:editor run dialog show @s ${ns}:editor_menu
    execute as @a[nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick", components:{"minecraft:item_model":"minecraft:test_instance_block","minecraft:item_name":{italic:false,text:"Editor Menu"}}}}, scores={${ns}-right-click=1..}] at @s unless dimension ${ns}:editor run dialog show @s ${ns}:main_menu
    # Resets right click detection
    execute as @a[scores={${ns}-right-click=1..}] run scoreboard players set @s ${ns}-right-click 0
    
    # Sends out a raycast from every player and executes the raycast commands.
    execute as @a at @s anchored eyes positioned ^ ^ ^ summon minecraft:interaction run ${raycast} with entity @p
    # Deletes any remaining hover blocks that are no longer looked at (detected through raycast, listed above.)
    execute as @e[type=interaction, tag=${ns}-hover-select-delete] run ${removeHovers}
    # Sets up a trigger command to access the main menu or editor menu within the editor. A tag called ${ns}-disable is preconfigured so players with this tag can't access the menu, in case of survival and creative gameplay mixtures.
    execute as @a[scores={${ns}=1..}] at @s unless dimension ${ns}:editor run dialog show @s ${ns}:main_menu
    execute as @a[scores={${ns}=1..}] at @s if dimension ${ns}:editor run dialog show @s ${ns}:editor_menu
    execute as @a[scores={${ns}=1..}] run scoreboard players reset @s ${ns}
    # Reenables the trigger command for all who are allowed to use it
    scoreboard players enable @a[tag=!${ns}-disable] ${ns}
    # Takes any camera players that moved out of camera view
    execute as @a[tag=${ns}-camera-view] if predicate ${ns}:any_input run ${exitCamera}
    # Checks if there's any highlighted cameras in the editor that need to have particles placed.
    execute as @a[tag=!${ns}-camera-view] at @s run ${placeParticleEveryTick} with entity @s
`;

// These commands run when the datapack has been loaded in.
load`
    # Import setup functions from debug.
    ${debug.debugSetup}
    # Log the function call
    ${debug.run} {input: "load"}
    # Set up the scoreboard for detecting right clicks.
    scoreboard objectives add ${ns}-right-click minecraft.used:minecraft.carrot_on_a_stick
    # Set up a trigger scoreboard for quick menu access
    scoreboard objectives add ${ns} trigger
    # Change the commandModificationBlockLimit to allow 48x48x48 volumes (Different name in 1.21.11!!!)
    gamerule commandModificationBlockLimit 110592
    # Let operators know the datapack has been loaded.
    say Easy Animations Datapack Loaded!
`;

// Opens the main menu dialog for whoever runs this command.
menu`
    # Log the function call
    ${debug.run} {input: "menu displaying dialog: ${ns}:main_menu"}
    dialog show @s ${ns}:main_menu
`;

// Executes commands that have to run for each raycast iteration (we start at the player and move out 0.25 blocks more each time, until we are 5 blocks away.)
for (let i = 0.0; i < 5.25; i += 0.25) {
    raycastCommands.push(`
        $execute at @a[nbt={UUID:$(UUID)}] positioned ~ ~1.6 ~ run tp @s ^ ^ ^${i}
        execute at @s run ${handleHighlight}
    `);
}

// These commands will run at the furthest raycast (5 blocks out from the player)
raycastCommands.push(`
    execute at @s run ${keepHoverSelect}
`)

// this is executed as an interaction entity at the player's eyes. We just gotta make sure we're facing the same direction as the player, that we have a size of 0.25, and that we kill this interaction after its use.
raycast`
    data modify entity @s Rotation set from entity @p Rotation
    data merge entity @s {width:0.25f,height:0.25f}
    ${raycastCommands.join('\n')}
    kill @s
`;
