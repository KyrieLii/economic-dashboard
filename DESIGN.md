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
    width: "190px"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "12px"
  market-card-hover:
    backgroundColor: "#141e25"
  group-add:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    padding: "4px"
  settings-popover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "14px"
    width: "min(360px, calc(100vw - 24px))"
  settings-search:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.search}"
    padding: "0 9px"
    width: "100%"
    height: "36px"
  board-editbar:
    textColor: "{colors.ink}"
    padding: "10px 0"
  metric-picker:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    width: "min(520px, calc(100vw - 24px))"
    padding: "0"
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

The interface supports Chinese and English. Chinese labels use the system CJK fallback beside locally bundled Latin fonts; switching language preserves the same visual hierarchy. Units and exceptional states remain visible on cards; observation dates and source notes are available in tooltips and detail views.

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

The frontmatter retains the incumbent type hierarchy and adds card-value and drawer-value roles. There is no decorative display face. Card names are 12px at weight 500; card values are 21px, reducing to 18px at 1400px and returning to 20px at 950px and below. Card units and exceptional status labels are 10px; group names are 13px with 11px counts. The selected metric title is 16px at weight 550. Drawer values are 32px on desktop and 28px on phones; mobile headlines are 18px.

**The Measurement Rule.** Use the mono face for quantities and identifiers; retain the sans-serif stack for descriptive labels. Chart axes and tooltip text stay at 12px; compact card units and exceptional status labels use 10px. Observation dates appear in source tooltips and detail views.

## Layout

The current observation board is centered at a maximum width of 1800px with 20px desktop horizontal padding and 16px top padding. A 52px header carries Settings, Languages and Refresh icons in that order, with 6px gaps; all three are 32px square on desktop and 34px on phones. The header date, “市场全景” title/count, bottom historical-record count and daily/latest-collection summary are absent. An active filter summary appears above the groups only while filtering. Detailed data status remains available from settings. A quiet update watermark sits at the viewport bottom right (16px right, 10px bottom), using 11px mono text at 0.65 opacity; it indicates collection time in Beijing time, while each metric's observation date remains in its tooltip. Main content reserves 40px bottom padding.

Six named groups start with 25 cards: A 股 (7), 美股 / 美元 (4), 港股 (3), 黄金 / 布油 (2), 加密货币 (2), and 利率 / 美债 (7). Users can customize these groups from 34 built-in metrics plus registered assets through the add-card picker. The board and its groups use wrapping flex layouts with left alignment. Cards have a shared fixed width, adjustable from 160–300px in 10px steps, default 190px; they do not stretch to consume spare row space. Cards clamp to their available container width. A group's preferred width is its card count times the selected width, plus 8px between cards; groups shrink to the viewport and wrap cards as needed. Groups have 18px horizontal separation and 20px bottom spacing. Explicit row starts insert full-width breaks; defaults begin rows at A 股, 美股 / 美元, 黄金 / 布油 and 利率 / 美债. Group order and row starts are editable. A-share turnover remains an independent card beside the index cards.

Wrapping depends on the selected card width and available space, including while filtering; there is no forced two-column phone layout or fractional-width desktop grid. At 1400px and below card padding becomes 10px with 6px internal gaps; at 600px and below page horizontal/top padding is 12px and card internal gaps are 8px. Board search and favorites filter only cards in the saved layout. The add-card picker searches built-in and registered metrics locally, and names/codes of A-shares, Hong Kong stocks, US stocks and crypto remotely. Editing clears and disables board filters so every draft card and empty group stays reachable.

Selecting a card opens a right-edge native modal drawer, at most 600px wide and the full dynamic viewport height. At phone widths it fills the viewport. Its toolbar remains outside the independently scrolling content; content padding is 20px on desktop and 14px on phones. The modal locks background scrolling and preserves the board beneath the dimmed backdrop. Close, Escape, or a backdrop click dismisses it and returns focus to the invoking card. Common spacing anchors remain in the frontmatter; contextual dimensions supplement that scale.

## Elevation & Depth

Tooltips use a downward soft shadow to separate on-demand notes from the data underneath. The settings popover uses `0 12px 32px #0006` to separate its temporary control surface. Resting card depth is conveyed by surface tones, thin borders, hover/focus fills, and whitespace. During pointer sorting, the complete dragged card or group becomes a fixed overlay at 0.96 opacity with `0 16px 36px #0008` shadow; its live placeholder uses 0.2 opacity and a one-pixel dashed lime outline. The modal drawer uses a half-opacity black backdrop and a left divider, without a decorative shadow. The chart's lime fill fades from 14% opacity to transparent; it supports the actual curve without becoming a decorative backdrop.

**The Ruled Surface Rule.** Separate data regions with the existing tonal layers and thin rules before adding elevation.

