// This file is meant for functions that take inputs from dialogs, generate dialogs for specific inputs, and act as an outside interface to many sub-systems. 

// Set up stuff
import mcf from './mcf.js';
import * as debug from './debug.js';
import { saveInventory } from './inventory.js';
import { workingHotbar } from './inventory/hotbar.js';
import { grabAnimationFromUuid } from './data.js';
import { operationOnSelectedFrames } from './animation/operate.js';
import { replaceAllInString, toLowerCase, stringConcat, testIfInt } from './util.js';
import { enterEditor } from './editor.js';
import { startRender } from './render.js';
import { noticeAnimInUse } from './error.js';
const folder = mcf.menu;
export const {
    setName, createSelection, displayAnimationsDialog, renderAnimation, moveFramesShowDialog
} = folder;
const {
    recAddAnimToList, grabOffsetAndOperate, macroDialog, editAnimationSetup, countSelected, modifyFrameDurationDialog, displayModifySelectDialog, anonymous: a
} = folder;
const ns = 'easy-anim';


// Sets up the name and base data needed for a new animation.
setName`
    # Log the entry point
    ${debug.entry} {input: "from set_name dialog"}
    # Log the function call
    $${debug.run} {input: "setName with $(name)"}
    # Log the expected function path.
    ${debug.path} {input: "-> replaceAllInString -> toLowerCase -> ^ check duplicate -> set up data -> createSelection"}
    # Remove possibly trailing data.
    data remove storage ${ns}:temp formatted
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
    # Remove all items.
    clear @s *
    # Give player our full hotbar.
    $${workingHotbar} {name:$(name)}
    # Add the owner to the newly created animation
    $data modify storage ${ns}:animation_data animations[{name:$(name)}].data.owner set from entity @s UUID
    # Specify that the new animation is currently at the anchor location
    $data modify storage ${ns}:animation_data animations[{name:$(name)}].data.location set value "anchor"
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
    # Remove possibly trailing data
    data remove storage ${ns}:temp displayanimationsdialog
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
    # Clear possibly trailing data
    scoreboard objectives remove ${ns}-dmsd
    data remove storage ${ns}:temp dmsd
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
        $dialog show @s {type:"minecraft:multi_action",title:"Modify Selection",body:{type:"minecraft:plain_message",contents:"Currently Selected (starts at 0): $(list)"},inputs:[{type:"minecraft:number_range",key:"firstselectbar",label:"Select Specific Frame",start:0,end:$(maxframe),step:1,initial:0},{type:"minecraft:text",key:"firstselecttext",label:"Or, type it here (nums only!):"},{type:"minecraft:number_range",key:"secondselectbar",label:"Range Select",start:0,end:$(maxframe),step:1,initial:0},{type:"minecraft:text",key:"secondselecttext",label:"Or, type it here (nums only!):"}],can_close_with_escape:1,after_action:"close",exit_action:{label:"⬅ Return to Editor Menu",action:{type:"minecraft:show_dialog",dialog:"${ns}:editor_menu"}},actions:[{label:"🎯 Toggle Specified Frame",tooltip:"Chooses the frame specified in the top slider or text box.",action:{type:"minecraft:dynamic/run_command",template:"function ${ns}:animation/selecting/parse_toggle_single_select_frame {$(UUID), $(firstselect)}"}},{label:"↔ Toggle Range of Frames",tooltip:"Chooses all frames in between the two specified in the sliders or text boxes above.",action:{type:"minecraft:dynamic/run_command",template:"function ${ns}:animation/selecting/parse_toggle_range_select_frame {$(UUID), $(firstselect), $(secondselect)}"}},{label:"📥 Toggle Current Frame",tooltip:"Toggles the selection state of the frame you are physically standing in.",action:{type:"minecraft:run_command",command:"function ${ns}:animation/selecting/select_in_player_frame with entity @s"}},{label:"☯ Invert Selection",tooltip:"All currently selected are deselected, all non-selected frames are now selected.",action:{type:"minecraft:run_command",command:"function ${ns}:animation/selecting/toggle_all_select_frame with entity @s"}},{label:"✔ Select All Frames",action:{type:"minecraft:run_command",command:"function ${ns}:animation/selecting/select_all_frames {$(UUID), select: 1}"}},{label:"❌ Deselect All Frames",action:{type:"minecraft:run_command",command:"function ${ns}:animation/selecting/select_all_frames {$(UUID), select: -1}"}}]}
    `} with storage ${ns}:temp dmsd
    # Clear trailing data
    data remove storage ${ns}:animation_data new
    scoreboard objectives remove ${ns}-dmsd
    data remove storage ${ns}:temp dmsd
