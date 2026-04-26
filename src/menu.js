// Set up stuff
import mcf from './mcf.js';
import * as debug from './debug.js';
import { saveInventory, workingHotbar, calculateLaneX } from './inventory.js';
import { grabStrBlockPos, cleanUpNewAnimationData, handleSummon, regroupEntities, removeDocile, grabAnimationFromUuid, recGroupSearch } from './selection.js';
import { allocAnimation, storeFrame } from './storage.js';
import { replaceAllInString, toLowerCase, stringConcat } from './util.js';
import { enterEditor } from './animation.js';
import { startRender } from './render.js';
const folder = mcf.menu;
export const { setName, createSelection, createAnimation, saveStructure, displayAnimationsDialog, deleteAnimation, renderAnimation, displayModifySelectDialog } = folder;
const { noticeAnimInUse, recAddAnimToList, macroDialog, editAnimationSetup, recRemoveFrameData, macroRemoveAnimationStorage, countSelected, anonymous: a } = folder;
const ns = 'easy-anim';


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
    data modify storage ${ns}:temp str.name set from storage ${ns}:animation_data new.name
    # Warn if the animation currently has framecount or frames.
    execute if data storage ${ns}:animation_data new.framecount run ${debug.warn} {input: "Animation has framecount! Overwriting..."}
    execute if data storage ${ns}:animation_data new.frames run ${debug.warn} {input: "Animation has frame data! Overwriting..."}
    # Insert frame 0 data into the new animation. Take all data from the base selection.
    data modify storage ${ns}:animation_data new.framecount set value 1
    data modify storage ${ns}:animation_data new.frames set value []
    data modify storage ${ns}:animation_data new.frames append value {}
    data modify storage ${ns}:animation_data new.frames[0].duration set value 20
    data modify storage ${ns}:animation_data new.frames[0].camera set from storage ${ns}:animation_data new.camera
    data modify storage ${ns}:animation_data new.frames[0].anchor set from storage ${ns}:animation_data new.anchor
    data modify storage ${ns}:animation_data new.frames[0].size set from storage ${ns}:animation_data new.size
    ${saveStructure`
        # Log the function call
        $${debug.run} {input: "saveStructure at $(x) $(y) $(z) within $(sx) $(sy) $(sz) for $(name)"}
        # Warn if we're replacing a non-air block
        $execute in ${ns}:editor unless block $(lanex) 3 0 minecraft:air run ${debug.warn} {input: "Non-air block in editor at $(lanex) 3 0! Replacing..."}
        $execute positioned $(x) $(y) $(z) run clone ~ ~1 ~ ~ ~1 ~ to ${ns}:editor $(lanex) 3 0 strict
        # Warn if no interactions or handles are present.
        $execute positioned $(x) $(y) $(z) unless entity @n[type=minecraft:interaction,tag=${ns}-select-str-block,distance=..1] run ${debug.warn} {input:"No interaction blocking the structure block! Skipping removal..."}
        $execute positioned $(x) $(y) $(z) unless entity @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)] run ${debug.warn} {input:"No handles on the selection! Skipping removal..."}
        $execute positioned $(x) $(y) $(z) run kill @n[type=minecraft:interaction,tag=${ns}-select-str-block,distance=..1]
        $execute positioned $(x) $(y) $(z) run kill @e[tag=${ns}-handle,dx=$(sx),dy=$(sy),dz=$(sz)]
        # Ungroup any grouped entities and tag them so they can find each other.
        execute store result storage ${ns}:temp str.id int 1 run scoreboard players set groupid ${ns}-temp 0
        $execute positioned $(x) $(y) $(z) run ${recGroupSearch} with storage ${ns}:temp str
        # Using the macro, make sure all of the entities within the selection are no longer considered docile
        ${a`
            # Log the function call
            ${debug.run} {input: "removing docile tags within selection"}
            # Warn if no entities are found.
            $execute positioned $(x) $(y) $(z) if entity @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-entity-turned-docile] run ${debug.warn} {input: "No docile entities found! Skipping..."}
            $execute positioned $(x) $(y) $(z) as @e[type=!player,dx=$(sx),dy=$(sy),dz=$(sz),tag=${ns}-entity-turned-docile] run ${removeDocile}
        `} with storage ${ns}:temp str
        $execute positioned $(x) $(y) $(z) run setblock ~ ~1 ~ minecraft:redstone_block
        $execute positioned $(x) $(y) $(z) run setblock ~ ~1 ~ minecraft:air
        $data modify block $(x) $(y) $(z) name set value "${ns}:$(name)-frame0"
        $execute positioned $(x) $(y) $(z) run setblock ~ ~1 ~ minecraft:redstone_block
        $data modify block $(x) $(y) $(z) name set value "${ns}:$(name)-base"
        # Allocate a lane in storage for this new animation, and place base and frame 0 in there.
        # Warn if animation_data already has a storageid
        execute if data storage ${ns}:animation_data new.storageid run ${debug.warn} {input: "Animation already has a storage lane! Skipping assignment..."}
        execute unless data storage ${ns}:animation_data new.storageid run ${allocAnimation}
        $${storeFrame} {name: $(name), framenum: "base"}
        $${storeFrame} {name: $(name), framenum: 0}
        # Regroup any grouped entities and remove their redundant tags + data. Must be separated so data that is needed to find each other isn't erased yet.
        $execute positioned $(x) $(y) $(z) positioned ~1 ~1 ~1 run ${regroupEntities} with storage ${ns}:temp str
        $execute positioned $(x) $(y) $(z) run clone from ${ns}:editor $(lanex) 3 0 $(lanex) 3 0 ~ ~1 ~ strict
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

// If a dialog option needs to select an animation to perform, this function will handle that by generating a dialog with every animation as a button.
displayAnimationsDialog`
    # Log the entry point
    ${debug.entry} {input:"from: main_menu dialog"}
    # Log the function call
    $${debug.run} {input:"displayAnimationsDialog afterwards running: $(func)"}
    # Log the exepected function path
    ${debug.path} {input:"-> recAddAnimToList (stringConcat) -> macroDialog"}
    # Error if not executing from a player.
    execute unless entity @s[type=player] run return run ${debug.error} {input:"Command must run from the context of a player!"}
    # If there are no animations available, warn, let the player know and return.
    execute unless data storage ${ns}:animation_data animations[0] run ${debug.warn} {input:"No animations exist! Letting player know and exiting..."}
    execute unless data storage ${ns}:animation_data animations[0] run return run tellraw @s {text:"There are no existing animations! Create one first.", color:"red"}
    # Grab the animations list in a temporary storage location.
    data modify storage ${ns}:temp displayanimationsdialog.list set from storage ${ns}:animation_data animations
    # Set up a temporary storage location to hold all of the button creating dialogs
    data modify storage ${ns}:temp displayanimationsdialog.dialogs set value ""
    # Bring the function macro into the data of the animation.
    $data modify storage ${ns}:temp displayanimationsdialog.list[0].func set value "$(func)"
    # Bring the player's UUID into the data of the animation.
    data modify storage ${ns}:temp displayanimationsdialog.list[0].UUID set from entity @s UUID
    # loop through this entire list
    ${recAddAnimToList`
        # Log function call
        $${debug.run} {input:"Generating dialog for anim $(name)"}
        # Store the new button dialog in a temporary location.
        $data modify storage ${ns}:temp displayanimationsdialog.current set value ', {"label": "$(name)","action": {"type": "minecraft:run_command","command": "function $(func) {anim:$(name), UUID:$(UUID)}"}}'
        # Concat it to the list of the other buttons.
        ${stringConcat} {output:"${ns}:temp displayanimationsdialog.dialogs", front:"${ns}:temp displayanimationsdialog.dialogs", back:"${ns}:temp displayanimationsdialog.current"}
        # Remove this animation from the temp list
        data remove storage ${ns}:temp displayanimationsdialog.list[0]
        # Return early if no more exist in the list.
        execute unless data storage ${ns}:temp displayanimationsdialog.list[0] run return 1
        # Bring the func and UUID macro to this new animation
        $data modify storage ${ns}:temp displayanimationsdialog.list[0].func set value "$(func)"
        $data modify storage ${ns}:temp displayanimationsdialog.list[0].UUID set value "$(UUID)"
        # Run this function with the same context.
        ${recAddAnimToList} with storage ${ns}:temp displayanimationsdialog.list[0]
    `} with storage ${ns}:temp displayanimationsdialog.list[0]
    # Trim the first 2 characters from the dialogs (it's an extra comma and space)
    data modify storage ${ns}:temp displayanimationsdialog.dialogs set string storage ${ns}:temp displayanimationsdialog.dialogs 2
    # Display this dialog with each button running the macroed function
    ${macroDialog`
        # Log the function call
        $${debug.run} {input:'calling dialog menu with $(dialogs)'}
        $dialog show @s {"type": "minecraft:multi_action","title": "Select Animation","actions": [$(dialogs)]}
    `} with storage ${ns}:temp displayanimationsdialog
    # Remove temporary data
    data remove storage ${ns}:temp displayanimationsdialog
