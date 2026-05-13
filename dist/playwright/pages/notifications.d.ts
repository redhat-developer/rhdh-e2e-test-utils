import { type Page } from "@playwright/test";
export declare class NotificationPage {
    private readonly page;
    private readonly uiHelper;
    constructor(page: Page);
    clickNotificationsNavBarItem(): Promise<void>;
    notificationContains(text: string | RegExp): Promise<void>;
    clickNotificationHeadingLink(text: string | RegExp): Promise<void>;
    markAllNotificationsAsRead(): Promise<void>;
    selectAllNotifications(): Promise<void>;
    selectNotification(nth?: number): Promise<void>;
    selectSeverity(severity?: string): Promise<void>;
    saveSelected(): Promise<void>;
    saveAllSelected(): Promise<void>;
    viewSaved(): Promise<void>;
    markLastNotificationAsRead(): Promise<void>;
    markNotificationAsRead(text: string): Promise<void>;
    markLastNotificationAsUnRead(): Promise<void>;
    viewRead(): Promise<void>;
    viewUnRead(): Promise<void>;
    sortByOldestOnTop(): Promise<void>;
    sortByNewestOnTop(): Promise<void>;
}
//# sourceMappingURL=notifications.d.ts.map