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
];
