# UI Design System Audit Report
**Project**: ERP Desdobra  
**Date**: December 26, 2025  
**Status**: READ-ONLY AUDIT (No modifications made)

---

## A) Component Inventory

### Base UI Components (`/components/ui/`)
**Total**: 30 component files

#### Core Components (Well-Defined)
| Component | Path | Notes |
|-----------|------|-------|
| Card | `/components/ui/Card.tsx` | ✅ Uses `glass` effect, `rounded-2xl`, compact structure |
| Button | `/components/ui/Button.tsx` | ✅ CVA variants (primary, secondary, ghost, danger, outline), sizes  |
| Input | `/components/ui/Input.tsx` | ✅ `rounded-2xl`, `shadow-sm`, error states |
| Select | `/components/ui/Select.tsx` | ✅ `rounded-2xl`, `shadow-sm`, custom chevron |
| Alert | `/components/ui/Alert.tsx` | ✅ Present |
| Dialog | `/components/ui/Dialog.tsx` | ✅ Radix-based, arbitrary positioning values |
| PageHeader | `/components/ui/PageHeader.tsx` | ✅ Present |
| Tabs | `/components/ui/Tabs.tsx` | ✅ Radix-based |
| Modal | `/components/ui/Modal.tsx` | ✅ Present |
| Sheet | `/components/ui/Sheet.tsx` | ✅ Radix-based |
| Tooltip | `/components/ui/Tooltip.tsx` | ✅ Present |

#### Supporting Components
- `DecimalInput.tsx` - Custom decimal number input
- `FormTabs.tsx`, `FormTabsList.tsx` - Form-specific tab variants
- `FieldError.tsx`, `FormErrorSummary.tsx` - Validation feedback
- `Label.tsx`, `Textarea.tsx`, `Switch.tsx`
- `DataTable.tsx` - Data table wrapper
- `DropdownMenu.tsx`, `CommandPalette.tsx`
- `alert-dialog.tsx`, `calendar.tsx`, `popover.tsx`, `separator.tsx`
- `select-shadcn.tsx` - Alternate select component
- `use-toast.tsx` - Toast hook
- `ConfirmDialogDesdobra.tsx` - Custom confirmation dialog
- `RoleBadge.tsx`, `Logo.tsx`

### Missing/Opportunity Components
- **Toast/Notification** - Only hook exists, no visual component
- **Table** - `DataTable.tsx` exists but may benefit from standardization
- **Badge** - Custom badges scattered (see RoleBadge)
- **Skeleton** - No loading skeleton component
- **Avatar** - No avatar component
- **Breadcrumb** - No breadcrumb component

---

## B) Inconsistency Report

### 1. Shadow Usage Outside Base Components
**Count**: 8 occurrences in `/app` directory  
**Pattern**: `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`

**Examples**:
```
/app/app/cadastros/produtos/page.tsx:160
  className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm"

/app/app/configuracoes/conta/page.tsx:128
  "fixed top-24 right-6 z-50 p-4 rounded-md ... shadow-lg ..."

/app/app/settings/company/page.tsx:479
  className="... shadow-sm hover:shadow-md transition-all ..."

/app/app/settings/master-data/page.tsx:50
  <Card className="hover:shadow-lg transition-shadow">
```

**Impact**: Medium - Shadows applied inconsistently outside Card component

---

### 2. Rounded Values Outside Base Components
**Count**: 138+ occurrences in `/components` directory  
**Patterns**: `rounded-lg`, `rounded-md`, `rounded-xl`, `rounded-2xl`, `rounded-full`

**Examples** (Sample of 10):
```
/components/crm/DealCard.tsx:26
  'p-3 bg-white rounded-lg border shadow-sm ...'

/components/expedicao/RouteDetails.tsx:22
  "bg-white border border-gray-200 rounded-lg p-12 ..."

/components/sales/SalesTable.tsx:36
  "bg-white border border-gray-200 rounded-lg overflow-hidden"

/components/sales/SalesFilters.tsx:185
  "... rounded-2xl border-gray-200 bg-white h-10 shadow-sm"

/components/app/Sidebar.tsx:177
  "... rounded-r-xl border-r-2 ..."

/components/app/CompanySelector.tsx:97
  "... rounded-xl border border-gray-200 shadow-xl ..."

/components/app/ProductSelector.tsx:142
  "... rounded-xl border border-gray-100 bg-white ... shadow-xl"
```

**Impact**: HIGH - Extreme inconsistency, no clear pattern for border radius usage

---

### 3. Hardcoded Colors (Hex/RGBA)
**Count**: 0 direct instances found  
**Status**: ✅ GOOD - No hardcoded hex colors (`bg-[#...]`, `text-[#...]`)  
**Note**: All colors use Tailwind utility classes (bg-white, text-gray-500, etc.)

---

### 4. Inline Styles `style={...}`
**Count**: 3 occurrences  
**Location**: Flyout panel components

