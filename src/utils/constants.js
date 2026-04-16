// Scale: 1 AU = 100 Three.js units
export const AU_SCALE = 100

// Planet visual scale: Earth radius = 2.5 units
export const PLANET_SCALE = 2.5

// Moon scale factor (relative to Earth)
export const MOON_SCALE = 0.27

// Sun visual radius
export const SUN_RADIUS = 10

// Time: 1 Earth year completes in TIME_YEAR_SECS real seconds
export const TIME_YEAR_SECS = 120  // 2 minutes per year

// Day scale derived from year scale
export const TIME_DAY_SECS = TIME_YEAR_SECS / 365.25

// Asteroid belt
export const BELT_INNER_AU = 2.2
export const BELT_OUTER_AU = 3.2
export const BELT_COUNT = 5000

// Starfield
export const STAR_COUNT = 120000
export const STAR_RADIUS = 60000

// Shadow map size
export const SHADOW_MAP_SIZE = 2048

// LOD distances (Three.js units)
export const LOD_HIGH   = 0
export const LOD_MED    = 400
export const LOD_LOW    = 1200
export const LOD_TINY   = 3000
