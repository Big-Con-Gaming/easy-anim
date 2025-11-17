// index.js
// This is the main entry point for your datapack generation.
// Import your mcf context and any functions you want to use.

import mcf from './mcf.js';
import { rightClick, select, displayBox } from './menu.js';

// Declare the functions you want to use
const { tick, load, menu } = mcf;

const ns = 'easy-anim';

// These commands will run every tick.
tick`
  ${rightClick}
  execute as @a[scores={easy-anim-right-click=1..}] run scoreboard players set @s easy-anim-right-click 0
  ${select}
  ${displayBox}
`;

// These commands run when the datapack has been loaded in.
load`
  # Set up the scoreboard for detecting right clicks.
  scoreboard objectives add easy-anim-right-click minecraft.used:minecraft.carrot_on_a_stick
  # Forceload the main chunk in the editor dimension so the inventory barrel at the bottom of the world is always loaded and can be used.
  execute in easy-anim:editor run forceload add 0 0
  # Let operators know the datapack has been loaded.
  say Easy Animations Datapack Loaded!
`;

menu`
    dialog show @s easy-anim:main_menu
`;