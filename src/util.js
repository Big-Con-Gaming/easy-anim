// Sets up basic things.
import mcf from './mcf.js';
import * as debug from './debug.js';
const folder = mcf.util;
export const { replaceAllInString, toLowerCase, stringConcat, cleanKill, stringEquals, pullDataStringEquals, testIfInt } = folder;
const { anonymous: a, incrementIdx, recCharTest, lowerCaseMacro, rawConcat } = folder;
const ns = 'easy-anim';

const toLowerCaseCommands = [];

// Increment idx by 1
incrementIdx`
    # Log the function call
    ${debug.run} {input: "incrementIdx"}
    execute store result storage ${ns}:util temp.idx int 1 run scoreboard players add idx ${ns}-util-string 1
    execute store result storage ${ns}:util temp.idxadd int 1 run scoreboard players add idxadd ${ns}-util-string 1
`;

// Takes an input string, a character to find, and a character to replace it with, and outputs the modified string, in a storage location provided.
// input: string, find: character, replace: character, output: data location (block/entity/storage path)
replaceAllInString`
    # Log the function call
    $${debug.run} {input: "replaceAllInString in $(input) find $(find) replace with $(replace)"}
    # Log the expected function path.
    ${debug.path} {input: "-> incrementIdx -> recCharTest (appending Char -> incrementIdx)"}
    # Place the input string into a temporary storage location.
    $data modify storage ${ns}:util temp.input set value "$(input)"
    $data modify storage ${ns}:util temp.find set value "$(find)"
    $data modify storage ${ns}:util temp.replace set value "$(replace)"
    data modify storage ${ns}:util temp.output set value ""
    # separate into a new function to update context.
    scoreboard objectives add ${ns}-util-string dummy
    execute store result score length ${ns}-util-string run data get storage ${ns}:util temp.input
    scoreboard players set idx ${ns}-util-string -1
    scoreboard players set idxadd ${ns}-util-string 0
    ${incrementIdx}
    # For each character,
    ${recCharTest`
        # Log the function call
        $${debug.run} {input: "recCharTest from $(idx) to $(idxadd) creating $(output)"}
        # Pull out the next character from the input string.
        $data modify storage ${ns}:util temp.char set string storage ${ns}:util temp.input $(idx) $(idxadd)
        # Duplicate the character to test against.
        data modify storage ${ns}:util temp.testchar set from storage ${ns}:util temp.char
        # Check if it matches the find character.
        $execute store success score test ${ns}-util-string run data modify storage ${ns}:util temp.testchar set value "$(find)"
        # If it matches the find character, append the replace character to output,
        $execute if score test ${ns}-util-string matches 0 run data modify storage ${ns}:util temp.output set value "$(output)$(replace)"
        # else append the original character. Must be in separate function to update macro context.
        ${a`
            # Log the function call
            $${debug.run} {input: "appending character $(char)"}
            $execute if score test ${ns}-util-string matches 1 run data modify storage ${ns}:util temp.output set value "$(output)$(char)"
        `} with storage ${ns}:util temp
        # Increment idx
        ${incrementIdx}
        # Repeat until the entire string has been processed.
        execute unless score idx ${ns}-util-string >= length ${ns}-util-string run ${recCharTest} with storage ${ns}:util temp
    `} with storage ${ns}:util temp
    # Warn if the output will be overwriten. Commented out because toLowerCase will place output into the input of next replacement.
    # $execute if data $(output) run ${debug.warn} {input:"$(output) has data already! Overwriting..."}
    # Store the final output string in the provided storage location.
    $data modify $(output) set from storage ${ns}:util temp.output
    # Remove temporary data.
    scoreboard objectives remove ${ns}-util-string
    data remove storage ${ns}:util temp
`;


// Takes an input string and an output data location, and converts the input string to all lowercase, storing it in the output location.
const alphabetUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const alphabetLower = 'abcdefghijklmnopqrstuvwxyz';

lowerCaseMacro`
    $${replaceAllInString} {input:"$(input)", find:"$(upper)", replace:"$(lower)", output:"$(output)"}
`;

toLowerCaseCommands.push(`
    # Log the function call
    $${debug.run} {input: "toLowerCase with $(input)"}
    # Log the expected function path.
    ${debug.path} {input: "path: -> replaceAllInString x26"}
    $data modify storage ${ns}:util lowercase.input set value "$(input)"
    data modify storage ${ns}:util lowercase.output set value "storage ${ns}:util lowercase.input"
`);

