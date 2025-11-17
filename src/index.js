// index.js
// This is the main entry point for your datapack generation.
// Import your mcf context and any functions you want to use.

import mcf from './mcf.js';
import { rightClick, select } from './menu.js';

// Declare the functions you want to use
const { tick, load, menu } = mcf;

const ns = 'easy-anim';

// These commands will run every tick.
tick`
  ${rightClick}
  execute as @a[scores={easy-anim-right-click=1..}] run scoreboard players set @s easy-anim-right-click 0
  ${select}
`;

// These commands run when the datapack has been loaded in.
load`
  # Set up the scoreboard for detecting right clicks.
  scoreboard objectives add easy-anim-right-click minecraft.used:minecraft.carrot_on_a_stick
  # Let operators know the datapack has been loaded.
  say Easy Animations Datapack Loaded!
`;

menu`
    dialog show @s easy-anim:main_menu
`;