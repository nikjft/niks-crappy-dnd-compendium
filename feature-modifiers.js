// feature-modifiers.js — Programmatic modifiers lookup mapping for feats, traits, and class features

export default {
  "Tough|PHB": [
    { "target": "hp.max", "type": "add", "value": "2 * {char.level}" }
  ],
  "Tough|XPHB": [
    { "target": "hp.max", "type": "add", "value": "2 * {char.level}" }
  ],
  "Alert|PHB": [
    { "target": "initiative", "type": "add", "value": 5 }
  ],
  "Alert|XPHB": [
    { "target": "initiative", "type": "add", "value": "{prof_bonus}" }
  ],
  "Dwarven Toughness|Dwarf|PHB": [
    { "target": "hp.max", "type": "add", "value": "{char.level}" }
  ],
  "Dwarven Toughness|Dwarf|XPHB": [
    { "target": "hp.max", "type": "add", "value": "{char.level}" }
  ],
  "Fast Movement|Barbarian|PHB|5": [
    { "target": "speed", "type": "add", "value": 10 }
  ],
  "Fast Movement|Barbarian|XPHB|5": [
    { "target": "speed", "type": "add", "value": 10 }
  ],
  "Roving|Ranger|XPHB|6": [
    { "target": "speed", "type": "add", "value": 10 }
  ],
  "Primal Champion|Barbarian|PHB|20": [
    { "target": "str.score", "type": "add", "value": 4 },
    { "target": "con.score", "type": "add", "value": 4 }
  ],
  "Primal Champion|Barbarian|XPHB|20": [
    { "target": "str.score", "type": "add", "value": 4 },
    { "target": "con.score", "type": "add", "value": 4 }
  ]
};