## Shapes

Panels have restrained rounded corners; controls use smaller radii from the frontmatter. Dividers are one pixel. Card hover/focus uses the lime border; the full-height drawer has square viewport edges and a one-pixel left rule. Icons are small stroked SVGs; favorite stars fill only when selected. The rounded status dot is a compact status marker, not a substitute for its text.

## Components

### Buttons

Default actions use raised slate, the primary action uses lime with dark text, and ghost actions have transparent backgrounds. Buttons use the same compact radius and padding, with background/color transitions lasting 150ms. Hover changes the surface color; keyboard focus uses a two-pixel lime outline with four-pixel offset. Disabled buttons show reduced opacity and a wait cursor. Settings, Languages and Refresh are icon-only 32px controls (34px on phones), separated by 6px, each with an accessible name. Card information/favorite actions are independent of the open-detail button, at 22×24px on desktop and 26×28px on phones. The information trigger appears on card hover/focus and remains visible on phones.

### Inputs / Fields

Search is a dark inset field with a thin rule border and compact radius. Focus changes its enclosing border to lime. Settings search spans the popover at 36px high; the picker retains its 30px search height. Desktop shows a keyboard shortcut hint; mobile omits it. Native date inputs use the same inset material with a smaller radius. The chart's native range input enables keyboard and touch selection of dated observations.

### Navigation

The board is navigated through six named groups, with configured-card search and the favorites filter inside settings. Nonempty groups remain visible in normal browsing; editing exposes all six groups with their draft counts and an “添加” action. On phones this group action has a 32px minimum height. Period buttons inside the drawer remain compact mono labels with a translucent lime active fill.

### Cards / Containers

Each compact card has its own panel surface, one-pixel rule border and 10px radius, with no resting shadow. Its main button presents the name, value and unit, signed change beside a 64×20px sparkline, followed by exceptional status only when data is missing, delayed, or failed. Observation dates live in the information tooltip and remain visible in detail; cards have no persistent date row. Hover or focus-within turns the border lime and lightens the surface over 120ms. Collection errors use an amber border and explicit text. Favorite and source controls sit at the top right without being nested inside the detail-opening button. Card names reserve 44px of right padding on desktop and 54px on phones for these actions; long Chinese or English names wrap anywhere rather than overlap the controls.

### Settings popover

The named gear button sits left of the independent Languages button, followed by Refresh; these three controls share the same 32px desktop / 34px phone size. It is lime when settings are open or filtering is active. A native auto popover holds search, “仅显示关注”, “新增”, “编辑布局”, the rise/fall color convention, a card-width slider, and “数据状态”. The slider shows the current pixel width in mono and uses the existing lime accent, with a 160–300px range and 10px steps. The popover uses the existing panel surface, one-pixel rule and 10px corners, with 14px padding, a 360px maximum width and 12px minimum viewport clearance. It sits 60px from the top and 20px from the right (12px on phones), scrolls within viewport height minus 76px, and uses a two-column action grid beneath full-width search.

Escape, outside click and the close control dismiss settings. Command/Ctrl+K opens settings and focuses search unless editing or a detail/picker dialog is active. Choosing add, edit or data status closes the popover; entering editing clears filters. Active filter text remains visible above the groups after settings closes. Draft Save/Cancel/default actions remain on the board only while editing.

### Language switch

The independent Languages icon between Settings and Refresh toggles Chinese and English; its accessible name and tooltip announce the target language. Interface labels, built-in metric names, units, source notes, detail views and chart text use the selected language. Registered assets use the provider's English name when available, otherwise the available name remains as a fallback; codes and symbols are preserved. Search retains original names alongside translated/provider English names. Language is stored separately under `economic:language`, independent of the v2 layout and its Save/Cancel draft. If storage is unavailable, switching still works for the session. Long translations wrap within the existing fixed card widths and reserved action space.

### Board editor and metric picker

Inside settings, “新增” opens a draft and its picker; “编辑布局” opens the draft editor. A thin ruled action strip contains “恢复默认”, “取消”, and lime “保存”. While editing, card placement, group order, explicit row starts and card width form one draft. Save persists them together in the current browser; Cancel discards them together, and restoring defaults also requires Save. Outside editing, the settings width slider saves immediately. The v2 browser layout retains compatibility with v1 saved cards, supplying default group preferences when absent. Storage failure keeps the draft open and shows an explicit error. No account synchronization is implied.

Each editing card gains a ruled control row with a drag handle, previous/next buttons, and a right-aligned remove button. Card controls are 32px square on desktop and 32×36px on phones, with the drag handle available on touch screens. Pointer dragging from the card body or handle moves the complete visual across or within groups; the body opens detail only outside editing. Group titles drag whole groups. Other cards/groups make room in real time, with a 160ms position transition that is disabled for reduced motion. Dragging near viewport edges scrolls the board. Escape, pointer cancellation or window blur rolls back the current drag while preserving earlier draft edits.

