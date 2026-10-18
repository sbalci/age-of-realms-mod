# Age of Realms — Master Asset Plan (Every Building, Unit, Age & Civilization)

This document defines the complete specification, visual DNA, scale hierarchy, and generation pipeline for every building and unit across all **10 civilizations** and **6 playable ages** in **Age of Realms**.

---

## 1. Combinatorial Matrix & Scope

| Dimension | Count | Identifiers |
| :--- | :---: | :--- |
| **Civilizations** | **10** | `franks`, `teutons`, `spanish`, `italians`, `vikings`, `byzantines`, `saracens`, `turks`, `chinese`, `japanese` |
| **Playable Ages** | **6** | `0` Dark Age, `1` Feudal Age, `2` Castle Age, `3` Imperial Age, `4` Modern Age, `5` Future Age |
| **Buildings** | **23** | `tc`, `house`, `mill`, `lumbercamp`, `miningcamp`, `farm` (`farm_0..2`), `dock`, `market`, `blacksmith`, `well`, `university`, `monastery`, `barracks`, `range`, `stable`, `siege`, `outpost`, `palisade`, `wall`, `gate`, `tower`, `castle`, `wonder` |
| **Units & Variants** | **53** | **47** `UNITS` entries (`villager` M/F, `sapper`, `monk`/Imam, `tradecart`, 7 Barracks infantry, 7 Range archers/cav-archers, 5 Stable cavalry, 6 Siege engines, 10 Castle Unique Units, 8 Naval ships, 6 Modern/Future units) + `cow` breed variant + 4 wild/cheat units (`deer`, `boar`, `wolf`, `cobra`) |

### Total Distinct Visual States
- **Buildings:** $10 \text{ civilizations} \times 6 \text{ ages} \times 23 \text{ buildings} = \mathbf{1,380}$ unique `(civ, age, building)` visual states (plus 3 growth stages per farm).
- **Units:** $10 \text{ civilizations} \times 47 \text{ playable unit types}$ (with age-evolving civilian, religious, trade, siege, and naval visuals across Ages $0\text{–}5$) $= \mathbf{650+}$ distinct unit appearances.
- **Engine Contract:** Preserves `Object.keys(ACTOR_ART).length === 53` (`tests/actors.test.js`) and `STYLE.length === 4` (`tests/terrain.test.js`) while routing per-civilization and per-age sprites through `KENNEY_ART` (`game/art/kenney/`), `CIV_ART` (`game/js/civ_art.js`), and the supersampled `UHD` unit cache (`game/js/units_hd.js`).

---

## 2. Hybrid Asset Generation & Compositing Pipeline

1. **AI-Generated Hero Isometric Sprites (`tools/art/generated/` $\rightarrow$ `game/art/kenney/`):**
   - Orthographic $45^\circ$ azimuth / $30^\circ$ elevation isometric renders on pure `#FFFFFF` backgrounds, processed via `tools/art/process-generated.mjs` (flood-fill edge background removal, soft alpha feathering, automatic bounding-box crop, and isometric base-y calibration).
   - Used for monumental landmarks (`wonder_0..5`, regional `castle` fortresses, `tc_4..5` Modern/Future Command Centers, and regional Naval Ship hulls).
2. **Parametric 3D Kit Baker (`tools/art/kenney-recipes.js` & `tools/art/bake-kenney.mjs`):**
   - Uses Three.js to assemble 230+ CC0 modular 3D meshes (`assets/kenney_all/`) with age-tiered geometry (`_0` Dark, `_1` Feudal, `_2` Castle, `_3` Imperial, `_4` Modern, `_5` Future), baked ambient occlusion, and ground contact shadows.
   - Original kits: `tools/art/blender/islamic_kit.py` builds CC0 Islamic architecture pieces in Blender (`npm run art:kit`, output `assets/original/islamic/`); `tools/art/turks-recipes.mjs` and `tools/art/saracens-recipes.mjs` (shared parts in `tools/art/islamic-kit.mjs`) assemble the Turks sprites for all 18 building types and every age they exist in, in four eras (Seljuk 0–1, Ottoman 2–3, Tanzimat 4, Republican 5), and the Saracens `house`/`tc`/`monastery` sprites (`<type>_<civ>_<age>`), and `bake-kenney.mjs --recipes` merges them into the manifest without re-baking other sprites. In game, `civ_art.js` prefers these per-civ sprites and skips its painted crown for them; a civ's own castle sprite comes before its family castle, civ sprites baked for ages 4–5 skip the painted Modern/Future add-ons, and a civ's sprites load the first time that civ is drawn.
3. **3D Animated Actor Atlas Baker (`tools/art/actor-models.js` & `tools/art/bake-actors.mjs`):**
   - Bakes 4-direction (`se`, `sw`, `ne`, `nw`) $\times$ 4-action (`idle`, `walk`, `attack`, `work`) $\times$ 4-frame sprite sheets + player-color mask sheets into `game/assets/actors/`.
4. **Runtime Civilization $\times$ Age Architectural & Equipment Compositor (`game/js/civ_art.js`):**
   - Applies civilization-specific masonry/roof/trim palettes, architectural crowns (spires, domes, *kümbet* cones, pagoda tiers, *irimoya* gables, Norse dragon finials), cultural courtyard props, and Ages 4–5 industrial/futuristic retrofits to every building sprite (except civ sprites baked for that age) in `bldSprite(type, st, pc, civ)`.
   - Applies civilization-specific helmets, hats, shield heraldry, weapon silhouettes, trade caravan mounts, and naval ship sails/prows to every unit in `drawUnitFigure(g, u, t)` and `uhdKey(u, dir, f, p, q)`.

---

## 3. Master Civilization Visual DNA (All 10 Civilizations)

| Civ ID | Name | Architectural Family | Masonry & Wall Palette | Roof & Crown Silhouette | Signature Props & Details | Military Helmets, Shields & Heraldry |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `franks` | **Franks** | Western Chivalric (`west`) | Cream Loire limestone (`#dcd3c0`), warm oak half-timbering, dressed ashlar | Steep slate-blue (`#3b4d6b`) chateau cones & mansard ridges with gold finials | Gothic pointed arches, royal blue-and-gold fleur-de-lis banners, lance racks | Nasal helm $\rightarrow$ bascinet $\rightarrow$ sallet; blue kite/heater shield with gold Fleur-de-Lis |
| `teutons` | **Teutons** | Northern Brick Gothic (`north`) | Red-brown Brick Gothic (`#9c4a38`), crisp white plaster panels, heavy iron-dark oak | Dark iron-slate (`#2e333b`) steep gables & crow-stepped brick parapets | Twin octagonal barbicans, iron-bound oak doors, glowing braziers, wayside crosses | Flat-topped great helm with black/white/gold horns; white heater shield with black Iron Cross |
| `spanish` | **Spanish** | Iberian Mudéjar (`med`) | Golden-ochre Castilian sandstone (`#dec49a`), whitewashed stucco, brick trim | Warm terracotta barrel tiles (`#b85236`), octagonal Mudéjar cupolas | Horseshoe & scalloped arches, wrought-iron grilles, Albarrana towers | Cabasset & high-comb morion helm; crimson buckler/adarga shield with gold Castilian Lion |
| `italians` | **Italians** | Renaissance Maritime (`med`) | Polychrome Carrara marble banding (`#ece7dc` / `#3e5c4a`), warm Sienna brick | Terracotta ribbed Brunelleschi domes (`#c45b3e`), Tuscan low-pitched roofs, campaniles | Swallowtail Ghibelline merlons, Renaissance loggia colonnades, courtyard fountains | Rounded barbuta & Venetian sallet; tall white pavise/oval shield with red Cross of St. George |
| `vikings` | **Vikings** | Norse Stave & Longhouse (`nordic`) | Dark tarred stave-wood planks (`#4a3525`), carved pine logs, dry-stone boulder bases | Steep overlap wood shingles (`#59412e`), turf roofs (Age 0), crossed dragon-head finials | Carved *Urnes* dragon prows, glowing red runestones, shield-hung longhouse eaves | Gjermundbu iron spectacle helm & horned jarl crest; round wooden shield with red/gold Norse swirl |
| `byzantines` | **Byzantines** | Imperial Roman-East (`byz`) | Buff limestone & red Roman brick courses (*opus listatum*, `#d8c3a5` / `#a44a3f`) | Broad terracotta & lead saucer domes (`#9e4b3b`), vaulted semi-domes on octagonal drums | Porphyry columns, gold mosaic archivolts, double-headed eagle standards | Conical spangenhelm with mail aventail; imperial purple oval shield with gold Chi-Rho / Eagle |
| `saracens` | **Saracens** | Abbasid / Mamluk Desert (`desert`) | Carved desert sandstone (`#e4c99c`), alternating *ablaq* ochre/cream courses | Pointed turquoise (`#2a8a82`) & gold-leaf ribbed domes, flat roofs with stepped merlons | Pointed horseshoe arches, *mashrabiya* wood screens, slender minarets, palm courtyards | Turban-wrapped conical helm & *keffiyeh*; brass-studded round *daraqah* shield with gold crescent |
| `turks` | **Turks** | Seljuk $\rightarrow$ Ottoman $\rightarrow$ Tanzimat $\rightarrow$ Republican (`ottoman`) | Seljuk sandstone with turquoise glaze (Ages 0–1) $\rightarrow$ cut limestone & Iznik tiles (Ages 2–3) $\rightarrow$ Tanzimat pilastered stone & brick (Age 4) $\rightarrow$ Republican Ankara stone, cream plaster & red tile (Age 5) | Conical Seljuk *kümbet* roofs (Ages 0–1) $\rightarrow$ cascading lead-grey domes & pencil minarets | Cobalt/turquoise tile friezes, pointed ogee arches, crescent *alem* finials, *şadırvan* fountains | Seljuk fur-trimmed *sharbush* $\rightarrow$ Ottoman *chichak* neck-guard helm & Janissary white *börk* |
| `chinese` | **Chinese** | Imperial Tang/Song/Ming (`east_cn`) | Grey-blue kilned brick (`#78808a`), whitewashed courtyard walls, vermilion pillars (`#b82925`) | Sweeping upturned glazed tile roofs (charcoal $\rightarrow$ jade green `#2c785c` $\rightarrow$ imperial gold) | *Dougong* bracket eaves, *paifang* gates, red paper lanterns, bronze tripods, stone lions | Iron brimmed *bingmao* & phoenix-wing helm; vermilion-and-gold shield with Imperial Dragon crest |
| `japanese` | **Japanese** | Sengoku Castle & Shrine (`east_jp`) | Battered dry-stone *ishigaki* walls (`#6e6a64`), crisp white *shikkui* plaster, charred cedar | Curved *irimoya* hip-and-gable dark *kawara* tile roofs (`#2c323d`) with gold *shachihoko* carp | Vermilion *torii* gates, vertical clan *nobori* banners, bamboo fences, stone *tōrō* lanterns | Laced *kabuto* helmet with gold crescent/antler *maedate*; lacquered rectangular shield with *Takeda* mon |

