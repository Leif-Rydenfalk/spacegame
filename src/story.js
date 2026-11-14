// Story slots. Every line here is a placeholder until Leif's own text replaces it: keep the id and the trigger,
// replace the text. Setting (Leif's decision): a neighbouring star system where Earth sent prisoners to do research
// on its planets. That is where it went wrong. The starting planet holds many species that live in hives under the
// ground; a hivemind; the ruins of something older; and the colony's own military bases and research facilities,
// under lockdown since the hivemind began shutting them down one after another. See PLAN.md, "Lore notes".
const P = '[placeholder] ';
export const STORY = {
  title: P + 'spacegame',
  system: {
    starName: P + 'Star', homeName: P + 'Home', moonName: P + 'Moon',
    planets: [P + 'I', P + 'II', P + 'Home', P + 'IV', P + 'V', P + 'VI', P + 'VII'],
  },
  // names shown in the HUD when the player stands in a site, and the species names
  sites: { ruin: P + 'ruin site', hive: P + 'hive', base: P + 'military outpost, under lockdown', lab: P + 'research facility, under lockdown' },
  species: { scout: P + 'scout', swarmer: P + 'swarmer', brute: P + 'brute', spitter: P + 'spitter', burrower: P + 'burrower', flier: P + 'flier', grazer: P + 'grazer (native)', jelly: P + 'spore jelly (native)' },
  // one quiet line at the bottom of the screen when the trigger event first fires (once: false = every time)
  beats: [
    { id: 'landed', trigger: 'landed', text: P + 'Transport down. One prisoner awake. Research station does not answer.', once: true },
    { id: 'firstCreature', trigger: 'firstCreature', text: P + 'Something out there follows the lamp.', once: true },
    { id: 'firstKill', trigger: 'firstKill', text: P + 'It bleeds light.', once: true },
    { id: 'suitPrinted', trigger: 'suitPrinted', text: P + 'The suit prints anything, atom by atom. Slowly.', once: true },
    { id: 'firstMachinePrinted', trigger: 'firstMachinePrinted', text: P + 'First machine out of the suit printer. It does one thing, fast.', once: true },
    { id: 'furnaceLit', trigger: 'furnaceLit', text: P + 'First fire on this world that we lit ourselves.', once: true },
    { id: 'firstAutomation', trigger: 'firstAutomation', text: P + 'The line runs without hands.', once: true },
    { id: 'blueprintMode', trigger: 'blueprintMode', text: P + 'Blueprints: plan it, and let something else build it.', once: true },
    { id: 'firstRobot', trigger: 'firstRobot', text: P + 'First builder drone away. It reads the plan better than I do.', once: true },
    { id: 'printerBuilt', trigger: 'printerBuilt', text: P + 'Bio-printer online. Death is now a delay.', once: true },
    { id: 'died', trigger: 'died', text: P + 'Signal lost. The body stays where it fell.', once: false },
    { id: 'ruinFound', trigger: 'ruinFound', text: P + 'Ruins. Not ours. Older than the colony, older than the hives?', once: true },
    { id: 'stoneRead', trigger: 'stoneRead', text: P + 'The stone answers when touched.', once: true },
    { id: 'cacheOpened', trigger: 'cacheOpened', text: P + 'Someone sealed this and meant to come back.', once: true },
    { id: 'baseFound', trigger: 'baseFound', text: P + 'Military outpost. Blast doors down, emergency power only. Nobody at the guns.', once: true },
    { id: 'labFound', trigger: 'labFound', text: P + 'Research facility. Sealed from the inside.', once: true },
    { id: 'terminalRead', trigger: 'terminalRead', text: P + 'The terminals still hold the last shift.', once: true },
    { id: 'audioLog', trigger: 'audioLog', text: P + 'A voice from before the lockdown.', once: true },
    { id: 'hiveFound', trigger: 'hiveFound', text: P + 'A hive mouth. The ground under it is hollow.', once: true },
    { id: 'eggHatched', trigger: 'eggHatched', text: P + 'The sacs open when they feel footsteps.', once: true },
    { id: 'firstWave', trigger: 'hiveWave', text: P + 'They heard us. They come to the noise.', once: true },
    { id: 'machineLost', trigger: 'machineLost', text: P + 'They break what is loud.', once: true },
    { id: 'facilityDark', trigger: 'facilityDark', text: P + 'Another facility just went dark. The hivemind is spreading.', once: false },
    { id: 'hiveHeartKilled', trigger: 'hiveHeartKilled', text: P + 'The heart stops. This hive is silent. The others are not.', once: false },
    { id: 'seenBrute', trigger: 'seen:brute', text: P + 'That one is armoured. It walks through walls.', once: true },
    { id: 'seenBurrower', trigger: 'seen:burrower', text: P + 'The ground moves before it arrives.', once: true },
    { id: 'seenSpitter', trigger: 'seen:spitter', text: P + 'It keeps its distance. The acid eats rock.', once: true },
    { id: 'seenFlier', trigger: 'seen:flier', text: P + 'They have wings too.', once: true },
    { id: 'seenSwarmer', trigger: 'seen:swarmer', text: P + 'Small ones. Never one.', once: true },
    { id: 'launch', trigger: 'launch', text: P + 'Leaving the ground they sent us to.', once: true },
    { id: 'orbit', trigger: 'orbit', text: P + 'Orbit. Nobody on Earth knows this ship exists.', once: true },
    { id: 'firstAsteroid', trigger: 'firstAsteroid', text: P + 'First rock cut. The belt is the real research.', once: true },
    { id: 'depotBuilt', trigger: 'depotBuilt', text: P + 'Depot holding orbit.', once: true },
    { id: 'firstDrone', trigger: 'firstDrone', text: P + 'Hauler away. It knows the way back.', once: true },
    { id: 'hiveSighted', trigger: 'hiveSighted', text: P + 'Contacts closing. They are grown, not built.', once: true },
    { id: 'shipLost', trigger: 'shipLost', text: P + 'Ship lost. The wreck is still ours.', once: false },
  ],
  // lore read in the world: sites.js picks entry n (wrapping) for the site kind and the kind of object used.
  // ruin.stone = alien lore stones in the halls and vaults; base/lab.terminal = facility terminals;
  // base/lab.audio = audio-log slots. Add as many entries as the story needs.
  lore: {
    ruin: { stone: [
      { id: 'ruin.stone.0', text: P + 'ruin stone 0: who built this place' },
      { id: 'ruin.stone.1', text: P + 'ruin stone 1: what they kept in the vaults' },
      { id: 'ruin.stone.2', text: P + 'ruin stone 2: what they knew about the hives' },
      { id: 'ruin.stone.3', text: P + 'ruin stone 3: why the halls are empty' },
    ] },
    base: {
      terminal: [
        { id: 'base.terminal.0', text: P + 'outpost terminal 0: lockdown order, date, authority' },
        { id: 'base.terminal.1', text: P + 'outpost terminal 1: duty roster, the last patrol that did not return' },
        { id: 'base.terminal.2', text: P + 'outpost terminal 2: armoury log, what was issued the night of the attack' },
        { id: 'base.terminal.3', text: P + 'outpost terminal 3: list of facilities that stopped answering, in order' },
      ],
      audio: [
        { id: 'base.audio.0', text: P + 'outpost audio log 0: a sentry hears something under the floor' },
        { id: 'base.audio.1', text: P + 'outpost audio log 1: the commander seals the doors with people still outside' },
      ],
    },
    lab: {
      terminal: [
        { id: 'lab.terminal.0', text: P + 'research terminal 0: what the prisoners were sent here to study' },
        { id: 'lab.terminal.1', text: P + 'research terminal 1: specimen notes, the species share one mind' },
        { id: 'lab.terminal.2', text: P + 'research terminal 2: the experiment with noise and pollution, and what answered it' },
        { id: 'lab.terminal.3', text: P + 'research terminal 3: the artefact taken from the ruins' },
      ],
      audio: [
        { id: 'lab.audio.0', text: P + 'research audio log 0: a researcher argues for stopping the drilling' },
        { id: 'lab.audio.1', text: P + 'research audio log 1: the last entry before the facility went dark' },
      ],
    },
  },
};