`;

// Logs and tells the player that the animation is in use elsewhere
noticeAnimInUse`
    ${debug.error} {input: "Animation is currently in use!"}
    tellraw @s {text: "Animation is currently in use!", color: "red"}
`

// Runs when selecting an animation to edit. Must receive macro anim and UUID which contains the name of the animation we want to edit and the UUID of the executing player.
editAnimationSetup`
    # Log the entry point
    ${debug.entry} {input:"from: displayAnimationsDialog specified execution from main_menu dialog"}
    # Log the function call
    $${debug.run} {input:"editAnimationSetup for $(UUID) editing $(anim)"}
    # Log the expected function path
    ${debug.path} {input: "-> enterEditor"}
    # Error if the player already has a currentAnim
    $execute if data storage ${ns}:player_data players[{UUID:$(UUID)}].currentAnim run return run ${debug.error} {input:"Player already has a currentAnim!"}
    # If the animation is being displayed elsewhere (location != none), then return and tell the player.
    $execute unless data storage ${ns}:animation_data animations[{name:$(anim),data:{location:"none"}}] run return run ${noticeAnimInUse}
    # Set this animation's name to the player's currentAnim
    $data modify storage ${ns}:player_data players[{UUID:$(UUID)}].currentAnim set value $(anim)
    # Execute enterEditor with the player as the macro context.
    ${enterEditor} with entity @s