---

## 4. 6-Tier Building Scale Hierarchy & Unit Calibration

All building and unit sprites obey a unified isometric projection ($64 \times 32\text{ px}$ per $1 \times 1$ tile at `1x` logical scale, baked at `2x` retina resolution) and a strict **6-Tier Scale Hierarchy**:

| Tier | Role | Logical Size (`1x`) | Height vs. Human (`24 px`) | Included Assets |
| :--- | :--- | :--- | :---: | :--- |
| **Tier 0** | Units & Citizens | `23–25 px` (infantry)<br>`34–36 px` (cavalry)<br>`55–88 px` (siege/ships) | **$1.0\times$** | All 53 unit/actor types (`US = 0.95`, `asc = 0.68–0.92`) — humans fit cleanly under `26–28 px` building doorways |
| **Tier 1** | Compact Utility & Camps | `76–141 px` W $\times$ `80–134 px` H | **$3.3\times\text{–}5.5\times$** | `well` (`1×1`), `outpost` (`1×1`), `palisade` (`1×1`), `wall` (`1×1`), `lumbercamp` (`2×2`), `miningcamp` (`2×2`), `house` (`2×2`) |
| **Tier 2** | Medium Civic & Field Yards | `141–205 px` W $\times$ `155–190 px` H | **$6.5\times\text{–}7.9\times$** | `mill` (`2×2`), `farm` (`3×3`), `market` (`3×3`), `range` (`3×3`), `stable` (`3×3`), `dock` (`3×3`), `blacksmith` (`3×3`), `gate` (`3×1`), `tower` (`1×1`) |
| **Tier 3** | 2-Storey Military & Academic Halls | `205–214 px` W $\times$ `207–286 px` H | **$8.6\times\text{–}11.9\times$** | `siege` (`3×3`), `barracks` (`3×3`), `university` (`3×3`), `monastery` (`3×3`) |
| **Tier 4** | Capital Hubs & Fortresses | `284–310 px` W $\times$ `274–403 px` H | **$11.5\times\text{–}16.8\times$** | `tc` (`4×4`, Ages `0..5`), `castle` (`4×4`, regional fortresses) |
| **Tier 5** | Colossal Wonders | `384 px` W $\times$ `307–369 px` H | **$14.0\times\text{–}16.0\times$** | `wonder` (`5×5`, Ages `0..5`) |

---

## 5. Building-by-Building Asset Plan (All 23 Buildings $\times$ 6 Ages $\times$ 10 Civilizations)

Every building automatically progresses through **6 Ages (`0` Dark $\rightarrow$ `5` Future)** and receives civilization-specific masonry, roofing, crowns, and courtyard props.

### 5.1 `tc` — Town Center (`4×4` tiles, Tier 4 Capital Hub)
- **Role:** Economic & administrative capital, villager training, resource drop-off, and Age research hub.
- **Age Progression (`0..5`):**
  - **Age 0 (Dark):** Timber chieftain hall / mud-brick compound with open hearth courtyard, hide canopies, and rough log stockade posts (`tc_0`).
  - **Age 1 (Feudal):** Two-story stone-and-timber manor keep with twin side storage halls, shingled roofs, and paved drop-off yard (`tc_1`).
  - **Age 2 (Castle):** Fortified three-story stone keep with corner watch turrets, arched colonnade wings, and heraldic banners (`tc_2`).
  - **Age 3 (Imperial):** Grand sovereign palace-keep with gilded roof ridges, high belfry/dome/pagoda spire, and marble/cut-stone courtyard (`tc_3`).
  - **Age 4 (Modern):** Early-20th-century reinforced brick-and-steel Command Headquarters with clock/radio communications tower, electric yard lamps, and supply depot portico (`tc_4`).
  - **Age 5 (Future):** Armored composite-alloy Command Nexus with central sensor dome, glowing cyan power conduits, solar collector wings, and holographic civic beacon (`tc_5`).
- **Civilization Variants (All 10 Civs):**
  - `franks`: Slate-coned chateau keep with fleur-de-lis standards and Gothic arched hall wings.
  - `teutons`: Red-brick *Ordkonvent* command hall with steep dark-slate gables, iron braziers, and black-cross banners.
  - `spanish`: Sandstone *Alcázar* municipal hall with terracotta *teja* roofs, arched cloister porch, and Mudéjar lantern tower.
  - `italians`: Renaissance *Palazzo Pubblico* with Carrara marble banding, terracotta dome, and tall *campanile* bell tower.
  - `vikings`: Great Norse *Mjöðhall* (Mead Hall) with steep tarred stave roofs, crossed gilded dragon-head gable finials, shield friezes, and runestone courtyard.
  - `byzantines`: Imperial *Praetorium* with striped brick-and-limestone walls, central terracotta saucer dome, and double-headed eagle banners.
  - `saracens`: Domed *Dar al-Imara* palace court with turquoise ribbed dome, horseshoe arcades, and courtyard date palms.
  - `turks`: Seljuk *Kervansaray* portal & conical *kümbet* (Ages 0–1) $\rightarrow$ Ottoman *Divan* court with cascading lead domes, Iznik tile frieze, and crescent *alem* (Ages 2–5).
  - `chinese`: Imperial *Yamen* magistrate compound with vermilion pillars, sweeping double-eave jade/gold glazed tile roof, *paifang* entrance, and red lanterns.
  - `japanese`: *Honmaru Goten* palace & *Tenshu* keep on battered *ishigaki* stone foundation with white plaster walls, *irimoya* gables, gold *shachihoko* finials, and *nobori* flags.

### 5.2 `house` — House (`2×2` tiles, Tier 1 Dwelling)
- **Role:** Population capacity (`+5` pop). Must stay compact (`scale: 0.72`) so clusters of houses form believable streets around taller civic buildings.
- **Age Progression (`0..5`):**
  - **Age 0:** Round wattle-and-daub or rough log hut with thatch/turf roof (`house_0`).
  - **Age 1:** Hewn timber-frame cottage with small garden fence and wood-shingle roof (`house_1`).
  - **Age 2:** Two-room stone-and-timber town house with tiled roof, chimney, and shuttered windows (`house_2`).
  - **Age 3:** Ornate two-story burgher/courtyard residence with dormers, balconies, and warm lit windows (`house_3`).
  - **Age 4:** Industrial brick townhouse with iron roof ventilator, streetlamp, and power line mast (`house_4`).
  - **Age 5:** Pressurized modular habitat residence with solar-glass roof panels and glowing cyan status strips (`house_5`).
