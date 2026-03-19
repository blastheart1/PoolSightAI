export const WATER_FEATURES = [
  "pool", "spa", "plunge_pool", "wading_pool", "lap_pool",
  "reflecting_pool", "baja_shelf", "beach_entry", "infinity_edge",
  "overflow_channel", "water_feature", "waterfall", "sheer_descent",
  "deck_jet", "bubbler", "grotto",
] as const;

export const POOL_STRUCTURE = [
  "bond_beam", "raised_bond_beam", "pool_steps", "pool_ledge",
  "swim_out", "pool_wall", "pool_floor", "deep_end", "shallow_end",
  "safety_rope_line",
] as const;

export const DECKING_HARDSCAPE = [
  "decking", "concrete_deck", "pavers", "tile_deck", "wood_deck",
  "composite_deck", "stamped_concrete", "exposed_aggregate", "flagstone",
  "stepping_stones", "pathway", "courtyard", "motor_court",
] as const;

export const OUTDOOR_STRUCTURES = [
  "covered_patio", "pergola", "ramada", "cabana", "gazebo", "shade_sail",
  "pavilion", "loggia", "breezeway", "pool_house", "guest_house",
  "trellis", "arbor", "canopy", "sun_shelf_canopy",
] as const;

export const OUTDOOR_LIVING = [
  "outdoor_kitchen", "bbq_grill", "outdoor_bar", "bar_seating",
  "fire_pit", "fire_table", "fireplace", "pizza_oven",
  "outdoor_refrigerator", "sink", "dining_area", "lounge_area",
  "seating_area", "daybed", "chaise_lounge", "hammock",
  "outdoor_shower", "changing_room", "outdoor_bathroom",
  "bar_counter", "serving_counter", "beverage_station",
  "tv_area", "speaker_system", "projector_screen",
] as const;

export const LANDSCAPE = [
  "lawn", "artificial_turf", "planting_bed", "garden_bed",
  "raised_planter", "planter_pot", "hedge", "tree", "palm_tree",
  "shrub", "ground_cover", "turf_zone", "planting_strip",
  "green_roof", "vertical_garden", "water_plants",
  "flower_bed", "vegetable_garden", "herb_garden",
] as const;

export const BOUNDARIES_SAFETY = [
  "fence", "pool_fence", "glass_fence", "wrought_iron_fence",
  "wood_fence", "vinyl_fence", "block_wall", "retaining_wall",
  "garden_wall", "privacy_wall", "gate", "pool_gate",
  "driveway_gate", "pedestrian_gate", "property_line",
  "setback_line", "easement", "pool_cover", "pool_alarm",
] as const;

export const MECHANICAL_UTILITY = [
  "equipment_pad", "pool_equipment", "pump", "filter", "heater",
  "salt_system", "chemical_feeder", "automation_panel",
  "electrical_panel", "gas_meter", "utility_box", "hvac_unit",
  "generator", "solar_panels", "solar_water_heater",
  "irrigation_controller", "drainage_channel", "catch_basin",
  "sump", "cleanout", "hose_bib", "outdoor_lighting",
  "pool_lighting", "string_lights", "security_camera",
  "intercom", "storage_shed", "trash_enclosure", "bike_storage",
] as const;

export const ALL_FEATURE_TYPES = [
  ...WATER_FEATURES,
  ...POOL_STRUCTURE,
  ...DECKING_HARDSCAPE,
  ...OUTDOOR_STRUCTURES,
  ...OUTDOOR_LIVING,
  ...LANDSCAPE,
  ...BOUNDARIES_SAFETY,
  ...MECHANICAL_UTILITY,
  "other" as const,
];

export type PoolFeatureType =
  | (typeof WATER_FEATURES)[number]
  | (typeof POOL_STRUCTURE)[number]
  | (typeof DECKING_HARDSCAPE)[number]
  | (typeof OUTDOOR_STRUCTURES)[number]
  | (typeof OUTDOOR_LIVING)[number]
  | (typeof LANDSCAPE)[number]
  | (typeof BOUNDARIES_SAFETY)[number]
  | (typeof MECHANICAL_UTILITY)[number]
  | "other";