`;

// Deletes all of the data related to a specific animation. Requires macro of anim for the name of the animation.
deleteAnimation`
    # Log the entry point
    ${debug.entry} {input:"from: displayAnimationsDialog specified execution from main_menu dialog"}
    # Log the function call
    $${debug.run} {input:"deleteAnimation for $(anim)"}
    # Log the expected function path
    ${debug.path} {input: "-> macroRemoveAnimationStorage -> recRemoveFrameData"}
    # If the animation doesn't exist, error
    $execute unless data storage ${ns}:animation_data animations[{name:$(anim)}].data run return run ${debug.error} {input: "$(anim) doesn't exist!"}
    # If the animation is being displayed somewhere (location != none), then return and tell the player.
    $execute unless data storage ${ns}:animation_data animations[{name:$(anim),data:{location:"none"}}] run return run ${noticeAnimInUse}
    # Possible extension of function: If location is editor, run exit editor on owner. (In multiplayer, permission check?)
    # Clear all of the frames from storage (removeFrame works on a one frame at a time basis)
    # Warn if the animation has no frames
    $execute unless data storage ${ns}:animation_data animations[{name:$(anim)}].data.frames run ${debug.warn} {input: "Animation has no frames! Skipping deletion..."}
    # Grab all frames into a temporary location to iterate through.
    $data modify storage ${ns}:temp deleteAnimation.frames set from storage ${ns}:animation_data animations[{name:$(anim)}].data.frames
    # Grab the animation's storage lane X
    $execute store result storage ${ns}:temp deleteAnimation.x int 48 run data get storage ${ns}:animation_data animations[{name:$(anim)}].data.storageid
    # Execute the loop setup command as a macro to use the lane x value (trying to avoid repetitive macros)
    execute in ${ns}:storage run ${macroRemoveAnimationStorage`
        # Log the function call
        $${debug.run} {input: "macroRemoveAnimationStorage at x: $(x)"}
        # Clear the storage's lane
        $execute if data storage ${ns}:temp deleteAnimation.frames[0] positioned $(x) 0 0 run ${recRemoveFrameData`
            # Log the function call
            ${debug.run} {input: "recRemoveFrameData"}
            # Forceload the entire frame
            forceload add ~ ~ ~47 ~47
            # Fill the frame with air
            fill ~ ~ ~ ~47 ~47 ~47 minecraft:air
            # Unforceload the entire frame
            forceload remove ~ ~ ~47 ~47
            # Remove the frame from temp storage
            data remove storage ${ns}:temp deleteAnimation.frames[0]
            # If there's still a frame, execute at the next frame's location another fill command.
            execute if data storage ${ns}:temp deleteAnimation.frames[0] positioned ~ ~ ~48 run ${recRemoveFrameData}
        `}
        # Remove the base frame
        # Forceload the entire frame + the lane block
        $execute positioned $(x) 0 -48 run forceload add ~ ~ ~47 ~48
        # Fill the frame with air
        $execute positioned $(x) 0 -48 run fill ~ ~ ~ ~47 ~47 ~47 minecraft:air
        # Remove the bedrock block denoting the frame.
        # Warn if this block isn't bedrock
        $execute unless block $(x) 50 0 minecraft:bedrock run ${debug.warn} {input: "Expected bedrock to denote storage lane at $(x) 50 0! Replacing with air..."}
        $setblock $(x) 50 0 minecraft:air
        # Unforceload the entire frame
        $execute positioned $(x) 0 -48 run forceload remove ~ ~ ~47 ~48
    `} with storage ${ns}:temp deleteAnimation
    # Remove the data from storage
    $data remove storage ${ns}:animation_data animations[{name:$(anim)}]
    # Possible check for error/warn: Someone has this as currentAnim, must be removed (and the rest of their data)
    $execute if data storage ${ns}:player_data players[{currentAnim:$(anim)}] run ${debug.warn} {input: "Players have this animation as their currentAnim! Removing..."}
    $data remove storage ${ns}:player_data players[{currentAnim:$(anim)}]
    # Tell the player the operation was successful.
    $tellraw @s {text:"$(anim) has been successfully deleted.", color: "green"}
    # Remove temporary placeholder data
    data remove storage ${ns}:temp deleteAnimation