- **Civilization Variants:**
  - `franks`: Half-timbered limestone cottage with steep slate roof.
  - `teutons`: Red-brick *Fachwerk* house with stepped gable roof.
  - `spanish`: Whitewashed stucco *casa* with red barrel-tile roof and wrought-iron window balcony.
  - `italians`: Warm ochre Tuscan town villa with low terracotta roof and arched loggia.
  - `vikings`: Turf-and-stave longhouse dwelling with carved gable dragon tips and stacked firewood.
  - `byzantines`: Roman-brick courtyard *domus* with arched windows and barrel-tiled roof.
  - `saracens`: Sandstone courtyard house with flat parapet roof, *mashrabiya* wooden bay window, and *malqaf* windcatcher.
  - `turks`: Seljuk stone dwelling (Ages 0–1) $\rightarrow$ Ottoman timber-and-plaster *konak* with projecting upper-floor *cumba* bay.
  - `chinese`: *Siheyuan* courtyard pavilion with grey brick walls, upturned tile eaves, and hanging red lantern.
  - `japanese`: Traditional *minka* (Ages 0–1) $\rightarrow$ *machiya* merchant townhouse (Ages 2–5) with dark *kawara* tiles, *shōji* screens, and bamboo fence.

### 5.3 `mill` — Mill (`2×2` tiles, Tier 2 Food Drop-Off & Agriculture Hub)
- **Role:** Food drop-off site, farm queue/reseeding hub, and agricultural technology research building.
- **Age Progression (`0..5`):**
  - **Age 0:** Open grain-grinding shelter with hand querns, woven grain baskets, and thatch roof (`mill_0`).
  - **Age 1:** Timber rotary mill house with rotating wind/water blades and grain sacks (`mill_1`).
  - **Age 2:** Stone-base tower mill with full canvas sails/waterwheel and covered flour-loading cart bay (`mill_2`).
  - **Age 3:** Tall masonry estate mill with reinforced four-sail rotor, granary annex, and golden grain bins (`mill_3`).
  - **Age 4:** Steam/electric roller-flour mill & cylindrical steel grain elevator with exhaust stack (`mill_4`).
  - **Age 5:** Automated synth-protein & hydroponic nutrient processing silo with glowing bio-domes (`mill_5`).
- **Civilization Variants:**
  - `franks`, `teutons`: Tall post-and-smock windmill with four lattice sails.
  - `spanish`, `italians`, `byzantines`: Mediterranean cylindrical stone windmill with triangular lateen cloth sails.
  - `vikings`: Heavy timber water/wind grain house with carved Norse rafters and barley barrels.
  - `saracens`, `turks`: Vertical-axle Persian/Islamic wind-tower mill (*asbad*) & domed stone granary.
  - `chinese`, `japanese`: Upturned-eave timber granary (*kura*) with water-wheel trip-hammer and rice bales (*tawara*).

### 5.4 `lumbercamp` — Lumber Camp (`2×2` tiles, Tier 1 Wood Drop-Off & Forestry Tech)
- **Role:** Wood drop-off site and forestry upgrade research (`doublebit`, `bowsaw`).
- **Age Progression (`0..5`):**
  - **Age 0:** Rough log lean-to with chopping block, hand axes, and stacked logs (`lumbercamp_0`).
  - **Age 1:** Open-sided timber sawpit shed with two-man crosscut saw and log pile (`lumbercamp_1`).
  - **Age 2:** Stone-and-timber carpenter's yard with timber jib crane, saw table, and seasoned plank stacks (`lumbercamp_2`).
  - **Age 3:** Heavy guild timber depot with geared hoist, covered drying shed, and wagon loading ramp (`lumbercamp_3`).
  - **Age 4:** Steam-powered circular sawmill with metal chimney and rail timber bogie (`lumbercamp_4`).
  - **Age 5:** Laser-cutter forestry & carbon-cellulose processing rig with plasma saw emitter (`lumbercamp_5`).
- **Civilization Variants:** Roof pitch, timber tint, and shed banners match each civilization (`east_cn`/`east_jp` upturned tile shed with bamboo stacks; `desert`/`ottoman` canvas-and-stone timber yard; `nordic` tarred log shed).

### 5.5 `miningcamp` — Mining Camp (`2×2` tiles, Tier 1 Ore Drop-Off & Sapper Hub)
- **Role:** Gold, Stone, and Coal drop-off site; trains `sapper` units and researches mining upgrades.
- **Age Progression (`0..5`):**
  - **Age 0:** Open quarry pithead with wooden tripod hoist, pickaxes, and ore baskets (`miningcamp_0`).
  - **Age 1:** Timber-shored mine adit with hand winch, ore sorting table, and rubble heaps (`miningcamp_1`).
  - **Age 2:** Stone-masonry assay shed with wheeled wooden ore cart, wooden track, and smelting brazier (`miningcamp_2`).
  - **Age 3:** Fortified royal mint & smelting depot with iron crane, bullion chests, and coal bunkers (`miningcamp_3`).
  - **Age 4:** Industrial steel pithead winding frame, coal hopper, and iron tipper carts (`miningcamp_4`).
  - **Age 5:** Automated deep-crust plasma bore rig with magnetic ore levitators (`miningcamp_5`).
- **Civilization Variants:** Civ-specific shed roof, ore flags, and regional smelter chimney design.

### 5.6 `farm` — Farm (`3×3` tiles, 3 Growth Stages: `farm_0`, `farm_1`, `farm_2`)
- **Role:** Renewable food plot worked by a single villager.
- **Growth Stages & Age Progression:**
  - `farm_0` (Freshly Plowed): Tilted dark loam furrows with seed rows and corner boundary markers.
  - `farm_1` (Growing Green): Lush green crop stalks with irrigation ditches and scarecrow/field marker.
  - `farm_2` (Ripe Harvest): Golden wheat/rice/barley rows ready for sickle harvesting with stacked sheaves.
  - **Ages 4–5:** Mechanized irrigated rows (Age 4) and glowing hydroponic nutrient strips (Age 5).
- **Civilization Variants:**
  - `franks`, `teutons`, `vikings`: Split-rail timber corner fences and golden wheat/rye sheaves.
  - `spanish`, `italians`, `byzantines`: Low dry-stone field borders with olive/vine corner posts.
  - `saracens`, `turks`: Mud-brick irrigation channels (*qanat* water rills) with date-palm corner stakes.
  - `chinese`, `japanese`: Flooded terraced rice-paddy borders with bamboo corner rails.

### 5.7 `dock` — Dock (`3×3` tiles, Tier 2 Naval Shipyard & Sea Trade Hub)
- **Role:** Builds and repairs all naval vessels; drop-off point for `fishingship` and sea trade endpoint for `tradecog`.
- **Age Progression (`0..5`):**
  - **Age 0:** Timber jetty on wooden pilings with drying fish nets and reed/thatch boathouse (`dock_0`).
  - **Age 1:** Sturdy plank pier with shingled harbor warehouse, mooring bollards, and cargo barrels (`dock_1`).
  - **Age 2:** Stone quay wall with timber slipway crane, harbormaster tower, and stacked trade crates (`dock_2`).
  - **Age 3:** Grand imperial admiralty arsenal with stone lighthouse beacon, twin cranes, and vaulted warehouse (`dock_3`).
  - **Age 4:** Steel-truss coaling & naval shipyard with hammerhead crane and searchlight beacon (`dock_4`).
  - **Age 5:** Magnetic-docking naval slipway with plasma beacon spire and automated cargo gantries (`dock_5`).
- **Civilization Variants:**
  - `vikings`: Longship slipway with dragon-headed mooring posts and shield-hung boathouse.
  - `chinese`, `japanese`: Vermilion-pillared harbor pavilion with upturned tile roof and hanging harbor lanterns.
  - `byzantines`, `saracens`, `turks`, `italians`: Arched stone *arsenale* / *tersane* gallery with domed harbor beacon.
  - `franks`, `teutons`, `spanish`: High-gabled Hanseatic/Atlantic stone wharf with crane wheelhouse.

