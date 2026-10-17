// ===== Civilization × Age × Building & Unit Visual DNA Compositor =====
// Makes every building (23 types) and unit (49 types) visually distinct across all 10 civilizations and 6 ages.
'use strict';

const CIV_ARCH = {
  franks: {
    name: 'Franks', family: 'west', crenel: 'square', crown: 'chateau', emblem: 'fleur',
    shieldShape: 'heater', helmStyle: 'bascinet', sailStyle: 'square', cartStyle: 'wagon',
    ages: [
      { wall: '#8f6840', roof: '#c8a658', trim: '#5c3e22', base: '#786a56', beams: null, stone: '#9c9282', accent: '#3b6ea5', dome: '#4a6b8c' },
      { wall: '#eadcc0', roof: '#984632', trim: '#583a20', base: '#8e8474', beams: '#583a20', stone: '#aca290', accent: '#2f5d90', dome: '#466482' },
      { wall: '#dcd4c4', roof: '#3d5878', trim: '#6e665c', base: '#968e80', beams: null, stone: '#c8c0b0', accent: '#285588', dome: '#3d5878' },
      { wall: '#eee6d6', roof: '#2d4868', trim: '#7c7264', base: '#a49c8c', beams: null, stone: '#dad2c2', accent: '#e8c040', dome: '#2d4868' },
      { wall: '#c8c2b8', roof: '#364858', trim: '#48525c', base: '#787c80', beams: '#48525c', stone: '#b0aca4', accent: '#4a78a8', dome: '#486078' },
      { wall: '#dce6f0', roof: '#264868', trim: '#386890', base: '#607488', beams: null, stone: '#c4d4e4', accent: '#5ce6ff', dome: '#40b8e0' },
    ],
  },
  teutons: {
    name: 'Teutons', family: 'west', crenel: 'stepped', crown: 'gothic', emblem: 'cross',
    shieldShape: 'heater', helmStyle: 'greathelm', sailStyle: 'square', cartStyle: 'wagon',
    ages: [
      { wall: '#7c5634', roof: '#b8964c', trim: '#482e18', base: '#6e6050', beams: null, stone: '#8c8478', accent: '#a82820', dome: '#4a4e54' },
      { wall: '#e2d6c0', roof: '#9e3824', trim: '#3c2614', base: '#82786a', beams: '#3c2614', stone: '#9a9084', accent: '#b82820', dome: '#52565c' },
      { wall: '#b8543c', roof: '#383c44', trim: '#e8dfd0', base: '#7e766c', beams: '#38281c', stone: '#9e968c', accent: '#1e1e1e', dome: '#383c44' },
      { wall: '#a8442e', roof: '#282c34', trim: '#f0e8da', base: '#888076', beams: null, stone: '#b2aaa0', accent: '#d8b038', dome: '#282c34' },
      { wall: '#8e4232', roof: '#2c3238', trim: '#3c4248', base: '#686c70', beams: '#2c3238', stone: '#94908c', accent: '#d04030', dome: '#3c444c' },
      { wall: '#ccd4dc', roof: '#242a32', trim: '#384048', base: '#586068', beams: null, stone: '#b4bcc4', accent: '#ff6844', dome: '#3888a8' },
    ],
  },
  spanish: {
    name: 'Spanish', family: 'west', crenel: 'albarrana', crown: 'mudejar', emblem: 'lion',
    shieldShape: 'round', helmStyle: 'morion', sailStyle: 'square', cartStyle: 'wagon',
    ages: [
      { wall: '#9c7244', roof: '#d0a858', trim: '#644224', base: '#84725c', beams: null, stone: '#aa9a82', accent: '#c03028', dome: '#b85434' },
      { wall: '#f0e2c8', roof: '#c45430', trim: '#6a4424', base: '#988870', beams: '#6a4424', stone: '#bca88c', accent: '#c82820', dome: '#c45430' },
      { wall: '#e6ca9a', roof: '#b84828', trim: '#7a5230', base: '#a29076', beams: null, stone: '#d4ba92', accent: '#e0a828', dome: '#c85a32' },
      { wall: '#f2dec0', roof: '#a83c20', trim: '#8a6038', base: '#ae9c82', beams: null, stone: '#e2ca9e', accent: '#e8b830', dome: '#d89830' },
      { wall: '#d8c4a4', roof: '#8c3c28', trim: '#54483c', base: '#847c70', beams: '#54483c', stone: '#c0b098', accent: '#d84028', dome: '#9c4830' },
      { wall: '#ece2d0', roof: '#7c2e24', trim: '#b88628', base: '#747068', beams: null, stone: '#dcd0bc', accent: '#ffaa38', dome: '#48c8e0' },
    ],
  },
  italians: {
    name: 'Italians', family: 'west', crenel: 'swallowtail', crown: 'campanile', emblem: 'stgeorge',
    shieldShape: 'pavise', helmStyle: 'barbuta', sailStyle: 'lateen', cartStyle: 'wagon',
    ages: [
      { wall: '#987048', roof: '#cca65a', trim: '#5e4024', base: '#80705c', beams: null, stone: '#a49888', accent: '#b83228', dome: '#b05238' },
      { wall: '#ecd8bc', roof: '#bc5838', trim: '#64462c', base: '#948878', beams: '#64462c', stone: '#b8aca0', accent: '#c42c24', dome: '#bc5838' },
      { wall: '#ece4d8', roof: '#b44e32', trim: '#4e6858', base: '#9e968a', beams: null, stone: '#dad2c6', accent: '#3a6e54', dome: '#b85234' },
      { wall: '#f6f0e6', roof: '#a8442a', trim: '#385c48', base: '#aca498', beams: null, stone: '#ece6dc', accent: '#e2b238', dome: '#c45838' },
      { wall: '#dcd4c8', roof: '#8a402c', trim: '#485850', base: '#82807a', beams: '#485850', stone: '#ccc4b8', accent: '#388060', dome: '#789890' },
      { wall: '#edf2f0', roof: '#34685c', trim: '#388870', base: '#6c7c78', beams: null, stone: '#dce6e2', accent: '#54f0c8', dome: '#4cd8c0' },
    ],
  },
  vikings: {
    name: 'Vikings', family: 'nordic', crenel: 'shields', crown: 'stave', emblem: 'raven',
    shieldShape: 'round', helmStyle: 'spectacle', sailStyle: 'longship', cartStyle: 'nordic',
    ages: [
      { wall: '#6e4c2e', roof: '#6a7c3e', trim: '#422c18', base: '#62584c', beams: '#3e2816', stone: '#7c7872', accent: '#b83828', dome: '#523822' },
      { wall: '#785232', roof: '#624428', trim: '#3a2412', base: '#6c6256', beams: '#3a2412', stone: '#868078', accent: '#c43c28', dome: '#48301c' },
      { wall: '#5e4028', roof: '#463220', trim: '#2e1c0e', base: '#746c62', beams: '#2e1c0e', stone: '#928c84', accent: '#d49828', dome: '#3a2818' },
      { wall: '#523822', roof: '#362618', trim: '#c89838', base: '#7e766c', beams: '#26180c', stone: '#a09a92', accent: '#e0a830', dome: '#2e2014' },
      { wall: '#5c544c', roof: '#2e343a', trim: '#3c4248', base: '#64686c', beams: '#2e343a', stone: '#888888', accent: '#c84830', dome: '#3c4854' },
      { wall: '#b8c8d4', roof: '#243442', trim: '#386078', base: '#546470', beams: null, stone: '#9eb0be', accent: '#48e0ff', dome: '#38a8d0' },
    ],
  },
  byzantines: {
    name: 'Byzantines', family: 'byzantine', crenel: 'striped', crown: 'saucer_dome', emblem: 'chi_rho',
    shieldShape: 'oval', helmStyle: 'spangen', sailStyle: 'lateen', cartStyle: 'wagon',
    ages: [
      { wall: '#9a7048', roof: '#c49c52', trim: '#683824', base: '#806e5a', beams: null, stone: '#a49480', accent: '#882848', dome: '#b0583c' },
      { wall: '#dec8a8', roof: '#b45438', trim: '#8a3428', base: '#90806e', beams: '#7a3424', stone: '#b8a690', accent: '#8e2850', dome: '#b85c3e' },
      { wall: '#e2ceb0', roof: '#a84c32', trim: '#983228', base: '#9c8c7a', beams: null, stone: '#ccb89e', accent: '#7a2458', dome: '#c46442' },
      { wall: '#ecdcbe', roof: '#9c422a', trim: '#9e2c24', base: '#a89886', beams: null, stone: '#dac8ae', accent: '#e2b038', dome: '#d8a032' },
      { wall: '#cbbba4', roof: '#7c4030', trim: '#68342c', base: '#847c72', beams: '#68342c', stone: '#b8aa98', accent: '#983060', dome: '#886848' },
      { wall: '#e4dce8', roof: '#4e3458', trim: '#8848a0', base: '#6e6478', beams: null, stone: '#cec4d6', accent: '#e8b840', dome: '#a864e0' },
    ],
  },
  saracens: {
    name: 'Saracens', family: 'islamic', crenel: 'stepped', crown: 'ribbed_dome', emblem: 'crescent_star',
    shieldShape: 'round', helmStyle: 'turban', sailStyle: 'lateen', cartStyle: 'camel',
    ages: [
      { wall: '#b88c58', roof: '#d4b068', trim: '#78522c', base: '#967c5c', beams: null, stone: '#bca07c', accent: '#1e824c', dome: '#c8a058' },
      { wall: '#dfc496', roof: '#c89e54', trim: '#7c5630', base: '#a68c6a', beams: null, stone: '#ceb28a', accent: '#1e824c', dome: '#2e8b78' },
      { wall: '#e8d0a6', roof: '#28887a', trim: '#8c6438', base: '#b29876', beams: null, stone: '#dcc29a', accent: '#d8a830', dome: '#289484' },
      { wall: '#f2deb8', roof: '#1e7c72', trim: '#c89830', base: '#bca482', beams: null, stone: '#e8d0aa', accent: '#e8b838', dome: '#d8a830' },
      { wall: '#d8c4a0', roof: '#2c6864', trim: '#545044', base: '#8c8270', beams: null, stone: '#c4b294', accent: '#289868', dome: '#388880' },
      { wall: '#eae4d4', roof: '#1c5c64', trim: '#28a898', base: '#707874', beams: null, stone: '#d6d0c0', accent: '#40f0c0', dome: '#38d8c0' },
    ],
  },
  turks: {
    name: 'Turks', family: 'islamic', crenel: 'pointed', crown: 'ottoman_dome', emblem: 'tughra',
    shieldShape: 'round', helmStyle: 'ottoman', sailStyle: 'lateen', cartStyle: 'camel',
    ages: [
      { wall: '#a88254', roof: '#3a7880', trim: '#684828', base: '#8a7458', beams: null, stone: '#b09878', accent: '#289098', dome: '#3a7880' },
      { wall: '#d6be98', roof: '#2e7c88', trim: '#6e5030', base: '#9a866c', beams: null, stone: '#c2ac8c', accent: '#2494a0', dome: '#2e8490' },
      { wall: '#ded4c2', roof: '#526270', trim: '#288290', base: '#989082', beams: null, stone: '#ccc2b0', accent: '#c83028', dome: '#586878' },
      { wall: '#eae2d2', roof: '#465666', trim: '#228898', base: '#a49c8e', beams: null, stone: '#dad2c0', accent: '#e2b038', dome: '#4a5c6e' },
      { wall: '#ece9e2', roof: '#3c4854', trim: '#485460', base: '#7c7c78', beams: null, stone: '#d8d2c6', accent: '#c83028', dome: '#4c5c6c' },
      { wall: '#e6dccb', roof: '#b0503a', trim: '#8c3a2c', base: '#9a8a78', beams: null, stone: '#c9a98e', accent: '#c8102e', dome: '#7d858c' },
    ],
  },
  chinese: {
    name: 'Chinese', family: 'east', crenel: 'greybrick', crown: 'pagoda', emblem: 'dragon',
    shieldShape: 'dragon', helmStyle: 'song', sailStyle: 'junk', cartStyle: 'canopy',
    ages: [
      { wall: '#8c6844', roof: '#686c70', trim: '#7a2820', base: '#706c66', beams: '#6e241c', stone: '#84888c', accent: '#c43224', dome: '#585c60' },
      { wall: '#dcd8d0', roof: '#4c5258', trim: '#982820', base: '#7c8084', beams: '#8c241c', stone: '#92969a', accent: '#d03424', dome: '#444a50' },
      { wall: '#e4dfd6', roof: '#2c6854', trim: '#a82820', base: '#888c90', beams: '#9c241c', stone: '#9ea2a6', accent: '#e0a828', dome: '#2c6854' },
      { wall: '#eee8dc', roof: '#c89228', trim: '#b4241c', base: '#94989c', beams: '#a82018', stone: '#acb0b4', accent: '#f0bc30', dome: '#d09828' },
      { wall: '#c4c8cc', roof: '#38544c', trim: '#882820', base: '#70767c', beams: '#68241c', stone: '#989ea4', accent: '#d83828', dome: '#3c5c54' },
      { wall: '#dce4ea', roof: '#225852', trim: '#c83028', base: '#5c6c78', beams: null, stone: '#b8c6d0', accent: '#50f0d0', dome: '#38c8b0' },
    ],
  },
  japanese: {
    name: 'Japanese', family: 'east', crenel: 'ishigaki', crown: 'tenshu', emblem: 'mon',
    shieldShape: 'sode', helmStyle: 'kabuto', sailStyle: 'junk', cartStyle: 'canopy',
    ages: [
      { wall: '#785838', roof: '#988254', trim: '#38281c', base: '#68625a', beams: '#38281c', stone: '#7a7670', accent: '#b83024', dome: '#44464a' },
      { wall: '#ece6da', roof: '#3c4046', trim: '#2c221a', base: '#746e66', beams: '#2c221a', stone: '#88847c', accent: '#c42c20', dome: '#383c42' },
      { wall: '#f4efe4', roof: '#2e3238', trim: '#241c16', base: '#7e7870', beams: '#241c16', stone: '#949088', accent: '#d8a428', dome: '#2a2e34' },
      { wall: '#faf6ec', roof: '#22262c', trim: '#c89828', base: '#88827a', beams: '#1e1812', stone: '#a29e96', accent: '#e8b430', dome: '#22262c' },
      { wall: '#dcdad4', roof: '#282e36', trim: '#383c42', base: '#6c6c68', beams: '#282e36', stone: '#90908c', accent: '#c82c24', dome: '#323a44' },
      { wall: '#eef2f6', roof: '#1e2836', trim: '#c8302c', base: '#5a6470', beams: null, stone: '#c0cad4', accent: '#64e8ff', dome: '#38a8e0' },
    ],
  },
};

