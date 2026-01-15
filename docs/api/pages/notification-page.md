# NotificationPage API

Page object for the RHDH notifications page.

## Import

```typescript
import { NotificationPage } from "rhdh-e2e-test-utils/pages";
```

## Constructor

```typescript
new NotificationPage(page: Page)
```

Creates a new NotificationPage instance with an internal `UIhelper`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `Page` | Playwright Page object |

## Methods

### Navigation

#### `clickNotificationsNavBarItem()`

```typescript
async clickNotificationsNavBarItem(): Promise<void>
```

Navigate to the notifications page via the sidebar and wait for it to load.

### Notification Selection

#### `selectAllNotifications()`

```typescript
async selectAllNotifications(): Promise<void>
```

Select all notifications using the header checkbox.

#### `selectNotification(nth?)`

```typescript
async selectNotification(nth?: number): Promise<void>
```

Select a specific notification by index.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `nth` | `number` | `1` | Zero-based index of the notification to select |

### Notification Content

#### `notificationContains(text)`

```typescript
async notificationContains(text: string | RegExp): Promise<void>
```

Verify a notification contains specific text. Automatically expands the table to show 20 rows.

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string \| RegExp` | Text or pattern to find |

**Example:**
```typescript
await notificationPage.notificationContains("Build completed");
await notificationPage.notificationContains(/Pipeline.*succeeded/);
```

#### `clickNotificationHeadingLink(text)`

```typescript
async clickNotificationHeadingLink(text: string | RegExp): Promise<void>
```

Click on a notification heading link.

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string \| RegExp` | Notification heading text to click |

### Mark as Read/Unread

#### `markAllNotificationsAsRead()`

```typescript
async markAllNotificationsAsRead(): Promise<void>
```

Mark all notifications as read. If no notifications exist, does nothing.

#### `markLastNotificationAsRead()`

```typescript
async markLastNotificationAsRead(): Promise<void>
```

Mark the most recent notification as read.

#### `markNotificationAsRead(text)`

```typescript
async markNotificationAsRead(text: string): Promise<void>
```

Mark a specific notification as read by its text content.

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text to identify the notification |

#### `markLastNotificationAsUnRead()`

```typescript
async markLastNotificationAsUnRead(): Promise<void>
```

Mark the most recent notification as unread.

### Save for Later

#### `saveSelected()`

```typescript
async saveSelected(): Promise<void>
```

Save the currently selected notification for later.

#### `saveAllSelected()`

```typescript
async saveAllSelected(): Promise<void>
```

Save all selected notifications for later.

### Filtering and Views

#### `selectSeverity(severity?)`

```typescript
async selectSeverity(severity?: string): Promise<void>
```

Filter notifications by severity.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `severity` | `string` | `""` | Severity level (e.g., "critical", "high", "normal") |

#### `viewSaved()`

```typescript
async viewSaved(): Promise<void>
```

Switch to viewing saved notifications.

#### `viewRead()`

```typescript
async viewRead(): Promise<void>
```

Switch to viewing read notifications.

#### `viewUnRead()`

```typescript
async viewUnRead(): Promise<void>
```

Switch to viewing unread notifications.

### Sorting

#### `sortByOldestOnTop()`

```typescript
async sortByOldestOnTop(): Promise<void>
```

Sort notifications with oldest first.

#### `sortByNewestOnTop()`

```typescript
async sortByNewestOnTop(): Promise<void>
```

Sort notifications with newest first (default).

## Complete Example

```typescript
import { test, expect } from "@playwright/test";
import { NotificationPage } from "rhdh-e2e-test-utils/pages";

test("manage notifications", async ({ page }) => {
  const notificationPage = new NotificationPage(page);

  // Navigate to notifications
  await notificationPage.clickNotificationsNavBarItem();

  // Check for a specific notification
  await notificationPage.notificationContains("Build completed successfully");

  // Filter by severity
  await notificationPage.selectSeverity("high");

  // Select and mark as read
  await notificationPage.selectNotification(0);
  await notificationPage.markLastNotificationAsRead();

  // Save important notifications
  await notificationPage.selectAllNotifications();
  await notificationPage.saveAllSelected();

  // View saved notifications
  await notificationPage.viewSaved();

  // Sort by oldest
  await notificationPage.sortByOldestOnTop();
});

test("clear all notifications", async ({ page }) => {
  const notificationPage = new NotificationPage(page);

  await notificationPage.clickNotificationsNavBarItem();
  await notificationPage.markAllNotificationsAsRead();
});
```

## Related Pages

- [NotificationPage Guide](/guide/page-objects/notification-page.md) - Detailed usage guide
