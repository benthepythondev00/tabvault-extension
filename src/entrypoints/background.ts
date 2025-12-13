import { 
  sessionOperations, 
  backupOperations,
  workspaceOperations,
  settingsOperations, 
  statsOperations,
  exportData,
  importData,
} from '../lib/storage';
import { startPaymentBackgroundListener, onPaymentStatusChange } from '../lib/payment';

export default defineBackground(() => {
  console.log('TabVault background script loaded');

  // Start ExtensionPay background listener
  startPaymentBackgroundListener();

  // Listen for payment status changes and sync to settings
  onPaymentStatusChange(async (user) => {
    if (user.paid) {
      await settingsOperations.update({ isPro: true });
      console.log('TabVault: User upgraded to Pro!');
    }
  });

  // Auto-backup timer
  let autoBackupInterval: ReturnType<typeof setInterval> | null = null;

  async function setupAutoBackup() {
    const settings = await settingsOperations.get();
    
    // Clear existing interval
    if (autoBackupInterval) {
      clearInterval(autoBackupInterval);
      autoBackupInterval = null;
    }
    
    if (settings.autoBackupEnabled && settings.isPro) {
      const intervalMs = settings.autoBackupIntervalMinutes * 60 * 1000;
      
      autoBackupInterval = setInterval(async () => {
        console.log('TabVault: Running auto-backup...');
        const sessions = await sessionOperations.getAll();
        
        for (const session of sessions) {
          if (session.isTracking) {
            // Update tracking sessions with current state
            await sessionOperations.updateContent(session.id);
          } else {
            // Create backup for all sessions
            await backupOperations.create(session, 'auto');
          }
        }
      }, intervalMs);
      
      console.log(`TabVault: Auto-backup enabled every ${settings.autoBackupIntervalMinutes} minutes`);
    }
  }

  // Initialize auto-backup
  setupAutoBackup();

  // Handle messages from popup
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // Keep channel open for async response
  });

  async function handleMessage(message: { type: string; payload?: unknown }) {
    switch (message.type) {
      // Session operations
      case 'GET_SESSIONS':
        return await sessionOperations.getAll();
      
      case 'GET_SESSION':
        return await sessionOperations.getById((message.payload as { id: string }).id);
      
      case 'CREATE_SESSION': {
        const payload = message.payload as { name: string; color?: string; tags?: string[]; workspace?: string };
        return await sessionOperations.create(payload.name, {
          color: payload.color as Parameters<typeof sessionOperations.create>[1]['color'],
          tags: payload.tags,
          workspace: payload.workspace,
        });
      }
      
      case 'UPDATE_SESSION': {
        const payload = message.payload as { id: string; updates: Parameters<typeof sessionOperations.update>[1] };
        return await sessionOperations.update(payload.id, payload.updates);
      }
      
      case 'UPDATE_SESSION_CONTENT': {
        const payload = message.payload as { id: string };
        return await sessionOperations.updateContent(payload.id);
      }
      
      case 'DELETE_SESSION': {
        const payload = message.payload as { id: string };
        await sessionOperations.delete(payload.id);
        return { success: true };
      }
      
      case 'RESTORE_SESSION': {
        const payload = message.payload as { 
          id: string; 
          closeCurrentTabs?: boolean;
          restoreTabGroups?: boolean;
          restoreWindowPositions?: boolean;
        };
        return await sessionOperations.restore(payload.id, {
          closeCurrentTabs: payload.closeCurrentTabs,
          restoreTabGroups: payload.restoreTabGroups,
          restoreWindowPositions: payload.restoreWindowPositions,
        });
      }
      
      case 'DUPLICATE_SESSION': {
        const payload = message.payload as { id: string };
        return await sessionOperations.duplicate(payload.id);
      }
      
      case 'REORDER_SESSIONS': {
        const payload = message.payload as { sessionIds: string[] };
        await sessionOperations.reorder(payload.sessionIds);
        return { success: true };
      }
      
      case 'SEARCH_SESSIONS': {
        const payload = message.payload as { query: string };
        return await sessionOperations.search(payload.query);
      }
      
      case 'CAN_ADD_SESSION':
        return await sessionOperations.canAdd();
      
      // Backup operations
      case 'GET_BACKUPS':
        return await backupOperations.getAll();
      
      case 'GET_SESSION_BACKUPS': {
        const payload = message.payload as { sessionId: string };
        return await backupOperations.getForSession(payload.sessionId);
      }
      
      case 'CREATE_BACKUP': {
        const payload = message.payload as { sessionId: string };
        const session = await sessionOperations.getById(payload.sessionId);
        if (session) {
          return await backupOperations.create(session, 'manual');
        }
        return { error: 'Session not found' };
      }
      
      case 'RESTORE_FROM_BACKUP': {
        const payload = message.payload as { backupId: string };
        return await backupOperations.restoreFromBackup(payload.backupId);
      }
      
      case 'DELETE_BACKUP': {
        const payload = message.payload as { id: string };
        await backupOperations.delete(payload.id);
        return { success: true };
      }
      
      // Workspace operations (Pro)
      case 'GET_WORKSPACES':
        return await workspaceOperations.getAll();
      
      case 'CREATE_WORKSPACE': {
        const payload = message.payload as { name: string; color?: string };
        return await workspaceOperations.create(
          payload.name, 
          payload.color as Parameters<typeof workspaceOperations.create>[1]
        );
      }
      
      case 'UPDATE_WORKSPACE': {
        const payload = message.payload as { id: string; updates: Parameters<typeof workspaceOperations.update>[1] };
        return await workspaceOperations.update(payload.id, payload.updates);
      }
      
      case 'DELETE_WORKSPACE': {
        const payload = message.payload as { id: string };
        await workspaceOperations.delete(payload.id);
        return { success: true };
      }
      
      case 'ADD_SESSION_TO_WORKSPACE': {
        const payload = message.payload as { workspaceId: string; sessionId: string };
        await workspaceOperations.addSession(payload.workspaceId, payload.sessionId);
        return { success: true };
      }
      
      case 'REMOVE_SESSION_FROM_WORKSPACE': {
        const payload = message.payload as { workspaceId: string; sessionId: string };
        await workspaceOperations.removeSession(payload.workspaceId, payload.sessionId);
        return { success: true };
      }
      
      // Settings operations
      case 'GET_SETTINGS':
        return await settingsOperations.get();
      
      case 'UPDATE_SETTINGS': {
        const result = await settingsOperations.update(message.payload as Parameters<typeof settingsOperations.update>[0]);
        // Re-setup auto-backup if settings changed
        setupAutoBackup();
        return result;
      }
      
      case 'RESET_SETTINGS':
        return await settingsOperations.reset();
      
      // Stats operations
      case 'GET_TODAY_STATS':
        return await statsOperations.getTodayStats();
      
      case 'GET_ALL_STATS':
        return await statsOperations.getAllStats();
      
      // Export/Import
      case 'EXPORT_DATA':
        return await exportData();
      
      case 'IMPORT_DATA':
        await importData(message.payload as Parameters<typeof importData>[0]);
        return { success: true };
      
      // Capture current windows (for preview)
      case 'CAPTURE_CURRENT_WINDOWS':
        return await sessionOperations.captureCurrentWindows();
      
      default:
        return { error: 'Unknown message type' };
    }
  }

  // Update badge with session count
  async function updateBadge() {
    const sessions = await sessionOperations.getAll();
    const count = sessions.length;
    
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#14b8a6' }); // Teal
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }

  // Initialize badge on load
  updateBadge();

  // Listen for tab changes to update tracking sessions
  chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      // Update any tracking sessions
      const sessions = await sessionOperations.getAll();
      for (const session of sessions) {
        if (session.isTracking) {
          await sessionOperations.updateContent(session.id);
        }
      }
    }
  });

  // Update badge when sessions change
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['local:sessions']) {
      updateBadge();
    }
  });
});