### 5.8 `market` — Market (`3×3` tiles, Tier 2 Trade, Tribute & Resource Exchange)
- **Role:** Trains `tradecart` units, buys/sells resources for gold, and unlocks allied vision/tribute.
- **Age Progression (`0..5`):**
  - **Age 1:** Open cobblestone market square with timber guild shed and colorful canvas merchant stalls (`market_1`).
  - **Age 2:** Two-story arcaded cloth/spice hall with weighing scales, caravan hitching post, and striped awnings (`market_2`).
  - **Age 3:** Grand stone bourse / *bedesten* exchange with clock/dome tower, silk canopies, and treasure chests (`market_3`).
  - **Age 4:** Industrial glass-and-iron commodity exchange hall with telegraph ticker mast and truck loading bay (`market_4`).
  - **Age 5:** Quantum trade nexus with holo-ticker ring, anti-grav cargo pallets, and energy canopy (`market_5`).
- **Civilization Variants:**
  - `saracens`, `turks`: Vaulted *souk* / *kapalıçarşı* bazaar with turquoise/lead domes, spice carpets, and camel tie-posts.
  - `chinese`, `japanese`: *Fangshi* merchant hall with sweeping tile eaves, silk banners, and red paper lanterns.
  - `italians`, `spanish`, `byzantines`: Renaissance/Mediterranean *loggia dei mercanti* with marble arcades and amphorae.
  - `franks`, `teutons`, `vikings`: Steep-gabled guildhall with colourful heraldic market tents and barrel wagons.

### 5.9 `blacksmith` — Blacksmith (`3×3` tiles, Tier 2 Armor & Weapon Upgrades)
- **Role:** Researches melee attack, ranged fletching/bodkin, and infantry/archer/cavalry armor upgrades.
- **Age Progression (`0..5`):**
  - **Age 1:** Timber smithy with stone hearth, glowing coal forge, leather bellows, and outdoor anvil (`blacksmith_1`).
  - **Age 2:** Coursed-stone armory workshop with tall brick chimney, quenching trough, grindstone, and weapon racks (`blacksmith_2`).
  - **Age 3:** Master royal foundry with twin blast chimneys, trip-hammer, and gilded armor display stands (`blacksmith_3`).
  - **Age 4:** Bessemer steelworks & munitions plant with riveted converter stack and overhead gantry (`blacksmith_4`).
  - **Age 5:** Nano-metallurgy & composite-armor fabrication bay with glowing induction furnace core (`blacksmith_5`).
- **Civilization Variants:** Displays the civilization's signature shields and weapons on the outdoor rack (e.g., *katana* & *dō-maru* stand for `japanese`, scimitars & round shields for `saracens`/`turks`, halberds & dragon shields for `chinese`, kite/heater shields for Europeans).

### 5.10 `well` — Well (`1×1` tile, Tier 1 Settlement Water Supply)
- **Role:** Compact `1×1` water source boosting nearby farm and settlement vitality.
- **Age Progression (`0..5`):**
  - **Ages 0–1:** Rough stone circular well curb with timber A-frame rope winch and wooden bucket (`well_0`, `well_1`).
  - **Ages 2–3:** Carved masonry wellhouse with columns, ornate roof canopy, and bronze water spouts (`well_2`, `well_3`).
  - **Age 4:** Cast-iron motorized pump station with pressure gauge and standpipe (`well_4`).
  - **Age 5:** Atmospheric hydro-condenser pylon with glowing purified water reservoir (`well_5`).
- **Civilization Variants:**
  - `turks`, `saracens`: Domed marble *şadırvan* / *sebil* fountain kiosk with pointed arches.
  - `chinese`, `japanese`: Four-post upturned-eave *tsurube* well pavilion with bamboo/tile roof.
  - `italians`, `byzantines`, `spanish`: Sculpted marble *vera da pozzo* fountainhead with classical arch.
  - `franks`, `teutons`, `vikings`: Slate or shingle-roofed timber winch wellhouse.

### 5.11 `university` — University (`3×3` tiles, Tier 3 Science, Ballistics & Era Research)
- **Role:** Researches advanced engineering, ballistics, chemistry, industrialization, electronics, and fusion technologies.
- **Age Progression (`0..5`):**
  - **Age 2:** Two-story stone collegium with arched scriptorium windows, courtyard sundial, and lecture hall (`university_2`).
  - **Age 3:** Grand royal academy with copper astronomical observatory dome, armillary sphere, and library wings (`university_3`).
  - **Age 4:** Polytechnic institute with high-voltage Tesla insulator coils, glass skylight laboratory, and radio array (`university_4`).
  - **Age 5:** Quantum research institute with levitating containment torus, holographic globe, and particle beam conduit (`university_5`).
- **Civilization Variants:**
  - `saracens`, `turks`: Monumental *Madrasa* & astronomical observatory (*Rasathane*) with grand *iwan* arch, geometric tilework, and brass sextant dome.
  - `chinese`, `japanese`: Imperial *Guozijian* academy & bronze armillary platform with multi-tiered upturned tile roofs.
  - `italians`, `franks`, `teutons`, `spanish`, `byzantines`: Classical colonnaded rotunda & Gothic/Renaissance library hall.
  - `vikings`: High-roofed Norse *Fróðleikr* hall of runes and navigation astrolabes.

### 5.12 `monastery` — Monastery (`3×3` tiles, Tier 3 Sacred Sanctuary & Relic Repository)
- **Role:** Trains `monk` (or `Imam` for Turks) units, researches faith technologies, and houses Relics for continuous gold generation.
- **Age Progression (`0..5`):**
  - **Age 2:** Vaulted sanctuary nave with cloister walk, sacred reliquary altar, and tall bell/call-to-prayer spire (`monastery_2`).
  - **Age 3:** Grand cathedral / imperial mosque / great temple with stained-glass or glazed-tile rose windows and gilded roof crowns (`monastery_3`).
  - **Age 4:** Heritage stone sanctuary retrofitted with copper lightning rods, electric floodlighting, and broadcast chimes (`monastery_4`).
  - **Age 5:** Luminous neo-sanctuary combining traditional sacred geometry with floating golden energy halo spires (`monastery_5`).
- **Civilization Variants (Culturally Authentic Sacred Architecture):**
  - `franks`, `teutons`, `spanish`, `italians`: Romanesque/Gothic abbey church with rose window, flying buttresses, and soaring bell spire.
  - `vikings`: Multi-tiered Norwegian *Stavkirke* (Stave Church) with dark tarred shingle roofs and dragon-prow gables.
  - `byzantines`: Cross-in-square Orthodox basilica with central brick drum dome, semi-domes, and gold cross finials.
  - `saracens`: Hypostyle *Masjid* with ribbed turquoise dome, horseshoe courtyard arcade, and square/octagonal *mi'dhana* minaret.
  - `turks`: Seljuk tiled *Gök Medrese* mosque (Age 2) $\rightarrow$ Classical Ottoman imperial *Camii* with cascading lead domes and slender pencil minaret (Ages 3–5).
  - `chinese`: Sacred Buddhist/Daoist *Daxiong Baodian* temple hall with sweeping golden/jade eaves, incense cauldron, and octagonal pagoda tower.
  - `japanese`: *garan* temple & Shinto shrine complex with vermilion *torii* gate, *tahōtō* pagoda spire, and *shimenawa* rope lintel.

### 5.13 `barracks` — Barracks (`3×3` tiles, Tier 3 Infantry Training Hall)
- **Role:** Trains `militia` $\rightarrow$ `manatarms` $\rightarrow$ `longsword` $\rightarrow$ `twohanded`, `spearman` $\rightarrow$ `pikeman` $\rightarrow$ `halberdier`, `rifleman` (Age 4), and `plasmaguard` (Age 5).
- **Age Progression (`0..5`):**
  - **Age 0:** Timber militia muster hall with palisade drill fence, straw combat dummies, and spear racks (`barracks_0`).
  - **Age 1:** Two-story stone-and-timber guardhouse with corner watch turret, weapon racks, and training yard (`barracks_1`).
  - **Age 2:** Fortified crenellated garrison hall with arched sally port, armor stands, and parade ground (`barracks_2`).
  - **Age 3:** Grand royal infantry citadel with twin banner towers, gilded roof cresting, and iron-grated armory (`barracks_3`).
  - **Age 4:** Reinforced concrete-and-brick modern infantry depot with sandbagged machine-gun post and radio mast (`barracks_4`).
  - **Age 5:** Drop-pod & exo-infantry garrison bay with plasma barrier gates and glowing tactical holo-pad (`barracks_5`).
- **Civilization Variants:** Displays civilization-specific shields along the eaves, civ roof silhouette, and regional drill banners.