Dragging a group into another group's bottom 24px target places it after that group on a new row; the target uses lime text and a dashed baseline. Group previous/next controls and the toggle between “换行” and “合并” provide keyboard alternatives, alongside the per-card arrows. Group controls are 28px square on desktop and 32px on phones; active row-start toggles use lime. Boundary arrows are disabled and remove hover uses amber. Empty draft groups expose a dashed, 130px-minimum add/drop target at the selected card width. The edit action strip wraps on phones without covering values.

The add-card picker is a native modal with the existing slate surface, one-pixel rule, 10px corners, and dimmed backdrop. Its width is at most 520px, with 12px viewport side clearance; its maximum height is the smaller of 720px and the viewport minus 32px. Search receives initial focus and matches names, codes, identifiers, symbols, markets and bilingual search terms across 34 built-in metrics and registered assets. The same input searches assets remotely after a 300ms debounce. Wrapping market chips offer “全部 / A股 / 港股 / 美股 / 加密货币” with `aria-pressed` state, 4px gaps, 7px 10px padding, and lime text over a faint lime fill for selection. They filter both local and remote results.

Search accepts Chinese security names, Shanghai/Shenzhen/Beijing codes, Hong Kong codes, and crypto names/tickers plus common Chinese aliases. Exact “APEL” or “苹果” queries resolve to AAPL; crypto aliases such as “比特币” and “索拉纳” resolve to their USD symbols. Normalized queries are shown explicitly. A native select offers automatic grouping by the result's market or an explicit destination group. Local ruled rows show name, market, code and unit with add/disabled “已添加” actions; remote rows show name, market, code and exchange with “追踪”. Already registered assets remain in local results without remote duplication. A live status confirms additions.

Muted 12px hints communicate searching, correction and no-more-matches states. Amber 12px errors include retry; partial source failures show warning/status text with retry while keeping successful results available. During asset registration the active action reads “采集中…”, remote tracking, search/clear, market chips and destination changes are disabled, and the footer reports that history is being saved. Registration failures remain visible and the action becomes available to retry. Results scroll independently between controls and a footer reminding users to save. Close, Escape, backdrop and “完成添加” dismiss the picker while retaining the draft only when registration is not pending. Pending registration disables close controls and blocks Escape/backdrop dismissal until success or failure.

“追踪” immediately registers a verified supported stock or crypto asset and its available daily history on the server, then appends its card to the layout draft. Save applies only the browser layout. Cancel or removing a card does not delete registered history or stop daily collection. Asset detail retains the same date/source tooltip and history drawer. Stock daily closes are not real-time prices or total returns; crypto uses completed UTC daily bars rather than rolling 24-hour change.

### Detail drawer and source tooltips

The drawer is a native modal dialog, named by its group/history toolbar and initially focused on the 36px close control. It reveals over 160ms with opacity and a clipped right-edge reveal. Tooltip Escape dismisses the tooltip before the dialog. Observation dates (including UTC for crypto) and source notes open on hover, keyboard focus or touch; they render outside card clipping and inside the dialog's top layer when applicable, with viewport-bounded positioning and scrolling. Escape, outside tap, resize or scroll dismisses them. The adjacent external-link action in detail opens the original source.

### History and provenance

The selected metric's name precedes its category and code. Its value, unit, previous-observation date, chart, range statistics, source link, and observation date form one continuous detail view. SVG axes stay at 12px by sizing the viewBox to the measured container width. A dated readout accompanies pointer and range-input inspection. Empty and failed states preserve explicit text and retry actions where available; absent values remain dashes.

Reduced-motion preference disables transitions, sorting position animations and the refresh spin. Data changes do not use decorative entrance animation.

## Do's and Don'ts

### Do:
- **Do** align quantities and use explicit units and signed changes; make observation dates available in tooltips and detail.
- **Do** use lime consistently for selection, primary action, and chart emphasis.
- **Do** preserve visible focus, modal dismissal and focus return to the invoking card.
- **Do** show missing observations and source failures explicitly.
- **Do** save or cancel all editor changes together and provide arrow/row-toggle alternatives to pointer dragging.

### Don't:
- **Don't** imply rise or fall through color alone.
- **Don't** substitute invented chart points for absent observations.
- **Don't** add decorative imagery or hero typography to the data workspace.
- **Don't** hide latest values, units, changes, or exceptional status to make mobile cards fit.
- **Don't** confuse filtering saved cards with searching the full catalog in the add-card picker.
- **Don't** stretch cards to fill a row; preserve the chosen fixed width and left alignment.