`;

// Asks the user for an offset to move all selected frames by.
moveFramesShowDialog`
    # Log the entry point
    ${debug.entry} {input: "from editor_menu dialog"}
    # Log the function call
    ${debug.run} {input: "moveFramesShowDialog"}
    # Log the expected path
    ${debug.path} {input: "-> grabAnimationFromUuid -> ^ no selection -> operationOnSelectedFrames -> show Move Selected Frames dialog"}
    # Grab animation data (just for the check below)
    ${grabAnimationFromUuid} with entity @s
    # If no frames are selected, error and exit. Warn the player in the process.
    execute unless data storage ${ns}:animation_data new.frames[].selected run return run ${a`
        # Remove leftover data in new, which was opened just to check if any frames were selected.
        data remove storage ${ns}:animation_data new
        # Log error
        ${debug.error} {input: "No frames are selected!"}
        # Warn the user that they must select frames first.
        tellraw @s {text: "Please select some frames first!", color:red}
    `}
    # Clean up possibly trailing data
    data remove storage ${ns}:temp csfbounds
    # Execute operationOnSelectedFrames with the calcBounds operation.
    ${operationOnSelectedFrames} {mode: "calcBounds"}
    # Create an offset macro key insert in storage for the dialog to use.
    data modify storage ${ns}:temp csfbounds.offsetinsert set value "$(offset)"
    # Using the bounds, generate and show the dialog to the user.
    ${a`
        $dialog show @s {type:"minecraft:multi_action",title:"Move Selected Frames",inputs:[{type:"minecraft:number_range",key:"offset",label:"Offset",start:-$(lower),end:$(upper),step:1,initial:0}],exit_action:{label:"Cancel"},actions:[{label:"Move Frames",tooltip:"Takes each frame's # and applies the offset to move them that amount within the animation. + is later, - is earlier.",action:{type:"minecraft:dynamic/run_command",template:"function easy-anim:menu/grab_offset_and_operate {offset: $(offsetinsert)}"}}]}
    `} with storage ${ns}:temp csfbounds
    # Clean up trailing data
    data remove storage ${ns}:temp csfbounds
`

// Tosses the given offset into carryover and calls operationOnSelectedFrames with the move operation.
grabOffsetAndOperate`
    # Log the function call
    $${debug.run} {input: "grabOffsetAndOperate with offset $(offset)"}
    # remove possibly trailing data
    scoreboard objectives remove ${ns}-gao
    # Create a scoreboard to test offset's sign
    scoreboard objectives add ${ns}-gao dummy
    # Store this offset into carryover for operationOnSelectedFrames to use.
    $data modify storage ${ns}:temp carryover.offset set value $(offset)
    execute store result score offset ${ns}-gao run data get storage ${ns}:temp carryover.offset
    # If offset is zero, we exit since you can't move a frame to itself...
    execute if score offset ${ns}-gao matches 0 run return run ${a`
        tellraw @s {text: "You can't move a frame to it's own location! Try an offset that isn't zero!", color: "red"}
        ${debug.error} {input: "User inputted an offset of 0 from move_frames dialog, exiting..."}
        data remove storage ${ns}:temp carryover.offset
        scoreboard objectives remove ${ns}-gao
    `}
    # Check if this value is negative, and if so, trigger a flag so that operationOnSelectedFrames can run in ascending order instead of descending order.
    execute if score offset ${ns}-gao matches ..-1 run data modify storage ${ns}:temp selectedframes.reverseCount set value true
    # Execute operationOnSelectedFrames with the move operation.
    ${operationOnSelectedFrames} {mode: "move"}
    # remove the scoreboard
    scoreboard objectives remove ${ns}-gao
`

// Checks the output from the duration dialog and stores the correct duration into storage.
modifyFrameDurationDialog`
    # Log the entry point
    ${debug.entry} {input: "from: frame_duration dialog"}
    # Log the function call
    $${debug.run} {input: "modifyFrameDurationDialog setting to either $(slider) or $(text) if valid"}
    # Log the expected function path.
    ${debug.path} {input: "-> | testIfInt -> operationOnSelectedFrames"}
    # Cleanup possibly trailing data
    scoreboard objectives remove ${ns}-mfdd
    data remove storage ${ns}:temp carryover
    # Create temporary scoreboard
    scoreboard objectives add ${ns}-mfdd dummy
    # Set a player within the objective to the value of the text input. If the text input is empty or invalid, it will be set to 0.
    $execute store result score check ${ns}-mfdd run ${testIfInt} {input: '$(text)'}
    # If score is 0, use slider to set duration
    $execute if score check ${ns}-mfdd matches 0 run data modify storage ${ns}:temp carryover.duration set value $(slider)
    # If score is 1, use text to set duration
    $execute if score check ${ns}-mfdd matches 1 run data modify storage ${ns}:temp carryover.duration set value '$(text)'
    # Run operationOnSelectedFrames with the given carryover data setting frame duration
    ${operationOnSelectedFrames} {mode: "duration"}
    # Clear carryover data / trailing data
    data remove storage ${ns}:temp carryover
    scoreboard objectives remove ${ns}-mfdd
`;
