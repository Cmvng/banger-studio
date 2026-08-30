# CMVNG Studio v7: fresh 2026 design and product audit

Audit date: 2026-08-30

## Executive verdict

The product now has credible technical depth, but the design experience still tells three different stories:

1. The home and writer screens look like a polished blue SaaS dashboard.
2. Research-to-write recommends templates from the legacy template registry.
3. Signal Workshop is a separate, newer native-vector catalog inside the Builder.

That split is the main reason the product does not yet feel like one exceptional creative instrument.

The strongest v7 direction is not “add more cards, gradients, pills, and assets.” It is:

> Make the interface quiet and precise so the work can be loud, authored, tactile, editorial, and unmistakably CMVNG.

The next build should unify research, writing, design recommendation, Builder editing, and export around one manifest-driven design registry. It should also be more honest about what is a structural design, what is a recipe, what is an element, and what is only a colorway.

## Audit scope and limitations

### Current implementation inspected

- studio-enhancements.js, version 6.0.0
- creative-pack-v5.js
- builder-geometry-v6.js
- the composed local preview-v5.html production candidate
- native Builder controls and serialization in preview-v5.html
- current creative-pack and geometry tests

The live URL was also attempted through the in-app browser and a direct read-only HTTP request. No browser instance was available in this task, and the Railway host timed out on the direct request. Therefore this document does not claim a fresh live screenshot review. Visual and interaction findings are grounded in the current local production bundle and source, with browser-only checks explicitly retained in the QA section.

### Current test evidence

The current code passes meaningful engineering checks:

- 26 characters
- 58 doodles
- 24 text structures
- 30 special layouts
- 138 native assets total
- 552 asset instantiations across four formats
- 2,208 format reflows audited
- 1,940 design layers inspected by the geometry test
- no out-of-bounds composition failures in the tested fixtures
- 12 inline scripts parse without syntax failure

That is real progress. It proves the next bottleneck is not basic asset quantity or bounding-box repair. It is art direction, product coherence, editing depth, discovery, and the truthfulness of catalog claims.

## What contemporary 2026 signals actually suggest

The sources below are directional evidence, not a command to copy current trends. The CMVNG recommendations are an inference from them.