**Examples**:
```
/components/app/ConfiguracoesFlyoutPanel.tsx:152
/components/app/VendasFlyoutPanel.tsx:148
/components/app/CadastrosFlyoutPanel.tsx:242
```

**Pattern**: Likely positioning calculations for flyout panels  
**Impact**: Low - Isolated to specific dynamic positioning needs

---

### 5. Arbitrary Tailwind Values
**Count**: Multiple in dialog positioning  
**Patterns**: `left-[50%]`, `top-[50%]`, `top-[20%]`, `top-[48%]`, `translate-x-[-50%]`, `translate-y-[-50%]`

**Examples**:
```
/components/ui/Dialog.tsx:41
  "fixed left-[50%] top-[50%] ... translate-x-[-50%] translate-y-[-50%] ..."

/components/ui/CommandPalette.tsx:36
  "fixed left-[50%] top-[20%] ... translate-x-[-50%] ..."

/components/ui/alert-dialog.tsx:39
  "fixed left-[50%] top-[50%] ... translate-x-[-50%] translate-y-[-50%] ..."
```

**Impact**: Low - Standard Radix UI centering pattern, acceptable use case

---

## C) Theme & Tokens Analysis

### Current Theme Location: `app/globals.css`

#### CSS Custom Properties (@theme)
```css
@theme {
  /* Brand Colors (Sky Blue palette) */
  --color-brand-50: #f0f9ff;
  --color-brand-100: #e0f2fe;
  --color-brand-200: #bae6fd;
  --color-brand-300: #7dd3fc;
  --color-brand-400: #38bdf8;
  --color-brand-500: #0ea5e9;  /* Primary */
  --color-brand-600: #0284c7;
  --color-brand-700: #0369a1;
  --color-brand-800: #075985;
  --color-brand-900: #0c4a6e;

  /* Surface Colors (Glassmorphism) */
  --color-background: #F2F2F7;  /* iOS Light Gray */
  --color-surface: rgba(255, 255, 255, 0.75);
  --color-surface-hover: rgba(255, 255, 255, 0.9);

  /* Border Radius */
  --radius-ios: 14px;
}
```

#### :root Variables
```css
:root {
  --background: #F2F2F7;
  --foreground: #1D1D1F;
}
```

#### Custom CSS Classes
- `.glass` - Glassmorphism effect (backdrop-filter, rgba background)
- `.glass-dark` - Dark variant
- `.scrollbar-thin` - Custom scrollbar styling
- `.no-spinners` - Remove number input arrows

### Tailwind Config
**Status**: ❌ NOT FOUND in root directory  
**Note**: Using Tailwind CSS v4 `@theme` directive in globals.css instead of traditional config file

### ThemeProvider
**Status**: ❓ NOT EXPLICITLY IDENTIFIED  
**Note**: No React context-based theme provider found; relies on CSS variables

---

## D) Single Source of Truth (SSOT) Proposal

### Goal
Create a centralized design token system and enforce component-based styling to eliminate hardcoded utilities across the codebase.

### Proposed Structure

#### 1. Design Tokens (`/lib/design-tokens.ts`)
**Purpose**: Single source for all design values  
**Content**:
```typescript
export const designTokens = {
  colors: {
    brand: {
      50: 'brand-50',
      100: 'brand-100',
      // ... (reference CSS variables)
      primary: 'brand-600',
    },
    surface: {
      base: 'white',
      glass: 'surface',
      background: 'background',
    },
    semantic: {
      success: 'green-500',
      error: 'red-500',
      warning: 'amber-500',
      info: 'blue-500',
    }
  },
  radius: {
    sm: 'rounded-md',    // 6px
    md: 'rounded-lg',    // 8px
    lg: 'rounded-xl',    // 12px
    xl: 'rounded-2xl',   // 16px (primary for cards/inputs)
    full: 'rounded-full',
  },
  shadow: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    card: 'shadow-sm',  // default card shadow
  },
  spacing: {
    card: 'p-6',
    cardHeader: 'p-6',
    cardContent: 'p-6 pt-0',
  }
}
```

#### 2. Component Standardization Order
**Priority 1** (Must Fix - High Impact):
1. Card variants (default already uses `glass + rounded-2xl + shadow-sm`)
2. Container/Wrapper patterns (enforce rounded-lg/rounded-xl consistently)
3. Button (already good, uses CVA)
4. Input/Select (already use rounded-2xl)

**Priority 2** (Should Fix - Medium Impact):
5. Badge component (create standardized component from scattered usages)
6. Table/DataTable rows
7. Modal/Dialog containers

**Priority 3** (Nice to Have):
8. Hover state shadows
9. Border radius for small elements (badges, tags)

#### 3. Migration Steps

**STEP 1**: Create Token File
- File: `/lib/design-tokens.ts`
- Define all tokens as shown above
- Export const object

**STEP 2**: Update Base Components
- Refactor `/components/ui/Card.tsx` to accept variant prop:
  ```typescript
  variant?: 'default' | 'flat' | 'elevated'
  ```