### 5.14 `range` — Archery Range (`3×3` tiles, Tier 2 Ranged & Marksman Training Yard)
- **Role:** Trains `archer` $\rightarrow$ `crossbow` $\rightarrow$ `arbalest`, `skirmisher` $\rightarrow$ `eskirm`, `cavarcher` $\rightarrow$ `hcavarcher`, `marksman` (Age 4), and `railgunner` (Age 5).
- **Age Progression (`0..5`):**
  - **Age 1:** Timber fletcher's pavilion with covered shooting line, three straw bullseye targets, and bow racks (`range_1`).
  - **Age 2:** Stone-and-timber butts gallery with elevated spotter balcony, quiver barrels, and long-distance targets (`range_2`).
  - **Age 3:** Imperial marksman hall with vaulted shooting loggia, pavilion tents, and gilded wind-vanes (`range_3`).
  - **Age 4:** Modern rifle & sniper firing range with earth berm, steel pop-up targets, and rangefinder tower (`range_4`).
  - **Age 5:** Electromagnetic railgun & particle calibration gallery with laser target emitters (`range_5`).
- **Civilization Variants:**
  - `japanese`: *Kyūdōjō* archery hall with dark tile roof, *maku* curtain, and *mato* targets.
  - `chinese`: Pavilion range with crossbow/bolt racks and dragon pennants.
  - `saracens`, `turks`: Arched *Meydan-ı Ok* bowyer lodge with composite bow racks and horse-archery post.
  - `franks`, `teutons`, `spanish`, `italians`, `byzantines`, `vikings`: Regional timber/masonry fletcher's hall with red-and-white straw targets.

### 5.15 `stable` — Stable (`3×3` tiles, Tier 2 Cavalry & Royal Mount Yard)
- **Role:** Trains `scout` $\rightarrow$ `lightcav` and `knight` $\rightarrow$ `cavalier` $\rightarrow$ `paladin`.
- **Age Progression (`0..5`):**
  - **Age 1:** Timber horse barn with hay loft, water trough, fenced paddock, and hitching rail (`stable_1`).
  - **Age 2:** Stone-walled cavalry mews with tiled roof, barding armor stands, and cobblestone exercise yard (`stable_2`).
  - **Age 3:** Royal equestrian pavilion with arched stalls, gilded weathervane, and caparisoned tournament banners (`stable_3`).
  - **Age 4:** Mechanized cavalry & reconnaissance motor pool with fuel drums and dispatch stalls (`stable_4`).
  - **Age 5:** Grav-cavalry & cyber-mount rapid deployment paddock with energy tether pylons (`stable_5`).
- **Civilization Variants:**
  - `saracens`: Desert *Marbat* cavalry & camel courtyard with sandstone arches and palm shade.
  - `turks`: Steppe/Ottoman *Has Ahır* imperial stables with lead dome cupola and horse-tail *tuğ* standard.
  - `chinese`, `japanese`: Upturned-eave *umaya* cavalry barn with lacquered saddle racks.
  - `franks`, `teutons`, `spanish`, `italians`, `byzantines`, `vikings`: Regional masonry/stave stables with tournament lance racks.

### 5.16 `siege` — Siege Workshop (`3×3` tiles, Tier 3 Artillery & Heavy Vehicle Factory)
- **Role:** Produces `ram` $\rightarrow$ `cappedram`, `mangonel` $\rightarrow$ `onager`, `scorpion`, `tank` (Age 4), and `fusionwalker` (Age 5).
- **Age Progression (`0..5`):**
  - **Age 2:** Twin-bay heavy timber & stone engineering hall with A-frame lifting crane, iron-rimmed wheels, and torsion rope spools (`siege_2`).
  - **Age 3:** Grand royal arsenal with cannon foundry chimney, overhead travelling hoist, and iron shot pyramids (`siege_3`).
  - **Age 4:** Heavy armored tank assembly plant with saw-tooth factory skylights, smokestacks, and steel roll-up doors (`siege_4`).
  - **Age 5:** Mecha & `fusionwalker` orbital-grade assembly hangar with magnetic gantry cranes and plasma weld arcs (`siege_5`).
- **Civilization Variants:** Civ-specific masonry, roof silhouette, and artillery yard props (e.g., Ottoman cannon barrels for `turks`, multi-bolt *bed-crossbow* frames for `chinese`, heavy iron-bound siege sheds for `teutons`).

### 5.17 `outpost` — Outpost (`1×1` tile, Tier 1 Early Warning Watchpost)
- **Role:** Cheap `1×1` long-line-of-sight observation post (`los: 10+`).
- **Age Progression (`0..5`):**
  - **Ages 0–1:** Four-legged timber watch scaffold with ladder, signal brazier, and lookout platform (`outpost_0`, `outpost_1`).
  - **Ages 2–3:** Stone-base beacon pillar with covered crow's nest and horn/bell (`outpost_2`, `outpost_3`).
  - **Age 4:** Steel lattice observation mast with rotating searchlight (`outpost_4`).
  - **Age 5:** Autonomous sensor spire with rotating radar/lidar dish and cyan scan pulse (`outpost_5`).
- **Civilization Variants:** Roof cap and banner match the civilization's architectural DNA.

### 5.18 `palisade` — Palisade Wall (`1×1` tile, Tier 1 Timber Stockade)
- **Role:** Early-game cheap wooden barrier (`1×1`).
- **Age Progression & Civ Variants:** Sharpened vertical log stockade bound with rope/iron bands (`palisade_0`); incorporates bamboo-and-timber stakes for `chinese`/`japanese`, tarred oak + round shields for `vikings`, and sandbag/barbed-wire reinforcement in Age 4 / laser-picket posts in Age 5.

### 5.19 `wall` — Stone Wall (`1×1` tile, Tier 1 Fortified Curtain Wall)
- **Role:** Heavy defensive masonry curtain wall (`1×1`).
- **Age Progression (`0..5`):**
  - **Ages 1–2:** Dressed stone rampart with crenellated parapet walk (`wall_1`, `wall_2`).
  - **Age 3:** Thick fortified bastion wall with machicolations and buttressed base (`wall_3`).
  - **Age 4:** Reinforced ferro-concrete bunker wall with steel embrasures (`wall_4`).
  - **Age 5:** Layered composite-alloy energy-shielded rampart with glowing conduit seam (`wall_5`).
- **Civilization Variants:** Merlons and masonry follow `CIV_ARCH` (swallowtail merlons for `italians`, stepped merlons for `saracens`/`turks`, red brick for `teutons`, striped brick courses for `byzantines`, grey brick for `chinese`, battered *ishigaki* + white plastered *hei* wall for `japanese`).

### 5.20 `gate` — Gate (`3×1` / `1×3` tiles, Tier 2 Fortified Passage)
- **Role:** Passable wall gateway that opens for friendly/allied units and blocks enemies.
- **Age Progression (`0..5`):**
  - **Ages 1–2:** Twin-turret stone gatehouse with iron portcullis and arched passageway (`gate_1`, `gate_2`).
  - **Age 3:** Monumental machicolated barbican gatehouse with gilded crest and heavy oak-and-iron doors (`gate_3`).
  - **Age 4:** Armored steel blast-door checkpoint with guard box and searchlights (`gate_4`).
  - **Age 5:** Hard-light plasma barrier gate between twin alloy pylons (`gate_5`).
- **Civilization Variants:** Horseshoe arch for `saracens`/`spanish`, pointed ogee + tile frieze for `turks`, *chenglou* upturned-eave gate roof for `chinese`, *yagura-mon* timber-over-stone gate for `japanese`, stave-and-shield arch for `vikings`.

### 5.21 `tower` — Watch / Guard / Keep Tower (`1×1` tile, Tier 2 Defensive Arrow/Gun Tower)
- **Role:** Defensive firing tower (`1×1`) upgraded via `guardtower` and `keep` technologies.
- **Age Progression (`0..5`):**
  - **Age 1 (Watch Tower):** Square stone-and-timber watchtower with hoarding gallery (`tower_1`).
  - **Age 2 (Guard Tower):** Tall dressed-stone tower with corbeled parapet and arrow slits (`tower_2`).
  - **Age 3 (Keep):** Massive buttressed stone keep tower with steep roof/dome/pagoda crown and cannon/ballista ports (`tower_3`).
  - **Age 4:** Concrete flak/artillery casemate tower with rotating armored gun turret (`tower_4`).
  - **Age 5:** Directed-energy defense pylon with glowing plasma emitter crown (`tower_5`).
- **Civilization Variants:** Conical slate roof (`franks`), steep red-brick helm roof (`teutons`), Ghibelline campanile (`italians`), domed turret (`byzantines`, `saracens`, `turks`), multi-eave watchtower (`chinese`, `japanese`), stave watchtower (`vikings`).

