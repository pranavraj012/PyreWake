// Material ids are baked into each vertex; the surface shader looks its parameters up here.
// layer indexes the texture arrays: 0 rock, 1 ash ground, 2 fibrous bark, 3 char, 4 leather, 5 weave, 6 iron, 7 cracked rock
export interface MatDef { id: number; layer: number; scale: number; tint: [number, number, number]; keep: number; rough: number; roughTex: number; metal: number; bump: number; edge: number; grime: number; ember: number }

const m = (id: number, layer: number, scale: number, tint: [number, number, number], o: Partial<MatDef> = {}): MatDef =>
  ({ id, layer, scale, tint, keep: 0.5, rough: 0.75, roughTex: 0.6, metal: 0, bump: 1, edge: 0.3, grime: 0.5, ember: 0, ...o });

// `keep` = how much of the scan's own hue survives versus the tint.
export const MATS: MatDef[] = [
  m(0, 4, 6, [0.40, 0.25, 0.18], { keep: 0.1, rough: 0.52, bump: 0.35, edge: 0.1, grime: 0.7 }),       // skin
  m(1, 3, 5, [0.045, 0.04, 0.038], { keep: 0.35, rough: 0.82, bump: 1.1, edge: 0.35, ember: 1 }),      // charred flesh
  m(2, 5, 4.5, [0.235, 0.22, 0.195], { keep: 0.15, rough: 0.92, bump: 1.2, edge: 0.3, grime: 0.9 }),     // bone-white wraps
  m(3, 4, 4, [0.075, 0.05, 0.036], { keep: 0.35, rough: 0.55, bump: 1.0, edge: 0.6 }),                 // leather
  m(4, 6, 2.2, [0.15, 0.15, 0.155], { keep: 0.5, rough: 0.46, metal: 0.9, bump: 0.8, edge: 0.75, grime: 0.8 }), // dark iron
  m(5, 5, 4.5, [0.052, 0.048, 0.046], { keep: 0.2, rough: 0.94, bump: 1.3, edge: 0.3 }),               // dark cloth
  m(6, 5, 4.5, [0.22, 0.035, 0.02], { keep: 0.15, rough: 0.88, bump: 1.2, edge: 0.35, grime: 0.9 }),   // rust-red sash
  m(7, 2, 9, [0.022, 0.017, 0.015], { keep: 0.2, rough: 0.42, bump: 1.0, edge: 0.2 }),                 // hair
  m(8, 4, 1, [0.5, 0.48, 0.44], { keep: 0, rough: 0.08, roughTex: 0, bump: 0, edge: 0, grime: 0 }),    // eye
  m(9, 4, 2.2, [0.36, 0.335, 0.3], { keep: 0.12, rough: 0.46, bump: 0.8, edge: 0.15, grime: 1.0 }),   // dead skin
  m(10, 7, 3, [0.5, 0.42, 0.28], { keep: 0.15, rough: 0.35, bump: 0.35, edge: 0.2, grime: 1.1 }),      // teeth, bone
  m(11, 2, 5, [0.17, 0.125, 0.08], { keep: 0.3, rough: 0.95, bump: 1.2, edge: 0.4 }),                  // rope
  m(12, 6, 1.1, [0.2, 0.13, 0.1], { keep: 0.75, rough: 0.6, metal: 0.65, bump: 1.2, edge: 0.7, grime: 1.0 }), // rusted iron
  m(13, 2, 6, [0.012, 0.011, 0.011], { keep: 0.1, rough: 0.24, roughTex: 0.3, bump: 0.8, edge: 0.1 }), // wet hair
  m(14, 6, 1.6, [0.4, 0.4, 0.41], { keep: 0.35, rough: 0.28, roughTex: 0.35, metal: 1, bump: 0.35, edge: 0.5 }), // blade steel
  m(15, 4, 3, [0.1, 0.012, 0.01], { keep: 0.1, rough: 0.18, roughTex: 0.2, bump: 0.8, edge: 0.0, grime: 1.1 }), // wet mouth flesh
  m(16, 0, 0.55, [0.235, 0.225, 0.21], { keep: 0.4, rough: 0.85, bump: 1.25, edge: 0.55, grime: 0.9 }), // stone
  m(17, 2, 0.95, [0.13, 0.112, 0.098], { keep: 0.35, rough: 0.9, bump: 2.2, edge: 0.4, grime: 0.9 }),   // banyan
  m(18, 5, 1.8, [0.27, 0.24, 0.2], { keep: 0.15, rough: 0.95, bump: 1.4, edge: 0.3, grime: 1.1 }),     // shroud
  m(19, 3, 0.9, [0.05, 0.042, 0.038], { keep: 0.4, rough: 0.9, bump: 1.4, edge: 0.4, ember: 0.6 }),    // burnt wood
  m(20, 7, 1.0, [0.42, 0.37, 0.29], { keep: 0.2, rough: 0.7, bump: 0.7, edge: 0.3, grime: 1.0 }),      // loose bone
  m(21, 1, 0.35, [0.17, 0.16, 0.152], { keep: 0.35, rough: 0.97, bump: 1.2, edge: 0.0, grime: 0.4 }),  // ash ground
  m(22, 3, 2.2, [0.12, 0.02, 0.008], { keep: 0.2, rough: 0.8, bump: 1.4, edge: 0, grime: 0, ember: 4 }),  // living fire: the One Beneath's core
  m(23, 5, 4.5, [0.03, 0.026, 0.024], { keep: 0.15, rough: 0.96, bump: 1.4, edge: 0.5, grime: 0.6, ember: 0.9 }),   // scorched cloth hem
  m(24, 2, 1.1, [0.085, 0.066, 0.05], { keep: 0.22, rough: 0.58, bump: 1.7, edge: 0.4, grime: 1.2 }),    // wet timber
  m(25, 1, 0.9, [0.14, 0.06, 0.035], { keep: 0.1, rough: 0.9, bump: 0.9, edge: 0.4, grime: 0.7 }),       // clay of the lamps
  m(26, 5, 2.6, [0.145, 0.125, 0.092], { keep: 0.15, rough: 0.96, bump: 1.5, edge: 0.3, grime: 1.0 }),    // wet hemp net
  m(27, 4, 2.2, [0.075, 0.085, 0.07], { keep: 0.1, rough: 0.5, bump: 0.5, edge: 0.15, grime: 0.9 }),     // old wet skin
  m(28, 2, 3.2, [0.026, 0.021, 0.015], { keep: 0.08, rough: 0.86, bump: 1.6, edge: 0.2, grime: 1.1 }),     // wet reed hat
  m(29, 6, 3, [0.36, 0.25, 0.1], { keep: 0.2, rough: 0.32, roughTex: 0.4, metal: 1, bump: 0.5, edge: 0.8, grime: 0.9 }), // tarnished fare coins
  m(30, 5, 3.4, [0.017, 0.018, 0.021], { keep: 0.1, rough: 0.62, roughTex: 0.5, bump: 1.4, edge: 0.25, grime: 0.5 }),   // soaked black shroud
  m(31, 4, 2.6, [0.115, 0.125, 0.12], { keep: 0.08, rough: 0.42, roughTex: 0.45, bump: 0.45, edge: 0.12, grime: 0.85 }),   // drowned skin
  // --- the Waiting House
  m(32, 5, 4.0, [0.24, 0.232, 0.22], { keep: 0.12, rough: 0.93, bump: 1.25, edge: 0.32, grime: 0.95 }),    // grey linen
  m(33, 5, 3.6, [0.028, 0.024, 0.022], { keep: 0.15, rough: 0.95, bump: 1.4, edge: 0.45, grime: 0.7, ember: 0.22 }), // soot-stiff linen
  m(34, 5, 5.0, [0.3, 0.29, 0.27], { keep: 0.08, rough: 0.82, roughTex: 0.4, bump: 0.7, edge: 0.4, grime: 1.1 }),     // starched hood, grey since the first night
  m(35, 4, 2.4, [0.2, 0.165, 0.15], { keep: 0.1, rough: 0.5, bump: 0.45, edge: 0.12, grime: 0.9 }),     // her skin, ash-pale
  m(36, 0, 0.5, [0.25, 0.125, 0.088], { keep: 0.3, rough: 0.86, bump: 1.25, edge: 0.55, grime: 0.95 }),  // red sandstone
  m(37, 6, 2.0, [0.46, 0.31, 0.11], { keep: 0.2, rough: 0.34, roughTex: 0.4, metal: 1, bump: 0.4, edge: 0.7, grime: 0.8 }), // brass hour lines
  m(38, 6, 2.4, [0.36, 0.15, 0.075], { keep: 0.25, rough: 0.4, roughTex: 0.45, metal: 1, bump: 0.6, edge: 0.7, grime: 1.0 }), // copper bowls
  m(39, 1, 2.2, [0.2, 0.192, 0.185], { keep: 0.3, rough: 0.99, bump: 1.1, edge: 0.2, grime: 0.5 }),     // ash shapes under ash sheets
  m(40, 5, 2.0, [0.012, 0.011, 0.011], { keep: 0.1, rough: 0.9, bump: 1.5, edge: 0.35, grime: 0.6, ember: 0 }),  // the Pall's soot-black cloth
  m(41, 2, 1.6, [0.11, 0.085, 0.06], { keep: 0.25, rough: 0.88, bump: 1.5, edge: 0.45, grime: 1.1 }),   // dry cot timber
  m(42, 6, 1.4, [0.2, 0.06, 0.03], { keep: 0.1, rough: 0.26, roughTex: 0.3, metal: 1, bump: 0.3, edge: 0.9, grime: 0.3, ember: 1.6 }),   // the scythe's edge, kept red
];