for(let i = 0; i < alphabetLower.length; i++) {
    const upperChar = alphabetUpper.charAt(i);
    const lowerChar = alphabetLower.charAt(i);
    toLowerCaseCommands.push(`
        data modify storage ${ns}:util lowercase.lower set value "${lowerChar}"
        data modify storage ${ns}:util lowercase.upper set value "${upperChar}"
        ${lowerCaseMacro} with storage ${ns}:util lowercase
    `);
}

toLowerCaseCommands.push(`
    $data modify $(output) set from storage ${ns}:util lowercase.input
    data remove storage ${ns}:util lowercase
`);

toLowerCase`${toLowerCaseCommands.join('\n')}`;

// Takes an output storage directory, a front string and a back string and concats these into the output directory.
rawConcat`
    # Log the function call
    $${debug.run} {input: 'rawConcat creating $(front)$(back) in $(output)'}
    # Warn if output already has data in place. Removing since this happens a lot with prefix/suffix
    # $execute if data storage $(output) run ${debug.warn} {input:"$(output) already has data! Overwriting..."}
    $data modify storage $(output) set value '$(front)$(back)'
`;

// Takes an output storage directory, a front input storage directory, and a back input storage directory and macros them into rawConcat for you.
stringConcat`
    # Log the function call
    $${debug.run} {input: "stringConcat using $(front) and $(back) at $(output)"}
    # Log the expected function path.
    ${debug.path} {input: "-> rawConcat"}
    $data modify storage ${ns}:temp stringConcat.output set value "$(output)"
    $data modify storage ${ns}:temp stringConcat.front set from storage $(front)
    $data modify storage ${ns}:temp stringConcat.back set from storage $(back)
    ${rawConcat} with storage ${ns}:temp stringConcat
    data remove storage ${ns}:temp stringConcat
`;

// Execute on an entity to kill it by teleporting it away to the editor dimension, removing it's drops so nothing is left behind.
cleanKill`
    # Log the function call
    ${debug.run} {input: "cleanKill"}
    data modify entity @s DeathLootTable set value "minecraft:air"
    data modify entity @s Glowing set value false
    kill @s
    execute in ${ns}:editor run tp @s 0 -30 0
`;

// Checks to see if two strings are equal. Requires input1, input2, and output macros that contain strings.
stringEquals`
    # Log the function call
    $${debug.run} {input: "stringEquals using $(input1) and $(input2) placing into $(output)"}
    scoreboard objectives add ${ns}-string-equals dummy
    # place the input and output strings into temporary storage.
    $data modify storage ${ns}:test stringEquals.input1 set value "$(input1)"
    $data modify storage ${ns}:test stringEquals.input2 set value "$(input2)"
    # Warn if replacing data in output. Currently can't be used as output within the data subtype doesn't have subtype in its prefix...
    # $execute if data $(output) run ${debug.warn} {input:"$(output) already has data! Overwriting..."}
    # Store a result score while setting the input to the value of output.
    $execute store result $(output) run data modify storage ${ns}:test stringEquals.input1 set from storage ${ns}:test stringEquals.input2
    # Remove temporary data
    scoreboard objectives remove ${ns}-string-equals
    data remove storage ${ns}:test stringEquals
`;

// Pulls out data from paths to setup a storage macro for stringEquals. Needs input1, input2, and output which have to be data paths (block/entity/storage coordinates/selector/namespace path)
pullDataStringEquals`
    # Log the function call
    $${debug.run} {input: "pullDatastringEquals from $(input1) and $(input2) placing into $(output)"}
    # Log the path
    ${debug.path} {input: "-> stringEquals"}
    $data modify storage ${ns}:test pullDataStringEquals.input1 set from $(input1)
    $data modify storage ${ns}:test pullDataStringEquals.input2 set from $(input2)
    $data modify storage ${ns}:test pullDataStringEquals.output set value "$(output)"
    # run stringEquals
    ${stringEquals} with storage ${ns}:test pullDataStringEquals
    # Clean up temporary data
    data remove storage ${ns}:test pullDataStringEquals
`;

// Places the macroed input into a score command.
// If the macro fails the parse, the function will fail in total, and you can store that result to test if the input is a number.
testIfInt`
    # Log the function call
    $${debug.run} {input: "testIfInt with $(input) (succeeded)"}
    # Create a temporary scoreboard.
    scoreboard objectives add ${ns}-util-string dummy
    # Store the input as a data string
    $scoreboard players set test ${ns}-util-string $(input)
    # Clear trailing data
    scoreboard objectives remove ${ns}-util-string
    # Return 1 to indicate success
    return 1
`;