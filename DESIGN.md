---
name: Economic Dashboard
description: A dark, measured observation desk for economic data.
colors:
  bg: "#0b1016"
  surface: "#111821"
  raised: "#17212c"
  rule: "#27323f"
  ink: "#e5edf5"
  muted: "#9aaabd"
  accent: "#b9ed80"
  up: "#ff8d9c"
  down: "#70d7b0"
  warning: "#f4c278"
  primary-ink: "#18270c"
  primary-hover: "#ccf6a0"
  button-hover: "#23303e"
  row-selected: "#1b2927"
  benchmark-selected: "#18221d"
  period-selected: "#b9ed801a"
typography:
  headline:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "26px"
    fontWeight: 600
    letterSpacing: "-0.035em"
  title:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "16px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "14px"
  label:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "12px"
  metric:
    fontFamily: "'JetBrains Mono Variable', monospace"
    fontSize: "35px"
    fontWeight: 500
    letterSpacing: "-0.04em"
  numeric:
    fontFamily: "'JetBrains Mono Variable', monospace"
    fontSize: "14px"
    letterSpacing: "-0.03em"
  axis:
    fontFamily: "'JetBrains Mono Variable', monospace"
    fontSize: "12px"
rounded:
  date-field: "4px"
  compact-control: "5px"
  search: "6px"
  button: "7px"
  notice: "8px"
  panel: "10px"
spacing:
  micro: "4px"
  compact: "8px"
  control: "12px"
  section: "20px"
  panel: "24px"
  page: "36px"
components:
  button:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "9px 13px"
  button-hover:
    backgroundColor: "{colors.button-hover}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.button}"
    padding: "9px 13px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "9px 13px"
  search:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.search}"
    padding: "0 9px"
    height: "34px"
    width: "235px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  period-active:
    backgroundColor: "{colors.period-selected}"
    textColor: "{colors.accent}"
    rounded: "{rounded.compact-control}"
    padding: "5px 9px"
  metric-selected:
    backgroundColor: "{colors.row-selected}"
    textColor: "{colors.accent}"
---

# Design System: Economic Dashboard

## Overview

**Creative North Star: "Scientific figure plates"**

A dark observation desk with calibrated charts, aligned measurements, and quiet dividing rules. Its modern, technical character comes from precise numeric typography and readable evidence, rather than decoration.

Chinese interface labels use the system CJK fallback beside locally bundled Latin fonts. Dates, units, sources, and missing-data states remain part of the visual hierarchy.

**Key Characteristics:**
- Charcoal surfaces with restrained lime selection and action accents.
- Monospaced measurements paired with compact sans-serif labels.
- Flat, ruled panels and responsive detail views.

## Colors

### Primary

Lime (`accent`) identifies the primary action, selected categories, favorites, and the history curve. It also supplies keyboard focus indication.

### Secondary

Rose (`up`) and mint (`down`) encode signed changes in the default Chinese market convention. The user can swap their roles. Amber (`warning`) denotes collection errors or older observations.

### Neutral

Charcoal (`bg`) surrounds dark slate panels (`surface`). Raised controls use `raised`; thin dividers use `rule`. Main text uses `ink`, while dates, source notes, and secondary labels use `muted`. Selected rows and benchmarks have distinct subdued green backgrounds.

**The Signed Change Rule.** Pair rise/fall color with a sign and unit; color alone never carries the meaning.

## Typography

Inter Variable is bundled locally for Latin interface text; Chinese follows the declared system fallback stack. JetBrains Mono Variable is bundled locally for measured values, dates, codes, and chart axes. Numeric roles use tabular figures.

The headline, title, body, label, metric, numeric, and axis roles in the frontmatter are the reusable hierarchy. There is no decorative display face. The selected metric title is an intermediate size (20px, weight 550); benchmark values use 25px at ordinary desktop widths. Mobile reduces the headline to 22px, selected metric title to 18px, and primary metric to 32px. Benchmark values range from 20px to 29px across the implemented breakpoints.

