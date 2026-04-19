# Planet Textures

Drop Solar System Scope (or compatible) texture downloads here.

Expected file layout (used by `src/orbital/planetData.js`):

```
public/textures/
  mercury/  mercury_map.jpg
  venus/    venus_atmosphere.jpg
  earth/    earth_daymap.jpg  earth_nightmap.jpg  earth_clouds.jpg
            earth_specular.jpg  earth_normal.jpg
  mars/     mars_map.jpg
  jupiter/  jupiter_map.jpg
  saturn/   saturn_map.jpg  saturn_rings.png
  uranus/   uranus_map.jpg
  neptune/  neptune_map.jpg
  moon/     moon_map.jpg
```

Without these files the planets render with procedural colour fallback textures.
Good free sources: Solar System Scope (solarsystemscope.com), NASA Visible Earth.