function buildCategoryMap(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const t of WATER_FEATURES) m[t] = "water";
  for (const t of POOL_STRUCTURE) m[t] = "pool_structure";
  for (const t of DECKING_HARDSCAPE) m[t] = "hardscape";
  for (const t of OUTDOOR_STRUCTURES) m[t] = "structure";
  for (const t of OUTDOOR_LIVING) m[t] = "living";
  for (const t of LANDSCAPE) m[t] = "landscape";
  for (const t of BOUNDARIES_SAFETY) m[t] = "boundary";
  for (const t of MECHANICAL_UTILITY) m[t] = "mechanical";
  m.other = "other";
  return m;
}

export const FEATURE_CATEGORY = buildCategoryMap() as Record<PoolFeatureType, string>;

export const DRAW_ORDER: Record<string, number> = {
  landscape: 1,
  boundary: 2,
  hardscape: 3,
  structure: 4,
  pool_structure: 5,
  water: 6,
  living: 7,
  mechanical: 8,
  other: 9,
};

interface FeatureStyle {
  fill: string;
  stroke: string;
  text: string;
  strokeDash?: string;
  rx?: number;
}

export const FEATURE_COLORS: Record<string, FeatureStyle> = {
  // Water
  pool:              { fill: "#bfdbfe", stroke: "#3b82f6", text: "#1e3a5f", rx: 8 },
  spa:               { fill: "#93c5fd", stroke: "#2563eb", text: "#1e3a5f", rx: 8 },
  plunge_pool:       { fill: "#7dd3fc", stroke: "#0284c7", text: "#0c4a6e", rx: 6 },
  wading_pool:       { fill: "#bae6fd", stroke: "#38bdf8", text: "#0c4a6e", rx: 8 },
  lap_pool:          { fill: "#cffafe", stroke: "#06b6d4", text: "#164e63", rx: 4 },
  reflecting_pool:   { fill: "#e0f2fe", stroke: "#7dd3fc", text: "#0c4a6e", rx: 2 },
  baja_shelf:        { fill: "#dbeafe", stroke: "#60a5fa", text: "#1e3a8a", rx: 4 },
  beach_entry:       { fill: "#eff6ff", stroke: "#93c5fd", text: "#1e3a8a", rx: 2 },
  infinity_edge:     { fill: "#bfdbfe", stroke: "#1d4ed8", text: "#1e3a5f", rx: 4, strokeDash: "4 2" },
  overflow_channel:  { fill: "#dbeafe", stroke: "#60a5fa", text: "#1e3a8a", rx: 2 },
  water_feature:     { fill: "#cffafe", stroke: "#22d3ee", text: "#164e63", rx: 4 },
  waterfall:         { fill: "#e0f7fa", stroke: "#26c6da", text: "#006064", rx: 4 },
  sheer_descent:     { fill: "#e0f2fe", stroke: "#38bdf8", text: "#0c4a6e", rx: 2 },
  deck_jet:          { fill: "#e0f2fe", stroke: "#7dd3fc", text: "#0c4a6e", rx: 2 },
  bubbler:           { fill: "#e0f2fe", stroke: "#7dd3fc", text: "#0c4a6e", rx: 6 },
  grotto:            { fill: "#c7d2fe", stroke: "#6366f1", text: "#312e81", rx: 8 },

  // Pool structure
  bond_beam:         { fill: "#e2e8f0", stroke: "#94a3b8", text: "#334155", rx: 2 },
  raised_bond_beam:  { fill: "#cbd5e1", stroke: "#64748b", text: "#1e293b", rx: 2 },
  pool_steps:        { fill: "#dbeafe", stroke: "#93c5fd", text: "#1e3a8a", rx: 2 },
  pool_ledge:        { fill: "#dbeafe", stroke: "#93c5fd", text: "#1e3a8a", rx: 2 },
  swim_out:          { fill: "#bfdbfe", stroke: "#60a5fa", text: "#1e3a5f", rx: 4 },
  pool_wall:         { fill: "#e2e8f0", stroke: "#94a3b8", text: "#334155", rx: 0 },
  pool_floor:        { fill: "#bfdbfe", stroke: "#93c5fd", text: "#1e3a8a", rx: 0 },
  deep_end:          { fill: "#93c5fd", stroke: "#3b82f6", text: "#1e3a5f", rx: 0 },
  shallow_end:       { fill: "#dbeafe", stroke: "#93c5fd", text: "#1e3a8a", rx: 0 },
  safety_rope_line:  { fill: "none",    stroke: "#f97316", text: "#7c2d12", rx: 0, strokeDash: "6 3" },

  // Hardscape
  decking:           { fill: "none",    stroke: "#a3a3a3", text: "#404040", rx: 4, strokeDash: "6 3" },
  concrete_deck:     { fill: "#f5f5f4", stroke: "#a8a29e", text: "#292524", rx: 2 },
  pavers:            { fill: "#e7e5e4", stroke: "#78716c", text: "#292524", rx: 2 },
  tile_deck:         { fill: "#fafaf9", stroke: "#d6d3d1", text: "#292524", rx: 1 },
  wood_deck:         { fill: "#fde68a", stroke: "#d97706", text: "#78350f", rx: 2 },
  composite_deck:    { fill: "#fef3c7", stroke: "#d97706", text: "#78350f", rx: 2 },
  stamped_concrete:  { fill: "#f0ebe3", stroke: "#a8a29e", text: "#292524", rx: 2 },
  exposed_aggregate: { fill: "#ece9e4", stroke: "#9ca3af", text: "#374151", rx: 2 },
  flagstone:         { fill: "#e7e5e4", stroke: "#9ca3af", text: "#374151", rx: 1 },
  stepping_stones:   { fill: "#e7e5e4", stroke: "#9ca3af", text: "#374151", rx: 4 },
  pathway:           { fill: "#f5f5f4", stroke: "#d6d3d1", text: "#404040", rx: 2, strokeDash: "8 4" },
  courtyard:         { fill: "#fafaf9", stroke: "#d6d3d1", text: "#374151", rx: 4 },
  motor_court:       { fill: "#f1f5f9", stroke: "#cbd5e1", text: "#334155", rx: 2 },

  // Structures
  covered_patio:     { fill: "#f3f4f6", stroke: "#9ca3af", text: "#374151", rx: 6 },
  pergola:           { fill: "none",    stroke: "#6b7280", text: "#374151", rx: 0, strokeDash: "10 4" },
  ramada:            { fill: "#f9fafb", stroke: "#9ca3af", text: "#374151", rx: 4 },
  cabana:            { fill: "#fdf4ff", stroke: "#c084fc", text: "#581c87", rx: 6 },
  gazebo:            { fill: "#fdf4ff", stroke: "#c084fc", text: "#581c87", rx: 8 },
  shade_sail:        { fill: "#fef9c3", stroke: "#eab308", text: "#713f12", rx: 0, strokeDash: "6 2" },
  pavilion:          { fill: "#f3f4f6", stroke: "#9ca3af", text: "#374151", rx: 4 },
  loggia:            { fill: "#f3f4f6", stroke: "#9ca3af", text: "#374151", rx: 2 },
  breezeway:         { fill: "#f3f4f6", stroke: "#d1d5db", text: "#374151", rx: 2 },
  pool_house:        { fill: "#f1f5f9", stroke: "#94a3b8", text: "#1e293b", rx: 4 },
  guest_house:       { fill: "#f1f5f9", stroke: "#94a3b8", text: "#1e293b", rx: 4 },
  trellis:           { fill: "none",    stroke: "#92400e", text: "#78350f", rx: 0, strokeDash: "6 4" },
  arbor:             { fill: "none",    stroke: "#92400e", text: "#78350f", rx: 4, strokeDash: "5 3" },
  canopy:            { fill: "#fef9c3", stroke: "#d97706", text: "#78350f", rx: 4 },
  sun_shelf_canopy:  { fill: "#fef9c3", stroke: "#d97706", text: "#78350f", rx: 4 },

  // Living
  outdoor_kitchen:   { fill: "#fafaf9", stroke: "#d1d5db", text: "#374151", rx: 4 },
  bbq_grill:         { fill: "#1c1917", stroke: "#44403c", text: "#fafaf9", rx: 2 },
  outdoor_bar:       { fill: "#fef3c7", stroke: "#d97706", text: "#78350f", rx: 4 },
  bar_seating:       { fill: "#fef9c3", stroke: "#fbbf24", text: "#78350f", rx: 2 },
  fire_pit:          { fill: "#fef3c7", stroke: "#f97316", text: "#7c2d12", rx: 8 },
  fire_table:        { fill: "#fef3c7", stroke: "#f97316", text: "#7c2d12", rx: 4 },
  fireplace:         { fill: "#f5f5f4", stroke: "#78716c", text: "#292524", rx: 2 },
  pizza_oven:        { fill: "#fef3c7", stroke: "#d97706", text: "#78350f", rx: 4 },
  outdoor_refrigerator: { fill: "#e0f2fe", stroke: "#7dd3fc", text: "#0c4a6e", rx: 2 },
  sink:              { fill: "#e0f2fe", stroke: "#7dd3fc", text: "#0c4a6e", rx: 2 },
  dining_area:       { fill: "#fafaf9", stroke: "#e7e5e4", text: "#374151", rx: 4 },
  lounge_area:       { fill: "#fafaf9", stroke: "#e7e5e4", text: "#374151", rx: 4 },
  seating_area:      { fill: "#fafaf9", stroke: "#e7e5e4", text: "#374151", rx: 4 },
  daybed:            { fill: "#fafaf9", stroke: "#d6d3d1", text: "#374151", rx: 4 },
  chaise_lounge:     { fill: "#fafaf9", stroke: "#d6d3d1", text: "#374151", rx: 4 },
  hammock:           { fill: "#fef9c3", stroke: "#fbbf24", text: "#78350f", rx: 8 },
  outdoor_shower:    { fill: "#e0f2fe", stroke: "#38bdf8", text: "#0c4a6e", rx: 2 },
  changing_room:     { fill: "#f1f5f9", stroke: "#94a3b8", text: "#1e293b", rx: 4 },
  outdoor_bathroom:  { fill: "#f1f5f9", stroke: "#94a3b8", text: "#1e293b", rx: 4 },
  bar_counter:       { fill: "#fef3c7", stroke: "#d97706", text: "#78350f", rx: 2 },
  serving_counter:   { fill: "#fafaf9", stroke: "#d6d3d1", text: "#374151", rx: 2 },
  beverage_station:  { fill: "#e0f2fe", stroke: "#7dd3fc", text: "#0c4a6e", rx: 2 },
  tv_area:           { fill: "#1c1917", stroke: "#44403c", text: "#fafaf9", rx: 2 },
  speaker_system:    { fill: "#1c1917", stroke: "#44403c", text: "#fafaf9", rx: 2 },
  projector_screen:  { fill: "#f8fafc", stroke: "#94a3b8", text: "#334155", rx: 2 },

  // Landscape
  lawn:              { fill: "#dcfce7", stroke: "#86efac", text: "#14532d", rx: 0 },
  artificial_turf:   { fill: "#bbf7d0", stroke: "#4ade80", text: "#14532d", rx: 0 },
  planting_bed:      { fill: "#d1fae5", stroke: "#6ee7b7", text: "#065f46", rx: 2 },
  garden_bed:        { fill: "#d1fae5", stroke: "#6ee7b7", text: "#065f46", rx: 4 },
  raised_planter:    { fill: "#a7f3d0", stroke: "#34d399", text: "#064e3b", rx: 4 },
  planter_pot:       { fill: "#fed7aa", stroke: "#f97316", text: "#7c2d12", rx: 8 },
  hedge:             { fill: "#bbf7d0", stroke: "#16a34a", text: "#14532d", rx: 2, strokeDash: "4 2" },
  tree:              { fill: "#86efac", stroke: "#15803d", text: "#14532d", rx: 8 },
  palm_tree:         { fill: "#86efac", stroke: "#15803d", text: "#14532d", rx: 8 },
  shrub:             { fill: "#bbf7d0", stroke: "#4ade80", text: "#14532d", rx: 6 },
  ground_cover:      { fill: "#dcfce7", stroke: "#86efac", text: "#14532d", rx: 2 },
  turf_zone:         { fill: "#dcfce7", stroke: "#86efac", text: "#14532d", rx: 0 },
  planting_strip:    { fill: "#d1fae5", stroke: "#6ee7b7", text: "#065f46", rx: 2 },
  green_roof:        { fill: "#bbf7d0", stroke: "#4ade80", text: "#14532d", rx: 4 },
  vertical_garden:   { fill: "#bbf7d0", stroke: "#4ade80", text: "#14532d", rx: 2 },
  water_plants:      { fill: "#a7f3d0", stroke: "#34d399", text: "#064e3b", rx: 4 },
  flower_bed:        { fill: "#fce7f3", stroke: "#f9a8d4", text: "#831843", rx: 4 },
  vegetable_garden:  { fill: "#d1fae5", stroke: "#4ade80", text: "#065f46", rx: 2 },
  herb_garden:       { fill: "#d1fae5", stroke: "#6ee7b7", text: "#065f46", rx: 2 },

  // Boundaries
  fence:             { fill: "none",    stroke: "#374151", text: "#374151", rx: 0, strokeDash: "6 3" },
  pool_fence:        { fill: "none",    stroke: "#dc2626", text: "#991b1b", rx: 0, strokeDash: "4 2" },
  glass_fence:       { fill: "#e0f2fe", stroke: "#7dd3fc", text: "#0c4a6e", rx: 0, strokeDash: "2 2" },
  wrought_iron_fence: { fill: "none",   stroke: "#1c1917", text: "#1c1917", rx: 0, strokeDash: "4 4" },
  wood_fence:        { fill: "none",    stroke: "#92400e", text: "#78350f", rx: 0 },
  vinyl_fence:       { fill: "none",    stroke: "#d6d3d1", text: "#374151", rx: 0 },
  block_wall:        { fill: "#e7e5e4", stroke: "#78716c", text: "#292524", rx: 0 },
  retaining_wall:    { fill: "#d6d3d1", stroke: "#6b7280", text: "#1f2937", rx: 0 },
  garden_wall:       { fill: "#e7e5e4", stroke: "#a8a29e", text: "#292524", rx: 2 },
  privacy_wall:      { fill: "#e7e5e4", stroke: "#78716c", text: "#292524", rx: 0 },
  gate:              { fill: "#fef9c3", stroke: "#d97706", text: "#78350f", rx: 2 },
  pool_gate:         { fill: "#fee2e2", stroke: "#dc2626", text: "#991b1b", rx: 2 },
  driveway_gate:     { fill: "#f1f5f9", stroke: "#94a3b8", text: "#1e293b", rx: 2 },
  pedestrian_gate:   { fill: "#fef9c3", stroke: "#d97706", text: "#78350f", rx: 2 },
  property_line:     { fill: "none",    stroke: "#1d4ed8", text: "#1e3a8a", rx: 0, strokeDash: "10 5" },
  setback_line:      { fill: "none",    stroke: "#dc2626", text: "#991b1b", rx: 0, strokeDash: "5 3" },
  easement:          { fill: "#fffbeb", stroke: "#f59e0b", text: "#78350f", rx: 0, strokeDash: "8 4" },
  pool_cover:        { fill: "#e0f2fe", stroke: "#0284c7", text: "#0c4a6e", rx: 4, strokeDash: "4 2" },
  pool_alarm:        { fill: "#fee2e2", stroke: "#dc2626", text: "#991b1b", rx: 4 },

  // Mechanical
  equipment_pad:     { fill: "#d1d5db", stroke: "#6b7280", text: "#1f2937", rx: 2 },
  pool_equipment:    { fill: "#d1d5db", stroke: "#6b7280", text: "#1f2937", rx: 2 },
  pump:              { fill: "#cbd5e1", stroke: "#64748b", text: "#1e293b", rx: 2 },
  filter:            { fill: "#cbd5e1", stroke: "#64748b", text: "#1e293b", rx: 2 },
  heater:            { fill: "#fed7aa", stroke: "#ea580c", text: "#7c2d12", rx: 2 },
  salt_system:       { fill: "#e0f2fe", stroke: "#7dd3fc", text: "#0c4a6e", rx: 2 },
  chemical_feeder:   { fill: "#fce7f3", stroke: "#f9a8d4", text: "#831843", rx: 2 },
  automation_panel:  { fill: "#1c1917", stroke: "#44403c", text: "#fafaf9", rx: 2 },
  electrical_panel:  { fill: "#1c1917", stroke: "#44403c", text: "#fafaf9", rx: 2 },
  gas_meter:         { fill: "#fef3c7", stroke: "#d97706", text: "#78350f", rx: 2 },
  utility_box:       { fill: "#d1d5db", stroke: "#6b7280", text: "#1f2937", rx: 2 },
  hvac_unit:         { fill: "#d1d5db", stroke: "#64748b", text: "#1e293b", rx: 2 },
  generator:         { fill: "#d1d5db", stroke: "#6b7280", text: "#1f2937", rx: 2 },
  solar_panels:      { fill: "#bfdbfe", stroke: "#1d4ed8", text: "#1e3a5f", rx: 2 },
  solar_water_heater: { fill: "#bfdbfe", stroke: "#1d4ed8", text: "#1e3a5f", rx: 2 },
  irrigation_controller: { fill: "#d1fae5", stroke: "#34d399", text: "#065f46", rx: 2 },
  drainage_channel:  { fill: "#e0f2fe", stroke: "#7dd3fc", text: "#0c4a6e", rx: 0 },
  catch_basin:       { fill: "#e0f2fe", stroke: "#7dd3fc", text: "#0c4a6e", rx: 2 },
  sump:              { fill: "#e0f2fe", stroke: "#7dd3fc", text: "#0c4a6e", rx: 2 },
  cleanout:          { fill: "#f1f5f9", stroke: "#94a3b8", text: "#1e293b", rx: 2 },
  hose_bib:          { fill: "#e0f2fe", stroke: "#7dd3fc", text: "#0c4a6e", rx: 2 },
  outdoor_lighting:  { fill: "#fef9c3", stroke: "#fbbf24", text: "#78350f", rx: 4 },
  pool_lighting:     { fill: "#fef9c3", stroke: "#fbbf24", text: "#78350f", rx: 4 },
  string_lights:     { fill: "none",    stroke: "#fbbf24", text: "#78350f", rx: 0, strokeDash: "3 3" },
  security_camera:   { fill: "#1c1917", stroke: "#44403c", text: "#fafaf9", rx: 2 },
  intercom:          { fill: "#1c1917", stroke: "#44403c", text: "#fafaf9", rx: 2 },
  storage_shed:      { fill: "#f1f5f9", stroke: "#94a3b8", text: "#1e293b", rx: 2 },
  trash_enclosure:   { fill: "#f1f5f9", stroke: "#94a3b8", text: "#1e293b", rx: 2 },
  bike_storage:      { fill: "#f1f5f9", stroke: "#94a3b8", text: "#1e293b", rx: 2 },

  // Catch-all
  existing_structure: { fill: "#fde68a", stroke: "#d97706", text: "#78350f", rx: 2 },
  other:             { fill: "#fafaf9", stroke: "#d1d5db", text: "#374151", rx: 4 },
};