`;

// Sets up the data required to begin a render of a specified animation.
renderAnimation`
    # Log the entry point
    ${debug.entry} {input:"from: displayAnimationsDialog specified execution from main_menu dialog"}
    # Log the function call
    $${debug.run} {input:"renderAnimation for $(anim) with $(UUID)"}
    # Log the expected function path
    ${debug.path} {input: "-> startRender"}
    # If the animation doesn't exist, error
    $execute unless data storage ${ns}:animation_data animations[{name:$(anim)}].data run return run ${debug.error} {input: "$(anim) doesn't exist!"}
    # If the animation is being displayed somewhere (location != none), then return and tell the player.
    $execute unless data storage ${ns}:animation_data animations[{name:$(anim),data:{location:"none"}}] run return run ${noticeAnimInUse}
    # Set this player's currentAnim to this animation
    $data modify storage ${ns}:player_data players[{UUID: $(UUID)}].currentAnim set value $(anim)
    # Call startRender
    ${startRender}
`;

// Creates the modify selection dialog to display to the player running the command. Must be constructed so that frame counts are used within the sliders and such.
displayModifySelectDialog`
    # Log the entry point
    ${debug.entry} {input: "from: editor_menu dialog"}
    # Log the function call.
    ${debug.run} {input: "displayModifySelectDialog"}
    # Log the expected function path.
    ${debug.path} {input: "-> (countSelected -> | appending to end)"}
    # Grab animation data
    ${grabAnimationFromUuid} with entity @s
    # Create a temporary scoreboard
    scoreboard objectives add ${ns}-dmsd dummy
    # Grab the framecount and store it as a score.
    execute store result score max ${ns}-dmsd run data get storage ${ns}:animation_data new.framecount
    # Grab the maxframeindex by decreasing max by 1
    execute store result storage ${ns}:temp dmsd.maxframe int 1 run scoreboard players remove max ${ns}-dmsd 1
    # Set min to 0 so we iterate over every frame, setting framenum in the process.
    execute store result storage ${ns}:temp dmsd.framenum int 1 run scoreboard players set min ${ns}-dmsd 0
    ${countSelected`
        # Log the function call
        $${debug.run} {input: "countSelected with $(framenum)"}
        # Test if this frame is selected
        $execute store result score selected ${ns}-dmsd run data get storage ${ns}:animation_data new.frames[$(framenum)].selected
        # If so, append it to our frame selection list. (If it's not the first one in the list, append ", " first.)
        execute if score selected ${ns}-dmsd matches 1 if data storage ${ns}:temp dmsd.list run ${a`
            # Separated since both commands need the precondition specified above.
            ${debug.run} {input: "appending to end"}
            $data modify storage ${ns}:temp dmsd.merge set value ", $(framenum)"
            ${stringConcat} {front: "${ns}:temp dmsd.list", back: "${ns}:temp dmsd.merge", output: "${ns}:temp dmsd.list"}
        `} with storage ${ns}:temp dmsd
        $execute if score selected ${ns}-dmsd matches 1 unless data storage ${ns}:temp dmsd.list run data modify storage ${ns}:temp dmsd.list set value "$(framenum)"
        # Increment framenum
        execute store result storage ${ns}:temp dmsd.framenum int 1 run scoreboard players add min ${ns}-dmsd 1
        # Recursively call only if we haven't reached max yet
        execute if score min ${ns}-dmsd <= max ${ns}-dmsd run ${countSelected} with storage ${ns}:temp dmsd
    `} with storage ${ns}:temp dmsd
    # If the list is empty (none selected), change the list to just be "none"
    execute unless data storage ${ns}:temp dmsd.list run data modify storage ${ns}:temp dmsd.list set value "none"
    # Set up any "double nested" macros (macro inserting macro references for the command-end, very weird I know.)
    ${a`
        $data modify storage ${ns}:temp dmsd.UUID set value "UUID: $(UUID)"
    `} with entity @s
    data modify storage ${ns}:temp dmsd.firstselect set value 'firstselectbar: $(firstselectbar), firstselecttext: \\\\\"$(firstselecttext)\\\\\"'
    data modify storage ${ns}:temp dmsd.secondselect set value 'secondselectbar: $(secondselectbar), secondselecttext: \\\\\"$(secondselecttext)\\\\\"'
    # Create and show the dialog to the player.
    ${a`
        $dialog show @s {type:"minecraft:multi_action",title:"Modify Selection",body:{type:"minecraft:plain_message",contents:"Currently Selected (starts at 0): $(list)"},inputs:[{type:"minecraft:number_range",key:"firstselectbar",label:"Select Specific Frame",start:0,end:$(maxframe),step:1,initial:0},{type:"minecraft:text",key:"firstselecttext",label:"Or, type it here (nums only!):"},{type:"minecraft:number_range",key:"secondselectbar",label:"Range Select",start:0,end:$(maxframe),step:1,initial:0},{type:"minecraft:text",key:"secondselecttext",label:"Or, type it here (nums only!):"}],can_close_with_escape:1,after_action:"close",exit_action:{label:"Return to menu",action:{type:"minecraft:show_dialog",dialog:"${ns}:editor_menu"}},actions:[{label:"Toggle Specified Frame",tooltip:"Chooses the frame specified in the top slider or text box.",action:{type:"minecraft:dynamic/run_command",template:"function ${ns}:animation/parse_toggle_single_select_frame {$(UUID), $(firstselect)}"}},{label:"Toggle Range of Frames",tooltip:"Chooses all frames in between the two specified in the sliders or text boxes above.",action:{type:"minecraft:dynamic/run_command",template:"function ${ns}:animation/parse_toggle_range_select_frame {$(UUID), $(firstselect), $(secondselect)}"}},{label:"Toggle Current Frame",tooltip:"Toggles the selection state of the frame you are physically standing in.",action:{type:"minecraft:run_command",command:"function ${ns}:animation/select_in_player_frame with entity @s"}},{label:"Invert Selection",tooltip:"All currently selected are deselected, all non-selected frames are now selected.",action:{type:"minecraft:run_command",command:"function ${ns}:animation/toggle_all_select_frame with entity @s"}},{label:"Select All Frames",action:{type:"minecraft:run_command",command:"function ${ns}:animation/select_all_frames {$(UUID), select: 1}"}},{label:"Deselect All Frames",action:{type:"minecraft:run_command",command:"function ${ns}:animation/select_all_frames {$(UUID), select: -1}"}}]}
    `} with storage ${ns}:temp dmsd
    # Clear trailing data
    data remove storage ${ns}:animation_data new
    scoreboard objectives remove ${ns}-dmsd
    data remove storage ${ns}:temp dmsd
`;