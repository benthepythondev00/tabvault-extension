import { storage } from 'wxt/utils/storage';
import type { 
  Session, 
  Backup, 
  Settings, 
  DailyStats, 
  Workspace,
  Tab,
  TabGroup,
  Window,
  SessionColor,
} from '../types/session';
import { DEFAULT_SETTINGS, generateId } from '../types/session';

// Storage keys
export const sessionsStorage = storage.defineItem<Session[]>('local:sessions', {
  fallback: [],
});

export const backupsStorage = storage.defineItem<Backup[]>('local:backups', {
  fallback: [],
});

export const settingsStorage = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});

export const workspacesStorage = storage.defineItem<Workspace[]>('local:workspaces', {
  fallback: [],
});

export const dailyStatsStorage = storage.defineItem<DailyStats[]>('local:dailyStats', {
  fallback: [],
});

// Helper to get today's date string
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// =============================================================================
// SESSION OPERATIONS
// =============================================================================
export const sessionOperations = {
  async getAll(): Promise<Session[]> {
    return await sessionsStorage.getValue();
  },

  async getById(id: string): Promise<Session | null> {
    const sessions = await this.getAll();
    return sessions.find(s => s.id === id) || null;
  },

  async create(name: string, options?: { 
    color?: SessionColor; 
    tags?: string[];
    workspace?: string;
  }): Promise<{ session: Session | null; error?: string }> {
    const sessions = await this.getAll();
    const settings = await settingsStorage.getValue();
    
    // Check free tier limit
    if (!settings.isPro && sessions.length >= settings.maxFreeSessions) {
      return { session: null, error: 'FREE_LIMIT_REACHED' };
    }
    
    // Capture current browser state
    const windows = await this.captureCurrentWindows();
    
    if (windows.length === 0) {
      return { session: null, error: 'NO_WINDOWS' };
    }
    
    const tabCount = windows.reduce((sum, w) => sum + w.tabs.length, 0);
    
    const newSession: Session = {
      id: generateId(),
      name: name.trim() || `Session ${sessions.length + 1}`,
      windows,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tabCount,
      windowCount: windows.length,
      tags: options?.tags || [],
      color: options?.color || 'teal',
      isTracking: false,
      workspace: options?.workspace,
    };
    
    sessions.unshift(newSession);
    await sessionsStorage.setValue(sessions);
    
    // Record stats
    await statsOperations.recordSessionSaved(tabCount);
    
    // Create initial backup
    await backupOperations.create(newSession, 'auto');
    
    return { session: newSession };
  },

  async captureCurrentWindows(): Promise<Window[]> {
    const chromeWindows = await chrome.windows.getAll({ populate: true });
    const windows: Window[] = [];
    
    for (const chromeWindow of chromeWindows) {
      if (!chromeWindow.id || !chromeWindow.tabs) continue;
      
      // Skip extension/devtools windows
      if (chromeWindow.type !== 'normal') continue;
      
      // Get tab groups for this window
      let tabGroups: TabGroup[] = [];
      try {
        const groups = await chrome.tabGroups.query({ windowId: chromeWindow.id });
        tabGroups = groups.map(g => ({
          id: g.id,
          title: g.title || '',
          color: g.color,
          collapsed: g.collapsed,
        }));
      } catch {
        // Tab groups API might not be available
      }
      
      const tabs: Tab[] = chromeWindow.tabs.map(t => ({
        id: generateId(),
        url: t.url || '',
        title: t.title || '',
        favIconUrl: t.favIconUrl,
        pinned: t.pinned || false,
        groupId: t.groupId !== -1 ? t.groupId : undefined,
        index: t.index,
      }));
      
      // Filter out chrome:// and edge:// URLs
      const validTabs = tabs.filter(t => 
        !t.url.startsWith('chrome://') && 
        !t.url.startsWith('edge://') &&
        !t.url.startsWith('chrome-extension://') &&
        t.url !== ''
      );
      
      if (validTabs.length === 0) continue;
      
      windows.push({
        id: generateId(),
        tabs: validTabs,
        tabGroups,
        focused: chromeWindow.focused || false,
        state: chromeWindow.state as Window['state'] || 'normal',
        width: chromeWindow.width,
        height: chromeWindow.height,
        left: chromeWindow.left,
        top: chromeWindow.top,
      });
    }
    
    return windows;
  },

  async update(id: string, updates: Partial<Pick<Session, 'name' | 'color' | 'tags' | 'workspace'>>): Promise<Session | null> {
    const sessions = await this.getAll();
    const index = sessions.findIndex(s => s.id === id);
    
    if (index === -1) return null;
    
    sessions[index] = {
      ...sessions[index],
      ...updates,
      updatedAt: Date.now(),
    };
    
    await sessionsStorage.setValue(sessions);
    return sessions[index];
  },

  async updateContent(id: string): Promise<Session | null> {
    const sessions = await this.getAll();
    const index = sessions.findIndex(s => s.id === id);
    
    if (index === -1) return null;
    
    // Create backup before updating
    await backupOperations.create(sessions[index], 'auto');
    
    // Capture current state
    const windows = await this.captureCurrentWindows();
    const tabCount = windows.reduce((sum, w) => sum + w.tabs.length, 0);
    
    sessions[index] = {
      ...sessions[index],
      windows,
      tabCount,
      windowCount: windows.length,
      updatedAt: Date.now(),
    };
    
    await sessionsStorage.setValue(sessions);
    return sessions[index];
  },

  async delete(id: string): Promise<void> {
    const sessions = await this.getAll();
    const session = sessions.find(s => s.id === id);
    
    if (session) {
      // Create backup before deleting
      await backupOperations.create(session, 'before_delete');
    }
    
    const filtered = sessions.filter(s => s.id !== id);
    await sessionsStorage.setValue(filtered);
  },

  async restore(id: string, options?: { 
    closeCurrentTabs?: boolean;
    restoreTabGroups?: boolean;
    restoreWindowPositions?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    const session = await this.getById(id);
    if (!session) {
      return { success: false, error: 'SESSION_NOT_FOUND' };
    }
    
    const settings = await settingsStorage.getValue();
    const restoreTabGroups = options?.restoreTabGroups ?? settings.restoreTabGroups;
    const restoreWindowPositions = options?.restoreWindowPositions ?? settings.restoreWindowPositions;
    const closeCurrentTabs = options?.closeCurrentTabs ?? settings.closeCurrentBeforeRestore;
    
    // Create backup before restore
    await backupOperations.create(session, 'before_restore');
    
    try {
      // Close current tabs if requested
      if (closeCurrentTabs) {
        const currentWindows = await chrome.windows.getAll({ populate: true });
        for (const win of currentWindows) {
          if (win.id && win.type === 'normal') {
            await chrome.windows.remove(win.id);
          }
        }
      }
      
      let totalTabsRestored = 0;
      
      // Restore each window
      for (const window of session.windows) {
        if (window.tabs.length === 0) continue;
        
        const windowCreateData: chrome.windows.CreateData = {
          focused: window.focused,
          state: window.state,
          url: window.tabs[0].url, // Create window with first tab
        };
        
        if (restoreWindowPositions && window.width && window.height) {
          windowCreateData.width = window.width;
          windowCreateData.height = window.height;
          windowCreateData.left = window.left;
          windowCreateData.top = window.top;
        }
        
        const newWindow = await chrome.windows.create(windowCreateData);
        if (!newWindow.id) continue;
        
        totalTabsRestored++;
        
        // Create remaining tabs
        const groupIdMap = new Map<number, number>(); // old group ID -> new group ID
        
        for (let i = 1; i < window.tabs.length; i++) {
          const tab = window.tabs[i];
          const newTab = await chrome.tabs.create({
            windowId: newWindow.id,
            url: tab.url,
            pinned: tab.pinned,
            index: tab.index,
          });
          
          totalTabsRestored++;
          
          // Handle tab groups
          if (restoreTabGroups && tab.groupId !== undefined && newTab.id) {
            const originalGroup = window.tabGroups.find(g => g.id === tab.groupId);
            if (originalGroup) {
              let newGroupId = groupIdMap.get(tab.groupId);
              
              if (newGroupId === undefined) {
                // Create new group
                newGroupId = await chrome.tabs.group({
                  tabIds: newTab.id,
                  createProperties: { windowId: newWindow.id },
                });
                groupIdMap.set(tab.groupId, newGroupId);
                
                // Update group properties
                await chrome.tabGroups.update(newGroupId, {
                  title: originalGroup.title,
                  color: originalGroup.color,
                  collapsed: originalGroup.collapsed,
                });
              } else {
                // Add to existing group
                await chrome.tabs.group({
                  tabIds: newTab.id,
                  groupId: newGroupId,
                });
              }
            }
          }
        }
        
        // Handle first tab's group (if any)
        if (restoreTabGroups && window.tabs[0].groupId !== undefined && newWindow.tabs?.[0]?.id) {
          const originalGroup = window.tabGroups.find(g => g.id === window.tabs[0].groupId);
          if (originalGroup) {
            let newGroupId = groupIdMap.get(window.tabs[0].groupId);
            
            if (newGroupId === undefined) {
              newGroupId = await chrome.tabs.group({
                tabIds: newWindow.tabs[0].id,
                createProperties: { windowId: newWindow.id },
              });
              groupIdMap.set(window.tabs[0].groupId, newGroupId);
              
              await chrome.tabGroups.update(newGroupId, {
                title: originalGroup.title,
                color: originalGroup.color,
                collapsed: originalGroup.collapsed,
              });
            } else {
              await chrome.tabs.group({
                tabIds: newWindow.tabs[0].id,
                groupId: newGroupId,
              });
            }
          }
        }
      }
      
      // Record stats
      await statsOperations.recordSessionRestored(totalTabsRestored);
      
      return { success: true };
    } catch (error) {
      console.error('TabVault: Failed to restore session:', error);
      return { success: false, error: 'RESTORE_FAILED' };
    }
  },

  async canAdd(): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const settings = await settingsStorage.getValue();
    const sessions = await this.getAll();
    
    if (settings.isPro) {
      return { allowed: true, remaining: Infinity, limit: Infinity };
    }
    
    const remaining = settings.maxFreeSessions - sessions.length;
    
    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
      limit: settings.maxFreeSessions,
    };
  },

  async search(query: string): Promise<Session[]> {
    const sessions = await this.getAll();
    const lowerQuery = query.toLowerCase();
    
    return sessions.filter(session => {
      // Search in name
      if (session.name.toLowerCase().includes(lowerQuery)) return true;
      
      // Search in tags
      if (session.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) return true;
      
      // Search in tab titles and URLs
      for (const window of session.windows) {
        for (const tab of window.tabs) {
          if (tab.title.toLowerCase().includes(lowerQuery)) return true;
          if (tab.url.toLowerCase().includes(lowerQuery)) return true;
        }
      }
      
      return false;
    });
  },

  async duplicate(id: string): Promise<{ session: Session | null; error?: string }> {
    const original = await this.getById(id);
    if (!original) {
      return { session: null, error: 'SESSION_NOT_FOUND' };
    }
    
    const sessions = await this.getAll();
    const settings = await settingsStorage.getValue();
    
    // Check free tier limit
    if (!settings.isPro && sessions.length >= settings.maxFreeSessions) {
      return { session: null, error: 'FREE_LIMIT_REACHED' };
    }
    
    const newSession: Session = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isTracking: false,
    };
    
    sessions.unshift(newSession);
    await sessionsStorage.setValue(sessions);
    
    return { session: newSession };
  },

  async reorder(sessionIds: string[]): Promise<void> {
    const sessions = await this.getAll();
    const reordered: Session[] = [];
    
    for (const id of sessionIds) {
      const session = sessions.find(s => s.id === id);
      if (session) {
        reordered.push(session);
      }
    }
    
    // Add any sessions not in the reorder list at the end
    for (const session of sessions) {
      if (!sessionIds.includes(session.id)) {
        reordered.push(session);
      }
    }
    
    await sessionsStorage.setValue(reordered);
  },
};