- Add shadow variants to Card
- Standardize rounded values across Input, Select, Button (already consistent)

**STEP 3**: Create Missing Components
- `/components/ui/Badge.tsx` - Standardized badge
- `/components/ui/Container.tsx` - Standard content wrapper
- `/components/ui/Skeleton.tsx` - Loading states

**STEP 4**: File-by-File Refactor (suggested priority):
1. `/app/app/cadastros/*` pages
2. `/components/sales/*`
3. `/components/expedicao/*`
4. `/components/crm/*`
5. `/components/app/*` (Sidebar, selectors)

**STEP 5**: Create Storybook/Documentation
- Document all components with variants
- Create visual design token reference

**STEP 6**: Enforce via Lint Rules (see Section E)

#### 4. Files to Create/Modify

**New Files**:
- `/lib/design-tokens.ts` - Central token export
- `/components/ui/Badge.tsx` - Standardized badge component
- `/components/ui/Container.tsx` - Wrapper component
- `/components/ui/Skeleton.tsx` - Loading skeleton
- `/.eslintrc-design-system.json` - Custom lint rules

**Files to Modify**:
- `/components/ui/Card.tsx` - Add variant support
- `/components/ui/Button.tsx` - Already good, minor tweaks if needed
- All 138+ files with `rounded-*` usage (see Section B.2)
- All 8 files with `shadow-*` usage outside base components (see Section B.1)

---

## E) Lint Rules Checklist

### ESLint Custom Rules

#### Rule 1: No Hardcoded Shadows
```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "JSXAttribute[name.name='className'] Literal[value=/shadow-/]",
        "message": "Direct shadow-* usage forbidden outside /components/ui/. Use Card component or design tokens."
      }
    ]
  }
}
```

#### Rule 2: No Arbitrary Rounded Values
```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "JSXAttribute[name.name='className'] Literal[value=/rounded-(?!full|2xl|xl|lg|md|sm)/]",
        "message": "Use standardized rounded values from design tokens (sm|md|lg|xl|2xl|full)."
      }
    ]
  }
}
```

#### Rule 3: No Inline Styles (Exceptions Allowed)
```json
{
  "rules": {
    "react/forbid-dom-props": [
      "error",
      {
        "forbid": [
          {
            "propName": "style",
            "message": "Inline styles forbidden. Use Tailwind or design tokens. Exceptions: dynamic calculations only in flyout panels."
          }
        ]
      }
    ]
  }
}
```

#### Rule 4: No Hardcoded Hex Colors
```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "JSXAttribute[name.name='className'] Literal[value=/#[0-9A-Fa-f]{3,6}/]",
        "message": "Hardcoded hex colors forbidden. Use Tailwind color utilities or design tokens."
      }
    ]
  }
}
```

#### Rule 5: Enforce Component Usage for Common Patterns
```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "JSXElement[openingElement.name.name='div'][openingElement.attributes//Literal[value=/bg-white.*rounded-.*border/]]",
        "message": "Use <Card> component instead of manual div + bg-white + rounded + border."
      }
    ]
  }
}
```

### Stylelint Rules (if using CSS)
```json
{
  "rules": {
    "declaration-no-important": true,
    "color-no-hex": true,
    "selector-class-pattern": "^[a-z][a-zA-Z0-9]*$"
  }
}
```

### Pre-commit Hook
```bash
#!/bin/bash
# Check for hardcoded styles
if git diff --cached --name-only | grep -E '\.tsx$'; then
  echo "Checking for design system violations..."
  npm run lint:design-system || {
    echo "❌ Design system violations detected. Fix before commit."
    exit 1
  }
fi
```

### VSCode Settings (Recommended)
```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

---

## Summary

### Strengths ✅
1. **30 well-organized base components** in `/components/ui/`
2. **No hardcoded hex colors** - all use Tailwind utilities
3. **CSS custom properties** defined in globals.css with brand colors
4. **CVA-based variants** in Button component
5. **Minimal inline styles** (only 3 instances for dynamic positioning)

### Weaknesses ❌
1. **138+ inconsistent rounded-* usages** - No clear standard
2. **Shadow usage outside base components** - 8 occurrences in /app
3. **No Tailwind config file** (using v4 @theme instead)
4. **Missing components**: Badge, Skeleton, Avatar, Breadcrumb
5. **No lint rules enforcing design system**

### Recommended Next Steps
1. **Immediate**: Create `/lib/design-tokens.ts`
2. **Week 1**: Add Badge, Container, Skeleton components
3. **Week 2-3**: Refactor high-traffic pages (cadastros, sales)
4. **Week 4**: Implement ESLint rules
5. **Ongoing**: Gradual migration guided by lint warnings

---

**Report Generated**: 2025-12-26  
**Audit Completed By**: Design System Analysis Agent  
**Status**: No modifications made (read-only audit)