const CIV_WONDER_NAMES = {
  franks: ['Megalithic Sanctuary', 'Royal Carolingian Hall', 'Abbey of Cluny', 'Chartres Cathedral', 'Grand Palais Observatory', 'Helios Fusion Spire'],
  teutons: ['Irminsul Sanctuary', 'Imperial Pfalz Hall', 'Marienburg Chapterhouse', 'Cologne Cathedral', 'Humboldt Observatory', 'Aegis Fusion Core'],
  spanish: ['Iberian Stone Sanctuary', 'Visigothic Royal Hall', 'Great Cloister of León', 'Torre del Oro Cathedral', 'Real Observatorio', 'Solaris Fusion Beacon'],
  italians: ['Etruscan Rotunda', 'Lombard Guild Hall', 'Piazza dei Miracoli', 'Duomo di Firenze', 'Galileo World Observatory', 'Leonardo Fusion Spire'],
  vikings: ['Uppsala Sacred Grove', 'Great Mead-Hall of Lejre', 'Borgund Stave Sanctuary', 'Yggdrasil High Temple', 'Aurora Polar Observatory', 'Bifrost Fusion Beacon'],
  byzantines: ['Constantine Sanctuary', 'Sacred Palace Magnaura', 'Imperial Library of Porphyry', 'Hagia Sophia', 'Archimedes Observatory', 'Sol Invictus Beacon'],
  saracens: ['Desert Oasis Sanctuary', 'Abbasid Palace Hall', 'House of Wisdom', 'Great Mosque of Samarra', 'Al-Battani Observatory', 'Crescent Star Beacon'],
  turks: ['Ancestral Sanctuary', 'Seljuk Caravanserai', 'Great Madrasa', 'Imperial Mosque', 'World Observatory', 'Fusion Beacon'],
  chinese: ['Ancestral Jade Altar', 'Tang Daming Palace Hall', 'Imperial Hanlin Academy', 'Temple of Heaven', 'Purple Mountain Observatory', 'Celestial Dragon Beacon'],
  japanese: ['Izumo Sacred Shrine', 'Heian Daigokuden Hall', 'Todai-ji Great Lecture Hall', 'Golden Pavilion & Tenshu', 'Edo Astronomical Conservatory', 'Amaterasu Fusion Spire'],
};

function civOfOwner(owner) {
  if (typeof W !== 'undefined' && W && W.players && W.players[owner]) return W.players[owner].civ || 'franks';
  if (typeof W !== 'undefined' && W && W.players && W.humanId && W.players[W.humanId]) return W.players[W.humanId].civ || 'franks';
  return 'franks';
}
function ageOfOwner(owner) {
  if (typeof W !== 'undefined' && W && W.players && W.players[owner]) return Math.min(5, W.players[owner].age || 0);
  if (typeof W !== 'undefined' && W && W.players && W.humanId && W.players[W.humanId]) return Math.min(5, W.players[W.humanId].age || 0);
  return 1;
}
function civSpec(civ) { return CIV_ARCH[civ] || CIV_ARCH.franks; }

