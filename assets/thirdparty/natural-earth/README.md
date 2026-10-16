# Natural Earth geography

Made with Natural Earth. The source land and lake polygons are public domain:
https://www.naturalearthdata.com/about/terms-of-use/

Source: Natural Earth 1:50m physical vectors, downloaded 2026-10-15 from the authors' repository:

- https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_land.geojson
- https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_lakes.geojson

`node tools/build-geography.mjs` makes the compact, offline raster masks in `game/js/geography-data.js`.
Coastlines and lakes derive from these polygons; game mountains, forests, resources and starts are stylized for play.