// =============================================================================
// BACKUP OPERATIONS - CRITICAL FOR DATA SAFETY
// =============================================================================
export const backupOperations = {
  async getAll(): Promise<Backup[]> {
    return await backupsStorage.getValue();
  },

  async getForSession(sessionId: string): Promise<Backup[]> {
    const backups = await this.getAll();
    return backups
      .filter(b => b.sessionId === sessionId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async create(session: Session, reason: Backup['reason']): Promise<Backup> {
    const backups = await this.getAll();
    const settings = await settingsStorage.getValue();
    
    const newBackup: Backup = {
      id: generateId(),
      sessionId: session.id,
      sessionName: session.name,
      data: { ...session },
      createdAt: Date.now(),
      reason,
    };
    
    backups.unshift(newBackup);
    
    // Clean up old backups based on retention policy
    const cutoffDate = Date.now() - (settings.backupRetentionDays * 24 * 60 * 60 * 1000);
    const filtered = backups.filter(b => b.createdAt > cutoffDate);
    
    // Keep at least 10 most recent backups per session
    const sessionBackups = new Map<string, Backup[]>();
    for (const backup of filtered) {
      const list = sessionBackups.get(backup.sessionId) || [];
      list.push(backup);
      sessionBackups.set(backup.sessionId, list);
    }
    
    const finalBackups: Backup[] = [];
    for (const [, list] of sessionBackups) {
      finalBackups.push(...list.slice(0, 10));
    }
    
    await backupsStorage.setValue(finalBackups);
    
    // Update session's lastBackupAt
    const sessions = await sessionsStorage.getValue();
    const sessionIndex = sessions.findIndex(s => s.id === session.id);
    if (sessionIndex !== -1) {
      sessions[sessionIndex].lastBackupAt = Date.now();
      await sessionsStorage.setValue(sessions);
    }
    
    return newBackup;
  },

  async restoreFromBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
    const backups = await this.getAll();
    const backup = backups.find(b => b.id === backupId);
    
    if (!backup) {
      return { success: false, error: 'BACKUP_NOT_FOUND' };
    }
    
    const sessions = await sessionsStorage.getValue();
    const sessionIndex = sessions.findIndex(s => s.id === backup.sessionId);
    
    if (sessionIndex === -1) {
      // Session was deleted, recreate it
      sessions.unshift(backup.data);
    } else {
      // Replace session with backup data
      sessions[sessionIndex] = {
        ...backup.data,
        updatedAt: Date.now(),
      };
    }
    
    await sessionsStorage.setValue(sessions);
    return { success: true };
  },

  async delete(id: string): Promise<void> {
    const backups = await this.getAll();
    const filtered = backups.filter(b => b.id !== id);
    await backupsStorage.setValue(filtered);
  },

  async deleteForSession(sessionId: string): Promise<void> {
    const backups = await this.getAll();
    const filtered = backups.filter(b => b.sessionId !== sessionId);
    await backupsStorage.setValue(filtered);
  },
};

// =============================================================================
// WORKSPACE OPERATIONS (PRO FEATURE)
// =============================================================================
export const workspaceOperations = {
  async getAll(): Promise<Workspace[]> {
    return await workspacesStorage.getValue();
  },

  async create(name: string, color: SessionColor = 'blue'): Promise<Workspace> {
    const workspaces = await this.getAll();
    
    const newWorkspace: Workspace = {
      id: generateId(),
      name,
      color,
      sessionIds: [],
      createdAt: Date.now(),
    };
    
    workspaces.push(newWorkspace);
    await workspacesStorage.setValue(workspaces);
    
    return newWorkspace;
  },

  async update(id: string, updates: Partial<Pick<Workspace, 'name' | 'color'>>): Promise<Workspace | null> {
    const workspaces = await this.getAll();
    const index = workspaces.findIndex(w => w.id === id);
    
    if (index === -1) return null;
    
    workspaces[index] = { ...workspaces[index], ...updates };
    await workspacesStorage.setValue(workspaces);
    
    return workspaces[index];
  },

  async delete(id: string): Promise<void> {
    const workspaces = await this.getAll();
    const filtered = workspaces.filter(w => w.id !== id);
    await workspacesStorage.setValue(filtered);
    
    // Remove workspace reference from sessions
    const sessions = await sessionsStorage.getValue();
    const updatedSessions = sessions.map(s => {
      if (s.workspace === id) {
        return { ...s, workspace: undefined };
      }
      return s;
    });
    await sessionsStorage.setValue(updatedSessions);
  },

  async addSession(workspaceId: string, sessionId: string): Promise<void> {
    const workspaces = await this.getAll();
    const workspace = workspaces.find(w => w.id === workspaceId);
    
    if (workspace && !workspace.sessionIds.includes(sessionId)) {
      workspace.sessionIds.push(sessionId);
      await workspacesStorage.setValue(workspaces);
      
      // Update session's workspace
      const sessions = await sessionsStorage.getValue();
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        session.workspace = workspaceId;
        await sessionsStorage.setValue(sessions);
      }
    }
  },

  async removeSession(workspaceId: string, sessionId: string): Promise<void> {
    const workspaces = await this.getAll();
    const workspace = workspaces.find(w => w.id === workspaceId);
    
    if (workspace) {
      workspace.sessionIds = workspace.sessionIds.filter(id => id !== sessionId);
      await workspacesStorage.setValue(workspaces);
      
      // Clear session's workspace
      const sessions = await sessionsStorage.getValue();
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        session.workspace = undefined;
        await sessionsStorage.setValue(sessions);
      }
    }
  },
};