// ---------- 1. Heraldic Emblem & Shield Renderer ----------
function drawCivEmblem(g, emblem, x, y, r, pc) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#f2d050';
  g.strokeStyle = '#f2d050';
  g.lineWidth = Math.max(0.7, r * 0.28);
  switch (emblem) {
    case 'fleur': // Gold Fleur-de-lis
      g.beginPath();
      g.moveTo(0, -r * 0.9); g.quadraticCurveTo(r * 0.35, -r * 0.2, 0, r * 0.7);
      g.quadraticCurveTo(-r * 0.35, -r * 0.2, 0, -r * 0.9); g.fill();
      g.beginPath();
      g.moveTo(-r * 0.75, -r * 0.1); g.quadraticCurveTo(0, -r * 0.35, r * 0.75, -r * 0.1);
      g.moveTo(-r * 0.55, r * 0.25); g.lineTo(r * 0.55, r * 0.25); g.stroke();
      break;
    case 'cross': // Black & Gold Teutonic Cross
      g.fillStyle = '#181818';
      g.fillRect(-r * 0.22, -r * 0.85, r * 0.44, r * 1.7);
      g.fillRect(-r * 0.75, -r * 0.28, r * 1.5, r * 0.44);
      break;
    case 'lion': // Castilian Crown / Lion rampart
      g.beginPath();
      g.moveTo(-r * 0.65, r * 0.35); g.lineTo(-r * 0.65, -r * 0.35); g.lineTo(-r * 0.25, 0);
      g.lineTo(0, -r * 0.55); g.lineTo(r * 0.25, 0); g.lineTo(r * 0.65, -r * 0.35); g.lineTo(r * 0.65, r * 0.35);
      g.closePath(); g.fill();
      break;
    case 'stgeorge': // Red/Gold St. George Cross
      g.fillStyle = '#c82420';
      g.fillRect(-r * 0.22, -r * 0.85, r * 0.44, r * 1.7);
      g.fillRect(-r * 0.75, -r * 0.22, r * 1.5, r * 0.44);
      break;
    case 'raven': // Norse Sun-Wheel & Iron Boss
      g.strokeStyle = '#f0e6c8';
      g.beginPath();
      g.moveTo(-r * 0.7, 0); g.lineTo(r * 0.7, 0);
      g.moveTo(0, -r * 0.7); g.lineTo(0, r * 0.7); g.stroke();
      g.fillStyle = '#d8b040';
      g.beginPath(); g.arc(0, 0, r * 0.32, 0, Math.PI * 2); g.fill();
      break;
    case 'chi_rho': // Byzantine Chi-Rho / Imperial Cross
      g.beginPath();
      g.moveTo(-r * 0.55, -r * 0.55); g.lineTo(r * 0.55, r * 0.55);
      g.moveTo(r * 0.55, -r * 0.55); g.lineTo(-r * 0.55, r * 0.55);
      g.moveTo(0, -r * 0.85); g.lineTo(0, r * 0.85); g.stroke();
      break;
    case 'crescent_star': // Saracen Crescent & Star
    case 'tughra': // Ottoman Crescent
      g.beginPath();
      g.arc(r * 0.08, 0, r * 0.62, 0.55, Math.PI * 2 - 0.55);
      g.stroke();
      g.beginPath(); g.arc(r * 0.38, 0, r * 0.2, 0, Math.PI * 2); g.fill();
      break;
    case 'dragon': // Chinese Imperial Dragon Pearl & Wave
      g.beginPath();
      g.arc(0, -r * 0.15, r * 0.38, 0, Math.PI * 2); g.fill();
      g.beginPath();
      g.moveTo(-r * 0.65, r * 0.45); g.quadraticCurveTo(0, r * 0.05, r * 0.65, r * 0.45); g.stroke();
      break;
    case 'mon': // Japanese Takeda Four-Diamond Mon
      for (const [dx, dy] of [[0, -r * 0.42], [0, r * 0.42], [-r * 0.42, 0], [r * 0.42, 0]]) {
        g.beginPath();
        g.moveTo(dx, dy - r * 0.28); g.lineTo(dx + r * 0.28, dy);
        g.lineTo(dx, dy + r * 0.28); g.lineTo(dx - r * 0.28, dy);
        g.closePath(); g.fill();
      }
      break;
  }
  g.restore();
}

function drawCivShield(g, civ, pc, x, y, r = 3.8, heavy = false) {
  const spec = civSpec(civ);
  const shape = spec.shieldShape;
  const rim = heavy ? '#e8c040' : '#b8b0a0';
  const baseFill = civ === 'teutons' || civ === 'italians' ? '#f4efe6' : pc.c;
  g.save();
  g.translate(x, y);
  g.fillStyle = baseFill;
  g.strokeStyle = rim;
  g.lineWidth = heavy ? 1.05 : 0.8;
  if (shape === 'pavise') {
    g.beginPath();
    g.rect(-r * 0.85, -r * 1.25, r * 1.7, r * 2.4);
    g.fill(); g.stroke();
  } else if (shape === 'sode') {
    g.beginPath();
    g.rect(-r * 0.8, -r * 1.05, r * 1.6, r * 2.0);
    g.fill(); g.stroke();
    // Lacing stripes
    g.strokeStyle = pc.d || '#222'; g.lineWidth = 0.65;
    for (let k = -r * 0.5; k <= r * 0.6; k += r * 0.55) {
      g.beginPath(); g.moveTo(-r * 0.75, k); g.lineTo(r * 0.75, k); g.stroke();
    }
  } else if (shape === 'heater' || shape === 'dragon') {
    g.beginPath();
    g.moveTo(-r * 0.9, -r * 1.05);
    g.lineTo(r * 0.9, -r * 1.05);
    g.lineTo(r * 0.85, r * 0.15);
    g.lineTo(0, r * 1.25);
    g.lineTo(-r * 0.85, r * 0.15);
    g.closePath();
    g.fill(); g.stroke();
  } else if (shape === 'oval') {
    g.beginPath();
    g.ellipse(0, 0, r * 0.88, r * 1.2, 0, 0, Math.PI * 2);
    g.fill(); g.stroke();
  } else {
    // Round shield (Vikings, Saracens, Turks, Spanish)
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill(); g.stroke();
  }
  drawCivEmblem(g, spec.emblem, 0, 0, r * 0.72, pc);
  g.restore();
}

// ---------- 2. Architectural Crowns, Roof Motifs & Era Retrofits for All 23 Buildings ----------
function drawEastEaves(g, x, y, w, d, z, col, gold = '#e8b838') {
  const cFL = P(x - w, y + d, z), cFR = P(x + w, y + d, z), cBR = P(x + w, y - d, z);
  g.strokeStyle = col; g.lineWidth = 2.0;
  g.beginPath();
  g.moveTo(cFL[0] - 4, cFL[1] - 3); g.quadraticCurveTo(cFL[0], cFL[1] + 1, cFR[0], cFR[1]);
  g.quadraticCurveTo(cFR[0] + 3, cFR[1] - 1, cFR[0] + 5, cFR[1] - 4);
  g.moveTo(cFR[0], cFR[1]); g.quadraticCurveTo(cBR[0], cBR[1] + 1, cBR[0] + 4, cBR[1] - 3);
  g.stroke();
  // Upturned golden cornerhorn finials
  g.fillStyle = gold;
  for (const pt of [[cFL[0] - 4, cFL[1] - 3], [cFR[0] + 4, cFR[1] - 4], [cBR[0] + 4, cBR[1] - 3]]) {
    g.beginPath(); g.arc(pt[0], pt[1], 1.7, 0, Math.PI * 2); g.fill();
  }
}

function drawDragonFinials(g, x, y, z, col = '#5a3a1e', gold = '#e0a830') {
  const p = P(x, y, z);
  g.strokeStyle = col; g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(p[0] - 6, p[1] + 3); g.lineTo(p[0] + 5, p[1] - 5);
  g.moveTo(p[0] + 6, p[1] + 3); g.lineTo(p[0] - 5, p[1] - 5);
  g.stroke();
  g.fillStyle = gold;
  g.beginPath();
  g.arc(p[0] - 5.5, p[1] - 5.5, 1.6, 0, Math.PI * 2);
  g.arc(p[0] + 5.5, p[1] - 5.5, 1.6, 0, Math.PI * 2);
  g.fill();
}

function drawShachihoko(g, x, y, z) {
  const p = P(x, y, z);
  g.fillStyle = '#f0bc30'; g.strokeStyle = '#7a5210'; g.lineWidth = 0.7;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(p[0] + s * 3, p[1]);
    g.quadraticCurveTo(p[0] + s * 8, p[1] - 2, p[0] + s * 6, p[1] - 7);
    g.quadraticCurveTo(p[0] + s * 3.5, p[1] - 4, p[0] + s * 2, p[1] - 1);
    g.closePath(); g.fill(); g.stroke();
  }
}

function drawMinaret(g, x, y, z0, h, stoneCol, roofCol, gold = '#e8c040') {
  cyl(g, x, y, 0.14, z0, h, stoneCol);
  box(g, x, y, 0.19, 0.19, z0 + h * 0.72, 2.5, gold);
  cone(g, x, y, 0.16, z0 + h, 12, roofCol);
  const top = P(x, y, z0 + h + 13);
  g.strokeStyle = gold; g.lineWidth = 1.3;
  g.beginPath(); g.arc(top[0], top[1] - 2, 2.6, 0.4, Math.PI * 2 - 0.4); g.stroke();
}

function drawTorii(g, x, y, z0, h = 16) {
  const pL = P(x - 0.28, y, z0), pR = P(x + 0.28, y, z0);
  const tL = P(x - 0.28, y, z0 + h), tR = P(x + 0.28, y, z0 + h);
  g.strokeStyle = '#c82820'; g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(pL[0], pL[1]); g.lineTo(tL[0], tL[1]);
  g.moveTo(pR[0], pR[1]); g.lineTo(tR[0], tR[1]);
  g.moveTo(tL[0] - 4, tL[1] + 3); g.lineTo(tR[0] + 4, tR[1] + 3);
  g.stroke();
  g.strokeStyle = '#221c18'; g.lineWidth = 2.8;
  g.beginPath();
  g.moveTo(tL[0] - 6, tL[1] - 1);
  g.quadraticCurveTo((tL[0] + tR[0]) / 2, (tL[1] + tR[1]) / 2 + 1.5, tR[0] + 6, tR[1] - 1);
  g.stroke();
}

