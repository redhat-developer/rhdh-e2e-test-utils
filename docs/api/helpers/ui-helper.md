# UIhelper API

UI interaction helper for Material-UI components.

## Import

```typescript
import { UIhelper } from "rhdh-e2e-test-utils/helpers";
```

## Constructor

```typescript
new UIhelper(page: Page)
```

## Methods

### Wait Operations

#### `waitForLoad()`
```typescript
async waitForLoad(timeout?: number): Promise<void>
```
Wait for page to fully load.

### Verification Methods

#### `verifyHeading()`
```typescript
async verifyHeading(heading: string | RegExp, timeout?: number): Promise<void>
```

#### `verifyText()`
```typescript
async verifyText(text: string | RegExp, timeout?: number): Promise<void>
```

#### `verifyLink()`
```typescript
async verifyLink(link: string | RegExp): Promise<void>
```

### Button Interactions

#### `clickButton()`
```typescript
async clickButton(
  label: string | RegExp,
  options?: { exact?: boolean; force?: boolean }
): Promise<Locator>
```

#### `clickButtonByLabel()`
```typescript
async clickButtonByLabel(
  label: string,
  options?: { force?: boolean }
): Promise<void>
```

#### `clickButtonByText()`
```typescript
async clickButtonByText(text: string): Promise<void>
```

### Navigation

#### `openSidebar()`
```typescript
async openSidebar(navBarText: SidebarTabs): Promise<void>
```
`SidebarTabs`: `"Home"` | `"Catalog"` | `"APIs"` | `"Docs"` | `"Learning Paths"` | `"Tech Radar"` | `"Create..."` | `"Settings"`

#### `openCatalogSidebar()`
```typescript
async openCatalogSidebar(navBarText: string): Promise<void>
```

#### `clickTab()`
```typescript
async clickTab(tabName: string): Promise<void>
```

### Table Operations

#### `verifyRowsInTable()`
```typescript
async verifyRowsInTable(
  rowTexts: (string | RegExp)[],
  exact?: boolean
): Promise<void>
```

#### `verifyCellsInTable()`
```typescript
async verifyCellsInTable(cellTexts: (string | RegExp)[]): Promise<void>
```

#### `verifyRowInTableByUniqueText()`
```typescript
async verifyRowInTableByUniqueText(
  uniqueRowText: string,
  cellTexts: string[]
): Promise<void>
```

#### `verifyRowNotInTable()`
```typescript
async verifyRowNotInTable(rowText: string): Promise<void>
```

### Form Interactions

#### `fillTextInputByLabel()`
```typescript
async fillTextInputByLabel(label: string, value: string): Promise<void>
```

#### `clearTextInputByLabel()`
```typescript
async clearTextInputByLabel(label: string): Promise<void>
```

#### `selectMuiBox()`
```typescript
async selectMuiBox(label: string, value: string): Promise<void>
```

#### `checkCheckbox()`
```typescript
async checkCheckbox(label: string): Promise<void>
```

### Card Interactions

#### `verifyTextinCard()`
```typescript
async verifyTextinCard(cardTitle: string, text: string): Promise<void>
```

#### `verifyLinkinCard()`
```typescript
async verifyLinkinCard(cardTitle: string, linkText: string): Promise<void>
```

#### `clickBtnInCard()`
```typescript
async clickBtnInCard(cardTitle: string, buttonLabel: string): Promise<void>
```

### Search

#### `searchInputPlaceholder()`
```typescript
async searchInputPlaceholder(placeholder: string, searchText: string): Promise<void>
```

### Alert and Dialog

#### `verifyAlertContains()`
```typescript
async verifyAlertContains(text: string): Promise<void>
```

#### `closeDialog()`
```typescript
async closeDialog(): Promise<void>
```
