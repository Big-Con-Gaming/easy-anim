// This file should be used for functions that have to deal with data modification and retrieval for the main namespaces.
// It's separated so that there are no reference errors
// Where data is stored:
// ${ns}:animation_data -> all data related to animations, including all frames, entities, camera, size and anchor, etc. Also contains a user's render and load queues if applicable.
// ${ns}:player_data -> all data related to the players, mainly currentanim, inventory for when they are making a selection, editor lane, etc.

// Sets up basic stuff.
import mcf from './mcf.js';
// Import functions needed here:
import * as debug from './debug.js';

const folder = mcf.data;

// Define functions you want other files to use here:
export const { grabPlayerData, grabPlayerDataFromOwner, grabAnimationData, grabPlayerAndAnimation, grabAnimationFromUuid, cleanUpNewAnimationData, cleanUpCurrentPlayerData, appendAllDataChanges } = folder;

// Define local functions here:
const { anonymous: a } = folder;

const ns = 'easy-anim';

// grabs the player's data and places it into the current namespace. Might be moved out into a player file.
// Must be ran as the player or with a UUID passed in.
grabPlayerData`
    # Log the function call
    $${debug.run} {input: "grabPlayerData for $(UUID)"}
    # Error if the player doesn't have data
    $execute unless data storage ${ns}:player_data players[{UUID:$(UUID)}] run return run ${debug.error} {input: "Player has no player_data!"}
    # Load the player's inventory from storage.
    $data modify storage ${ns}:player_data current set from storage ${ns}:player_data players[{UUID:$(UUID)}]
`

// Using the owner tag on an animation, it pulls that player's data into current.
grabPlayerDataFromOwner`
    # Log the function call
    ${debug.run} {input: "grabPlayerDataFromOwner for function currently in new"}
    # Log the expected path
    ${debug.path} {input: "-> grabPlayerData"}
    # Clear namespace in case of leftover data
    data remove storage ${ns}:temp gopd
    # Grab the owner tag from new and set it as UUID so that grabPlayerData can use it correctly (error if missing)
    execute unless data storage ${ns}:animation_data new.owner run return run ${debug.error} {input: "Animation has no owner tag!"}
    data modify storage ${ns}:temp gopd.UUID set from storage ${ns}:animation_data new.owner
    ${grabPlayerData} with storage ${ns}:temp gopd
    # Clear trailing data
    data remove storage ${ns}:temp gopd
`;

// Using currentAnim as a macro for the name of the animation, it pulls that out of animation_data into the new namespace.
grabAnimationData`
    # Log the function call
    $${debug.run} {input: "grabAnimationData for $(currentAnim)"}
    # Warn if animation data is already present in the new namespace.
    execute if data storage ${ns}:animation_data new run ${debug.warn} {input: "New contains data already, overriding..."}
    execute if data storage ${ns}:animation_data new run data remove storage ${ns}:animation_data new
    # Error if the animation requested doesn't exist.
    $execute unless data storage ${ns}:animation_data animations[{name:$(currentAnim)}].data run return run ${debug.error} {input: "Animation $(currentAnim) does not exist."}
    $data modify storage ${ns}:animation_data new set from storage ${ns}:animation_data animations[{name:$(currentAnim)}].data
    $data modify storage ${ns}:animation_data new.name set value $(currentAnim)
`;

// Calls both grabPlayerData and grabAnimationData to retrieve both player_data current and animation_data new
grabPlayerAndAnimation`
    # Log the function call
    $${debug.run} {input: "grabPlayerAndAnimation for $(UUID)"}
    # Log the path
    ${debug.path} {input: "-> grabPlayerData -> grabAnimationData"}
    # Toss player data into current with the provided UUID
    $${grabPlayerData} {UUID:$(UUID)}
    # Using the info inside of player data current, grab the animation data
    ${grabAnimationData} with storage ${ns}:player_data current
`;

// Grabs animation data from the player's UUID directly.
grabAnimationFromUuid`
    # Log the function call
    $${debug.run} {input: "grabAnimationFromUuid for $(UUID)"}
    # Log the path
    ${debug.path} {input: "-> grabAnimationData"}
    # Call grabAnimationData using currentAnim from the player data
    $${grabAnimationData} with storage ${ns}:player_data players[{UUID:$(UUID)}]
`;

// Saves changes made to the new namespace within animation_data to the actual animation's data. Must be ran with storage ${ns}:animation_data new.
cleanUpNewAnimationData`
    # Log the function call
    $${debug.run} {input: "cleanUpNewAnimationData for $(name)"}
    # Error if animation_data new does not exist.
    execute unless data storage ${ns}:animation_data new run return run ${debug.error} {input: "No data found in the new namespace."}
    data remove storage ${ns}:animation_data new.name
    $data modify storage ${ns}:animation_data animations[{name:$(name)}].data set from storage ${ns}:animation_data new
    data remove storage ${ns}:animation_data new
`

// Places all changes made to the current namespace onto the player's data
cleanUpCurrentPlayerData`
    # Log the function call
    $${debug.run} {input:"cleanUpCurrentPlayerData for $(UUID)"}
    # Error if the current namespace currently has no data
    execute unless data storage ${ns}:player_data current run return run ${debug.error} {input: "there is no data in player_data current!"}
    # Do the operation.
    $data modify storage ${ns}:player_data players[{UUID:$(UUID)}] set from storage ${ns}:player_data current
    # Remove the current data.
    data remove storage ${ns}:player_data current
`;

// Runs both cleanUpNewAnimationData and cleanUpCurrentPlayerData, saving both.
appendAllDataChanges`
    # Log the function call
    $${debug.run} {input: "appendAllDataChanges for animation $(name) and player $(owner)"}
    # Log the expected function path.
    ${debug.path} {input: "-> cleanUpNewAnimationData -> cleanUpCurrentPlayerData"}
    # Call each function with the appropriate macro
    $${cleanUpNewAnimationData} {name: $(name)}
    $${cleanUpCurrentPlayerData} {UUID: $(owner)}
`