function drawCivBuildingOverlay(g, type, st, pc, civ, isKenney, opts = {}) {
  const spec = civSpec(civ);
  const agePal = spec.ages[Math.min(5, Math.max(0, st))];
  const size = BUILDINGS[type] ? BUILDINGS[type].size : 2;
  const r = size / 2;
  const gold = '#e8c040';
  const topZ = (BLD_H[type] || 50) * (isKenney ? 0.58 : 0.72);

  // 1. Civilization-specific roof & crown ornament on major & civic buildings (civ sprites model their own; opts.crown = false)
  if (opts.crown !== false && st >= 1 && !BUILDINGS[type]?.wall && type !== 'palisade' && type !== 'outpost') {
    if (spec.family === 'east') {
      if (size >= 2) drawEastEaves(g, 0, 0, r * 0.72, r * 0.72, topZ * 0.55, agePal.roof, gold);
      if (civ === 'japanese' && size >= 3) drawShachihoko(g, 0, 0, topZ * 0.92);
      if (civ === 'chinese' && size >= 3 && st >= 2) {
        // Hanging red paper lanterns at front eaves
        for (const lx of [-r * 0.45, r * 0.45]) {
          const lp = P(lx, r * 0.78, 12);
          g.fillStyle = '#d82820'; g.beginPath(); g.ellipse(lp[0], lp[1], 2.4, 3.2, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = gold; g.fillRect(lp[0] - 1.2, lp[1] - 3.6, 2.4, 1); g.fillRect(lp[0] - 1.2, lp[1] + 2.8, 2.4, 1);
        }
      }
    } else if (spec.family === 'islamic' || spec.family === 'byzantine') {
      if (size >= 3 && st >= 1 && typeof vicDome === 'function' && (type === 'tc' || type === 'monastery' || type === 'university' || type === 'market' || type === 'castle')) {
        const dz = type === 'castle' ? 68 : type === 'tc' ? 54 : 38;
        const dr = type === 'castle' ? 0.48 : type === 'tc' ? 0.42 : 0.34;
        vicDome(g, 0, 0, dr, dz, 18, agePal.dome, spec.family === 'islamic' ? 1.22 : 1.0);
        const fn = P(0, 0, dz + 20);
        g.strokeStyle = gold; g.lineWidth = 1.4;
        if (spec.family === 'islamic') {
          g.beginPath(); g.arc(fn[0], fn[1] - 2, 3, 0.4, Math.PI * 2 - 0.4); g.stroke();
        } else {
          g.beginPath(); g.moveTo(fn[0], fn[1] + 2); g.lineTo(fn[0], fn[1] - 6); g.moveTo(fn[0] - 2.5, fn[1] - 3.5); g.lineTo(fn[0] + 2.5, fn[1] - 3.5); g.stroke();
        }
      }
      if (spec.family === 'islamic' && type === 'monastery' && st >= 1) {
        drawMinaret(g, 0.95, -0.85, 4, 48, agePal.stone, agePal.dome, gold);
      }
    } else if (spec.family === 'nordic') {
      if (size >= 2) drawDragonFinials(g, 0, 0, topZ * 0.85, agePal.trim, gold);
      // Hung Viking round shields along eaves
      if (size >= 2 && (type === 'tc' || type === 'barracks' || type === 'house' || type === 'castle' || type === 'dock')) {
        const cnt = size >= 3 ? 4 : 2;
        for (let k = 0; k < cnt; k++) {
          const sx = -r * 0.55 + k * (r * 1.1 / Math.max(1, cnt - 1));
          const sp = P(sx, r * 0.72, 13);
          drawCivShield(g, 'vikings', pc, sp[0], sp[1], 3.1, st >= 2);
        }
      }
    } else if (spec.family === 'west') {
      // Distinctive Western European crowns & stone details
      if (civ === 'teutons' && size >= 3 && st >= 2) {
        // Brick-Gothic stepped gable & black-cross escutcheon
        const ep = P(0, r * 0.75, 22);
        drawCivShield(g, 'teutons', pc, ep[0], ep[1], 3.8, true);
      } else if (civ === 'spanish' && size >= 3 && st >= 2 && typeof vicDome === 'function') {
        // Mudéjar octagonal terracotta cupola
        vicDome(g, -0.2, -0.2, 0.28, topZ * 0.75, 13, agePal.dome, 1.05);
      } else if (civ === 'italians' && size >= 3 && st >= 2 && typeof vicDome === 'function') {
        // Renaissance terracotta ribbed dome lantern
        vicDome(g, -0.15, -0.15, 0.32, topZ * 0.75, 15, agePal.dome, 1.0);
      }
    }
  }

  // 2. Building-type cultural courtyard props
  if (type === 'monastery' && civ === 'japanese') {
    drawTorii(g, -0.25, 1.28, 4, 15);
  } else if (type === 'monastery' && civ === 'chinese' && st >= 1) {
    // Tiered pagoda roof crown over the sanctuary
    for (let k = 0; k < 2; k++) {
      drawEastEaves(g, 0.78, -0.78, 0.38 - k * 0.08, 0.38 - k * 0.08, 44 + k * 12, agePal.roof, gold);
    }
  } else if (type === 'blacksmith') {
    // Display a shield & weapon of the owner's civilization on the forge rack
    const sp = P(-0.55, 0.92, 7);
    drawCivShield(g, civ, pc, sp[0], sp[1], 3.4, st >= 2);
  } else if (type === 'well' && st >= 1) {
    if (spec.family === 'islamic' && typeof vicDome === 'function') {
      vicDome(g, 0, 0, 0.28, 14, 10, agePal.dome, 1.15);
    } else if (spec.family === 'east') {
      drawEastEaves(g, 0, 0, 0.34, 0.34, 14, agePal.roof, gold);
    }
  }

  // 3. Heraldic Civilization Banner / Escutcheon on every non-wall building
  if (type !== 'palisade' && type !== 'wall' && type !== 'farm') {
    const bx = size >= 3 ? -r + 0.32 : -r + 0.22;
    const by = r - 0.18;
    const bz = size >= 3 ? 16 : 11;
    const bp = P(bx, by, bz);
    drawCivShield(g, civ, pc, bp[0], bp[1], size >= 3 ? 4.2 : 3.2, st >= 2);
  }

  // 4. Era 4 (Modern Age) & Era 5 (Future Age) Architectural Retrofits for ALL buildings
  if (st === 4 && type !== 'palisade') {
    // Modern Age: Industrial steel roof truss/antenna, ventilator stack & warm electric floodlight
    const mp = P(r * 0.45, -r * 0.45, topZ * 0.65);
    g.fillStyle = '#3c444c';
    g.fillRect(mp[0] - 2.2, mp[1] - 12, 4.4, 12);
    g.fillStyle = '#b85238';
    g.fillRect(mp[0] - 2.6, mp[1] - 13, 5.2, 2.2);
    if (size >= 2) {
      // Radio / telegraph mast
      const ap = P(-r * 0.45, -r * 0.45, topZ * 0.78);
      g.strokeStyle = '#5a6874'; g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(ap[0] - 3, ap[1]); g.lineTo(ap[0], ap[1] - 16); g.lineTo(ap[0] + 3, ap[1]);
      g.moveTo(ap[0] - 2, ap[1] - 6); g.lineTo(ap[0] + 2, ap[1] - 6);
      g.stroke();
      g.fillStyle = '#ff6040';
      g.beginPath(); g.arc(ap[0], ap[1] - 16.5, 1.5, 0, Math.PI * 2); g.fill();
    }
  } else if (st >= 5 && type !== 'palisade') {
    // Future Age: Glowing cyan/accent energy conduits, solar array strip & levitating holo-beacon
    const glow = agePal.accent || '#5ce6ff';
    const fp1 = P(-r * 0.65, r * 0.72, 6), fp2 = P(r * 0.65, r * 0.72, 6);
    const fp3 = P(r * 0.72, -r * 0.65, 6);
    g.strokeStyle = glow; g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(fp1[0], fp1[1]); g.lineTo(fp2[0], fp2[1]); g.lineTo(fp3[0], fp3[1]);
    g.stroke();
    if (size >= 2) {
      const hp = P(0, 0, topZ * 0.85 + 8);
      g.strokeStyle = glow; g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(hp[0], hp[1], 6 + size * 2, 2.5 + size * 0.8, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#e8ffff';
      g.beginPath(); g.arc(hp[0], hp[1] - 3, 2.2, 0, Math.PI * 2); g.fill();
    }
  }
}

// ---------- 3. Per-Civilization & Per-Age Unit Equipment, Helmets, Shields, Mounts & Weapons ----------
function drawCivHeadgear(g, u, d, civ, age, pc, hx, hy) {
  const spec = civSpec(civ);
  g.save();
  g.translate(hx, hy);
  if (d.draw === 'villager') {
    if (age >= 5) {
      // Future exo-visor
      g.fillStyle = '#d8e4f0'; g.beginPath(); g.arc(0, -1, 3.3, Math.PI, 0); g.fill();
      g.fillStyle = '#48e8ff'; g.fillRect(-1.5, -1.8, 4.2, 1.5);
    } else if (age === 4) {
      // Modern industrial hardhat
      g.fillStyle = '#e8b830'; g.beginPath(); g.arc(0, -1.5, 3.4, Math.PI, 0); g.fill();
      g.fillRect(-3.8, -1.8, 7.8, 1.1);
    } else if (spec.family === 'east' && age >= 1) {
      // Conical bamboo douli / sugegasa hat
      g.fillStyle = '#d8bc78'; g.strokeStyle = '#7a5c28'; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(-5.2, -1); g.lineTo(0, -4.8); g.lineTo(5.2, -1); g.closePath(); g.fill(); g.stroke();
    } else if (spec.family === 'islamic' && age >= 1) {
      // Wrapped keffiyeh / turban
      g.fillStyle = civ === 'turks' ? '#c83028' : '#f0ead8';
      g.beginPath(); g.ellipse(0, -2.2, 3.5, 2.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = pc.c; g.fillRect(-3, -2.2, 6, 1.0);
    } else if (spec.family === 'nordic' && age >= 1) {
      // Fur-trimmed Nordic wool cap
      g.fillStyle = pc.c; g.beginPath(); g.arc(0, -1.8, 3.1, Math.PI, 0); g.fill();
      g.fillStyle = '#6a4c32'; g.fillRect(-3.3, -2.0, 6.6, 1.4);
    } else if (age >= 2) {
      // Regional artisan beret / hood
      g.fillStyle = pc.c; g.beginPath(); g.ellipse(0, -2.4, 3.6, 1.8, -0.15, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    return;
  }

  if (d.draw === 'monk') {
    if (spec.family === 'east') {
      if (civ === 'japanese') {
        // Sohei white cowl wrap & tokin box
        g.fillStyle = '#f4f0e8'; g.beginPath(); g.arc(0, -1.8, 3.3, Math.PI * 0.85, 0.15); g.fill();
        g.fillStyle = '#1e1e1e'; g.fillRect(1.2, -4.2, 1.8, 1.8);
      } else {
        // Chinese Daoist / Chan lotus crown
        g.fillStyle = '#384048'; g.fillRect(-2.2, -4.8, 4.4, 2.6);
        g.fillStyle = '#e8c040'; g.fillRect(-1.2, -5.8, 2.4, 1.4);
      }
    } else if (spec.family === 'islamic') {
      // Imam turban with emerald/gold band
      g.fillStyle = '#f4efe2'; g.beginPath(); g.ellipse(0, -2.4, 3.8, 2.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1e824c'; g.fillRect(-3.2, -2.5, 6.4, 1.1);
    } else if (spec.family === 'byzantine') {
      // Orthodox kalimavkion cylindrical hat & veil
      g.fillStyle = '#222028'; g.fillRect(-2.8, -5.2, 5.6, 3.8);
      g.fillStyle = '#e8c040'; g.fillRect(-0.5, -4.6, 1.0, 2.6); g.fillRect(-1.4, -3.7, 2.8, 0.9);
    } else if (spec.family === 'nordic') {
      // Norse Godi runic circlet
      g.fillStyle = '#d8a838'; g.fillRect(-3.1, -2.6, 6.2, 1.3);
    } else if (age >= 3) {
      // Mitre trim in Imperial Age
      g.fillStyle = '#f4efe2'; g.beginPath(); g.moveTo(-2.6, -1.8); g.lineTo(0, -5.8); g.lineTo(2.6, -1.8); g.closePath(); g.fill();
      g.strokeStyle = '#e8c040'; g.lineWidth = 0.8; g.stroke();
    }
    g.restore();
    return;
  }

  // Military headgear by civilization
  const helm = spec.helmStyle;
  if (helm === 'kabuto') {
    // Japanese Kabuto with shikoro neck plates & golden maedate horns
    g.fillStyle = '#2a2c32';
    g.beginPath(); g.arc(0, -1.5, 3.6, Math.PI, 0); g.fill();
    g.fillStyle = pc.c; g.fillRect(-4.0, -1.5, 2.2, 2.6);
    g.fillStyle = '#f0bc30';
    g.beginPath(); g.moveTo(-1, -2.8); g.lineTo(1.8, -6.5); g.lineTo(3.5, -2.8); g.closePath(); g.fill();
  } else if (helm === 'song') {
    // Chinese Song/Ming iron brimmed helm with red tassel plume
    g.fillStyle = '#707882';
    g.beginPath(); g.arc(0, -1.6, 3.4, Math.PI, 0); g.fill();
    g.fillRect(-4.2, -1.6, 8.4, 1.0);
    g.fillStyle = '#d82820';
    g.beginPath(); g.moveTo(0, -4.8); g.quadraticCurveTo(-3.5, -7.2, -4.5, -3.5); g.lineTo(0, -3.8); g.fill();
  } else if (helm === 'spectacle') {
    // Viking Gjermundbu spectacle helm
    g.fillStyle = '#7c828a';
    g.beginPath(); g.arc(0, -1.6, 3.4, Math.PI, 0); g.fill();
    g.strokeStyle = '#d8b040'; g.lineWidth = 0.8;
    g.beginPath(); g.arc(1.2, -1.0, 1.1, 0, Math.PI * 2); g.stroke();
  } else if (helm === 'turban') {
    // Saracen turbaned spangenhelm + mail aventail
    g.fillStyle = '#d8b040'; g.beginPath(); g.moveTo(-2, -2); g.lineTo(0, -5.2); g.lineTo(2, -2); g.fill();
    g.fillStyle = pc.l || '#f0ead8'; g.beginPath(); g.ellipse(0, -1.8, 3.7, 1.9, 0, 0, Math.PI * 2); g.fill();
  } else if (helm === 'ottoman') {
    // Seljuk sharbush (early) or Ottoman chichak / Janissary plume (Castle+)
    if (age < 2) {
      g.fillStyle = '#2e8490'; g.beginPath(); g.moveTo(-2.8, -1.5); g.lineTo(0, -5.2); g.lineTo(2.8, -1.5); g.fill();
      g.fillStyle = '#5c4028'; g.fillRect(-3.4, -2.0, 6.8, 1.4);
    } else {
      g.fillStyle = '#b8c0c8'; g.beginPath(); g.moveTo(-3, -1.5); g.lineTo(0, -5.6); g.lineTo(3, -1.5); g.fill();
      g.fillStyle = '#e8c040'; g.fillRect(0.5, -6.8, 1.2, 2.5);
    }
  } else if (helm === 'spangen') {
    // Byzantine crested spangenhelm with purple/team plume
    g.fillStyle = '#c8a038'; g.beginPath(); g.arc(0, -1.6, 3.4, Math.PI, 0); g.fill();
    g.fillStyle = pc.c; g.beginPath(); g.ellipse(0, -4.8, 2.8, 1.3, 0, 0, Math.PI * 2); g.fill();
  } else if (helm === 'morion') {
    // Spanish high-combed Morion with curved brim
    g.fillStyle = '#b0b8c2';
    g.beginPath(); g.arc(0, -1.6, 3.3, Math.PI, 0); g.fill();
    g.beginPath(); g.moveTo(-4.4, -1.0); g.quadraticCurveTo(0, -2.4, 4.4, -1.0); g.lineWidth = 1.2; g.strokeStyle = '#b0b8c2'; g.stroke();
    g.fillStyle = '#d89828'; g.beginPath(); g.arc(0, -3.2, 2.2, Math.PI, 0); g.fill();
  } else if (helm === 'barbuta') {
    // Italian Barbuta / Sallet with St. George plume
    g.fillStyle = '#bcc4ce'; g.beginPath(); g.arc(0, -1.5, 3.4, Math.PI * 1.1, -0.1); g.fill();
    g.fillStyle = '#c82420'; g.beginPath(); g.arc(-0.8, -4.6, 1.8, 0, Math.PI * 2); g.fill();
  } else if (helm === 'greathelm') {
    // Teutonic Great Helm with gold cross visor
    g.fillStyle = '#8c949e'; g.fillRect(-3.1, -4.6, 6.2, 4.4);
    g.fillStyle = '#e8c040'; g.fillRect(0.5, -4.2, 1.0, 3.6); g.fillRect(-1.5, -2.8, 4.2, 0.9);
  } else {
    // Frankish bascinet with team plume
    g.fillStyle = '#a8b0ba'; g.beginPath(); g.arc(0, -1.6, 3.4, Math.PI, 0); g.fill();
    g.fillStyle = pc.c; g.beginPath(); g.moveTo(-0.5, -4.5); g.quadraticCurveTo(-3.5, -6.5, -4.2, -3.2); g.fill();
  }
  g.restore();
}

function drawCivUnitEquipment(g, u, t, civ, age, pc) {
  const d = UNITS[u.type];
  if (!d || d.animal || d.naval || u.type === 'cobra') return;
  const spec = civSpec(civ);
  const bob = u.anim === 'walk' ? Math.abs(Math.sin(t * 11)) * 0.9 : 0;
  const mounted = d.tags && d.tags.includes('mounted');
  const hy = (mounted ? -33.5 : -24.5) - bob;
  const hx = mounted ? 1.0 : 0.4;

  // 1. Civilization & Age Headgear
  drawCivHeadgear(g, u, d, civ, age, pc, hx, hy);

  // 2. Japanese Sashimono back-banner on Castle/Imperial military units
  if (civ === 'japanese' && age >= 2 && (d.tags.includes('infantry') || mounted) && d.draw !== 'villager') {
    const bx = mounted ? -4.5 : -3.8, by = (mounted ? -26 : -17) - bob;
    g.strokeStyle = '#3a2818'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(bx, by + 4); g.lineTo(bx, by - 9); g.lineTo(bx - 3.6, by - 9); g.stroke();
    g.fillStyle = pc.c; g.fillRect(bx - 3.6, by - 8.8, 3.2, 6.8);
    g.fillStyle = '#f0bc30'; g.fillRect(bx - 2.5, by - 6.2, 1.2, 1.2);
  }

  // 3. Per-Civilization Shield & Tier Equipment
  if (['militia', 'manatarms', 'longsword', 'spearman', 'skirmisher', 'eskirm', 'axeman'].includes(u.type)) {
    const heavy = ['longsword', 'eskirm', 'axeman'].includes(u.type);
    const r = u.type === 'militia' || u.type === 'spearman' || u.type === 'skirmisher' ? 3.2 : 3.9;
    drawCivShield(g, civ, pc, -4.4, -13 - bob, r, heavy);
  } else if (['knight', 'cavalier', 'paladin', 'cataphract'].includes(u.type)) {
    drawCivShield(g, civ, pc, -2.0, -17 - bob, u.type === 'paladin' ? 4.2 : 3.7, u.type !== 'knight');
    // Distinct tier barding trim on horse flank
    if (u.type === 'cavalier' || u.type === 'paladin') {
      g.strokeStyle = u.type === 'paladin' ? '#f0c840' : '#c8d0dc';
      g.lineWidth = u.type === 'paladin' ? 1.5 : 1.0;
      g.beginPath(); g.moveTo(-10, -8.5 - bob); g.lineTo(9.5, -8.5 - bob); g.stroke();
    }
  } else if (u.type === 'lightcav') {
    drawCivShield(g, civ, pc, -2.0, -17 - bob, 3.1, false);
  } else if (u.type === 'arbalest' || u.type === 'crossbow') {
    // Pavise back-shield or gilded prod for Arbalest
    if (u.type === 'arbalest') {
      g.fillStyle = '#e8c040'; g.fillRect(3.2, -16 - bob, 4.5, 1.4);
      drawCivShield(g, civ, pc, -4.8, -14 - bob, 3.2, true);
    }
  } else if (u.type === 'monk' && u.owner) {
    // Cultural holy staff finial
    const sx = 6.2, sy = -24 - bob;
    g.strokeStyle = '#e8c040'; g.lineWidth = 1.2;
    if (spec.family === 'islamic') {
      g.beginPath(); g.arc(sx, sy, 2.2, 0.4, Math.PI * 2 - 0.4); g.stroke();
    } else if (spec.family === 'east') {
      g.beginPath(); g.arc(sx, sy, 2.2, 0, Math.PI * 2); g.stroke();
    } else {
      g.beginPath(); g.moveTo(sx, sy - 2.5); g.lineTo(sx, sy + 2.5); g.moveTo(sx - 2, sy - 0.5); g.lineTo(sx + 2, sy - 0.5); g.stroke();
    }
  } else if (['rifleman', 'marksman', 'plasmaguard', 'railgunner'].includes(u.type)) {
    // Era 4-5 shoulder pauldron with civilization emblem & distinct weapon barrel
    drawCivShield(g, civ, pc, -3.8, -14.5 - bob, 2.5, u.type === 'plasmaguard' || u.type === 'railgunner');
    if (u.type === 'marksman' || u.type === 'railgunner') {
      // Long sniper / rail barrel & optic scope
      g.fillStyle = u.type === 'railgunner' ? '#5ce6ff' : '#3a4048';
      g.fillRect(4.5, -15.5 - bob, 8.5, 1.4);
      g.fillStyle = u.type === 'railgunner' ? '#aef8ff' : '#d8a830';
      g.fillRect(5.5, -17.0 - bob, 3.2, 1.2);
    }
  } else if (u.type === 'tank' || u.type === 'fusionwalker') {
    // Civilization heraldic crest on armored hull
    drawCivShield(g, civ, pc, -2, -16 - bob, 4.2, true);
  }
}

// ---------- 4. Cultural & Age-Evolving Trade Carts ----------
function drawCivTradeCart(g, u, t, civ, age, pc, fallback) {
  const spec = civSpec(civ);
  const run = u.anim === 'walk';
  const wa = run ? t * 6 : 0;
  const bob = run ? Math.sin(t * 12) * 0.6 : 0;
  if (age >= 5) {
    // Age 5: Anti-Gravity Hover Hauler
    g.save();
    g.fillStyle = 'rgba(70,235,255,0.28)'; g.beginPath(); g.ellipse(0, 2, 18, 6, 0, 0, Math.PI * 2); g.fill();
    g.translate(0, -3 + Math.sin(t * 4 + (u.id || 0)) * 1.4);
    g.fillStyle = '#c8d6e4'; g.strokeStyle = '#385068'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-16, -4); g.lineTo(-13, -13); g.lineTo(10, -13); g.lineTo(16, -6); g.lineTo(15, -2); g.lineTo(-15, -2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#5ce6ff'; g.fillRect(6, -11, 7, 3.5);
    g.fillStyle = u.tradeGold ? '#f0c840' : pc.c; g.fillRect(-11, -11, 14, 5);
    drawCivEmblem(g, spec.emblem, -4, -8.5, 3.0, pc);
    g.restore();
    return true;
  }
  if (age === 4) {
    // Age 4: Industrial Motorized Cargo Truck
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, 2, 18, 6, 0, 0, Math.PI * 2); g.fill();
    g.translate(0, bob);
    for (const wx of [-10, 9]) {
      g.fillStyle = '#222'; g.beginPath(); g.arc(wx, -1, 4.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#888'; g.beginPath(); g.arc(wx, -1, 1.8, 0, Math.PI * 2); g.fill();
    }
    // Cargo bed & cab
    g.fillStyle = '#586254'; g.fillRect(-15, -14, 18, 10);
    g.fillStyle = pc.c; g.fillRect(3, -12, 10, 8);
    g.fillStyle = '#9ad0f0'; g.fillRect(8, -11, 4, 3.5);
    if (u.tradeGold) { g.fillStyle = '#f0c840'; g.fillRect(-13, -17, 14, 3.5); }
    drawCivShield(g, civ, pc, -6, -9, 3.2, false);
    g.restore();
    return true;
  }
  if (spec.cartStyle === 'camel' && typeof drawHorse === 'function') {
    // Saracen & Turkish Camel Caravan
    g.save();
    drawHorse(g, u, t, u.anim || 'idle', '#c89e64', pc, true, null, 0.92, 2);
    // Richly patterned saddlebags, silk packs & gold chest
    g.fillStyle = pc.c; g.strokeStyle = '#e8c040'; g.lineWidth = 0.8;
    g.fillRect(-5, -24 - bob, 11, 7); g.strokeRect(-5, -24 - bob, 11, 7);
    g.fillStyle = u.tradeGold ? '#f0c840' : '#d8c498';
    g.beginPath(); g.ellipse(0.5, -26 - bob, 5.5, 3.2, 0, 0, Math.PI * 2); g.fill();
    drawCivEmblem(g, spec.emblem, 0.5, -20.5 - bob, 2.8, pc);
    g.restore();
    return true;
  }
  // Standard draft horse + culturally styled wagon/carriage
  fallback.call(this, g, u, t);
  g.save();
  g.translate(-10, 0);
  if (spec.cartStyle === 'canopy') {
    // East Asian curved canopy silk carriage & lantern
    g.fillStyle = spec.ages[Math.min(3, age)].roof;
    g.strokeStyle = '#e8b838'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-9, -15); g.quadraticCurveTo(0, -22, 9, -15); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#d82820'; g.beginPath(); g.arc(8, -13, 1.8, 0, Math.PI * 2); g.fill();
  } else if (spec.cartStyle === 'nordic') {
    // Viking runic wagon with hung round shields
    drawCivShield(g, 'vikings', pc, -3, -9, 2.8, false);
    drawCivShield(g, 'vikings', pc, 3, -9, 2.8, false);
  } else if (age >= 2) {
    // Covered guild wagon arch with civ emblem
    g.fillStyle = '#f0e8d4'; g.strokeStyle = pc.c; g.lineWidth = 0.9;
    g.beginPath(); g.arc(0, -12, 7.2, Math.PI, 0); g.fill(); g.stroke();
    drawCivEmblem(g, spec.emblem, 0, -15.5, 3.0, pc);
  }
  g.restore();
  return true;
}

// ---------- 5. Cultural & Age-Evolving Naval Fleet Customizations ----------
function drawCivShipOverlay(g, u, t, pc, civ, age) {
  const spec = civSpec(civ);
  const type = u.type;
  const L = { fishingship: 16, transport: 24, tradecog: 22, galley: 26, wargalley: 28, galleon: 32, fireship: 26, demoship: 18 }[type] || 24;
  g.save();
  // 1. Maritime hull & sail tradition by civilization
  if (spec.sailStyle === 'longship') {
    // Viking Dragon Prow, Coiled Tail & Gunwale Round Shields
    g.strokeStyle = '#5a381c'; g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(L - 2, -7); g.quadraticCurveTo(L + 7, -14, L + 4, -20);
    g.moveTo(-L + 2, -6); g.quadraticCurveTo(-L - 5, -13, -L - 2, -17);
    g.stroke();
    g.fillStyle = '#e0a830'; g.beginPath(); g.arc(L + 4.5, -20.5, 2.0, 0, Math.PI * 2); g.fill();
    for (let k = -2; k <= 2; k++) {
      drawCivShield(g, 'vikings', pc, k * (L * 0.32), -5.5, 2.6, false);
    }
  } else if (spec.sailStyle === 'junk') {
    // Chinese / Japanese Bamboo Sail Battens & Aft Pavilion Roof
    g.strokeStyle = 'rgba(110,65,25,0.65)'; g.lineWidth = 0.9;
    for (let y = -28; y <= -14; y += 3.5) {
      g.beginPath(); g.moveTo(-7, y); g.lineTo(9, y - 1); g.stroke();
    }
    // Upturned East Asian stern cabin roof
    g.fillStyle = spec.ages[Math.min(3, age)].roof;
    g.beginPath(); g.moveTo(-L - 2, -13); g.quadraticCurveTo(-L + 5, -16, -L + 11, -12); g.lineTo(-L - 2, -11); g.closePath(); g.fill();
  } else if (spec.sailStyle === 'lateen') {
    // Mediterranean / Islamic Lateen Yardarm & Bronze Spur
    g.strokeStyle = '#5c3c1e'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-9, -12); g.lineTo(10, -32); g.stroke();
    g.fillStyle = '#d8a838';
    g.beginPath(); g.moveTo(L, -3); g.lineTo(L + 8, -2); g.lineTo(L, -0.5); g.closePath(); g.fill();
  }

  // 2. Civilization Heraldic Emblem on Main Sail (for sailed ships)
  if (type !== 'demoship') {
    const sy = type === 'galleon' ? -24 : type === 'fishingship' ? -18 : -22;
    drawCivShield(g, civ, pc, 1, sy, type === 'fishingship' ? 2.8 : 4.2, true);
  }

  // 3. Modern Age (Age 4) & Future Age (Age 5) Naval Retrofits
  if (age === 4 && type !== 'fishingship') {
    // Steel gunhouse turret & funnel
    g.fillStyle = '#505a64'; g.fillRect(L * 0.35, -12, 7, 4.5);
    g.fillStyle = '#2e343a'; g.fillRect(L * 0.35 + 6, -10.5, 6, 1.6);
  } else if (age >= 5 && type !== 'fishingship') {
    // Future plasma rail turret & glowing hull trim
    g.strokeStyle = '#5ce6ff'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-L + 3, -4); g.lineTo(L - 1, -5); g.stroke();
    g.fillStyle = '#d0e2f0'; g.fillRect(L * 0.35, -12.5, 7.5, 4.5);
    g.fillStyle = '#5ce6ff'; g.fillRect(L * 0.35 + 6, -11, 7, 1.8);
  }
  g.restore();
}

// ---------- 6. Engine Wiring (Buildings, Wonders, Units, Ships, Farms & HUD Icons) ----------
(function wireCivArt() {
  // A. Wonder names for all 10 civilizations × 6 ages
  if (typeof wonderName === 'function') {
    wonderName = function (p) {
      const age = Math.min(5, p?.age || 0);
      const civ = p?.civ || 'franks';
      return (CIV_WONDER_NAMES[civ] || WONDER_NAMES)[age];
    };
  }

  // B. Every building advances visually across all 6 ages (0..5)
  if (typeof bldStyle === 'function') {
    bldStyle = function (b) {
      if (b && b.ghost && b.style !== undefined) return b.style;
      const p = typeof W !== 'undefined' && W && W.players && W.players[b?.owner];
      return p ? Math.min(5, p.age || 0) : 0;
    };
  }

  // C. Wrap drawBuildingArt so Classic/HD drawn buildings use the civilization's age palette + architectural overlay
  if (typeof drawBuildingArt === 'function') {
    const _baseDrawBuildingArt = drawBuildingArt;
    drawBuildingArt = function (g, type, st, pc, t) {
      const civ = (typeof HDB !== 'undefined' && HDB && HDB.civ) ? HDB.civ : (typeof W !== 'undefined' && W && W.players ? (W.players.find(q => q && q.color === pc)?.civ || 'franks') : 'franks');
      const spec = civSpec(civ);
      const pal = spec.ages[Math.min(5, Math.max(0, st))];
      const slot = Math.min(3, Math.max(0, st));
      const saved = Object.assign({}, STYLE[slot]);
      try {
        Object.assign(STYLE[slot], { wall: pal.wall, roof: pal.roof, trim: pal.trim, base: pal.base, beams: pal.beams, stone: pal.stone });
        _baseDrawBuildingArt.call(this, g, type, st, pc, t);
        drawCivBuildingOverlay(g, type, st, pc, civ, false);
      } finally {
        Object.assign(STYLE[slot], saved);
      }
    };
  }

  // age suffix of a sprite name (house_turks_2 -> 2); -1 when there is none
  const ageOf = k => { const n = +k.slice(k.lastIndexOf('_') + 1); return Number.isFinite(n) ? n : -1; };

  // D. Wrap bldSprite so building cache keys include (type, st, pc.c, civ) and cultural Kenney assets are selected
  if (typeof bldSprite === 'function') {
    const _baseBldSprite = bldSprite;
    bldSprite = function (type, st, pc, civArg) {
      const civ = civArg || (typeof W !== 'undefined' && W && W.players ? (W.players.find(q => q && q.color === pc)?.civ || 'franks') : 'franks');
      const spec = civSpec(civ);
      if (typeof KART !== 'undefined' && KART.on) {
        // a civilization's own building set is fetched the first time that civ is drawn
        if (!KART.civs.has(civ)) KART.loadCiv(civ);
        // per-civilization building sets (e.g. house_turks_2, castle_turks_2) replace the shared sprite unless the
        // shared one is newer, so the dedicated Modern/Future Town Centers (tc_4, tc_5) still win over tc_saracens_3
        const shared = kartKey(type, st), own = civKartKey(type, civ, st);
        const civSet = own && (!shared || ageOf(own) >= ageOf(shared)) ? own : null;
        let name = civSet;
        // cultural hero castles (castle_east, castle_med, castle_nordic) for civs without a castle of their own
        if (!name && type === 'castle') {
          const famKey = spec.family === 'east' ? 'castle_east' : (spec.family === 'islamic' || spec.family === 'byzantine') ? 'castle_med' : spec.family === 'nordic' ? 'castle_nordic' : 'castle';
          if (KART.img[famKey]) name = famKey;
        }
        if (!name) name = shared;
        if (name && KART.img[name]) {
          const key = name + '|' + st + '|' + pc.c + '|' + civ;
          let s = KART.cache.get(key);
          if (!s) {
            const size = BUILDINGS[type].size;
            const under = type !== 'dock' && !BUILDINGS[type].wall && type !== 'gate' && type !== 'outpost' ? g => {
              const r = size / 2 - 0.04;
              poly(g, [P(-r + 0.08, -r + 0.18, 0), P(r + 0.18, -r + 0.18, 0), P(r + 0.18, r + 0.18, 0), P(-r + 0.04, r + 0.18, 0)], 'rgba(0,0,0,0.16)');
            } : null;
            s = kartSprite(name, g => {
              flag(g, -size / 2 + 0.12, size / 2 - 0.12, 0, pc.c, 0.3, size >= 3 ? 0.92 : 0.72);
              if (typeof vicBanner === 'function' && size >= 3) {
                if (type === 'wonder' || type === 'castle') {
                  vicBanner(g, -0.75, size / 2 - 0.22, 18, pc, 16);
                  vicBanner(g, 0.75, size / 2 - 0.22, 18, pc, 16);
                } else {
                  vicBanner(g, size / 2 - 0.22, 0.55, 16, pc, 13);
                }
              }
              drawCivBuildingOverlay(g, type, st, pc, civ, true, civSet ? { crown: false } : undefined);
            }, under);
            s.staticSails = type === 'mill';
            KART.cache.set(key, s);
          }
          return s;
        }
      }
      // Classic / HD drawn building path with per-civ key
      const key = type + '|' + st + '|' + pc.c + '|' + civ;
      let s = R.spriteCache.get(key);
      if (s) return s;
      if (typeof HDB === 'object') HDB.civ = civ;
      try {
        const size = BUILDINGS[type].size, SC = 2;
        const w = size * TW + 60, h = size * TH + (BLD_H[type] || 60) + 60;
        const cv = document.createElement('canvas'); cv.width = w * SC; cv.height = h * SC;
        const g = cv.getContext('2d'); g.scale(SC, SC);
        const ax = w / 2, ay = h - size * TH / 2 - 14;
        g.translate(ax, ay);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        poly(g, [P(-size / 2 + 0.1, -size / 2 + 0.1 + 0.25, 0), P(size / 2 + 0.25, -size / 2 + 0.25, 0), P(size / 2 + 0.25, size / 2 + 0.25, 0), P(-size / 2, size / 2 + 0.25, 0)], 'rgba(0,0,0,0.2)');
        if (type !== 'dock' && !BUILDINGS[type].wall && type !== 'gate' && type !== 'outpost') {
          poly(g, [P(-size / 2, -size / 2, 0), P(size / 2, -size / 2, 0), P(size / 2, size / 2, 0), P(-size / 2, size / 2, 0)], 'rgba(150,130,95,0.55)');
        }
        drawBuildingArt(g, type, st, pc, 0.3);
        s = { cv, ax, ay, w, h, SC };
        R.spriteCache.set(key, s);
        return s;
      } finally {
        if (typeof HDB === 'object') HDB.civ = null;
      }
    };
  }

  // E. Pass owner's civilization into bldSprite inside drawBuilding
  if (typeof drawBuilding === 'function') {
    const _baseDrawBuilding = drawBuilding;
    drawBuilding = function (ctx, b, alpha) {
      const p = typeof W !== 'undefined' && W && W.players && W.players[b.owner];
      const civ = b.civ || (p && p.civ) || 'franks';
      const origBldSprite = bldSprite;
      bldSprite = (type, st, pc) => origBldSprite(type, st, pc, civ);
      try {
        return _baseDrawBuilding.call(this, ctx, b, alpha);
      } finally {
        bldSprite = origBldSprite;
      }
    };
  }

  // F. Cultural Farm borders & Age 5 hydroponic strips
  if (typeof drawFarm === 'function') {
    const _baseDrawFarm = drawFarm;
    drawFarm = function (ctx, b, gp) {
      _baseDrawFarm.call(this, ctx, b, gp);
      if (!b || !b.built) return;
      const civ = civOfOwner(b.owner);
      const age = ageOfOwner(b.owner);
      const spec = civSpec(civ);
      ctx.save();
      ctx.translate(gp.x, gp.y);
      const corners = [P(-1.42, -1.42, 0), P(1.42, -1.42, 0), P(1.42, 1.42, 0), P(-1.42, 1.42, 0)];
      if (age >= 5) {
        ctx.strokeStyle = 'rgba(80,235,255,0.55)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); corners.forEach((c, i) => i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1])); ctx.closePath(); ctx.stroke();
      } else if (spec.family === 'east') {
        ctx.strokeStyle = '#9a8248'; ctx.lineWidth = 1.2;
        ctx.beginPath(); corners.forEach((c, i) => i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1])); ctx.closePath(); ctx.stroke();
      } else if (spec.family === 'islamic') {
        // Irrigation channel border
        ctx.strokeStyle = 'rgba(55,145,175,0.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(corners[0][0], corners[0][1]); ctx.lineTo(corners[3][0], corners[3][1]); ctx.lineTo(corners[2][0], corners[2][1]); ctx.stroke();
      }
      ctx.restore();
    };
  }

  // G. Wrap drawShip to support cultural naval hull sprites (ship_longship, ship_junk, ship_dromon) & overlays
  if (typeof drawShip === 'function') {
    const _baseDrawShip = drawShip;
    drawShip = function (g, u, t, pc, attacking, since) {
      const civ = u.civ || civOfOwner(u.owner);
      const age = u.age !== undefined ? u.age : ageOfOwner(u.owner);
      const spec = civSpec(civ);
      const type = u.type;
      if (typeof KART !== 'undefined' && KART.on && ['galley', 'wargalley', 'fireship'].includes(type)) {
        const cultKey = spec.sailStyle === 'longship' ? 'ship_longship' : spec.sailStyle === 'junk' ? 'ship_junk' : spec.sailStyle === 'lateen' ? 'ship_dromon' : null;
        if (cultKey && KART.img[cultKey]) {
          const m = KENNEY_ART[cultKey], im = KART.img[cultKey];
          const bob = Math.sin(t * 2 + (u.id || 0)) * 1.2, roll = Math.sin(t * 1.5 + (u.id || 0)) * 0.025;
          const L = type === 'wargalley' ? 28 : 26;
          const sc = type === 'wargalley' ? 0.96 : 0.90;
          g.save();
          g.rotate(roll); g.translate(0, bob);
          if (u.anim === 'walk') {
            g.strokeStyle = 'rgba(255,255,255,0.48)'; g.lineWidth = 1.5;
            g.beginPath(); g.moveTo(-L, 2); g.quadraticCurveTo(-L - 10, 6, -L - 22, 4 + Math.sin(t * 5) * 2); g.stroke();
          }
          g.fillStyle = 'rgba(0,20,40,0.32)'; g.beginPath(); g.ellipse(0, 2, L + 2, 7, 0, 0, 6.3); g.fill();
          g.drawImage(im, -m.ax * sc, -m.ay * sc + 8, m.w * sc, m.h * sc);
          drawCivShipOverlay(g, u, t, pc, civ, age);
          if (type === 'fireship') {
            g.fillStyle = '#3a2418'; g.fillRect(L - 8, -10, 9, 3);
            drawFlame(g, L + 2, -9, attacking && since < 0.45 ? 1.05 : 0.55, t);
          }
          g.restore();
          return;
        }
      }
      _baseDrawShip.call(this, g, u, t, pc, attacking, since);
      drawCivShipOverlay(g, u, t, pc, civ, age);
    };
  }

  // H. Wrap unit figure drawing (both UHD.drawFig when UHD is active and drawUnitFigure otherwise)
  function wrapUnitFig(baseFn) {
    return function (g, u, t) {
      const d = UNITS[u.type];
      if (!d) return baseFn.apply(this, arguments);
      const civ = u.civ || civOfOwner(u.owner);
      const age = u.age !== undefined ? u.age : ageOfOwner(u.owner);
      const pc = pcolor(u.owner);
      if (d.draw === 'cart') {
        drawCivTradeCart.call(this, g, u, t, civ, age, pc, baseFn);
        return;
      }
      baseFn.apply(this, arguments);
      if (d.tags && d.tags.includes('siege') && u.type !== 'tank' && u.type !== 'fusionwalker') {
        drawCivShield(g, civ, pc, -5, -14, 3.2, u.type === 'cappedram' || u.type === 'onager' || u.type === 'trebuchet');
        return;
      }
      drawCivUnitEquipment(g, u, t, civ, age, pc);
    };
  }
  if (typeof UHD !== 'undefined' && UHD.drawFig) {
    UHD.drawFig = wrapUnitFig(UHD.drawFig);
  } else if (typeof drawUnitFigure === 'function') {
    drawUnitFigure = wrapUnitFig(drawUnitFigure);
  }

  // H2. Enhance UnitArt.theme so Saracens also use Seljuk/Middle-Eastern actor rigs in 'auto' mode
  if (typeof UnitArt === 'object' && typeof UnitArt.theme === 'function') {
    const _baseTheme = UnitArt.theme;
    UnitArt.theme = function (u) {
      const th = _baseTheme.call(this, u);
      if (this.mode === 'auto' && th === 'medieval') {
        const civ = u.civ || civOfOwner(u.owner);
        if (civ === 'saracens') return 'seljuk';
      }
      return th;
    };
  }

  // I. Include civilization & age in uhdExtra so UHD caches each nation's & era's unit sprites distinctly
  if (typeof uhdExtra === 'function') {
    const _baseUhdExtra = uhdExtra;
    uhdExtra = function (u, d) {
      const base = _baseUhdExtra(u, d);
      if (!d || (typeof UHD !== 'undefined' && UHD.ANIMAL && UHD.ANIMAL.has(d.draw))) return base;
      const civ = u.civ || civOfOwner(u.owner);
      const age = u.age !== undefined ? u.age : ageOfOwner(u.owner);
      return base + '/' + civ + ':' + age;
    };
  }

  // J. Include civilization & age in iconFor so HUD buttons and unit/building portraits match the player's nation & era
  if (typeof iconFor === 'function') {
    const _baseIconFor = iconFor;
    iconFor = function (key) {
      const atI = key.indexOf('@'), iconOwner = atI > 0 ? +key.slice(atI + 1) : (typeof W !== 'undefined' && W ? W.humanId : 1);
      const baseKey = atI > 0 ? key.slice(0, atI) : key;
      const civ = civOfOwner(iconOwner);
      const age = ageOfOwner(iconOwner);
      const pc = typeof W !== 'undefined' && W && W.players && W.players[iconOwner] ? W.players[iconOwner].color : PLAYER_COLORS[0];
      const [kind, id] = baseKey.includes(':') ? baseKey.split(':') : ['tech', baseKey];
      const fullKey = `${key}|${civ}|${age}|${pc.c}`;
      if (ICONS.has(fullKey)) return ICONS.get(fullKey);
      if (kind === 'bld' && BUILDINGS[id]) {
        const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
        const g = cv.getContext('2d');
        const grd = g.createLinearGradient(0, 0, 0, 64); grd.addColorStop(0, '#5a4a36'); grd.addColorStop(1, '#2a2218'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
        const sp = bldSprite(id, age, pc, civ);
        const sc = Math.min(56 / sp.w, 56 / sp.h) * 1.15;
        if (id === 'farm') {
          g.save(); g.translate(32, 36); g.scale(0.34, 0.34);
          drawFarm(g, { built: true, food: 175, owner: iconOwner, x: 0, y: 0, progress: 1 }, { x: 0, y: 0 });
          g.restore();
        } else {
          g.drawImage(sp.cv, 32 - sp.w * sc / 2, 60 - sp.h * sc, sp.w * sc, sp.h * sc);
        }
        const url = cv.toDataURL();
        ICONS.set(fullKey, url);
        return url;
      }
      ICONS.delete(key);
      const url = _baseIconFor(key);
      ICONS.set(fullKey, url);
      return url;
    };
  }
})();