### 5.22 `castle` — Castle (`4×4` tiles, Tier 4 Supreme Fortress & Unique Unit Citadel)
- **Role:** Supreme military stronghold (`4×4`), trains the civilization's **Unique Unit** and `trebuchet`, and researches `elite_uu`.
- **Dedicated Regional & Civilization Fortress Sprites (`castle`, `castle_east`, `castle_med`, `castle_nordic` + Per-Civ Crowns & Ages 4–5 Retrofits):**
  1. `franks`: Concentric Loire Chateau-Fortress with four conical slate-blue corner towers, portcullis barbican, and tall central donjon (`castle` + `franks` crown).
  2. `teutons`: Monumental Red-Brick *Ordensburg* (Marienburg style) with steep dark-iron roofs, stepped gables, and crusader banners (`castle` + `teutons` crown).
  3. `spanish`: Golden-sandstone *Alcázar de Segovia* style fortress with *Torre del Homenaje*, Mudéjar turrets, and terracotta roofs (`castle_med` + `spanish` crown).
  4. `italians`: Renaissance *Rocca* / Sforza citadel with swallowtail Ghibelline merlons, brick rondels, and marble-trimmed keep (`castle` + `italians` crown).
  5. `vikings`: Royal Norse *Trelleborg* & Stave Ring-Fortress (`castle_nordic`) with boulder ramparts, shield-hung timber palisades, and multi-tiered dragon-gable central hall.
  6. `byzantines`: Imperial *Kastron* (`castle_med`) with alternating red-brick *opus listatum* bands, octagonal domed keep, and Greek-fire braziers.
  7. `saracens`: Monumental *Qal'at* Citadel (`castle_med`) with *ablaq* sandstone curtain walls, four round corner towers, and ribbed turquoise-and-gold dome.
  8. `turks`: *Rumeli Hisarı* / Ottoman Citadel (`castle_med`) with cylindrical cannon towers, conical/domed lead roofs, Iznik tile bands, and crescent *alem* finials.
  9. `chinese`: Walled Imperial *Chenglou* Fortress (`castle_east`) with battered grey-brick ramparts, vermilion corner pavilions, and three-tiered jade/gold central palace keep.
  10. `japanese`: Sengoku *Hirayama-jiro* Castle (`castle_east`) on curved *ishigaki* dry-stone walls, crisp white *shikkui* plaster towers, five-tiered *Tenshu* donjon, and gold *shachihoko* roof carp.
  - **Ages 4–5:** Retrofitted with heavy coastal/fortress artillery cupolas, radar arrays, and steel blast shielding (Age 4) or planetary defense rail-turrets and deflector shield pylons (Age 5).

### 5.23 `wonder` — Wonder (`5×5` tiles, Tier 5 Monumental Era Landmark)
- **Role:** Supreme `5×5` architectural triumph triggering the Wonder victory countdown.
- **6 Distinct Era Wonder Monuments (`wonder_0` .. `wonder_5`) Customized per Civilization:**
  - `wonder_0` (**Dark Age — Ancestral Megalithic Sanctuary**): Stepped stone-and-earth platform with carved megalithic pillars, bronze-roofed rotunda, and ceremonial braziers.
  - `wonder_1` (**Feudal Age — Royal Great Hall Monument**): Grand stepped limestone plaza, timber-and-stone royal hall, four slate/tile corner towers, and gilded roof ridges.
  - `wonder_2` (**Castle Age — Grand Library & Sacred Rotunda**): Marble colonnaded plaza, arched scriptorium galleries, gilded frieze, and grand ribbed dome/pagoda crown.
  - `wonder_3` (**Imperial Age — Grand Imperial Monument**): Monumental marble plaza, four ornate corner spires/minarets/pagodas, classical colonnades, and soaring gilded central dome/tenshu.
  - `wonder_4` (**Modern Age — World Observatory & Exhibition Palace**): Stone-and-steel plaza, huge copper-and-glass astronomical observatory dome with brass telescope, and cuatro dynamo towers.
  - `wonder_5` (**Future Age — Orbital Fusion Beacon**): White-and-dark-steel hexagonal foundation pad, four inward-curving magnetic containment pylons, and three glowing cyan plasma torus rings around a levitating fusion core spire.
- **Civilization Customization:** Each Wonder receives the owning civilization's architectural crown (e.g., 4 pencil minarets + crescent dome for `turks`/`saracens`, multi-tiered golden pagoda roof for `chinese`/`japanese`, dragon-head stave finials for `vikings`, double-headed eagle + brick dome for `byzantines`, Gothic pinnacles for `franks`/`teutons`).

---

## 6. Unit-by-Unit Asset Plan (All 53 Unit & Actor Entries $\times$ 10 Civilizations $\times$ 6 Ages)

Every unit is rendered at `US = 0.95` (`23–25 px` infantry height, `34–36 px` cavalry height) via the 53 animated 3D actor atlases (`game/assets/actors/`) enhanced with the **Per-Civilization & Per-Age Equipment Compositor** (`game/js/civ_art.js` + `game/js/units_hd.js`).

### 6.1 Civilian, Religious, Trade & Engineering Units (5 Entries)

| # | Unit ID | Name & Role | Age Progression (`0..5`) | Per-Civilization Visual Differentiation (All 10 Civs) |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `villager` (M) | **Male Villager** (Gatherer / Builder) | **Ages 0–1:** Linen/hide work tunic, bare/straw head<br>**Ages 2–3:** Artisanal cloth tunic, leather belt, regional hat<br>**Age 4:** Industrial denim/khaki workwear + yellow steel hardhat<br>**Age 5:** Exo-utility suit + glowing visor | `franks`/`teutons`: Chaperon hood / felt cap; `spanish`/`italians`: Linen cap; `vikings`: Fur-trimmed wool cap; `byzantines`: Tunic + phrygian felt cap; `saracens`: Wrapped *keffiyeh*; `turks`: Seljuk felt *börk* $\rightarrow$ Ottoman turban; `chinese`: Conical bamboo *douli* hat; `japanese`: Woven *sugegasa* sedge hat |
| 2 | `villager_f` | **Female Villager** (Gatherer / Builder) | Same 6-age attire progression (`medieval`/`seljuk`/`ottoman` $\rightarrow$ `modern` $\rightarrow$ `future` atlases) | Regional headscarf, apron, bodice trim, and cultural headgear matching each of the 10 civilizations |
| 3 | `sapper` | **Sapper** (Tunnel / Trench / Demolition Engineer) | **Ages 1–3:** Leather apron, miner's iron kettle cap, heavy pickaxe & powder keg satchel<br>**Age 4:** Combat engineer helmet & dynamite pack<br>**Age 5:** Plasma-bore engineer rig | Civ-colored tunic, helmet badge, and cultural tool satchel trim |
| 4 | `monk` | **Monk / Imam / Priest** (Healer, Converter, Relic Carrier) | **Ages 2–3:** Sacred vestments + relic/healing staff<br>**Ages 4–5:** Gold-trimmed ceremonial robe with luminous halo staff | `franks`/`teutons`/`spanish`/`italians`: Brown/white monastic habit, tonsure/mitre, Latin cross staff; `vikings`: Fur-cloaked *Goði* with rune-ring staff; `byzantines`: Black *kalimavkion* veil, purple/gold *phelonion*, Orthodox cross; `saracens`/`turks`: **Imam** in white robe, green sash, white turban with emerald jewel, crescent-finial staff; `chinese`: Saffron/jade Daoist-Buddhist robe, lotus crown, ringed *khakkhara* staff; `japanese`: *Sōhei* monk with white *kesa* cowl and ringed pewter staff |
| 5 | `tradecart` | **Trade Cart** (Land Caravan) | **Ages 1–2:** Open 2-wheel wooden merchant cart<br>**Age 3:** Arched-canopy guild wagon with gold chests<br>**Age 4:** Motorized olive/player-tinted cargo truck with headlights<br>**Age 5:** Sleek anti-grav hover-hauler with glowing cyan thrusters | `saracens`/`turks`: Pack-camel caravan / ornate arched bazaar cart with silk carpets; `chinese`/`japanese`: Vermilion two-wheeled canopy carriage with paper lanterns & silk bales; `vikings`: Carved Norse ox-cart with fur pelts & barrels; `franks`/`teutons`/`spanish`/`italians`/`byzantines`: Heraldic covered merchant wagon |

### 6.2 Barracks Infantry Line (7 Units)

All infantry units display their civilization's **helmet silhouette**, **shield shape & heraldic emblem**, and **armor/tunic palette** while clearly distinguishing every upgrade tier:

