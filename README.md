# Easy Animations!

This is a data pack that allows you to create stop-motion-like animations directly within Minecraft.

## Dependencies
It is recommended that you play with the [Axiom mod](https://axiom.moulberry.com/) to easily move any entities (maybe in the future the pack could contain its own method to move entities.)

## How to Use

To begin, you access all menus within Easy Animations using this command:
```
/trigger easy-anim
```
This shows you a dialog depending on which dimension you are in. Outside of the editor, it will show you options to create a new animation or edit, render, or delete existing animations.

Creating Animations:
- To create an animation, you simply give it a unique name without special characters, select a volume of blocks using the selection tool (this will become the base of all of your frames),
set a camera position to be used as default for your frames, and then you are able to create the animation.
- From there, it'll ask you if you want to edit the editor for this animation. You can also use the edit button in the main menu to get to the editor as well.

Editing Animations:
- This will take you to a new dimension with all of your frames laid out next to each other. You can freely edit the blocks and entities within these frames.
- The trigger command will now show you many new operations for this animation. To use any of them, you need to select frames using ``Modify Selection``.
- There are multiple options for selecting frames, whether that's through the given slider, typing a frame number in the box, selecting the frame you are physically standing in, or selecting/deselecting all frames.
- With frames selected, you can now save those frames to keep any block and entity changes within them. You can also revert these block and entity changes to the last saved state.
- All other operations are permanent after running, like ``Remove Frames``. Exercise caution!
- You can add new frames that use the base frame which is what you saved when creating the animation, or you can duplicate selected frames.
- Moving frames allows you to just change the order of frames which affects how they are rendered out.
- You can save new cameras for frames based on your location relative to the selected frames, and you can load these to teleport to the frames. If you have multiple frames selected, you will see them play out based on frame durations.
- Highlight cameras give you a visual of where the camera is placed, and you can move these to modify the camera data as well, just save them once you close the highlight.
- Setting frame duration will change how long you are at a frame during a render or loading cameras. This is in game ticks.
- Finally, exiting the editor will place you back to where you entered, while nullifying any unsaved changes. Make sure to save your frames before you exit!

Rendering Animations:
- Rendering an animation will place each frame into the overworld where your initial selection was, while placing you at each camera and waiting the specified frame duration. This will continue until all frames are shown, then it resets to whatever blocks and entities were there beforehand.
- At any time, you can exit a render through moving the player, in which it will reset prematurely.

Deleting an animation is permanent and will erase all of the data!

## Getting Started with Development

This project was generated with [mcjspacker](https://www.npmjs.com/package/mcjspacker).

Install [npm](https://docs.npmjs.com/cli/v12/configuring-npm/install) if you haven't done so already.

1. Install dependencies:
   ```sh
   npm install
   ```
2. Build your datapack:
   ```sh
   npm run build
   ```
   This will generate the datapack files in the `data/easy-anim/function` directory.
3. (Optional) Watch for changes and auto-build:
   ```sh
   npm run watch
   ```

See the [mcjspacker github page](https://github.com/ofek2608/mcjspacker) for more examples of how to use mcjspacker within the project.

- From there, feel free to take a look at the issues in github and make a branch to work on them.
- While developing, make sure that you include ``debug.run`` messages at the start of your mcfunctions, with ``debug.path`` for top-level functions that execute other functions.
- If a function gets directly accessed by load, tick, or a user dialog, include a ``debug.entry`` that says so. Also, update entry-point-mapping.txt to include this entry.
- You can use ``debug.info`` for bug testing, but please do not leave any of these in committed code.
- Make sure to make unique data sources for functions (scoreboards, storage) that are cleared at the end AND the beginning of function execution (unless needed elsewhere).
- Try to keep all trailing data within animation_data and player_data storage namespaces.
- Lastly, if optimizations can be made by using javascript, please attempt to do so if it increases code readability and minimizes repetitive code.

## License

This project is licensed under Creative Commons Attribution–NonCommercial–ShareAlike 4.0 International (CC BY-NC-SA 4.0).

You may share, fork, and modify this datapack for noncommercial purposes, provided you credit the original creator, link to this repository, indicate changes, and distribute adaptations under the same license.

Commercial uses of the copyrighted project require separate permission from the rights holder.

License: https://creativecommons.org/licenses/by-nc-sa/4.0/
