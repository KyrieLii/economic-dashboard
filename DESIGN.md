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
    fontSize: "20px"
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
    fontSize: "28px"
    fontWeight: 500
    letterSpacing: "-0.04em"
  card-value:
    fontFamily: "'JetBrains Mono Variable', monospace"
    fontSize: "21px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  drawer-value:
    fontFamily: "'JetBrains Mono Variable', monospace"
    fontSize: "32px"
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
    height: "30px"
    width: "250px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  period-active:
    backgroundColor: "{colors.period-selected}"
    textColor: "{colors.accent}"
    rounded: "{rounded.compact-control}"
    padding: "5px 9px"
  market-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "12px"
  market-card-hover:
    backgroundColor: "#141e25"
  group-disclosure:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    padding: "4px"
  detail-drawer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    width: "min(600px, 100vw)"
    height: "100dvh"
    padding: "0"
  drawer-content:
    padding: "20px"
  refresh-icon:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.compact-control}"
    width: "32px"
    height: "32px"
  source-tooltip:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "12px 14px"
    width: "min(320px, calc(100vw - 24px))"
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

Lime (`accent`) identifies primary actions, card hover/focus borders, favorites, selected periods, and the history curve. It also supplies keyboard focus indication.

### Secondary

Rose (`up`) and mint (`down`) encode signed changes in the default Chinese market convention. The user can swap their roles. Amber (`warning`) denotes collection errors or older observations.

### Neutral

Charcoal (`bg`) surrounds dark slate panels (`surface`). Raised controls use `raised`; thin dividers use `rule`. Main text uses `ink`, while dates, source notes, and secondary labels use `muted`. Cards retain the panel material; hover and focus add a slightly lighter slate fill.

**The Signed Change Rule.** Pair rise/fall color with a sign and unit; color alone never carries the meaning.

## Typography

Inter Variable is bundled locally for Latin interface text; Chinese follows the declared system fallback stack. JetBrains Mono Variable is bundled locally for measured values, dates, codes, and chart axes. Numeric roles use tabular figures.

The frontmatter retains the incumbent type hierarchy and adds card-value and drawer-value roles. There is no decorative display face. Card names are 12px at weight 500; card values are 21px, reducing to 18px at 1400px and returning to 20px at 950px and below. Units and card dates are 10px; group names are 13px with 11px counts. The selected metric title is 16px at weight 550. Drawer values are 32px on desktop and 28px on phones; mobile headlines are 18px.

**The Measurement Rule.** Use the mono face for quantities and identifiers; retain the sans-serif stack for descriptive labels. Chart axes and tooltip text stay at 12px; compact card dates and units use 10px without replacing visible values, units, or status text.

## Layout

The current observation board is centered at a maximum width of 1800px with 20px desktop horizontal padding and 16px top padding. A 52px header precedes a compact title/search/favorites toolbar. Six named groups contain 25 primary cards and nine secondary cards available through group disclosures: A 股 (7 primary, 5 secondary), 美股 / 美元 (4, 1), 港股 (3), 黄金 / 布油 (2, 3), 加密货币 (2), and 利率 / 美债 (7). A-share turnover is an independent card beside the index cards.

The desktop outer grid has 14 equal columns with 18px gaps. A-share spans the first row; US/dollar and Hong Kong span eight and six columns on the next row; commodities and crypto each span seven columns on the third; rates/Treasuries span the fourth row. Inner grids use seven cards for A-share and rates, four for US/dollar, three for Hong Kong, and two each for commodities and crypto, with 8px gaps. The overview has no duplicate benchmark strip or permanent detail column.

At 1400px and below, A-share and rates wrap to four cards per row; card padding becomes 10px and the internal gap 6px. At 950px and below, the outer grid becomes two columns: A-share, US/dollar, Hong Kong and rates span the full width; commodities and crypto remain side by side, with rates on the fifth row. At 600px and below all groups stack, every inner grid uses two columns, group gaps become 16px, page horizontal/top padding becomes 12px, and the toolbar wraps with full-width controls. Mobile cards use 10px padding and 8px internal gaps. Search or favorites filtering gives matching groups full width and uses auto-filled cards with a 185px minimum; phones retain two columns. Search and favorites include secondary metrics without requiring disclosure first.