| # | Unit ID | Upgrade Tier & Age | Weapon & Armor Silhouette | Per-Civilization Equipment Overlay |
| :-: | :--- | :--- | :--- | :--- |
| 6 | `militia` | **Militia** (Age 0 Dark) | Quilted tunic, wooden club / short iron blade, small wooden buckler, no metal helmet (cloth/leather headband) | Civ-dyed tunic, cultural headband/cap (`douli` for `chinese`, *hachimaki* for `japanese`, *keffiyeh* for `saracens`, fur band for `vikings`), small civ-emblem buckler |
| 7 | `manatarms` | **Man-at-Arms** (Age 1 Feudal) | Chainmail hauberk over tunic, iron broadsword, medium painted shield, open iron helm | Civ helmet (nasal helm, kettle hat, spangenhelm, *jingasa*, *bingmao*, *sharbush*) + painted civ heraldic shield |
| 8 | `longsword` | **Long Swordsman** (Age 2 Castle) | Steel breastplate + mail skirt, long arming sword, full heraldic kite/round/tower shield, visored/crest helm | Full civ armor trim (mountain-scale for `chinese`, *dō-maru* + *kabuto* for `japanese`, *klibanion* for `byzantines`, surcoat + great helm for `teutons`, *chichak* for `turks`) |
| 9 | `twohanded` | **Two-Handed Swordsman** (Age 3 Imperial) | Full gilded plate / heavy lamellar armor, flowing shoulder cape, massive two-handed greatsword / *nodachi* / *zhanmadao*, crowned/plumed helm | Ornate plumed/crested civ helmet, gilded shoulder pauldrons, and culturally shaped greatsword blade |
| 10 | `spearman` | **Spearman** (Age 1 Feudal) | Leather/quilted jack, 2.5m ash spear, light buckler, light rimmed cap | Civ headgear (kettle cap, *jingasa*, bamboo hat, turban wrap, spectacle cap) + civ buckler |
| 11 | `pikeman` | **Pikeman** (Age 2 Castle) | Half-plate corselet & tassets, 4m steel-tipped pike, reinforced helmet | Civ breastplate pattern + cultural helmet crest |
| 12 | `halberdier` | **Halberdier** (Age 3 Imperial) | Gilded heavy plate armor, plumed helmet, ornate axe-headed polearm | Culturally distinct polearm head: European halberd (`franks`, `teutons`, `spanish`, `italians`), crescent *ji* halberd (`chinese`), *naginata*/*jumonji-yari* (`japanese`), *bardiche*/Dane-axe polearm (`vikings`, `byzantines`), crescent glaive (`saracens`, `turks`) |

### 6.3 Archery Range Units (7 Units)

| # | Unit ID | Upgrade Tier & Age | Weapon & Armor Silhouette | Per-Civilization Equipment Overlay |
| :-: | :--- | :--- | :--- | :--- |
| 13 | `archer` | **Archer** (Age 1 Feudal) | Light tunic, hip quiver, wooden self-bow, cloth/leather archer's cap | `japanese`: Asymmetric tall *yumi* bow + *eboshi* cap; `chinese`/`turks`/`saracens`/`byzantines`: Recurve composite bow + regional cap; `franks`/`teutons`/`spanish`/`italians`/`vikings`: Longbow + hood/cap |
| 14 | `crossbow` | **Crossbowman** (Age 2 Castle) | Mail shirt & brigandine vest, steel-prod crossbow, iron kettle/sallet helm, back bolt quiver | Civ helmet + brigandine trim + regional crossbow stock |
| 15 | `arbalest` | **Arbalester** (Age 3 Imperial) | Gilded half-plate & plumed helm, heavy windlass steel arbalest, back pavise/mantlet accent | Imperial civ helm plume + gilded shoulder guard + civ crest on back pavise |
| 16 | `skirmisher` | **Skirmisher** (Age 1 Feudal) | Light padded tunic, bundle of throwing javelins, large wicker/leather oval shield | Large shield painted with the civilization's full heraldic emblem |
| 17 | `eskirm` | **Elite Skirmisher** (Age 2/3 Castle) | Scale/mail hauberk, crested helmet, barbed heavy javelins, bronze-rimmed heraldic shield | Crested civ helmet + gilded rim around the civilization's shield emblem |
| 18 | `cavarcher` | **Cavalry Archer** (Age 2 Castle) | Swift unbarded horse, mounted archer in brigandine/lamellar drawing composite bow | Steppe/Ottoman turban & kaftan (`turks`), desert *keffiyeh* (`saracens`), *yabusame* samurai kabuto (`japanese`), plumed Ming helm (`chinese`), spangenhelm (`byzantines`) |
| 19 | `hcavarcher` | **Heavy Cavalry Archer** (Age 3 Imperial) | Half-barded warhorse, gilded lamellar/plate rider, horned/plumed helmet, composite bow | Heavy civ horse barding + imperial plumed/crested helmet |

### 6.4 Stable Cavalry Line (5 Units)

| # | Unit ID | Upgrade Tier & Age | Mount, Weapon & Armor Silhouette | Per-Civilization Equipment Overlay |
| :-: | :--- | :--- | :--- | :--- |
| 20 | `scout` | **Scout Cavalry** (Age 0/1) | Swift light horse, leather jerkin rider, short cavalry spear/sword, light cap | Civ cap/turban/helmet + saddle blanket in civ trim |
| 21 | `lightcav` | **Light Cavalry** (Age 2 Castle) | Armored leather-barded horse, mail/lamellar rider, curved sabre/lance, round/buckler shield | Winged/plumed hussar/sipahi style for `turks`/`byzantines`, *keffiyeh* lancer for `saracens`, *horo*-cloaked rider for `japanese`, Norse raider for `vikings` |
| 22 | `knight` | **Knight** (Age 2 Castle) | Heavy charger with cloth caparison, full mail-and-plate rider, couched lance / heavy sword, heater shield | Caparison & shield bear the civilization's heraldic colors & emblem; civ helmet (`kabuto` for `japanese`, dragon helm for `chinese`, great helm for `teutons`, bascinet for `franks`) |
| 23 | `cavalier` | **Cavalier** (Age 3 Imperial) | Steel-and-cloth barded destrier, fluted plate armor, plumed helm, gilded shield | Ornate plumed civ helmet + gold-trimmed heraldic horse barding |
| 24 | `paladin` | **Paladin** (Age 3 Imperial) | Full golden-plate barded warhorse, crowned/winged champion helm, flowing cape, radiant heraldic shield | Supreme imperial champion silhouette per civilization |

### 6.5 Siege Workshop & Castle Artillery (6 Units)

| # | Unit ID | Name & Age | Chassis & Weapon Silhouette | Per-Civilization & Age Visual Customization |
| :-: | :--- | :--- | :--- | :--- |
| 25 | `ram` | **Battering Ram** (Age 2) | 4-wheeled timber shed with sloped plank roof and swinging iron-shod oak log | Roof shingle/tile tint, shed side shields/banners, and ram-head carving match the civilization (e.g., dragon head for `vikings`/`chinese`, bronze ram head for `byzantines`/`italians`, crescent iron cap for `turks`/`saracens`) |
| 26 | `cappedram` | **Capped Ram** (Age 3) | Steel-plated armored siege shed with spiked/crested bronze ram head and corner pennants | Riveted iron/steel armor plates with gold civilization heraldry |
| 27 | `mangonel` | **Mangonel** (Age 2) | Heavy timber torsion catapult frame with throwing arm, stone basket, and 4 spoked wheels | Civ-tinted timber frame, player/civ banners, and brass/iron fittings |
| 28 | `onager` | **Onager** (Age 3) | Iron-reinforced heavy siege catapult with double torsion skeins, winch house, and fire-pot/boulder load | Gilded iron brackets, protective front mantlet with civ emblem |
| 29 | `scorpion` | **Scorpion** (Age 2) | Wheeled torsion ballista carriage with twin steel bow arms and heavy iron-tipped bolt | Civ-styled front shield mantlet and bronze torsion cylinders |
| 30 | `trebuchet` | **Trebuchet** (Age 3 Castle) | Tall A-frame counterweight siege engine with swinging beam, counterweight box, and sling (packed cart vs. unpacked tower states) | Counterweight box painted with civilization heraldry and topped with civ roof/banner finial |

### 6.6 Castle Unique Units — 1 Iconic Elite Unit per Civilization (10 Units)

