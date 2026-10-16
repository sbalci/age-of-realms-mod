# Geographic maps, Wonders and underground mining

The browser game now offers **Anatolia**, **Mediterranean** and **World** in Game Setup and the Map Editor. All four map sizes and 2–8 players work. Choose Large for the clearest World coastline. The World extent covers 60°S–85°N, including the inhabited continents; it does not include Antarctica or wrap at the date line.

Coastlines and lakes come from bundled public-domain [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) data. Nothing is fetched during play. Mountains follow approximate authored ranges; forests, deposits and resources are game terrain, not geological or elevation survey data. The seed varies resources and scenery without moving the coastline. Continents remain separated by water: use docks and transports. Starts move inland enough to fit the Town Center and starting villagers without filling in coastlines. Local starting supplies are guaranteed even where narrow peninsulas cannot fit the original large resource clusters.

Open [the map preview](../tools/geography-gallery.html) through the local game server. Rebuild the 18 KB geographic masks from the bundled source polygons with `npm run maps:build`. Source provenance is in [the Natural Earth README](../assets/thirdparty/natural-earth/README.md).

## Wonders

Wonders can now be started in any age. They keep the existing 5×5 footprint, 4,800 base HP, 500-second construction time, cost of 1,000 each food/wood/gold/stone and five-minute victory countdown. Advancing changes the appearance and name of existing Wonders, including unfinished ones, without resetting construction, health or the countdown. Fog remembers the form last seen.

| Age | Turkish form | Other civilizations |
| --- | --- | --- |
| Dark | Ancestral Sanctuary | Ancestral Monument |
| Feudal | Seljuk Caravanserai | Great Hall |
| Castle | Great Madrasa | Grand Library |
| Imperial | Imperial Mosque | Imperial Wonder, with the existing civilization architecture |
| Modern | World Observatory | World Observatory |
| Future | Fusion Beacon | Fusion Beacon |

All six forms have original Canvas art and corresponding 2.5D geometry. See [the Wonder preview](../assets/screenshots/wonders-by-age.png). The AI continues to invest in Wonders from Imperial onward.

## Elders

Each newly spawned villager has a **10% chance** of taking vows when reaching **85% of their personal lifespan**, about 25½ game minutes before variation or Herbal Medicine. Turkish converts are Imams; other converts are Monks. Conversion preserves ownership, the entity and health fraction, and deposits carried resources. This is a probability per villager, so a group of ten need not produce exactly one monk. Existing save files retain each person's already rolled destiny. Disabling aging also disables this conversion.

## Coal and underground deposits

Coal is a fifth stockpile resource, with its own HUD counter, costs, market trading, tribute and gathering statistics. New matches start with zero coal. Town Centers and Mining Camps accept it. Generated maps provide three buried coal seams per player (900 coal each), plus underground gold and stone beneath mountains.

| Improvement | Coal cost before civilization discounts |
| --- | ---: |
| Modern Age | 300 |
| Industrialization | 200 |
| Precision Rifling | 100 |
| Composite Armor | 150 |

Seam markers carry **C**, **G** or **S** flags. Select one to see its remaining minerals and access instructions. Survey markers are visible only on explored terrain; seeing a marker does not permit gathering.

1. **Villagers:** right-click a buried seam to excavate it, then begin mining automatically. They first remove the hill or mountain, then dig through the ground cover. Alternatively, select villagers, press **N → D**, and drag an excavation area; afterward right-click the opened mine.
2. **Sappers:** train them at a Mining Camp from Feudal Age. Press **N → K** and dig a connected tunnel from low ground to the tile beneath a seam. Villagers can mine it without removing the mountain. An isolated bore within a peak does not open a mine.
3. Surface excavation recovers the normal 15 stone per elevation level. Shaft digging does not generate free stone. Tunnel tiles retain the normal 5-stone cost.
4. Flooding or covering an open shaft closes surface access. Cutting a tunnel off from its entrance closes tunnel access. Workers stop rather than gather through sealed ground. Buildings cannot cover live seam markers.

The AI assigns coal workers in Imperial and later ages and uses the same excavation orders as the player. It builds nearby Mining Camps when needed. Older/custom maps without seams, or matches with Terraforming disabled, can supply coal through the Market (initially 180 gold per 100 coal, with normal price changes).

The editor palette includes buried coal and underground gold/stone. Map exports and match saves retain deposit depth, excavation progress, connected tunnels, automatic excavation jobs and coal balances. Earlier saves receive zero coal and the new market price without changing their other balances.

## Validation

`tests/geography-geology.test.js` covers geographic landmarks and coastlines across seeds, all sizes and player counts, sealed mining, excavation, connected and isolated tunnels, flooding, depletion, coal payment/trading/AI, save migration, editor exports, elder probability/timing and Wonder progression. Browser checks exercise setup/editor controls, HUD fit, mining instructions and save/load, distinct rendered Wonder forms, and 2.5D refresh without simulation mutations. Existing movement, engineering, save compatibility, economy and combat suites also run.

The new prices and early Wonder availability are initial game balance; extended competitive balance has not been evaluated.

Latest validation: 295 engine/performance checks passed across the regression suites; all 27 browser checks passed across the full run and targeted rerun; 72 JavaScript files passed syntax checks. The existing art-toggle navigation test now waits for the destination URL before inspecting the reloaded controls. A five-minute Imperial AI soak excavated and delivered coal without exceptions.