**The Measurement Rule.** Use the mono face for quantities and identifiers; retain the sans-serif stack for descriptive labels. Auxiliary text and chart axes stay at least 12px in the implemented layouts.

## Layout

The page is centered with a maximum width of 1760px and desktop horizontal padding of 36px. Five benchmark cells share a ruled strip. The workspace uses a table/detail grid of `minmax(0, 1.4fr) minmax(360px, 1fr)`, tightening at 1250px. Panels share edges instead of floating independently.

At 950px and below the workspace becomes one column. At 600px and below the detail moves above the table, page padding becomes 14px, and benchmarks become horizontally scrollable 150px cells with scroll snapping. Selecting a metric scrolls and focuses the detail; reduced-motion users receive immediate scrolling. The table retains value and change, moves the date beneath the metric code, and removes sparkline and standalone date columns. Horizontal overflow is contained within table and category regions.

Table rows are normally 58px high, with a bounded scroll region and sticky headings. Common spacing anchors are recorded in the frontmatter; the implementation also uses contextual intermediate values, not a strict universal spacing multiplier.

## Elevation & Depth

There are no box shadows. Depth is conveyed by surface tones, thin borders, selection fills, and whitespace. The chart's lime fill fades from 14% opacity to transparent; it supports the actual curve without becoming a decorative backdrop.

**The Ruled Surface Rule.** Separate data regions with the existing tonal layers and thin rules before adding elevation.

## Shapes

Panels have restrained rounded corners; controls use smaller radii from the frontmatter. Dividers are one pixel. Active category and benchmark indicators are two pixels. Icons are small stroked SVGs; favorite stars fill only when selected. The rounded status dot is a compact status marker, not a substitute for its text.

## Components

### Buttons

Default actions use raised slate, the primary action uses lime with dark text, and ghost actions have transparent backgrounds. Buttons use the same compact radius and padding, with background/color transitions lasting 150ms. Hover changes the surface color; keyboard focus uses a two-pixel lime outline with four-pixel offset. Disabled buttons show reduced opacity and a wait cursor.

### Inputs / Fields

Search is a dark inset field with a thin rule border and compact radius. Focus changes its enclosing border to lime. Desktop shows a keyboard shortcut hint; mobile omits it. Native date inputs use the same inset material with a smaller radius. The chart's native range input enables keyboard and touch selection of dated observations.

### Navigation

Category buttons form a horizontally scrollable text row. Active items use lime text and an underline. Period buttons are compact mono labels; the active period has a translucent lime fill. Their pressed states are exposed semantically.

### Cards / Containers

The benchmark strip and main workspace use the panel surface, outer rule, and restrained radius. A selected benchmark gains a green fill and bottom lime indicator. The data table marks the current metric with a green row fill and lime name; the favorite control remains an independent action.

### History and provenance

The selected metric's name precedes its category and code. Its value, unit, previous-observation date, chart, range statistics, source link, and observation date form one continuous detail view. SVG axes stay at 12px by sizing the viewBox to the measured container width. A dated readout accompanies pointer and range-input inspection. Empty and failed states preserve explicit text and retry actions where available; absent values remain dashes.

Reduced-motion preference disables transitions and the refresh spin. Data changes do not use decorative entrance animation.

## Do's and Don'ts

### Do:
- **Do** align quantities and use explicit units, dates, and signed changes.
- **Do** use lime consistently for selection, primary action, and chart emphasis.
- **Do** preserve visible focus and the mobile selection-to-detail behavior.
- **Do** show missing observations and source failures explicitly.

### Don't:
- **Don't** imply rise or fall through color alone.
- **Don't** substitute invented chart points for absent observations.
- **Don't** add decorative imagery or hero typography to the data workspace.
- **Don't** hide latest values or changes to make the mobile table fit.
