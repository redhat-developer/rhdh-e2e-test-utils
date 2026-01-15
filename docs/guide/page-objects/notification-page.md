# NotificationPage

The `NotificationPage` class provides methods for managing notifications in RHDH.

## Usage

```typescript
import { NotificationPage } from "rhdh-e2e-test-utils/pages";

const notificationPage = new NotificationPage(page);
```

## Methods

### `clickNotificationsNavBarItem()`

Navigate to notifications via the navbar:

```typescript
await notificationPage.clickNotificationsNavBarItem();
```

### `notificationContains(text)`

Check if a notification contains specific text:

```typescript
await notificationPage.notificationContains("Build completed");
await notificationPage.notificationContains("Entity updated");
```

### `markAllNotificationsAsRead()`

Mark all notifications as read:

```typescript
await notificationPage.markAllNotificationsAsRead();
```

### `selectSeverity(severity)`

Filter notifications by severity:

```typescript
await notificationPage.selectSeverity("critical");
await notificationPage.selectSeverity("high");
await notificationPage.selectSeverity("normal");
await notificationPage.selectSeverity("low");
```

### `viewSaved()`

View saved/bookmarked notifications:

```typescript
await notificationPage.viewSaved();
```

### `viewAll()`

View all notifications:

```typescript
await notificationPage.viewAll();
```

### `sortByNewestOnTop()`

Sort notifications with newest first:

```typescript
await notificationPage.sortByNewestOnTop();
```

### `sortByOldestOnTop()`

Sort notifications with oldest first:

```typescript
await notificationPage.sortByOldestOnTop();
```

### `saveNotification(index)`

Save/bookmark a notification:

```typescript
await notificationPage.saveNotification(0); // Save first notification
```

### `deleteNotification(index)`

Delete a notification:

```typescript
await notificationPage.deleteNotification(0); // Delete first notification
```

## Complete Example

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { NotificationPage } from "rhdh-e2e-test-utils/pages";

test("manage notifications", async ({ page, loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();

  const notificationPage = new NotificationPage(page);

  // Navigate to notifications
  await notificationPage.clickNotificationsNavBarItem();

  // Filter by severity
  await notificationPage.selectSeverity("critical");

  // Check for specific notification
  await notificationPage.notificationContains("Critical alert");

  // Sort by newest
  await notificationPage.sortByNewestOnTop();

  // Save important notification
  await notificationPage.saveNotification(0);

  // View saved notifications
  await notificationPage.viewSaved();

  // Mark all as read
  await notificationPage.markAllNotificationsAsRead();

  // View all again
  await notificationPage.viewAll();
});
```
