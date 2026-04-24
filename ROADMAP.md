# Ameri-CAD Roadmap

**Goal:** Fusion 360-class parametric CAD that runs locally, stays free, and keeps
the user's design data under their control.

## Non-Negotiables

- One canonical document graph. No parallel app/document/command state.
- OpenCASCADE B-Rep is the modeling source of truth.
- `.americad` files preserve feature history, sketches, parameters, and metadata.
- The app works offline and does not require an account.
- Every promoted feature has a Playwright or browser-harness regression test.
- Design QA covers desktop and narrow viewports before commit.

## Phase 0: Stabilize The Existing App

- [x] Stop silent boot fallback when command palette wiring breaks.
- [x] Add boot/design QA coverage for runtime errors and mobile overflow.
- [ ] Expose and test the public command surface for scripting and docs.
- [ ] Make status, command line, and feature tree report real document state.
- [ ] Remove fake inspector data when nothing is selected.

## Phase 1: One Document Spine

- [ ] Choose `DocumentModel` as the only CAD state owner.
- [ ] Move primitive creation through typed feature creation.
- [ ] Make commands return document mutations, not ad hoc scene mutations.
- [ ] Make the feature tree render document features only.
- [ ] Save/load the exact same graph used by the evaluator.

## Phase 2: Golden CAD Workflow

- [ ] New document starts empty and ready.
- [ ] Create sketch on XY/XZ/YZ/custom construction plane.
- [ ] Draw line, rectangle, circle, arc.
- [ ] Add coincident, horizontal, vertical, distance, radius constraints.
- [ ] Detect closed profiles.
- [ ] Extrude a profile into a B-Rep body.
- [ ] Edit sketch dimensions and regenerate the body.
- [ ] Reopen saved file with the same editable timeline.

## Phase 3: Core Modeling

- [ ] Kernel-native box, cylinder, sphere, cone, torus.
- [ ] Extrude, revolve, sweep, loft.
- [ ] Boolean union, subtract, intersect.
- [ ] Fillet, chamfer, shell, draft.
- [ ] Hole wizard with counterbore, countersink, tapped holes.
- [ ] Linear, circular, mirror, and path patterns.
- [ ] Mass properties and interference checks.

## Phase 4: Product-Grade UX

- [ ] Replace symbolic clutter with clear tool groups and compact labels.
- [ ] Inspector only shows real selected feature/body data.
- [ ] Timeline supports edit, suppress, reorder, roll back.
- [ ] Command palette lists all commands with searchable aliases.
- [ ] Keyboard shortcuts are editable and visible in tooltips.
- [ ] Design QA screenshot script captures desktop and mobile states.

## Phase 5: Local Professional CAD

- [ ] Assembly documents with components and joints.
- [ ] Drawing workspace with projected 2D views and dimensions.
- [ ] STEP, STL, and native export/import confidence tests.
- [ ] Plugin/scripting API for local automation.
- [ ] Optional collaboration/versioning without cloud lock-in.

## Current Definition Of "Real"

A feature is real only when it:

1. Creates or edits typed document graph data.
2. Rebuilds through the evaluator.
3. Renders in the viewport from evaluated geometry.
4. Survives save/load.
5. Has focused regression coverage.
