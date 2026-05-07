# Aeroinsights — Complete Design System & Implementation Guide

**Product Name:** Aeroinsights — Aviation Lessor Decision Platform  
**Version:** 1.0 (MVP)  
**Last Updated:** March 2026  
**Design Inspiration:** Knowvio (Layout) + SkyLift (Aesthetic) + PRD §6 (Institutional Restraint)  
**Primary Font:** Inter (or Manrope fallback)  
**Color Scheme:** Oxford Blue accent with institutional light theme

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color Palette & Design Tokens](#color-palette--design-tokens)
3. [Typography System](#typography-system)
4. [Layout Architecture](#layout-architecture)
5. [Sidebar Navigation](#sidebar-navigation)
6. [Top Navigation Bar](#top-navigation-bar)
7. [Main Content Area](#main-content-area)
8. [Component Library](#component-library)
9. [Navigation Sections (8 Main)](#navigation-sections-8-main)
10. [Feature-Specific Layouts](#feature-specific-layouts)
11. [Data Visualization & Charts](#data-visualization--charts)
12. [Micro-interactions & Animations](#micro-interactions--animations)
13. [Responsive Design](#responsive-design)
14. [Accessibility Standards](#accessibility-standards)
15. [Implementation Checklist](#implementation-checklist)

---

## Design Philosophy

### Core Principles (From PRD §6)

**1. Institutional Restraint**
- Professional, trustworthy appearance for €100m+ accounting decisions
- No visual gimmicks, 3D illustrations, or glassmorphism
- Clarity through typography hierarchy and whitespace, not pixel density
- Every design choice serves a functional purpose

**2. Decision Over Data**
- Lead with conclusions (numbers, recommendations, alerts)
- Supporting data drillable underneath
- Never present walls of tables as primary view
- KPI strip pattern at top of every analytical screen

**3. Reproducibility by Default**
- Every output timestamped, scenario-stamped, reproducible
- Immutable run records with stored seed and scenario hash
- Users can retrieve exact historical runs to the cent
- No ephemeral calculations

**4. Show Your Work**
- Every model output exposes inputs, weights, intermediate steps
- "Show calculation" affordance on all numerical outputs
- Auditors and Heads of Risk demand this
- Confidence visible everywhere (ranges, bands, assumptions)

**5. Two Paths Through Every Workflow**
- **Guided Path:** Wizard, defaults, checklist (occasional users)
- **Power Path:** Forms, batch, API (daily users)
- Same outputs from both paths

**6. No Surprise Costs**
- If feature triggers paid data call (Phase 2+), show cost before commit
- Transparency on all external data dependencies

---

## Color Palette & Design Tokens

### Primary Colors

| Name | Hex | RGB | Usage | Notes |
|------|-----|-----|-------|-------|
| **Primary Accent** | `#002147` | 0, 33, 71 | Primary actions, active nav, key data emphasis | Oxford Blue — institutional, trustworthy |
| **Background Primary** | `#FFFFFF` | 255, 255, 255 | Main page background | White — clean, professional |
| **Background Secondary** | `#FAFAFA` | 250, 250, 250 | Card backgrounds, elevated sections | Off-white — subtle separation |
| **Background Tertiary** | `#F4F5F7` | 244, 245, 247 | Inset panels, secondary backgrounds | Pale grey — visual hierarchy |
| **Sidebar Background** | `#0F172A` | 15, 23, 42 | Left sidebar | Dark slate — strong contrast |
| **Sidebar Hover** | `#1E293B` | 30, 41, 59 | Sidebar item hover state | Slightly lighter slate |

### Text Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Text Primary** | `#0F172A` | 15, 23, 42 | Headings, main content | Dark slate |
| **Text Secondary** | `#475569` | 71, 85, 105 | Body text, descriptions | Medium slate |
| **Text Tertiary** | `#94A3B8` | 148, 163, 184 | Meta info, labels, disabled | Light slate |
| **Text Muted** | `#E2E8F0` | 226, 232, 240 | Disabled text, placeholders | Very light slate |
| **Text Sidebar** | `#FFFFFF` | 255, 255, 255 | Sidebar text | White |
| **Text Sidebar Muted** | `#CBD5E1` | 203, 213, 225 | Inactive sidebar items | Light slate on dark |

### Semantic Colors

| Name | Hex | RGB | Usage | Meaning |
|------|-----|-----|-------|---------|
| **Success / Stage 1** | `#15803D` | 21, 128, 61 | Green pill, OK status, improvement | Positive, safe |
| **Warning / Stage 2** | `#B45309` | 180, 83, 9 | Amber pill, watch status, caution | Attention needed |
| **Danger / Stage 3** | `#B91C1C` | 185, 28, 28 | Red pill, breach, sanctioned | Critical, action required |
| **Info** | `#0369A1` | 3, 105, 161 | Information, secondary actions | Neutral information |

### Chart Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Series 1 (Primary)** | `#002147` | Oxford Blue — primary data series |
| **Series 2** | `#475569` | Slate — secondary series |
| **Series 3** | `#0F4C5C` | Deep teal — tertiary series |
| **Series 4** | `#6B7280` | Warm grey — quaternary series |

**Chart Palette Rules:**
- No rainbow gradients
- No neon colors
- Muted complements only
- Sufficient contrast for colorblind users
- Maximum 4 series per chart; use faceting for more

### CSS Variables

```css
:root {
  /* Primary Colors */
  --color-primary: #002147;
  --color-primary-dark: #001a35;
  --color-primary-light: #1a3a5c;
  
  /* Background Colors */
  --bg-primary: #FFFFFF;
  --bg-secondary: #FAFAFA;
  --bg-tertiary: #F4F5F7;
  --bg-sidebar: #0F172A;
  --bg-sidebar-hover: #1E293B;
  
  /* Text Colors */
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-tertiary: #94A3B8;
  --text-muted: #E2E8F0;
  --text-sidebar: #FFFFFF;
  --text-sidebar-muted: #CBD5E1;
  
  /* Semantic Colors */
  --color-success: #15803D;
  --color-warning: #B45309;
  --color-danger: #B91C1C;
  --color-info: #0369A1;
  
  /* Chart Colors */
  --chart-series-1: #002147;
  --chart-series-2: #475569;
  --chart-series-3: #0F4C5C;
  --chart-series-4: #6B7280;
  
  /* Borders & Dividers */
  --border-color: #E2E8F0;
  --border-color-dark: #CBD5E1;
  
  /* Spacing (8px base) */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 0.75rem;
  --spacing-lg: 1rem;
  --spacing-xl: 1.5rem;
  --spacing-2xl: 2rem;
  --spacing-3xl: 3rem;
  --spacing-4xl: 4rem;
  
  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  
  /* Shadows (subtle, max 4px blur) */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 2px 4px rgba(0, 0, 0, 0.06);
  --shadow-xl: 0 4px 6px rgba(0, 0, 0, 0.07);
  
  /* Typography */
  --font-family: 'Inter', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'Courier New', monospace;
  
  /* Layout */
  --sidebar-width: 280px;
  --sidebar-width-mobile: 0;
  --header-height: 64px;
  --main-max-width: 1400px;
  
  /* Z-index scale */
  --z-sidebar: 40;
  --z-header: 30;
  --z-dropdown: 50;
  --z-modal: 60;
  --z-tooltip: 70;
}
```

---

## Typography System

### Font Stack

```css
font-family: 'Inter', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Tabular Numerics (Required for Financial Tables):**
```css
font-variant-numeric: tabular-nums;
```

### Type Scale

| Level | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|-----------------|-------|
| **Display** | 2.5rem (40px) | 600 | 1.1 | -0.01em | Page titles, hero headlines |
| **H1** | 2rem (32px) | 600 | 1.2 | 0em | Section headings |
| **H2** | 1.5rem (24px) | 600 | 1.3 | 0em | Subsection headings |
| **H3** | 1.25rem (20px) | 600 | 1.4 | 0em | Card titles, metric labels |
| **H4** | 1.125rem (18px) | 600 | 1.5 | 0em | Small headings |
| **Body Large** | 1.125rem (18px) | 400 | 1.75 | -0.01em | Primary body text |
| **Body** | 1rem (16px) | 400 | 1.75 | -0.01em | Standard body text |
| **Body Small** | 0.875rem (14px) | 400 | 1.6 | 0em | Secondary text |
| **Tabular Cell** | 0.8125rem (13px) | 400 | 1.5 | 0em | Financial table cells |
| **Label** | 0.75rem (12px) | 500 | 1.5 | 0.05em | Labels, badges, status |
| **Caption** | 0.625rem (10px) | 400 | 1.4 | 0.1em | Captions, meta info |

### Font Weights

- **400** — Regular (body text, descriptions)
- **500** — Medium (labels, emphasis)
- **600** — Semibold (headings, strong emphasis)

**Note:** No weight 700 (bold) used in product UI. Use weight 600 for emphasis.

### Typography Examples

```css
/* Display */
.display {
  font-size: 2.5rem;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

/* H1 */
.h1 {
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-primary);
}

/* Body */
.body {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.75;
  letter-spacing: -0.01em;
  color: var(--text-secondary);
}

/* Tabular Cell */
.table-cell {
  font-size: 0.8125rem;
  font-weight: 400;
  line-height: 1.5;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

/* Label */
.label {
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  text-transform: uppercase;
}
```

---

## Layout Architecture

### Global Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Header (64px, sticky)                                       │
├──────────────┬──────────────────────────────────────────────┤
│ Sidebar      │ Main Content Area (flex-grow)                │
│ (280px,      │                                              │
│ fixed)       │ ┌────────────────────────────────────────┐  │
│              │ │ KPI Strip (if applicable)              │  │
│              │ │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │  │
│              │ │ │ KPI1 │ │ KPI2 │ │ KPI3 │ │ KPI4 │   │  │
│              │ │ └──────┘ └──────┘ └──────┘ └──────┘   │  │
│              │ └────────────────────────────────────────┘  │
│              │                                              │
│              │ ┌────────────────────────────────────────┐  │
│              │ │ Primary Content Section                │  │
│              │ │ (Tables, Charts, Forms)                │  │
│              │ └────────────────────────────────────────┘  │
│              │                                              │
│              │ ┌────────────────────────────────────────┐  │
│              │ │ Secondary Content Section              │  │
│              │ │ (Details, Related Data)                │  │
│              │ └────────────────────────────────────────┘  │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### Container Widths & Padding

| Breakpoint | Width | Padding | Max Content |
|-----------|-------|---------|-------------|
| Mobile (< 640px) | 100% | 1rem | 100% |
| Tablet (640px - 1024px) | 100% | 1.5rem | 100% |
| Desktop (1024px+) | 100% | 2rem | 1400px |

### Grid System

**Desktop (1024px+):**
- 12-column grid
- Column gap: 1.5rem (24px)
- Row gap: 2rem (32px)

**Tablet (640px - 1024px):**
- 6-column grid
- Column gap: 1rem (16px)
- Row gap: 1.5rem (24px)

**Mobile (< 640px):**
- Single column layout
- Gap: 1rem (16px)

---

## Sidebar Navigation

### Sidebar Specifications

**Desktop (1024px+):**
- **Width:** 280px (fixed, left side)
- **Height:** 100vh (full viewport height)
- **Position:** Fixed, z-index 40
- **Background:** `#0F172A` (dark slate)
- **Border Right:** 1px solid `#1E293B`
- **Overflow:** Auto (scrollable)

**Tablet (640px - 1024px):**
- **Width:** 280px (collapsible)
- **Behavior:** Slide-out drawer on hamburger click
- **Overlay:** Semi-transparent backdrop

**Mobile (< 640px):**
- **Width:** 100% or 80%
- **Behavior:** Slide-out from left on hamburger click
- **Overlay:** Full-screen semi-transparent backdrop

### Sidebar Sections (Top to Bottom)

#### 1. Logo Section (80px)

```
┌──────────────────────────┐
│ 📊 Aeroinsights           │
│    Decision Platform     │
└──────────────────────────┘
```

**Specifications:**
- **Height:** 80px
- **Padding:** 1rem
- **Border Bottom:** 1px solid `#1E293B`
- **Display:** Logo icon (32×32px) + Brand name (vertical stack)
- **Logo Icon:** Oxford Blue background `#002147`
- **Brand Name (Main):** "Aeroinsights" (1rem, weight 600, white)
- **Brand Name (Sub):** "Decision Platform" (0.75rem, weight 400, light slate)

```html
<div class="sidebar-logo">
  <div class="logo-icon">📊</div>
  <div class="logo-text">
    <div class="logo-main">Aeroinsights</div>
    <div class="logo-sub">Decision Platform</div>
  </div>
</div>
```

```css
.sidebar-logo {
  height: 80px;
  padding: 1rem;
  border-bottom: 1px solid #1E293B;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: var(--color-primary);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.logo-text {
  flex: 1;
}

.logo-main {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-sidebar);
  line-height: 1.2;
}

.logo-sub {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-sidebar-muted);
  line-height: 1.2;
}
```

#### 2. Main Navigation (8 Items)

```
Dashboard          📊
Portfolio          📚
Scenarios          🎯
Risk & ECL         ⚠️
Counterparties     🤝
Jurisdictions      🌍
Reports            📄
Settings           ⚙️
```

**Specifications:**
- **Padding:** 0.5rem 0 (vertical)
- **Item Height:** 40px
- **Item Padding:** 0.75rem 1rem (horizontal)
- **Item Margin:** 0.25rem 0.5rem
- **Border Radius:** 0.375rem
- **Font Size:** 0.875rem (14px)
- **Font Weight:** 500
- **Color (Default):** `#CBD5E1` (text-sidebar-muted)
- **Color (Hover):** `#FFFFFF` (text-sidebar)
- **Color (Active):** `#002147` (primary accent)
- **Background (Active):** `rgba(0, 33, 71, 0.15)` (primary with 15% opacity)

```html
<nav class="sidebar-nav">
  <a href="/dashboard" class="nav-item active">
    <span class="nav-icon">📊</span>
    <span class="nav-label">Dashboard</span>
  </a>
  
  <a href="/portfolio" class="nav-item">
    <span class="nav-icon">📚</span>
    <span class="nav-label">Portfolio</span>
  </a>
  
  <a href="/scenarios" class="nav-item">
    <span class="nav-icon">🎯</span>
    <span class="nav-label">Scenarios</span>
  </a>
  
  <a href="/risk-ecl" class="nav-item">
    <span class="nav-icon">⚠️</span>
    <span class="nav-label">Risk & ECL</span>
  </a>
  
  <a href="/counterparties" class="nav-item">
    <span class="nav-icon">🤝</span>
    <span class="nav-label">Counterparties</span>
  </a>
  
  <a href="/jurisdictions" class="nav-item">
    <span class="nav-icon">🌍</span>
    <span class="nav-label">Jurisdictions</span>
  </a>
  
  <a href="/reports" class="nav-item">
    <span class="nav-icon">📄</span>
    <span class="nav-label">Reports</span>
  </a>
  
  <a href="/settings" class="nav-item">
    <span class="nav-icon">⚙️</span>
    <span class="nav-label">Settings</span>
  </a>
</nav>
```

```css
.sidebar-nav {
  padding: 0.5rem 0;
  flex: 1;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 40px;
  padding: 0.75rem 1rem;
  margin: 0.25rem 0.5rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-sidebar-muted);
  text-decoration: none;
  cursor: pointer;
  transition: all 200ms ease;
  border: none;
  background: transparent;
  width: calc(100% - 1rem);
}

.nav-item:hover {
  color: var(--text-sidebar);
  background: rgba(255, 255, 255, 0.05);
}

.nav-item.active {
  color: var(--color-primary);
  background: rgba(0, 33, 71, 0.15);
}

.nav-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.nav-label {
  flex: 1;
  text-align: left;
}
```

#### 3. Settings Section (Bottom)

```
Dark Mode        [toggle]
Settings
Logout
```

**Specifications:**
- **Padding:** 0.5rem 0
- **Border Top:** 1px solid `#1E293B`
- **Item Height:** 40px
- **Item Padding:** 0.75rem 1rem
- **Font Size:** 0.875rem
- **Color:** `#CBD5E1`

#### 4. User Profile Card (Bottom)

```
[Avatar] Alex Johnson
alex@example.com
Operator
```

**Specifications:**
- **Height:** 60px
- **Padding:** 0.75rem
- **Border Top:** 1px solid `#1E293B`
- **Avatar:** 40px × 40px, circular
- **Name:** 0.875rem, weight 600, text-sidebar
- **Email:** 0.75rem, weight 400, text-sidebar-muted
- **Role:** 0.625rem, weight 400, text-sidebar-muted

---

## Top Navigation Bar

### Header Specifications

**Desktop (1024px+):**
- **Height:** 64px
- **Position:** Sticky (top)
- **Background:** `#FFFFFF` (white)
- **Border Bottom:** 1px solid `#E2E8F0`
- **Padding:** 0 2rem
- **Z-Index:** 30
- **Display:** Flex, space-between

**Tablet & Mobile:**
- **Height:** 64px (same)
- **Padding:** 0 1rem
- **Responsive adjustments:** See Responsive Design section

### Header Sections (Left to Right)

#### 1. Left Section (Welcome Message)

```
Welcome Back Alex!
You've completed 3 decisions today — keep it up!
```

**Specifications:**
- **Width:** Auto (flex-grow)
- **Display:** Flex, flex-direction column, justify-center
- **Padding:** 0 1rem 0 0

**Elements:**
- **Welcome Text:** "Welcome Back [Name]!" (0.875rem, weight 600, text-primary)
- **Subtitle:** "You've completed 3 decisions today — keep it up!" (0.75rem, weight 400, text-tertiary)

#### 2. Center Section (Search Bar)

```
🔍 Search by Aircraft MSN, Lessee, Lease ID...
```

**Specifications:**
- **Width:** 350px (on desktop, responsive on mobile)
- **Height:** 40px
- **Background:** `#F4F5F7` (pale grey)
- **Border:** 1px solid `#E2E8F0`
- **Border Radius:** 0.5rem
- **Padding:** 0 0.75rem
- **Display:** Flex, align-items center
- **Focus State:** Border `#002147`, box-shadow `0 0 0 3px rgba(0, 33, 71, 0.1)`

#### 3. Right Section (Icons & User Menu)

```
🔔 📧 ⋮ [Avatar] John Williams
                 Operator
```

**Elements:**

**A. Notification Icon**
- **Size:** 24px × 24px
- **Icon:** 🔔 (bell)
- **Badge:** Red dot with number (if unread)
- **Hover:** Background `#F4F5F7`, border-radius 0.375rem

**B. Message Icon**
- **Size:** 24px × 24px
- **Icon:** 📧 (envelope)
- **Badge:** Optional (similar to notifications)

**C. More Options Menu**
- **Size:** 24px × 24px
- **Icon:** ⋮ (three dots)
- **Click:** Open dropdown menu

**D. User Profile Section**
- **Display:** Flex, align-items center, gap 0.75rem
- **Avatar:** 36px × 36px, circular, image
- **Name:** "John Williams" (0.875rem, weight 600, text-primary)
- **Role:** "Operator" (0.75rem, weight 400, text-tertiary)

---

## Main Content Area

### Content Padding & Spacing

- **Desktop:** 2rem (32px) padding, max-width 1400px
- **Tablet:** 1.5rem (24px) padding
- **Mobile:** 1rem (16px) padding
- **Gap Between Sections:** 2rem (32px)
- **Gap Between Cards:** 1.5rem (24px)

### KPI Strip Pattern

**Usage:** Top of every analytical screen (Dashboard, Risk & ECL, Scenarios)

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ │ KPI 1    │ │ KPI 2    │ │ KPI 3    │ │ KPI 4    │   │
│ │ 25%      │ │ 18,560   │ │ 45       │ │ 88%      │   │
│ │ ▲ +5%    │ │ ▼ -2%    │ │ → 0%     │ │ ▲ +12%   │   │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Specifications:**
- **Height:** 100px
- **Padding:** 1.5rem
- **Background:** `#FAFAFA` (off-white)
- **Border Bottom:** 1px solid `#E2E8F0`
- **Grid:** 4 columns on desktop, 2 on tablet, 1 on mobile
- **Gap:** 1.5rem

**KPI Card:**
- **Background:** `#FFFFFF` (white)
- **Padding:** 1.5rem
- **Border Radius:** 0.5rem
- **Box Shadow:** `var(--shadow-md)`
- **Value:** 2.5rem, weight 600, text-primary
- **Label:** 0.875rem, weight 500, text-tertiary
- **Delta:** 0.75rem, weight 500, color-coded (green/amber/red)
- **Sparkline:** Optional mini chart (20px height)

---

## Component Library

### Buttons

#### Primary Button (Oxford Blue CTA)

```css
.btn-primary {
  background: var(--color-primary);
  color: white;
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.875rem;
  border: none;
  cursor: pointer;
  transition: all 200ms ease;
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.btn-primary:active:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(0);
}

.btn-primary:disabled {
  background: #CBD5E1;
  color: #94A3B8;
  cursor: not-allowed;
  box-shadow: none;
}
```

#### Secondary Button (Slate)

```css
.btn-secondary {
  background: #F4F5F7;
  color: var(--text-primary);
  border: 1px solid #E2E8F0;
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 200ms ease;
}

.btn-secondary:hover:not(:disabled) {
  background: #FAFAFA;
  border-color: #CBD5E1;
}
```

#### Danger Button (Red)

```css
.btn-danger {
  background: var(--color-danger);
  color: white;
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.875rem;
  border: none;
  cursor: pointer;
  transition: all 200ms ease;
}

.btn-danger:hover:not(:disabled) {
  background: #991b1b;
}
```

### Cards

#### Standard Card

```css
.card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  border: 1px solid #E2E8F0;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  border-color: #CBD5E1;
}
```

#### Metric Card

```css
.metric-card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-md);
  border: 1px solid #E2E8F0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metric-card__value {
  font-size: 2rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.metric-card__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-card__delta {
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.5rem;
  font-variant-numeric: tabular-nums;
}

.metric-card__delta.positive {
  color: var(--color-success);
}

.metric-card__delta.negative {
  color: var(--color-danger);
}

.metric-card__delta.neutral {
  color: var(--text-tertiary);
}
```

### Status Pills

**Usage:** Stage indicators, watchlist status, scenario status, sanction status

```css
.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid;
}

/* Stage 1 - Green */
.pill.stage-1 {
  background: rgba(21, 128, 61, 0.1);
  color: #15803D;
  border-color: rgba(21, 128, 61, 0.3);
}

/* Stage 2 - Amber */
.pill.stage-2 {
  background: rgba(180, 83, 9, 0.1);
  color: #B45309;
  border-color: rgba(180, 83, 9, 0.3);
}

/* Stage 3 - Red */
.pill.stage-3 {
  background: rgba(185, 28, 28, 0.1);
  color: #B91C1C;
  border-color: rgba(185, 28, 28, 0.3);
}

/* Neutral */
.pill.neutral {
  background: #F4F5F7;
  color: var(--text-secondary);
  border-color: #E2E8F0;
}
```

### Tables

**Specifications:**
- **Font Size:** 0.8125rem (13px) for cells
- **Font Variant:** `tabular-nums` for numeric columns
- **Row Height:** 40px
- **Header Background:** `#F4F5F7` (pale grey)
- **Header Font Weight:** 600
- **Border:** 1px solid `#E2E8F0`
- **Hover Row:** Background `#FAFAFA`
- **Striped (Optional):** Alternate rows `#F4F5F7` and `#FFFFFF`

```css
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.table thead {
  background: #F4F5F7;
  border-bottom: 1px solid #E2E8F0;
}

.table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.75rem;
}

.table td {
  padding: 0.75rem 1rem;
  color: var(--text-secondary);
  border-bottom: 1px solid #E2E8F0;
  height: 40px;
}

.table tbody tr:hover {
  background: #FAFAFA;
}

.table tbody tr:nth-child(odd) {
  background: #FFFFFF;
}

.table tbody tr:nth-child(even) {
  background: #F4F5F7;
}
```

### Input Fields

```css
.input {
  background: var(--bg-primary);
  border: 1px solid #E2E8F0;
  border-radius: var(--radius-md);
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  font-family: var(--font-family);
  transition: all 200ms ease;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 33, 71, 0.1);
}

.input::placeholder {
  color: var(--text-muted);
}
```

### Modals & Dialogs

```css
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.modal__content {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  padding: 2rem;
  max-width: 600px;
  width: 90%;
  box-shadow: var(--shadow-xl);
  max-height: 90vh;
  overflow-y: auto;
}

.modal__header {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.modal__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-tertiary);
}
```

---

## Navigation Sections (8 Main)

### 1. Dashboard

**Purpose:** KPI strip + watchlist headlines + last 5 scenario runs

**Layout:**
```
KPI Strip (4 metrics)
├─ Portfolio Book Value
├─ Expected Loss (ECL)
├─ Watchlist Status (Red/Amber/Green count)
└─ Active Scenarios (count)

Watchlist Headlines (3-5 items)
├─ Lessee name
├─ Status (Red/Amber/Green pill)
├─ Reason (payment lateness, rating change, etc.)
└─ Action button (View Profile)

Last 5 Scenario Runs
├─ Scenario name
├─ Run date/time
├─ Portfolio ECL result
├─ Key finding
└─ Action (Re-run, Export)
```

### 2. Portfolio

**Purpose:** Leases / Aircraft / Lessees tables with filters and concentration views

**Sections:**
- **Portfolio Overview:** Book value, encumbered value, expected loss, weighted-average lease term
- **Leases Table:** Sortable, filterable, with pagination (50 per page)
- **Aircraft Table:** Technical details, market value, maintenance reserve
- **Lessees Table:** Credit rating, payment history, behavior score
- **Concentration Views:** By lessee, country, region, aircraft type, vintage

### 3. Scenarios

**Purpose:** Library, custom builder, run history

**Sections:**
- **Scenario Library:** 6 pre-built templates (Baseline, COVID-Mild, COVID-Severe, Fuel Spike, Sovereign Stress, Currency Collapse, Russia-Style Expropriation)
- **Custom Builder:** JSON/YAML DSL editor with validation
- **Run History:** All historical runs with reproducibility
- **Deterministic vs. Monte Carlo:** Mode selection, path count configuration

### 4. Risk & ECL

**Purpose:** Staging matrix, ECL by lease, IAS 36 impairment workspace

**Sections:**
- **Stage Migration Matrix:** Period-on-period changes with reasons
- **ECL by Lease:** Individual lease ECL, PD term structure, LGD, EAD
- **IAS 36 Impairment:** Recoverable amount, VIU, FVLCD, impairment loss
- **Sensitivity Analysis:** Tornado chart on top 5 inputs
- **Auditor Evidence Pack:** Export button for PDF + JSON

### 5. Counterparties

**Purpose:** Lessee profiles, behavior scores, restructuring sim entry point

**Sections:**
- **Lessee Profile:** Name, credit rating, payment history, behavior score
- **Behavior Score Breakdown:** Punctuality, restructuring cooperation, government interference, litigation propensity
- **Restructuring Simulator:** 7 options (Payment Holiday, Deferral, Forgiveness, PBH, Term Extension, Rate Reduction, Hybrid)
- **Restructuring Comparison:** NPV, IRR, ECL, P95 downside, time-to-recovery

### 6. Jurisdictions

**Purpose:** Country profiles, CTC scores, repossession models

**Sections:**
- **Jurisdiction Profile:** CTC party flag, CTC compliance score, Alt-A flag, IDERA flag, enforceability score, rule-of-law index, sanctions status
- **Repossession Model:** P50/P90 timeline, P50/P90 cost, success probability
- **Precedent Database:** Case ID, year, lessor, airline, aircraft count, timeline, outcome, public source URL
- **AWG Index Updates:** Semi-annual updates + event-driven watchlist notices

### 7. Reports

**Purpose:** Exports, auditor packs, board-pack templates

**Sections:**
- **Export Formats:** CSV, XLSX, JSON, PDF
- **Auditor Pack:** All inputs, formulas, source data hashes
- **Board Pack:** Executive summary, KPI strip, key findings, recommendations
- **Scheduled Reports:** Weekly / monthly / quarterly per persona
- **Email Delivery:** Configurable recipients and frequency

### 8. Settings

**Purpose:** Tenant, users, data sources, model parameters, audit log

**Sections:**
- **Tenant Settings:** Company name, logo, currency, timezone
- **Users:** RBAC roles (Admin, Risk, Accounting, Read-only), MFA configuration
- **Data Sources:** CSV/Excel upload, data refresh cadence
- **Model Parameters:** Scenario weights (default 60/25/15), SICR triggers, discount rates
- **Audit Log:** Immutable 7-year retention, searchable by user/action/date

---

## Feature-Specific Layouts

### F01 Scenario Engine

**Layout:**
```
Scenario Library (6 templates)
├─ Baseline
├─ COVID-Mild
├─ COVID-Severe
├─ Fuel Spike
├─ Sovereign Stress
└─ Currency Collapse

Custom Scenario Builder
├─ JSON/YAML DSL editor
├─ Shock parameters (GDP, RPK, fuel, FX, rates, asset values, PD overrides)
└─ Validation feedback

Run Configuration
├─ Deterministic vs. Monte Carlo
├─ Path count (default 10,000, max 100,000)
└─ Run button

Performance: <5s deterministic, <60s Monte Carlo per 100 leases
```

### F02 IFRS 9 ECL Module

**Layout:**
```
ECL Summary
├─ Total ECL (portfolio)
├─ ECL by stage (Stage 1, 2, 3)
└─ Scenario weights (60/25/15)

Stage Migration Matrix
├─ Period-on-period changes
├─ Reasons for each migration
└─ Drill-down to individual leases

ECL by Lease
├─ Lease ID, lessee, aircraft
├─ PD, LGD, EAD, ECL 12-month, ECL lifetime
├─ Journal entry stub
└─ Sensitivity tornado chart

Auditor Evidence Pack Export
├─ PDF + JSON
├─ All inputs, formulas, source data hashes
└─ Timestamp, scenario stamp, reproducibility
```

### F03 IAS 36 Impairment

**Layout:**
```
Impairment Workspace
├─ Aircraft MSN, registration
├─ Carrying amount
├─ Recoverable amount (max of FVLCD, VIU)
├─ Impairment loss (if carrying > recoverable)
└─ Reversal logic (if applicable)

VIU Calculation
├─ Discount rate (user-configurable, default lessee-risk-adjusted WACC)
├─ Contractual cashflows from lease
├─ Expected residual
└─ Calculation steps exposed

Evidence Pack
├─ All inputs, formulas
├─ Source data hashes
└─ PDF + JSON export
```

### F04 Repossession & Recovery

**Layout:**
```
Jurisdiction Profiles (80+ CTC + 30+ non-CTC + 6 priority)
├─ CTC party flag, compliance score
├─ Alt-A flag, IDERA flag
├─ Enforceability score, rule-of-law index
├─ Sanctions status
└─ Last update timestamp

Repossession Model Output
├─ P50 timeline (months)
├─ P90 timeline (months)
├─ P50 cost (% of asset value)
├─ P90 cost (% of asset value)
└─ Success probability

Precedent Database
├─ Case ID, year, lessor, airline
├─ Aircraft count, timeline, outcome
└─ Public source URL

AWG CTC Index Updates
├─ Semi-annual updates
├─ Event-driven watchlist notices
└─ Material score change alerts
```

### F05 Lessee Behaviour & Cultural Payment Scorer

**Layout:**
```
Behaviour Score (0–100)
├─ Overall score
├─ Sub-scores:
│  ├─ Payment punctuality
│  ├─ Restructuring cooperation
│  ├─ Government interference likelihood
│  └─ Litigation propensity
└─ Evidence list for each sub-score

Score Explanation
├─ Itemised evidence
├─ Data sources
└─ Last update date

Score Update Cadence
├─ Monthly from internal payment history
└─ Quarterly from precedent/macro data

Non-Discriminatory Framing
├─ "Observed contractual-performance indicator under stress"
├─ Country-level proxies empirical only
└─ Legal sign-off before pilot
```

### F06 Lease Restructuring Simulator

**Layout:**
```
Restructuring Templates (7 options)
├─ Payment Holiday
├─ Deferral with Catch-up
├─ Forgiveness
├─ PBH Conversion
├─ Term Extension
├─ Rate Reduction
└─ Hybrid

Side-by-Side Comparison
├─ NPV-to-lessor
├─ IRR
├─ ECL
├─ P95 downside
├─ Time-to-recovery
└─ vs. Termination scenario

Counterfactual Analysis
├─ "What if lessee defaults anyway after we agree?"
└─ Automatic for each option

Term-Sheet Draft Generation
├─ PDF/DOCX output
└─ From selected restructuring option
```

### F07 Security Deposit & MR Logic

**Layout:**
```
Security Deposit Records
├─ Type (cash / LC)
├─ Amount, currency
├─ Refund triggers
└─ Governing-law clause reference

Maintenance Reserve Records (by component)
├─ Airframe HSI
├─ Engine PR
├─ LLPs
├─ Landing gear
├─ APU
├─ Rate basis ($/FH or $/cycle)
├─ Refundability flag
├─ Cap rule
└─ Cumulative balance ledger

Refund Cap Enforcement
├─ refund_t = min(MR_paid_net_of_refunds, evidenced_maint_cost_t)
└─ Per IATA IAWG guidance

End-of-Lease Cash Compensation
├─ Half-life return conditions
└─ Full-life return conditions

SD & MR Offsets in LGD
├─ Feeds correctly into F02 ECL calculation
└─ Auditor-defensible treatment
```

### F08 Market Value & Tear-down Engine

**Layout:**
```
Asset Valuation
├─ Aircraft MSN, registration
├─ Half-life base value
├─ Current market value
├─ Maintenance-adjusted value
├─ Lease-encumbered value
├─ Part-out value

Source Tags & Uncertainty
├─ Heuristic / Avitas BlueBook / Cirium / IBA / User-overridden
└─ Uncertainty band (±%)

Pluggable Provider Architecture
├─ Heuristic (MVP)
├─ Cirium adapter (Phase 2)
├─ IBA adapter (Phase 2)
├─ Avitas adapter (Phase 2)
└─ Configuration change, not code change

Part-Out Value Calculation
├─ Component value × recovery factor
└─ Minus tear-down cost
```

### F09 Risk Mitigation Action Simulator

**Layout:**
```
Mitigation Options
├─ Parent guarantee
├─ Additional security
├─ Cross-default acceleration
├─ Step-in rights
├─ Sub-lease consent withholding
└─ Insurance trigger

Quantified Benefits per Option
├─ Marginal ECL reduction
├─ Marginal expected recovery
└─ Capital cost

Net-Benefit Comparison
├─ Side-by-side comparison
├─ Recommendation engine
└─ Export for decision support
```

### F10 Bankruptcy Scenario Module

**Layout:**
```
Insolvency Regime Templates
├─ US Chapter 11 (§1110 / §365)
├─ India IBC (with new CTC Act 2025)
├─ Brazil RJ
├─ Mexico Concurso
├─ Indonesia PKPU
└─ Generic civil-law liquidation

Regime Details
├─ Typical stay duration
├─ Cure window for aircraft
├─ Executory-contract rejection rules
├─ Lessor priority
├─ Observed recovery timeline distribution
└─ Observed haircut distribution

Branching Simulation
├─ P(restructure | filing)
├─ P(lease assumed | restructure)
├─ P(rejected | restructure)
└─ Conditional haircut distributions (calibrated to precedent)
```

### F11 Watchlist & Early Warning System

**Layout:**
```
Per-Lessee Status (Green / Amber / Red)
├─ Computed daily from configurable rule-set
├─ Status pill with reason
└─ Last update timestamp

Default Signals
├─ Payment-lateness trend
├─ Schedule cancellations
├─ Ratings changes
├─ Sovereign CDS widening (if licensed)
├─ AWG CTC watchlist notices
└─ News-keyword detector

Status Change Events
├─ Audit-logged with evidence
├─ Configurable alerts (in-app + email)
└─ User-specific alert preferences

Watchlist Dashboard
├─ Red count, Amber count, Green count
├─ Trend over time
└─ Drill-down to individual lessees
```

### F12 Portfolio Aggregator & Concentration Monitor

**Layout:**
```
Concentration Views
├─ By lessee
├─ By country
├─ By region
├─ By aircraft type
├─ By vintage
└─ By lessee currency

Aggregate KPIs
├─ Book value
├─ Encumbered value
├─ Expected loss
├─ ECL
├─ Weighted-average lease term
└─ Weighted-average lessee credit

Concentration Policy Thresholds
├─ User-configurable limits
├─ Breach indicators
└─ Phase 2 enforcement workflow
```

---

## Data Visualization & Charts

### Chart Styling

**Color Palette:**
- **Series 1 (Primary):** Oxford Blue `#002147`
- **Series 2:** Slate `#475569`
- **Series 3:** Deep teal `#0F4C5C`
- **Series 4:** Warm grey `#6B7280`

**Chart Rules:**
- No rainbow gradients
- No neon colors
- Muted complements only
- Sufficient contrast for colorblind users
- Maximum 4 series per chart; use faceting for more

### Line Chart (Area Chart)

**Usage:** ECL trends, portfolio metrics over time, scenario comparisons

**Specifications:**
- **Line Color:** Primary series (Oxford Blue)
- **Line Width:** 2px
- **Fill:** Gradient from line color to transparent
- **Grid Lines:** `#E2E8F0`, 1px, dashed
- **Axis Labels:** 0.75rem, color `#475569`
- **Tooltip:** White card with soft shadow, dark text

### Bar Chart

**Usage:** Concentration by lessee/country, stage migration, restructuring comparison

**Specifications:**
- **Bar Color:** Oxford Blue or gradient
- **Bar Radius:** 4px (top only)
- **Bar Gap:** 12px between bars
- **Hover State:** Opacity +0.2, shadow increase
- **Value Labels:** 0.75rem, color `#0F172A`, positioned above bar

### Pie/Donut Chart

**Usage:** Portfolio composition, stage distribution, restructuring option breakdown

**Specifications:**
- **Segment Colors:** Primary palette (4 colors max)
- **Segment Spacing:** 2px gap
- **Center Label:** Large number + small label (donut only)
- **Legend:** Below chart, 0.875rem font

### Waterfall Chart

**Usage:** ECL bridge, impairment bridge, restructuring NPV breakdown

**Specifications:**
- **Positive Bars:** Green `#15803D`
- **Negative Bars:** Red `#B91C1C`
- **Connector Lines:** Slate `#94A3B8`, dashed
- **Value Labels:** Above each bar

### Heatmap

**Usage:** Concentration matrix (lessee × country), correlation matrix

**Specifications:**
- **Color Scale:** Blue (low) → White (medium) → Red (high)
- **Cell Borders:** 1px solid `#E2E8F0`
- **Cell Hover:** Tooltip with exact value

---

## Micro-interactions & Animations

### Entrance Animations

**Fade In**
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}
```

**Slide Up**
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-up {
  animation: slideUp 0.4s ease-out;
}
```

### Hover Animations

**Card Lift** (max 2px)
```css
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  transition: all 200ms ease;
}
```

**Button Hover**
```css
.btn-primary:hover {
  background: var(--color-primary-dark);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
  transition: all 200ms ease;
}
```

### Loading States

**Skeleton Loader**
- Placeholder cards with animated shimmer
- Shimmer: Left to right, 1.5s duration, infinite
- Background: `#E2E8F0`
- Shimmer: `#F4F5F7`

```css
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

.skeleton {
  background: linear-gradient(90deg, #E2E8F0 25%, #F4F5F7 50%, #E2E8F0 75%);
  background-size: 1000px 100%;
  animation: shimmer 1.5s infinite;
}
```

### Transition Timings

| Duration | Usage |
|----------|-------|
| 150ms | Quick feedback (button press, toggle) |
| 200ms | Standard interaction (hover, focus) |
| 300ms | Modal open, page transition |
| 500ms | Complex animations, scroll reveals |

**Note:** No animations >200ms on data screens (analytical tools shouldn't feel "fun")

### Easing Functions

- **ease-out:** `cubic-bezier(0.4, 0, 0.2, 1)` — For entrances
- **ease-in-out:** `cubic-bezier(0.4, 0, 0.2, 1)` — For transitions
- **ease-in:** `cubic-bezier(0.4, 0, 1, 1)` — For exits

---

## Responsive Design

### Breakpoints

```css
/* Mobile First */
/* < 640px: Mobile (default) */
/* 640px+: Tablet (sm) */
/* 1024px+: Desktop (md) */
/* 1280px+: Large Desktop (lg) */
/* 1536px+: Extra Large (xl) */
```

### Mobile Optimizations (< 640px)

**Sidebar:**
- Hidden by default
- Hamburger menu button in header
- Slide-out drawer on click
- Full-screen overlay backdrop

**Header:**
- Reduced padding (1rem instead of 2rem)
- Search bar hidden (replaced with search icon)
- User profile simplified (avatar only, click for menu)

**Content:**
- Single column layout
- Full-width cards
- Stacked metric cards (1 column)
- Tables with horizontal scroll
- Reduced padding (1rem instead of 2rem)

### Tablet Optimizations (640px - 1024px)

**Sidebar:**
- Collapsible (icon-only mode)
- Slide-out drawer on click
- Overlay backdrop

**Header:**
- Standard layout
- Search bar visible (reduced width)

**Content:**
- 2-column grids where appropriate
- Reduced padding (1.5rem instead of 2rem)
- KPI strip: 2 columns instead of 4

### Desktop Features (1024px+)

**Sidebar:**
- Always visible (280px fixed width)
- Full navigation labels
- Persistent

**Header:**
- Full layout
- Search bar visible (350px width)
- All icons visible

**Content:**
- Full 3-column layouts where applicable
- Maximum width 1400px
- Generous padding (2rem)
- KPI strip: 4 columns

---

## Accessibility Standards

### WCAG 2.2 AA Compliance (Target at GA)

**Color Contrast:**
- Dark text (`#0F172A`) on white (`#FFFFFF`): 13.5:1 ✓
- Oxford Blue (`#002147`) on white: 8.5:1 ✓
- White text on dark (`#0F172A`): 13.5:1 ✓
- Semantic colors (green/amber/red) with text labels (never color alone)

**Keyboard Navigation:**
- Tab order: logical, left-to-right, top-to-bottom
- Focus indicators: visible (2px outline, Oxford Blue accent)
- Skip links: for main content
- All interactive elements keyboard-accessible

**Screen Reader Support:**
- Semantic HTML: `<button>`, `<a>`, `<nav>`, `<main>`, `<article>`, `<form>`, `<table>`
- ARIA labels: for icon-only buttons
- Form labels: associated with inputs via `<label for="id">`
- Alt text: for images (descriptive)
- Table headers: `<th scope="col">` and `<th scope="row">`

**Motion & Animation:**
- Respect `prefers-reduced-motion` media query
- Animations not essential to understanding content
- No flashing content (>3 per second)

**Zoom & Magnification:**
- Tabular numerics readable at 200% zoom
- No horizontal scrolling at 200% zoom
- Reflow text at 200% zoom

---

## Implementation Checklist

### Phase 1: Foundation Setup (Week 1)

- [ ] Project structure created
- [ ] CSS variables defined (colors, spacing, typography)
- [ ] Global styles applied (base, headings, links, tables)
- [ ] Inter font imported from Google Fonts
- [ ] Button component created (primary, secondary, danger)
- [ ] Card component created (standard, metric)
- [ ] Badge/pill component created
- [ ] Input component created
- [ ] Table component created with tabular numerics

### Phase 2: Navigation Components (Week 1-2)

- [ ] Sidebar component created
  - [ ] Logo section
  - [ ] Navigation items (8 main sections)
  - [ ] Settings section
  - [ ] User profile card
  - [ ] Mobile hamburger menu toggle
- [ ] Header component created
  - [ ] Welcome message section
  - [ ] Search bar
  - [ ] Notification icon with badge
  - [ ] Message icon
  - [ ] More options menu
  - [ ] User profile section
- [ ] Layout component created (Sidebar + Header + Main)
- [ ] Responsive behavior tested

### Phase 3: Page Layouts (Week 2-3)

- [ ] Dashboard page created
  - [ ] KPI strip (4 metrics)
  - [ ] Watchlist headlines
  - [ ] Last 5 scenario runs
- [ ] Portfolio page created
  - [ ] Portfolio overview
  - [ ] Leases table
  - [ ] Aircraft table
  - [ ] Lessees table
  - [ ] Concentration views
- [ ] Scenarios page created
  - [ ] Scenario library (6 templates)
  - [ ] Custom builder
  - [ ] Run history
- [ ] Risk & ECL page created
  - [ ] Stage migration matrix
  - [ ] ECL by lease
  - [ ] IAS 36 impairment
  - [ ] Sensitivity analysis
  - [ ] Auditor evidence pack export
- [ ] Counterparties page created
  - [ ] Lessee profiles
  - [ ] Behavior scores
  - [ ] Restructuring simulator
- [ ] Jurisdictions page created
  - [ ] Jurisdiction profiles
  - [ ] Repossession models
  - [ ] Precedent database
  - [ ] AWG index updates
- [ ] Reports page created
  - [ ] Export formats
  - [ ] Auditor pack
  - [ ] Board pack
  - [ ] Scheduled reports
- [ ] Settings page created
  - [ ] Tenant settings
  - [ ] Users & RBAC
  - [ ] Data sources
  - [ ] Model parameters
  - [ ] Audit log

### Phase 4: Data Visualization (Week 3)

- [ ] Line/area chart component created
- [ ] Bar chart component created
- [ ] Pie/donut chart component created
- [ ] Waterfall chart component created
- [ ] Heatmap component created
- [ ] Chart color palette applied
- [ ] Legend and tooltip components created

### Phase 5: Interactions & Polish (Week 3-4)

- [ ] Hover effects added to buttons and cards
- [ ] Loading states implemented (skeleton, spinner)
- [ ] Transitions and animations added (≤200ms)
- [ ] Form validation feedback added
- [ ] Error states designed and implemented
- [ ] Success states designed and implemented

### Phase 6: Responsive Design (Week 4)

- [ ] Mobile layout tested (<640px)
  - [ ] Hamburger menu working
  - [ ] Single column layout
  - [ ] Touch-friendly tap targets (44px minimum)
- [ ] Tablet layout tested (640px-1024px)
  - [ ] Collapsible sidebar
  - [ ] 2-column grids
- [ ] Desktop layout tested (1024px+)
  - [ ] Full 3-column layouts
  - [ ] Maximum width 1400px
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)

### Phase 7: Accessibility (Week 4)

- [ ] WCAG 2.2 AA audit completed
- [ ] Color contrast verified
- [ ] Keyboard navigation tested
- [ ] Screen reader tested (NVDA, JAWS)
- [ ] Focus indicators visible
- [ ] Semantic HTML verified
- [ ] ARIA labels added
- [ ] Form labels associated with inputs
- [ ] Alt text added to images
- [ ] Zoom to 200% tested
- [ ] `prefers-reduced-motion` respected

### Phase 8: Testing & Refinement (Week 4-5)

- [ ] Performance testing (p95 load <2.5s, dashboard <1.5s)
- [ ] Scenario run performance (<5s deterministic, <60s Monte Carlo)
- [ ] Cross-browser compatibility verified
- [ ] User testing with pilot customers
- [ ] Feedback incorporated
- [ ] Design decisions documented

---

## Design Tokens Quick Reference

```css
/* Primary Colors */
--color-primary: #002147;
--text-primary: #0F172A;
--bg-primary: #FFFFFF;

/* Semantic Colors */
--color-success: #15803D;
--color-warning: #B45309;
--color-danger: #B91C1C;

/* Spacing */
--spacing-lg: 1rem;
--spacing-xl: 1.5rem;
--spacing-2xl: 2rem;

/* Typography */
--font-family: 'Inter', 'Manrope', sans-serif;
--font-size-body: 1rem;
--font-size-label: 0.75rem;

/* Layout */
--sidebar-width: 280px;
--header-height: 64px;
--main-max-width: 1400px;

/* Shadows */
--shadow-md: 0 1px 3px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 2px 4px rgba(0, 0, 0, 0.06);
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | March 2026 | Initial design system for Aeroinsights MVP with all 12 features |

---

**Design Lead:** Product & Design Team  
**Last Review:** March 2026  
**Next Review:** June 2026  
**Compliance:** WCAG 2.2 AA, PRD §6 institutional restraint, Knowvio layout, SkyLift aesthetic

---

## Additional Resources

- **Font:** [Inter - Google Fonts](https://fonts.google.com/specimen/Inter)
- **Color Tool:** [Coolors.co](https://coolors.co/)
- **Accessibility:** [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- **Charts:** Recharts or Chart.js with custom color palette
- **Icons:** Emoji or Lucide React
- **PRD Reference:** PRD_Aeroinsights_v0.3.md §6 (Design Principles)
