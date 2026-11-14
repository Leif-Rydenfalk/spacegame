// Story slots. Every line here is a placeholder until Leif's own text replaces it.
// Setting (Leif's decision): a neighbouring star system where Earth sent prisoners to do research on its planets.
// That is where it went wrong.
export const STORY = {
  title: '[placeholder] spacegame',
  system: {
    starName: '[placeholder] Star', homeName: '[placeholder] Home', moonName: '[placeholder] Moon',
    planets: ['[placeholder] I', '[placeholder] II', '[placeholder] Home', '[placeholder] IV', '[placeholder] V', '[placeholder] VI', '[placeholder] VII'],
  },
  beats: [
    { id: 'landed', trigger: 'landed', speaker: 'log', text: '[placeholder] Transport down. One prisoner awake. Research station does not answer.', once: true },
    { id: 'firstCreature', trigger: 'firstCreature', speaker: 'log', text: '[placeholder] Something out there follows the lamp.', once: true },
    { id: 'firstKill', trigger: 'firstKill', speaker: 'log', text: '[placeholder] It bleeds light.', once: true },
    { id: 'furnaceLit', trigger: 'furnaceLit', speaker: 'log', text: '[placeholder] First fire on this world that we lit ourselves.', once: true },
    { id: 'firstAutomation', trigger: 'firstAutomation', speaker: 'log', text: '[placeholder] The line runs without hands.', once: true },
    { id: 'printerBuilt', trigger: 'printerBuilt', speaker: 'log', text: '[placeholder] Bio-printer online. Death is now a delay.', once: true },
    { id: 'died', trigger: 'died', speaker: 'log', text: '[placeholder] Signal lost. The body stays where it fell.', once: false },
    { id: 'launch', trigger: 'launch', speaker: 'log', text: '[placeholder] Leaving the ground they sent us to.', once: true },
    { id: 'orbit', trigger: 'orbit', speaker: 'log', text: '[placeholder] Orbit. Nobody on Earth knows this ship exists.', once: true },
    { id: 'firstAsteroid', trigger: 'firstAsteroid', speaker: 'log', text: '[placeholder] First rock cut. The belt is the real research.', once: true },
    { id: 'depotBuilt', trigger: 'depotBuilt', speaker: 'log', text: '[placeholder] Depot holding orbit.', once: true },
    { id: 'firstDrone', trigger: 'firstDrone', speaker: 'log', text: '[placeholder] Hauler away. It knows the way back.', once: true },
    { id: 'hiveSighted', trigger: 'hiveSighted', speaker: 'log', text: '[placeholder] Contacts closing. They are grown, not built.', once: true },
    { id: 'shipLost', trigger: 'shipLost', speaker: 'log', text: '[placeholder] Ship lost. The wreck is still ours.', once: false },
  ],
};