// =============================================================================
// SETTINGS OPERATIONS
// =============================================================================
export const settingsOperations = {
  async get(): Promise<Settings> {
    return await settingsStorage.getValue();
  },

  async update(updates: Partial<Settings>): Promise<Settings> {
    const current = await this.get();
    const updated = { ...current, ...updates };
    await settingsStorage.setValue(updated);
    return updated;
  },

  async reset(): Promise<Settings> {
    await settingsStorage.setValue(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  },
};

// =============================================================================
// STATS OPERATIONS
// =============================================================================
export const statsOperations = {
  async getTodayStats(): Promise<DailyStats | null> {
    const stats = await dailyStatsStorage.getValue();
    const today = getTodayString();
    return stats.find(s => s.date === today) || null;
  },

  async getAllStats(): Promise<DailyStats[]> {
    return await dailyStatsStorage.getValue();
  },

  async recordSessionSaved(tabCount: number): Promise<void> {
    const stats = await dailyStatsStorage.getValue();
    const today = getTodayString();
    
    const todayIndex = stats.findIndex(s => s.date === today);
    
    if (todayIndex >= 0) {
      stats[todayIndex].sessionsSaved += 1;
      stats[todayIndex].tabsSaved += tabCount;
    } else {
      stats.push({
        date: today,
        sessionsSaved: 1,
        sessionsRestored: 0,
        tabsSaved: tabCount,
        tabsRestored: 0,
      });
    }
    
    // Keep only last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const filtered = stats.filter(s => new Date(s.date) >= thirtyDaysAgo);
    
    await dailyStatsStorage.setValue(filtered);
  },

  async recordSessionRestored(tabCount: number): Promise<void> {
    const stats = await dailyStatsStorage.getValue();
    const today = getTodayString();
    
    const todayIndex = stats.findIndex(s => s.date === today);
    
    if (todayIndex >= 0) {
      stats[todayIndex].sessionsRestored += 1;
      stats[todayIndex].tabsRestored += tabCount;
    } else {
      stats.push({
        date: today,
        sessionsSaved: 0,
        sessionsRestored: 1,
        tabsSaved: 0,
        tabsRestored: tabCount,
      });
    }
    
    await dailyStatsStorage.setValue(stats);
  },
};

// =============================================================================
// EXPORT/IMPORT DATA
// =============================================================================
export async function exportData(): Promise<{
  sessions: Session[];
  backups: Backup[];
  workspaces: Workspace[];
  settings: Settings;
  exportedAt: number;
  version: string;
}> {
  const [sessions, backups, workspaces, settings] = await Promise.all([
    sessionsStorage.getValue(),
    backupsStorage.getValue(),
    workspacesStorage.getValue(),
    settingsStorage.getValue(),
  ]);
  
  return { 
    sessions, 
    backups, 
    workspaces, 
    settings,
    exportedAt: Date.now(),
    version: '1.0.0',
  };
}

export async function importData(data: {
  sessions?: Session[];
  backups?: Backup[];
  workspaces?: Workspace[];
  settings?: Partial<Settings>;
}): Promise<void> {
  if (data.sessions) {
    await sessionsStorage.setValue(data.sessions);
  }
  if (data.backups) {
    await backupsStorage.setValue(data.backups);
  }
  if (data.workspaces) {
    await workspacesStorage.setValue(data.workspaces);
  }
  if (data.settings) {
    const current = await settingsStorage.getValue();
    await settingsStorage.setValue({ ...current, ...data.settings });
  }
}
