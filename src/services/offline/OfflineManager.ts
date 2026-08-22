export interface OfflineDraft {
  id: string;
  timestamp: string;
  type: 'INCIDENT_UPDATE' | 'MEDIA_ATTACHMENT' | 'RESOURCE_DISPATCH';
  payload: Record<string, any>;
}

export class OfflineManagerService {
  private static instance: OfflineManagerService;
  private isOnline: boolean = navigator.onLine;
  private draftQueue: OfflineDraft[] = [];
  private listeners: ((online: boolean) => void)[] = [];

  private constructor() {
    this.loadQueueFromStorage();
    window.addEventListener('online', () => this.handleStatusChange(true));
    window.addEventListener('offline', () => this.handleStatusChange(false));
  }

  public static getInstance(): OfflineManagerService {
    if (!OfflineManagerService.instance) {
      OfflineManagerService.instance = new OfflineManagerService();
    }
    return OfflineManagerService.instance;
  }

  public subscribe(callback: (online: boolean) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public getPendingDrafts(): OfflineDraft[] {
    return this.draftQueue;
  }

  public queueDraft(type: OfflineDraft['type'], payload: Record<string, any>): void {
    const draft: OfflineDraft = {
      id: `draft-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type,
      payload,
    };

    this.draftQueue.push(draft);
    this.saveQueueToStorage();

    if (this.isOnline) {
      this.syncPendingDrafts();
    }
  }

  private handleStatusChange(online: boolean): void {
    this.isOnline = online;
    console.log(`[OfflineManager] Network status changed to: ${online ? 'ONLINE' : 'OFFLINE'}`);

    if (online) {
      this.syncPendingDrafts();
    }

    this.listeners.forEach((fn) => fn(online));
  }

  public async syncPendingDrafts(): Promise<void> {
    if (this.draftQueue.length === 0) return;

    console.log(`[OfflineManager] Syncing ${this.draftQueue.length} pending offline drafts to backend...`);
    try {
      const res = await fetch('/api/offline/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drafts: this.draftQueue }),
      });
      const json = await res.json();
      if (json.success) {
        console.log(`[OfflineManager] Sync completed successfully: ${json.processedCount} drafts synced at ${json.syncedTimestamp}.`);
        this.draftQueue = [];
        localStorage.removeItem('arka_offline_drafts');
      }
    } catch (err) {
      console.warn('[OfflineManager] Failed to sync offline drafts, will retry on next connection change.', err);
    }
  }

  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem('arka_offline_drafts');
      if (stored) {
        this.draftQueue = JSON.parse(stored);
      }
    } catch (e) {
      this.draftQueue = [];
    }
  }

  private saveQueueToStorage(): void {
    try {
      localStorage.setItem('arka_offline_drafts', JSON.stringify(this.draftQueue));
    } catch (e) {
      console.warn('Failed to save offline drafts to localStorage');
    }
  }
}

export const offlineManager = OfflineManagerService.getInstance();
