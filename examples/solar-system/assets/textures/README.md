# Solar System Textures

The demo uses the highest-resolution Solar System Scope textures available in
this directory: 8K for close-up planet and Moon surfaces, 4K for Venus's cloud
layer, and the existing 2K textures for Uranus and Neptune.

Texture layout:

```
assets/textures/
  mercury/  8k_mercury.jpg
  venus/    4k_venus_atmosphere.jpg  8k_venus_surface.jpg
  earth/    8k_earth_daymap.jpg  8k_earth_nightmap.jpg
            8k_earth_clouds.jpg
  mars/     8k_mars.jpg
  jupiter/  8k_jupiter.jpg
  saturn/   8k_saturn.jpg  8k_saturn_ring_alpha.png
  uranus/   2k_uranus.jpg
  neptune/  2k_neptune.jpg
  moon/     8k_moon.jpg
```

Without these files, planets render with procedural colour fallback textures.
Good free sources include Solar System Scope (solarsystemscope.com) and NASA
Visible Earth.
