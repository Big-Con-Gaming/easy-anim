// Sets up basic things.
import mcf from './mcf.js';
import * as debug from './debug.js';

import { exitRender } from './render.js';

const folder = mcf.camera;

export const {
    placeParticleEveryTick, exitCamera, cameraDisplayParticles
} = folder;
const {
    anonymous: a
} = folder;
const ns = 'easy-anim';

// When the player moves from being in a camera, it brings them back to creative and removes their tag.
exitCamera`
    # Log the function call
    ${debug.run} {input: "exitCamera"}
    gamemode creative @s
    # Warn if the tag is already missing.
    execute unless entity @s[tag=${ns}-camera-view] run ${debug.warn} {input: "Player is missing ${ns}-camera-view tag! Skipping..."}
    tag @s[tag=${ns}-camera-view] remove ${ns}-camera-view
    # Check if the player is within a render, and if so, exit the render. Same if they are in a load queue.
    ${a`
        $execute if data storage ${ns}:animation_data render_queue[{player: $(UUID)}] run ${exitRender} with storage ${ns}:animation_data render_queue[{player: $(UUID)}]
        $execute if data storage ${ns}:animation_data load_queue[{UUID: $(UUID)}] run ${a`
            $scoreboard players reset #$(name)_load_duration
            $data remove storage ${ns}:animation_data load_queue[{UUID: $(UUID)}]  
        `} with storage ${ns}:animation_data load_queue[{UUID: $(UUID)}]
    `} with entity @s
`;

cameraDisplayParticles`
    # Log the function call - except this will be running every tick in the editor dimension.
    # ${debug.run} {input: "cameraDisplayParticles"}
    particle minecraft:dust{scale:1,color:[1d,0d,0d]} ^ ^ ^0.5 0 0 0 0.01 0 force @a
    particle minecraft:dust{scale:1,color:[0.75d,0d,0.25d]} ^ ^ ^1 0 0 0 0.01 0 force @a
    particle minecraft:dust{scale:1,color:[0.5d,0d,0.5d]} ^ ^ ^1.5 0 0 0 0.01 0 force @a
    particle minecraft:dust{scale:1,color:[0.25d,0d,0.75d]} ^ ^ ^2 0 0 0 0.01 0 force @a
    particle minecraft:dust{scale:1,color:[0d,0d,1d]} ^ ^ ^2.5 0 0 0 0.01 0 force @a
`

placeParticleEveryTick`
    $execute at @e[type=minecraft:item_display,tag=${ns}-camera-highlight,nbt={data:{owner:$(UUID)}}] run ${cameraDisplayParticles}
`;