Selecting a card opens a right-edge native modal drawer, at most 600px wide and the full dynamic viewport height. At phone widths it fills the viewport. Its toolbar remains outside the independently scrolling content; content padding is 20px on desktop and 14px on phones. The modal locks background scrolling and preserves the board beneath the dimmed backdrop. Close, Escape, or a backdrop click dismisses it and returns focus to the invoking card. Common spacing anchors remain in the frontmatter; contextual dimensions supplement that scale.

## Elevation & Depth

Tooltips use a downward soft shadow to separate on-demand notes from the data underneath. Card depth is conveyed by surface tones, thin borders, hover/focus fills, and whitespace. The modal drawer uses a half-opacity black backdrop and a left divider, without a decorative shadow. The chart's lime fill fades from 14% opacity to transparent; it supports the actual curve without becoming a decorative backdrop.

**The Ruled Surface Rule.** Separate data regions with the existing tonal layers and thin rules before adding elevation.

## Shapes

Panels have restrained rounded corners; controls use smaller radii from the frontmatter. Dividers are one pixel. Card hover/focus uses the lime border; the full-height drawer has square viewport edges and a one-pixel left rule. Icons are small stroked SVGs; favorite stars fill only when selected. The rounded status dot is a compact status marker, not a substitute for its text.

## Components

### Buttons

Default actions use raised slate, the primary action uses lime with dark text, and ghost actions have transparent backgrounds. Buttons use the same compact radius and padding, with background/color transitions lasting 150ms. Hover changes the surface color; keyboard focus uses a two-pixel lime outline with four-pixel offset. Disabled buttons show reduced opacity and a wait cursor. Refresh is an icon-only 32px control (36px on phones) with an accessible name. Card information/favorite actions are independent of the open-detail button, at 22×24px on desktop and 26×28px on phones. The information trigger appears on card hover/focus and remains visible on phones.

### Inputs / Fields

Search is a dark inset field with a thin rule border and compact radius. Focus changes its enclosing border to lime. Desktop shows a keyboard shortcut hint; mobile omits it. Native date inputs use the same inset material with a smaller radius. The chart's native range input enables keyboard and touch selection of dated observations.

### Navigation

The board is navigated through six persistent group headings, global search, and the favorites filter. Each group with secondary series has an “其他” disclosure with a count and expanded state; its chevron rotates when expanded. On phones the disclosure has a 32px minimum height. Period buttons inside the drawer remain compact mono labels with a translucent lime active fill.

### Cards / Containers

Each compact card has its own panel surface, one-pixel rule border and 10px radius, with no resting shadow. Its main button presents the name, value and unit, signed change beside a 64×20px sparkline, then observation date and exceptional status. Hover or focus-within turns the border lime and lightens the surface over 120ms. Collection errors use an amber border and explicit text. Favorite and source controls sit at the top right without being nested inside the detail-opening button.

### Detail drawer and source tooltips

The drawer is a native modal dialog, named by its group/history toolbar and initially focused on the 36px close control. It reveals over 160ms with opacity and a clipped right-edge reveal. Tooltip Escape dismisses the tooltip before the dialog. Source notes open on hover, keyboard focus or touch; they render outside card clipping and inside the dialog's top layer when applicable, with viewport-bounded positioning and scrolling. Escape, outside tap, resize or scroll dismisses them. The adjacent external-link action in detail opens the original source.

### History and provenance

The selected metric's name precedes its category and code. Its value, unit, previous-observation date, chart, range statistics, source link, and observation date form one continuous detail view. SVG axes stay at 12px by sizing the viewBox to the measured container width. A dated readout accompanies pointer and range-input inspection. Empty and failed states preserve explicit text and retry actions where available; absent values remain dashes.

Reduced-motion preference disables transitions and the refresh spin. Data changes do not use decorative entrance animation.

## Do's and Don'ts

### Do:
- **Do** align quantities and use explicit units, dates, and signed changes.
- **Do** use lime consistently for selection, primary action, and chart emphasis.
- **Do** preserve visible focus, modal dismissal and focus return to the invoking card.
- **Do** show missing observations and source failures explicitly.

### Don't:
- **Don't** imply rise or fall through color alone.
- **Don't** substitute invented chart points for absent observations.
- **Don't** add decorative imagery or hero typography to the data workspace.
- **Don't** hide latest values, units, dates or changes to make mobile cards fit.