| # | Unit ID | Civilization | Unit Name | Signature Historical Visual Design |
| :-: | :--- | :--- | :--- | :--- |
| 31 | `axeman` | `franks` | **Throwing Axeman** | Chainmail hauberk, blue fleur-de-lis tabard, braided beard, conical nasal helm, carrying twin bearded *francisca* throwing axes |
| 32 | `teutonic` | `teutons` | **Teutonic Knight** | Heavy white crusader cloak & surcoat with black cross, horned/crowned great helm, massive broadsword, black-cross heater shield |
| 33 | `conquistador` | `spanish` | **Conquistador** | Mounted armoured caballero on dappled horse, high-combed steel morion helmet, steel cuirass, firing matchlock harquebus with muzzle flash |
| 34 | `genoese` | `italians` | **Genoese Crossbowman** | Steel sallet helm, mail-and-plate brigandine, heavy steel crossbow, and tall ground-planted white pavise shield emblazoned with the red Cross of St. George |
| 35 | `samurai` | `japanese` | **Samurai** | Full laced *ō-yoroi* / *dō-maru* lamellar armor, horned *kabuto* helmet with gold *kuwagata* crest, back *sashimono* clan banner, wielding curved two-handed *katana* |
| 36 | `chukonu` | `chinese` | **Chu Ko Nu** | Imperial Song/Ming mountain-scale brigandine, red-plumed iron helmet, wielding lever-action box magazine repeating crossbow (*zhuge nu*) |
| 37 | `cataphract` | `byzantines` | **Cataphract** | Fully scale-armored warhorse (*klibanophoros*), bronze-and-purple lamellar rider, conical plumed helm with mail faceguard, heavy mace/kontos & imperial eagle shield |
| 38 | `berserk` | `vikings` | **Berserk** | Wolf/bear-pelt shoulder mantle, horned Gjermundbu helm, chainmail byrnie, swirling Norse round shield, and heavy bearded battle axe |
| 39 | `mameluke` | `saracens` | **Mameluke** | Armored war camel with embroidered saddle cloth, gilded Mamluk lamellar & turbaned helm, throwing curved scimitars |
| 40 | `janissary` | `turks` | **Janissary** | Tall white felt *börk* cap with golden spoon-holder (*kaşıklık*) & plume, crimson/player-colored *dolama* coat with gold braid, firing long Ottoman *tüfek* matchlock musket |

### 6.7 Naval Fleet — Dock Vessels (8 Units)

All 8 naval unit types adapt their hull silhouette, prow ornament, and sail rig to the civilization's maritime tradition (`vikings` Dragon Longships, `chinese`/`japanese` Battened Junks & Atakebune, `byzantines`/`saracens`/`turks`/`italians` Lateen Dromons/Galleys, `franks`/`teutons`/`spanish` Atlantic Cogs/Galleons) and gain steel/plasma superstructures in Ages 4–5:

| # | Unit ID | Name & Age | Base Hull & Function | Cultural & Age Visual Variations |
| :-: | :--- | :--- | :--- | :--- |
| 41 | `fishingship` | **Fishing Ship** (Age 0..5) | Compact single-mast coastal boat with trailing fishing nets & fish well | Square/lateen/junk single sail + bamboo/timber net boom; motorized trawler cabin in Age 4; hydro-skimmer in Age 5 |
| 42 | `transport` | **Transport Ship** (Age 1..5) | Wide-beamed troop carrier with boarding ramp, deck railings, and troop canopy | Regional sail rig + shield/banner gunwales; armored landing craft bow in Age 4; hover-transport deck in Age 5 |
| 43 | `tradecog` | **Trade Cog** (Age 1..5) | Broad-hulled merchant vessel (`ship_cog`) stacked with crates, amphorae, and gold chests | Atlantic square-sail cog, Mediterranean lateen *nave*, or East Asian treasure junk (`ship_junk`); cargo freighter in Ages 4–5 |
| 44 | `galley` | **Galley** (Age 1 Feudal) | Sleek oared scouting & skirmish warship with bow bolt-shooter | `vikings`: `ship_longship` clinker drakkar; `chinese`/`japanese`: `ship_junk` patrol boat; `byzantines`/`saracens`/`turks`/`italians`: `ship_dromon` lateen galley; `franks`/`teutons`/`spanish`: `ship_galley` |
| 45 | `wargalley` | **War Galley** (Age 2 Castle) | Reinforced oared warship with bronze naval spur ram, fighting forecastle, and twin sails | Added gunwale shields, fighting deck tower, and civilization heraldry on sails |
| 46 | `galleon` | **Galleon** (Age 3..5) | Heavy multi-masted gun-deck battleship (`ship_galleon` / regional flagship) with broadside cannon ports | `vikings`: Great Royal *Dreki* Dragon Flagship; `chinese`/`japanese`: Imperial multi-mast *Atakebune* / *Baochuan* War Junk; `byzantines`/`saracens`/`turks`: Imperial Dromon/Galleass with brass Greek-fire/cannon battery; Ages 4–5: Dreadnought turret / plasma rail-cruiser |
| 47 | `fireship` | **Fire Ship** (Age 2..5) | Armored siphon vessel with bow Greek-fire / naphtha nozzle and flaming brazier deck | Bronze dragon/lion siphon prow spewing flame jets; plasma-torch prow in Age 5 |
| 48 | `demoship` | **Demolition Ship** (Age 2..5) | Fast powder-packed hull loaded with volatile black-powder barrels and lit fuse | Glowing red powder kegs & warning pennants; antimatter/fusion core charge in Age 5 |

### 6.8 Modern & Future Era Units (6 Units)

| # | Unit ID | Era & Building | Visual Design & Per-Civilization Styling |
| :-: | :--- | :--- | :--- |
| 49 | `rifleman` | **Rifleman** (Age 4 Barracks) | Early-20th-century field uniform, steel combat helmet, bolt-action/semi-auto service rifle; uniform trim, helmet badge/silhouette (Adrian/Stahlhelm/Brodie/Kabalak), and shoulder patch match the civilization |
| 50 | `marksman` | **Marksman** (Age 4 Range) | Camouflaged field cloak/cape, scoped high-power precision rifle, spotter optics, and civilization insignia |
| 51 | `tank` | **Battle Tank** (Age 4 Siege) | Riveted/welded steel tracked armored hull (`machines-tank`), rotating main cannon turret, exhaust smoke, and civilization national roundel/crest painted on turret sides |
| 52 | `plasmaguard` | **Plasma Guard** (Age 5 Barracks) | Powered composite exo-armor (`future-gunner`), sealed visor helmet with glowing cyan/gold optics, plasma carbine, and civilization crest on chest/pauldron |
| 53 | `railgunner` | **Railgunner** (Age 5 Range) | Heavy anti-materiel exo-suit (`future-sniper`), twin-rail electromagnetic long rifle with glowing blue capacitor coils, and civilization heraldic trim |
| 54 | `fusionwalker` | **Fusion Walker** (Age 5 Siege) | Bipedal heavy siege mech (`machines-walker`) with twin plasma/rail cannons, glowing fusion core dome, and civilization livery + crest |

### 6.9 Gaia Wildlife, Livestock & Special Units (5 Entries)

| # | Unit ID / Variant | Name | Visual Design & Atlas |
| :-: | :--- | :--- | :--- |
| 55 | `sheep` | **Sheep** | Woolly white flock sheep (`animals-sheep`), tinted collar/bell when claimed by a player |
| 56 | `cow` (`sheep` breed) | **Anatolian / Steppe Cow** | Brown-and-white horned cattle (`animals-cow`), spawned in sets of 3 replacing wild boars near `turks` Town Centers |
| 57 | `deer` | **Deer** | Agile russet stag with branched antlers (`animals-deer`) |
| 58 | `boar` | **Wild Boar** | Bristled dark-brown tusker (`animals-boar`) |
| 59 | `wolf` | **Grey Wolf** | Predatory timber wolf (`animals-wolf`) |
| 60 | `cobra` | **Cobra Car** | Blue-and-white twin-stripe AC Shelby Cobra sports car firing rapid machine-gun volleys |

---

## 7. File Organization & Reproducible Build Commands

- **Kenney & AI-Generated Building/Ship Sprites:**
  - Raw AI renders: `tools/art/generated/*_raw.png`
  - Processed transparent sprites: `game/art/kenney/*.png`
  - Metadata & isometric anchor manifest: `game/art/kenney/manifest.js` (`KENNEY_ART`)
  - 3D recipes & baker: `tools/art/kenney-recipes.js`, `tools/art/bake-kenney.mjs`, `tools/art/process-generated.mjs`
- **3D Animated Unit Atlases:**
  - Actor atlases & masks: `game/assets/actors/*-sheet.png`, `game/assets/actors/*-mask.png`
  - Manifest & runtime binder: `game/assets/actors/manifest.js`, `game/js/actors.js`
  - 3D rig recipes & baker: `tools/art/actor-models.js`, `tools/art/bake-actors.mjs`
- **Runtime Civilization $\times$ Age Compositor:**
  - Architectural & unit equipment DNA: `game/js/civ_art.js`
  - Supersampled unit cache: `game/js/units_hd.js`
  - Building & world renderer: `game/js/render.js`, `game/js/wonders.js`
- **Verification Commands:**
  ```sh
  node tests/check-syntax.js
  node tests/run-all.js --quick
  node tests/save-compat.test.js
  ```