- [Canva's 2026 “polish to presence” analysis](https://www.canva.com/newsroom/news/design-trends-2026-polish-to-presence/) argues that generic polish is no longer enough and that visible thought, texture, and intentional imperfection can make work feel human. It also warns that analogue texture becomes empty when it is applied as surface styling without changing how the work is conceived.
- [Adobe's 2026 creative-trends analysis](https://blog.adobe.com/en/publish/2025/12/09/four-creative-trends-define-marketing-2026) points toward tactile, emotionally resonant, playful, and culturally specific content rather than frictionless sameness.
- [Adobe's analysis of millions of 2025 Firefly prompts](https://blog.adobe.com/en/publish/2026/01/08/halftone-nostalgia-more-2025-top-firefly-prompt-trends) found continued strength for minimalism and rising interest in static, stippling, halftone, and grain. That supports a system where clean hierarchy and tactile marks coexist instead of competing.
- [Webflow's 2026 trend review](https://webflow.com/blog/web-design-trends-2026) describes human craft as a differentiator in an environment of algorithmic sameness, and calls out intentional typographic treatments as a way to direct attention.
- [Google's Material 3 Expressive research](https://design.google/library/expressive-material-design-google-research?pubDate=20250521) reports that color, shape, size, motion, and containment can make an interface more emotional and more usable when they clarify hierarchy. The useful lesson for CMVNG is expressive emphasis, not decorating every component.
- [Figma's Config 2025 recap](https://www.figma.com/blog/config-2025-recap/) combines freeform drawing and texture with grid-based structure, and emphasizes direct manipulation of the specific selected area. That maps directly to CMVNG's need for expressive assets plus precise editing.
- [Figma's UI3 redesign account](https://www.figma.com/blog/behind-our-redesign-ui3/) describes the tension between beginner discoverability and expert muscle memory, using optional labels and consistent, collapsible panels while keeping the work central.
- [Apple's interface guidance](https://developer.apple.com/design/tips/) recommends 44 by 44 point touch controls, readable text, controls close to the content they modify, and preserving image aspect ratios.
- [W3C's WCAG 2.2 overview](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) adds requirements around alternatives to dragging, target size, visible focus, and focus not being obscured by sticky interface elements.

### The inference for CMVNG

- Make the product chrome calmer, not more decorative.
- Put expression inside the authored output: type, characters, marks, collage, screenshots, diagrams, and evidence.
- Use handmade texture only when it communicates research, correction, source, movement, or personality.
- Use scale and shape to clarify priority.
- Keep controls physically close to the selected object.
- Preserve direct manipulation while offering single-tap alternatives for drag, resize, and reorder.
- Let AI recommend and assemble, but keep the creator visibly in control of the result.

## What still feels dated, repetitive, or product-led instead of creator-led

### 1. The interface is still “blue gradient SaaS”

The home launchpad, writer hero, buttons, badges, modal header, cards, shadows, glass blur, and selection states repeatedly use:

- dark-to-electric-blue gradients
- large rounded cards
- pill labels
- soft blue shadows
- tiny uppercase monospace metadata
- white cards inside more white or blue cards

Individually these choices are competent. Repeated across every level, they make the interface feel like a 2022–2024 startup dashboard instead of a 2026 creative studio.

The app should not compete visually with the designs being created. Use a mostly neutral interface canvas, one CMVNG blue action color, crisp rules, flatter surfaces, and fewer containers.

### 2. Microtext is being used as decoration

Current Signal Workshop CSS uses approximately:

- 7px proof labels
- 7.5px card descriptions
- 8px tabs, filters, actions, and help
- 10px search text

The result may look dense and “designed” in code, but it is not comfortably readable on a phone. The 29px favorite target is also below the 44-point mobile target recommended by Apple. WCAG 2.2 only sets a 24 CSS pixel AA minimum in many cases; a production creative tool should exceed that minimum for frequent mobile actions.

V7 minimums:

- text inputs: 16px on mobile to prevent browser zoom and improve entry
- primary body: 14px
- secondary metadata: 12px
- compact labels: 11px
- frequent touch controls: 44 by 44 CSS pixels
- low-frequency compact controls: never below 36px, with sufficient separation

### 3. The “108 complete designs” count is still structurally misleading

The current v5 catalog is built as:

- 30 special layouts
- 24 text structures wrapped as “Story” designs
- 26 character assets wrapped as “Feature” designs
- 28 doodles wrapped as “Poster” designs

The 78 asset-led entries are generated through:

- 6 repeated type scaffolds
- 5 repeated character scaffolds
- 7 repeated doodle scaffolds

So the current catalog has 108 starts, but not 108 independently art-directed complete compositions. The test named designKits: 108 derives that number by adding asset counts. Its duplicate check confirms only that character and doodle SVG strings differ; it does not test design topology.

Current comparableComposition also includes text, color, font, and SVG inner content, which can make two identical layout grammars appear different. A structural test must ignore those values.

Immediate copy correction:

- Replace “108 complete designs” with “108 creative starts.”
- Label the catalog types honestly:
  - Templates: full compositions
  - Recipes: asset-led starting arrangements
  - Elements: characters, doodles, frames, charts
  - Text: editable story hierarchies
  - Styles: color and surface variants

Long-term quality target:

- 48 to 60 genuinely authored flagship templates
- 60 to 80 useful recipes
- 138+ native assets
- unlimited style combinations

Fewer truthful flagship templates are more premium than a larger number created by category arithmetic.

### 4. Four themes are colorways, not design directions

Signal, night, paper, and acid are valuable style variants. They change color roles. They do not change:

- reading order
- content topology
- surface model
- evidence treatment
- image treatment
- type hierarchy
- signature gesture

Keep them, but call them colorways. Do not count them as additional designs.

### 5. Research-to-design and Signal Workshop are disconnected

The research-to-write flow scores the legacy T template registry using keyword rules such as comparison, timeline, metric, launch, and quote. It displays four old template previews and then prepares those legacy template values.

Signal Workshop uses the newer creative-pack catalog only after the user enters the Builder.

That means:

- research intelligence cannot recommend a Signal Workshop template
- the 108 starts are not participating in the core “research → write → design” promise
- users see one template system after writing and another template system in Builder
- search tags, story intent, content roles, and source requirements are duplicated rather than shared

This is the highest-priority product issue.

### 6. Legacy-template handoff is stable, but not fully editable

The current handoff captures a design background image, then places editable content layers over it. Foundation lock prevents scattering and reset is valuable. But the background remains a raster foundation.

The user-facing phrase “every important layer” is more honest than “every layer,” but the product still implies broader editability than it provides.

V7 must either:

- rebuild recommended templates from native text, svgraw, img, and logo layers, or
- explicitly mark the template foundation as locked artwork and offer “Convert to native” only where supported.

The flagship templates recommended after writing should be native from the beginning.

### 7. Asset characters are numerous, but the visual language is still repetitive

Most current human characters use:

- the same 120 by 140 bust frame
- centered head
- nearly identical shoulder silhouette
- repeated facial geometry
- a prop attached at the edge to imply a different role

The notes describe actions such as climbing, mapping, working at a terminal, celebrating, or debating, but the actual silhouette often remains a front-facing bust. This reads as “same person, different prop.”

V7 should prioritize fewer but genuinely different full-body or half-body actions, camera angles, body proportions, and emotional silhouettes.

### 8. The Builder has power, but the power is fragmented

The native on-canvas Builder already supports:

- drag
- resize
- rotate
- duplicate
- bring forward
- delete
- text editing
- font browsing
- color chips
- undo snapshots
- character and doodle cycling

The added Layers sheet separately exposes:

- text value
- type size and line height
- color
- width
- x and y
- object alignment
- nudge
- order
- duplicate and delete
- background
- layers
- autosave and restore

The result is two partial inspectors with different capabilities. A user has to know which controls live on-canvas, in the native text editor, in Layers, in Signal Workshop, or in the top toolbar.

The v7 Builder should have one object model and one contextual inspector that reveals all applicable controls for the selected layer.

### 9. Replace mode is destructive and too easy

Tapping a design card immediately applies it. Replace is the default, and the prior canvas is not presented as a recoverable snapshot before the action.

Required behavior:

- first tap opens a larger detail preview
- Apply opens a three-choice confirmation when the canvas is not empty:
  - Replace current design
  - Add compatible parts
  - Save a copy and replace
- replacing creates a named undo checkpoint
- confirmation shows current layer count, incoming layer count, and whether content will be retained

### 10. Overlay is not semantically safe

Current overlay removes a full-canvas svgraw layer based on coordinates and width. It can still append:

- signature text
- the CMVNG logo
- layout-specific labels
- decorative elements intended for a different hierarchy

Overlay compatibility must be authored in the manifest. A template that is not designed as an overlay should not expose overlay mode.

### 11. Asset placement is collision-prone

Standalone assets are shifted only by a small drift derived from current layer count modulo four. This is deterministic but not composition-aware. Multiple additions still accumulate in the same area.

Placement should use:

- selected-layer anchor when relevant
- least-occupied safe-area quadrant
- preferred anchor metadata from the asset
- z-role, such as behind-text, beside-claim, over-image, or corner-mark
- one-tap Move to empty corner alternatives

### 12. Important Builder controls are still incomplete or misleading

- The visible hex text field has no applied change handler.
- Bold toggles only between 400 and 800, destroying intermediate weights such as 500, 600, 650, and 700.
- Layer width scales text size as well as width, which prevents editing the text box independently of type size.
- Alignment controls align the object to canvas edges; they do not control text alignment.
- X and Y inputs prohibit negative values even though deliberate bleed is a valid poster technique.
- Background color starts from a hard-coded value rather than reflecting the current canvas.
- Clear canvas is a one-tap destructive action without confirmation.
- Layer list has no hide, lock, group, thumbnail, or drag-reorder control.
- There is no opacity, crop, mask, border, radius, shadow, flip, letter-spacing, case, or text alignment control in the unified sheet.
- Rotation exists on-canvas but not in the inspector.
- Native tone filters apply a CSS filter to the entire canvas and can distort brand colors and images after the newer semantic themes are applied.

## V7 art direction: Quiet Frame, Loud Work

Signal Workshop remains the right brand idea. The interface and output system need a clearer division of responsibility.

### Interface language

- Neutral warm-white or near-black surfaces
- One blue focus/action color
- Crisp one-pixel rules
- Fewer cards; more spatial grouping
- Minimal shadow
- Radius used by function, not everywhere
- Comfortable readable type
- Persistent object context
- Expressive motion only for mode changes, successful assembly, and direct manipulation

### Output language

- Bold hierarchy
- Tactile evidence marks
- Strong editorial tension
- Expressive characters
- Native data diagrams
- Internet-native objects
- CMVNG signature as a compositional element, not a repeated footer stamp

## Six real structural systems

These are art directions because each changes geometry, hierarchy, surface behavior, type logic, and ornament rules. The four existing colorways can be applied inside them without changing the design count.

### 1. Signal Minimal

Purpose:

- one thesis
- one metric
- one product truth
- one clear action

Structural grammar:

- 65 to 80 percent negative space
- one dominant text or number block
- one small proof module
- one blue route marker
- no more than one doodle
- strict baseline grid

Type:

- Sora display plus Space Mono source
- optional Instrument Serif for one human phrase only

Surface:

- flat canvas
- no shadow stack
- one fine rule or crop mark

Remove:

- gradients
- generic glass pills
- multiple rounded cards
- decorative blob backgrounds

### 2. Field Editorial

Purpose:

- deep dive
- thesis
- source-led story
- quote with context
- timeline interpretation

Structural grammar:

- column grid
- masthead or section folio
- margin note
- pull quote or footnote
- visible source index
- asymmetric editorial crop

Type:

- Instrument Serif for observation
- Sora for conclusion
- Space Mono for date, source, page, and confidence state

Surface:

- warm paper
- hairline rules
- controlled ink registration shift
- no fake newspaper filler

Signature:

- numbered evidence note or editorial correction

### 3. Proof Tactile

Purpose:

- fact check
- receipts
- investigation
- screenshot evidence
- product teardown

Structural grammar:

- two to four layered evidence objects
- one clear conclusion card
- tape, paperclip, stamp, underline, and arrow only where they explain relationships
- image crops remain replaceable
- source order is visible

Type:

- condensed or heavy headline
- mono annotations
- simple body deck

Surface:

- paper fibers, halftone, torn edge, marker
- texture must be vector or safely tiled and adjustable
- maximum two tactile treatments per template

Signature:

- the viewer can trace claim → proof → conclusion

### 4. Data Instrument

Purpose:

- metrics
- ranking
- comparison
- scorecard
- token distribution
- roadmap and system status

Structural grammar:

- chart or metric first
- unit, timeframe, source, and status always present
- fixed numeric alignment
- semantic positive, warning, danger, unknown states
- minimal decorative marks

Type:

- large tabular-style number treatment
- Space Mono metadata
- Sora explanatory sentence

Surface:

- grid, ledger, instrument panel, or plot
- never a fake dashboard full of meaningless micro-widgets

Signature:

- every number answers “what, when, and according to whom?”

### 5. Type Broadcast

Purpose:

- launch
- breaking update
- culture statement
- strong opinion
- announcement

Structural grammar:

- words are the image
- scale contrast of at least 4:1
- purposeful line breaks
- one interruption: strike, insert, vertical word, or oversized punctuation
- one compact detail strip

Type:

- Archivo Black or Sora display
- Instrument Serif as emotional countervoice
- Space Mono as broadcast ticker

Surface:

- flat ink, paper, or acid field
- no repeated rounded cards

Signature:

- readable at feed-thumbnail size before any supporting copy is visible

### 6. Native Internet

Purpose:

- reaction
- meme analysis
- chat or post remix
- terminal/product demo
- community recap

Structural grammar:

- recognisable internet object such as post, browser, terminal, chat, notification, cursor, or meme specimen
- one analytical annotation layer that adds new meaning
- one visible provenance or context field
- deliberate crop and scale

Type:

- platform-like utility text stays secondary
- CMVNG interpretation is the main hierarchy

Surface:

- UI fragments may be sharp and flat
- avoid copying a platform's full branded chrome
- never fabricate likes, timestamps, verification, or source details

Signature:

- the source artifact and CMVNG's interpretation are visually distinct.

## Structural direction versus colorway

A design counts as structurally distinct only if it changes at least three of:

1. semantic content topology
2. dominant reading axis
3. hierarchy and type-role graph
4. image or screenshot behavior
5. evidence/provenance behavior
6. focal object or character role
7. connective marks and relationship graph
8. format reflow strategy

The structural fingerprint must ignore:

- literal text
- font family name
- colors
- SVG path data of a swapped asset
- character identity
- doodle identity
- rotation smaller than a defined ornament threshold

If the fingerprint matches, it is one template with recipes or styles.

## One product flow, one design registry

### Manifest model

Legacy templates and Signal Workshop must be migrated into one registry with:

- id and human-readable name
- system: minimal, editorial, tactile, data, typographic, internet
- story intent: explain, prove, compare, announce, react, teach, map, rank
- required content roles
- optional content roles
- source/evidence requirements
- image requirements
- character slots
- editable element list
- per-format layout or reflow strategy
- colorway compatibility
- overlayCompatibility
- layer budget
- long-copy limits
- recommendation tags and exclusions
- actual preview renderer

### Research step

The research result should become a visible source tray, not an invisible prerequisite.

Show:

- project identity
- exact researched URL
- page or post title
- source type
- published/updated time when available
- extracted facts with source anchors
- gathered images
- missing facts and confidence

Actions:

- Add source
- Remove source
- Open source
- Mark fact as key
- Exclude fact
- Continue to angle

### Writing step

The writer should expose the content structure the design engine will use.

Each draft version should have editable roles such as:

- hook
- thesis
- proof points
- metric
- comparison sides
- timeline moments
- quote
- caveat
- source footer
- CTA

The raw draft remains available, but the structured roles feed template recommendations. This is more reliable than scoring one large string with regex alone.

### Design-recommendation step

After writing:

- Show three recommended flagship templates.
- Explain fit using actual content roles: “uses your 3 dated milestones,” not a generic 96 percent score.
- Show any missing content: “needs one product screenshot.”
- Render the user's exact content.
- Offer More like this and Change direction.
- Search the unified registry, including Signal Workshop.
- Do not show unexplained pseudo-precision such as 96 percent, 90 percent, and 84 percent unless the score is calibrated.

Recommended card:

- actual 4:5 or selected-format preview
- template name
- structural system
- why it fits
- required/available content
- native editability state
- layer count

### Builder handoff

For flagship templates:

- build native layers directly
- do not create a full-template screenshot foundation
- preserve semantic roles so the creator can switch compatible templates without losing writing
- create a checkpoint named after the draft and template
- carry source data into the export preflight

Legacy designs may retain locked foundations temporarily, but must be labelled Legacy locked artwork.

### Export step

Before export, run a compact preflight:

- text overflow
- off-canvas content
- missing or low-resolution image
- contrast
- missing source for evidence-led template
- duplicate brand mark
- transparent background status
- selected output dimensions

Offer:

- PNG 1x
- PNG 2x
- transparent PNG where compatible
- copy of the written caption
- save version

## Exact Builder information architecture

### Desktop

Top bar:

- Back
- project/template name
- format
- undo
- redo
- zoom
- preview
- export

Left rail:

- Templates
- Elements
- Text
- Uploads
- Brand

Elements opens subcategories:

- Characters
- Marks
- Data
- Frames
- Internet
- Shapes

Right inspector, 300 to 320px, collapsible:

- selected layer title and type
- context-specific controls
- Layers tab
- History tab

Canvas stays central and visually dominant. Side panels may float or collapse, following the useful principle in Figma UI3 that the work remains center stage.

### Mobile

Persistent bottom navigation:

- Add
- Templates
- Layers
- Undo
- Export

When an object is selected, a contextual bar appears directly above the bottom navigation:

- Edit
- Replace
- Duplicate
- Arrange
- More

The inspector is one bottom sheet with three snap heights:

- peek: contextual actions only
- half: common controls
- full: advanced controls and layer list

Do not stack a 94vh catalog, sticky gradient header, sticky search, filter row, theme row, mode row, and more filters inside the same scroll container. That is visually and cognitively dense.

## Signal Workshop discovery and navigation

### First decision: what are you making?

Use large intent choices:

- Prove it
- Explain it
- Compare it
- Announce it
- React to it
- Teach it
- Build from scratch

Intent filters are more useful to a non-designer than a count-led tab labelled 108 designs.

### Second decision: template or element

Primary tabs:

- Templates
- Elements
- Text
- Brand

Inside Elements:

- Characters
- Doodles
- Data
- Frames
- Internet

Favorites and Recent are saved views, not primary categories.

### Search and filters

Search indexes:

- name
- intent
- structural system
- story roles
- tags
- compatible format
- image requirement
- character mood

Useful filters:

- Recommended
- No image needed
- Uses screenshots
- Data-led
- Character-led
- Fast edit
- Native only
- format

### Preview

- Card preview must use the exact selected format, not a square approximation.
- Preview all layers or explicitly mark a simplified preview; the current slice at 18 layers can omit meaningful content.
- Tapping a card opens a larger preview and details.
- Only element cards use one-tap Add.
- Keep the catalog open after adding an element and show Undo plus View layer.
- Theme/colorway changes update the detail preview, not the whole catalog at once.

### Recommendations and related assets

Template details should suggest:

- two suitable characters
- three marks
- one alternate text hierarchy
- one alternate colorway

Related suggestions come from semantic compatibility, not random category overlap.

## Exact inspector changes

### Common controls

- X and Y with optional negative bleed
- width and height with aspect lock
- rotation
- opacity
- align to canvas
- align to selection
- fine nudge 1px
- normal nudge 8px
- duplicate
- hide
- lock
- delete with undo

### Text

- editable text area
- font family
- weight without destroying intermediate values
- size
- line height
- letter spacing
- text alignment
- case
- color
- text box width independent from font size
- auto-fit
- restore role default

### Vector and doodle

- semantic recolor slots
- stroke width where supported
- flip horizontal
- rotation
- replace with related mark
- send behind or bring forward

### Character

- expression/mood where authored
- skin-tone palette
- clothing/accent palette
- mirror only when props and text remain semantically valid
- replace pose within the same role
- explode to components only as an advanced action

### Image

- replace
- crop position
- fit/fill
- mask shape
- corner radius
- exposure/contrast only if export-safe
- original resolution indicator

### Layer list

- front-to-back display, matching visual stacking
- type icon or thumbnail
- rename
- drag reorder plus Move forward/back alternatives
- visibility
- lock
- group and ungroup
- search layers
- select all text/images/marks

### History

- visible undo and redo
- named checkpoints:
  - Research handoff
  - Template applied
  - Format changed
  - Before clear
  - Exported version
- recoverable clear canvas
- multiple project versions, not only one autosave slot

## Canvas behavior

- Use an infinite neutral workspace around a finite output frame.
- Provide Fit, 100 percent, Zoom in, and Zoom out.
- Support pinch zoom and two-finger pan on mobile without moving selected objects.
- Show safe-area guides and an optional grid.
- Show snap lines and distances.
- Preserve intentional bleed while clipping only at export.
- Keep resize and rotation handles visually outside the output frame but inside interactive reach.
- Give each handle a 44px invisible hit area.
- Offer inspector alternatives for every drag gesture.
- Keep selected content visible when an inspector or mobile keyboard opens.
- Separate text-box resizing from font scaling.
- Preserve aspect ratio for images and characters by default.
- Make format changes semantic for flagship templates; use geometric reflow only for edited or unsupported content.

## Character language: expressive and inclusive without becoming a costume catalog

### Current issue

The current characters communicate role mostly through props. The bodies, face construction, and camera angle repeat. Diversity is present in some skin colors and hair, but it is not systematised or user-selectable.

### V7 character families

Build each flagship character as a pose family:

- investigate
- explain
- build
- compare
- warn
- celebrate
- react
- guide
- present data
- collaborate

Each family should include:

- bust, half-body, and full-body options where appropriate
- front, three-quarter, and side views
- calm, curious, skeptical, focused, delighted, concerned moods
- multiple skin tones
- multiple hair textures and head shapes
- varied body proportions
- age variation
- glasses and non-glasses
- optional mobility aids, prosthetics, hearing aids, or assistive devices when naturally integrated into the action
- neutral clothing options plus one CMVNG accent

### Naming

Catalog by action and story function:

- Investigating a claim
- Presenting a chart
- Testing the product
- Explaining the trade-off

Do not catalog people as:

- the disabled character
- the Black character
- the woman analyst
- the old person

Identity is a configurable human characteristic, not the story function.

### Representation rules

- Avoid coding intelligence, risk, hype, or anonymity to a specific skin tone or gender.
- Avoid cultural clothing as decorative shorthand.
- Use reference and consultation for regionally specific designs.
- Do not mirror props containing writing, handed tools, or direction-specific interfaces without correction.
- Test silhouettes at 120px.
- Test expression without relying only on color.
- Keep all visible text outside the SVG as editable text.

### Mascot

Develop Signal Block as the ownable non-human CMVNG mascot:

- built from the existing three-bar brand geometry
- five expressions
- six poses
- can hold pointers, receipts, charts, and source cards
- works in empty states, tips, and culture templates

The mascot gives the system personality without requiring a human caricature in every design.

## What to remove

Remove or retire from the shipped production bundle:

- legacy KIT_THEMES, KIT_COMPOSITIONS, MEGA_KITS, buildMegaKit, and the unused old openCreativeKit modal
- old eight-character and eight-doodle duplicate libraries embedded in studio-enhancements.js
- the count-brag proof strip at the top of Signal Workshop
- “121 original designs” and “108 complete designs” until the catalog taxonomy is corrected
- 7 to 10px UI copy
- generic gradient header on every major surface
- repeated pills where tabs or segmented controls are clearer
- favorite targets smaller than 44px
- one-tap destructive Replace and Clear
- global CSS tone filters that alter the whole canvas
- automatic CMVNG footer/signature on every recipe
- blind modulo-based asset drift
- pseudo-precise template-fit percentages
- hidden-scrollbar chip rows without an affordance that more content exists

## What to keep and refine

- Research readiness gate and visible source status
- real-content template previews
- format-aware geometry module
- foundation lock and reset for legacy designs
- native svgraw/text/image layers
- actual catalog preview rendering
- favorites and recent assets
- clear layer-budget warnings
- autosave
- on-canvas drag, resize, rotate, duplicate, and delete
- mobile-oriented bottom sheets
- official CMVNG identity
- Signal Workshop as the creative-system name

## Implementation priorities

### P0: product truth and no-data-loss foundation

1. Unify legacy templates and Signal Workshop behind one manifest registry.
2. Make research-to-design recommendations query that registry.
3. Build flagship recommendations as native layers.
4. Relabel 108 entries as starts, separated into Templates, Recipes, Elements, and Text.
5. Add replace confirmation and recoverable checkpoint.
6. Remove one-tap clear or add confirm plus undo.
7. Remove dead legacy creative-engine code from production.
8. Increase mobile type and touch-target sizes.

P0 acceptance:

- A researched draft can recommend and open a Signal Workshop flagship template.
- Every flagship output word is a text layer.
- Replacing and clearing can be undone exactly.
- Catalog counts match the actual taxonomy.
- No frequent mobile control is below 44px.

### P1: one coherent Builder

1. Consolidate native on-canvas controls and Layers into one contextual inspector.
2. Add text alignment, tracking, font family, complete weights, independent box width, rotation, opacity, visibility, lock, and group.
3. Replace modulo drift with smart placement.
4. Add format-specific actual previews and detail view.
5. Add authored overlay compatibility.
6. Add semantic template roles and preserve content when switching compatible templates.
7. Add source-aware export preflight.

P1 acceptance:

- A user can discover every selected-layer control from one place.
- Text width can change without changing font size.
- Asset add does not cover the selected headline in standard fixtures.
- Overlay never duplicates a background or signature.
- Compatible template switch preserves hook, proof, source, and CTA roles.

### P2: premium expression

1. Re-art-direct flagship templates into the six structural systems.
2. Replace repetitive bust-plus-prop characters with pose families.
3. Add Signal Block mascot.
4. Add texture controls and semantic recoloring.
5. Add named versions and project history.
6. Add AI-assisted “make this more editorial/minimal/tactile” controls that operate on semantic roles and always expose a before/after preview.

P2 acceptance:

- Every flagship template passes the structural fingerprint test.
- Character silhouettes remain distinguishable without props.
- Style changes do not change catalog count.
- AI-assisted changes are reversible and preserve user text and sources.

## Prioritized full-flow UX and QA checklist

### P0 research and writing

- [ ] Fresh session starts with a clear project entry point.
- [ ] Pasting a full X status URL researches the exact post.
- [ ] Pasting a normal article URL shows title, source, extracted facts, and available images.
- [ ] A title-only page does not unlock unsupported writing.
- [ ] A failed source clearly explains retry, paste details, or add another source.
- [ ] Multiple sources can be inspected and removed.
- [ ] Selected facts are visibly carried into the draft.
- [ ] Generated drafts keep source-backed facts separate from opinion.
- [ ] Version switching preserves the selected design recommendation state.
- [ ] Loading, error, ready, empty, and partial-evidence states are visually distinct.

### P0 design recommendation

- [ ] Metric-heavy draft recommends a Data Instrument template.
- [ ] Comparison draft recommends a true comparison topology.
- [ ] Timeline draft recommends a milestone/timeline topology.
- [ ] Quote/opinion draft recommends Field Editorial or Type Broadcast as appropriate.
- [ ] Screenshot-led draft recommends a replaceable-image template.
- [ ] Recommendation explanation references actual content roles.
- [ ] Missing required content is shown before apply.
- [ ] Signal Workshop templates appear in the recommendation flow.
- [ ] Preview uses the user's real content and selected format.
- [ ] No false percentage-fit precision is shown.

### P0 Builder safety

- [ ] Applying a template to a non-empty canvas asks Replace, Overlay when supported, Save copy, or Cancel.
- [ ] Replace creates an exact undo checkpoint.
- [ ] Clear creates an exact undo checkpoint.
- [ ] Autosave does not overwrite the only recoverable pre-replace state.
- [ ] No design exceeds the 48-layer budget without a clear resolution path.
- [ ] No native import silently slices authored layers.
- [ ] Foundation templates are labelled locked artwork.
- [ ] Flagship templates contain no flattened full-design image.
- [ ] Repeated logo/signature insertion is prevented.

### P1 Builder editing

- [ ] Text edit updates live and can be cancelled.
- [ ] Hex input actually applies.
- [ ] All supported weights remain selectable.
- [ ] Text box width and font size are independent.
- [ ] Text alignment and object alignment are clearly different.
- [ ] Rotation works through handle and numeric input.
- [ ] Opacity, flip, lock, hide, duplicate, and delete work.
- [ ] Layer reorder works by drag and by buttons.
- [ ] Group/ungroup preserves relative geometry.
- [ ] Selected layer remains visible while editing.
- [ ] Keyboard shortcuts do not fire while typing.
- [ ] Undo and redo cover property changes, asset adds, template apply, and format change.

### P1 canvas and format

- [ ] Square, post, story, and wide have authored flagship reflows.
- [ ] Modified designs preserve edits through format change.
- [ ] Text overflow is detected after format change.
- [ ] Images preserve aspect ratio.
- [ ] Intentional bleed remains possible.
- [ ] Safe-area guides match export.
- [ ] Snap guides appear and do not trap movement.
- [ ] Fit-to-screen works at phone, tablet, and desktop widths.
- [ ] Pinch zoom does not move the selected object.
- [ ] On-canvas toolbar and handles never render outside reachable viewport.

### P1 mobile

- [ ] Test 320, 360, 390, 430, and 768 CSS pixel widths.
- [ ] Test 640, 667, 740, 844, and 932 CSS pixel heights.
- [ ] All frequent controls meet 44px targets.
- [ ] Search input is at least 16px.
- [ ] No required UI copy is below 11px.
- [ ] The software keyboard does not cover selected text or Done.
- [ ] Bottom sheet has stable peek, half, and full states.
- [ ] Sticky bars do not obscure focused controls.
- [ ] Horizontal categories have a visible continuation cue.
- [ ] Back gesture and close preserve unsaved work.
- [ ] Screen-reader focus enters and exits dialogs predictably.

### P1 accessibility

- [ ] Dialogs have role, accessible name, aria-modal, focus trap, Escape close, and focus return.
- [ ] Visible focus is never hidden behind sticky UI.
- [ ] Drag operations have single-pointer/button alternatives.
- [ ] Color is not the only signal for verified, warning, or selected.
- [ ] Text and non-text contrast pass WCAG 2.2 AA.
- [ ] Decorative SVGs are hidden from assistive technology.
- [ ] Reduced-motion preference is respected.
- [ ] Character selection and skin-tone controls have neutral, respectful labels.

### P1 export

- [ ] Exported PNG matches the canvas at 1x and 2x.
- [ ] Fonts finish loading before capture.
- [ ] Transparent export remains transparent.
- [ ] No selection handles, guides, or UI chrome appear.
- [ ] Logo has correct aspect ratio and safe area.
- [ ] Low-resolution images are warned before export.
- [ ] Source-led designs warn when provenance is missing.
- [ ] Filename includes project, format, and version.
- [ ] Export failure leaves the design intact.

### P2 creative QA

- [ ] Every flagship template has one dominant signal at 120px.
- [ ] Each system follows its own structural grammar.
- [ ] No template differs from another only by color, font, asset, or copy.
- [ ] Tactile marks communicate evidence or emphasis.
- [ ] Data templates always show unit, timeframe, and source.
- [ ] Internet-native templates distinguish source from commentary.
- [ ] Character silhouette communicates action before the prop is visible.
- [ ] Human representation is balanced across the whole library.
- [ ] Long project names and 18/40/80/140-character text fixtures pass.
- [ ] Empty image, one image, and maximum image states pass.
- [ ] Structural-fingerprint report is reviewed before the public count changes.

## Definition of a 10/10 result

A creator pastes a project link, sees exactly what was sourced, writes a strong draft, receives three visibly different and justified CMVNG design directions, chooses one, and enters a Builder where the composition is native, stable, readable, mobile-friendly, and deeply editable. They can add a character or mark without covering the design, switch format without repairing the layout, undo any destructive choice, and export a result that feels authored rather than generated from a palette multiplier.

That is the standard v7 should be judged against.
