// This is meant to store common error messages. The goal is that these would error to the user, log to the debug console,
// and clean up any trailing data it can pick up on.

// Sets up basic stuff.
import mcf from './mcf.js';
import * as debug from './debug.js';

const folder = mcf.error;
export const {
    noticeAnimInUse, errorNoAnchor
} = folder;

const {
    anonymous: a
} = folder;

const ns = 'easy-anim';

// Logs and tells the player that the animation is in use elsewhere
noticeAnimInUse`
    ${debug.error} {input: "Animation is currently in use!"}
    tellraw @s {text: "Animation is currently in use!", color: "red"}
`

errorNoAnchor`
    ${debug.error} {input: "Selection is missing an anchor!"}
    tellraw @s {text: "Please select some blocks before creating an animation.", color: "red"}
    data remove storage ${ns}:animation_data new
`

// I PLAN TO MOVE MANY OTHER COMMON ERRORS HERE TOO!
