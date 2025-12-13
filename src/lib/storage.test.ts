import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  sessionOperations, 
  backupOperations,
  workspaceOperations,
  settingsOperations,
  sessionsStorage,
} from './storage';
import { generateId, formatDate, getDomain, truncate, getSessionStats } from '../types/session';
import type { Session, Window, Tab, TabGroup } from '../types/session';

// Mock chrome APIs
const mockChrome = {
  windows: {
    getAll: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
  tabs: {
    create: vi.fn(),
    group: vi.fn(),
  },
  tabGroups: {
    query: vi.fn(),
    update: vi.fn(),
  },
};

// @ts-expect-error - mock chrome global
globalThis.chrome = mockChrome;

// Helper to create a mock session
function createMockSession(overrides?: Partial<Session>): Session {
  const tabs: Tab[] = [
    { id: '1', url: 'https://example.com', title: 'Example', pinned: false, index: 0 },
    { id: '2', url: 'https://google.com', title: 'Google', pinned: false, index: 1 },
  ];
  
  const windows: Window[] = [{
    id: 'win-1',
    tabs,
    tabGroups: [],
    focused: true,
    state: 'normal',
  }];
  
  return {
    id: generateId(),
    name: 'Test Session',
    windows,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tabCount: 2,
    windowCount: 1,
    tags: [],
    color: 'teal',
    isTracking: false,
    ...overrides,
  };
}

describe('ID Generation', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(10);
  });
});

describe('Date Formatting', () => {
  it('should format recent times as "Just now"', () => {
    const now = Date.now();
    expect(formatDate(now)).toBe('Just now');
  });

  it('should format minutes ago', () => {
    const tenMinsAgo = Date.now() - 10 * 60 * 1000;
    expect(formatDate(tenMinsAgo)).toBe('10 mins ago');
  });

  it('should format hours ago', () => {
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    expect(formatDate(threeHoursAgo)).toBe('3 hours ago');
  });

  it('should format days ago', () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    expect(formatDate(twoDaysAgo)).toBe('2 days ago');
  });
});

describe('URL Helpers', () => {
  it('should extract domain from URL', () => {
    expect(getDomain('https://www.example.com/path')).toBe('example.com');
    expect(getDomain('https://subdomain.example.com')).toBe('subdomain.example.com');
  });

  it('should handle invalid URLs', () => {
    expect(getDomain('not-a-url')).toBe('not-a-url');
  });
});

describe('Text Truncation', () => {
  it('should truncate long text', () => {
    expect(truncate('This is a long text', 10)).toBe('This is...');
  });

  it('should not truncate short text', () => {
    expect(truncate('Short', 10)).toBe('Short');
  });
});

describe('Session Stats', () => {
  it('should calculate session statistics', () => {
    const session = createMockSession();
    const stats = getSessionStats(session);
    
    expect(stats.tabs).toBe(2);
    expect(stats.windows).toBe(1);
    expect(stats.groups).toBe(0);
  });

  it('should count tab groups', () => {
    const tabGroups: TabGroup[] = [
      { id: 1, title: 'Group 1', color: 'blue', collapsed: false },
    ];
    
    const session = createMockSession({
      windows: [{
        id: 'win-1',
        tabs: [
          { id: '1', url: 'https://example.com', title: 'Example', pinned: false, index: 0, groupId: 1 },
        ],
        tabGroups,
        focused: true,
        state: 'normal',
      }],
    });
    
    const stats = getSessionStats(session);
    expect(stats.groups).toBe(1);
  });
});

describe('Settings Operations', () => {
  it('should get default settings', async () => {
    const settings = await settingsOperations.get();
    
    expect(settings.theme).toBe('system');
    expect(settings.isPro).toBe(false);
    expect(settings.maxFreeSessions).toBe(5);
    expect(settings.autoBackupEnabled).toBe(true);
    expect(settings.restoreTabGroups).toBe(true);
  });

  it('should update settings', async () => {
    await settingsOperations.update({ theme: 'dark' });
    
    const settings = await settingsOperations.get();
    expect(settings.theme).toBe('dark');
  });

  it('should reset settings to defaults', async () => {
    await settingsOperations.update({ theme: 'dark', isPro: true });
    await settingsOperations.reset();
    
    const settings = await settingsOperations.get();
    expect(settings.theme).toBe('system');
    expect(settings.isPro).toBe(false);
  });
});

describe('Session Operations - canAdd', () => {
  it('should report can add status for free users', async () => {
    const canAdd = await sessionOperations.canAdd();
    
    expect(canAdd.allowed).toBe(true);
    expect(canAdd.limit).toBe(5);
  });

  it('should report unlimited for pro users', async () => {
    await settingsOperations.update({ isPro: true });
    
    const canAdd = await sessionOperations.canAdd();
    
    expect(canAdd.allowed).toBe(true);
    expect(canAdd.limit).toBe(Infinity);
  });
});

describe('Session Operations - CRUD', () => {
  beforeEach(() => {
    // Reset mocks
    mockChrome.windows.getAll.mockReset();
    mockChrome.tabGroups.query.mockReset();
  });

  it('should get all sessions (empty initially)', async () => {
    const sessions = await sessionOperations.getAll();
    expect(sessions).toEqual([]);
  });

  it('should search sessions by name', async () => {
    // Manually add sessions to storage
    const session1 = createMockSession({ id: '1', name: 'Work Project' });
    const session2 = createMockSession({ id: '2', name: 'Personal Research' });
    
    await sessionsStorage.setValue([session1, session2]);
    
    const results = await sessionOperations.search('work');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Work Project');
  });

  it('should search sessions by tag', async () => {
    const session1 = createMockSession({ id: '1', name: 'Session 1', tags: ['work', 'important'] });
    const session2 = createMockSession({ id: '2', name: 'Session 2', tags: ['personal'] });
    
    await sessionsStorage.setValue([session1, session2]);
    
    const results = await sessionOperations.search('important');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Session 1');
  });

  it('should search sessions by tab URL', async () => {
    const session1 = createMockSession({ 
      id: '1', 
      name: 'Session 1',
      windows: [{
        id: 'w1',
        tabs: [{ id: 't1', url: 'https://github.com', title: 'GitHub', pinned: false, index: 0 }],
        tabGroups: [],
        focused: true,
        state: 'normal',
      }],
    });
    const session2 = createMockSession({ id: '2', name: 'Session 2' });
    
    await sessionsStorage.setValue([session1, session2]);
    
    const results = await sessionOperations.search('github');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Session 1');
  });

  it('should update session name', async () => {
    const session = createMockSession({ id: 'test-1', name: 'Original Name' });
    await sessionsStorage.setValue([session]);
    
    const updated = await sessionOperations.update('test-1', { name: 'New Name' });
    
    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('New Name');
  });

  it('should delete session', async () => {
    const session = createMockSession({ id: 'delete-me' });
    await sessionsStorage.setValue([session]);
    
    await sessionOperations.delete('delete-me');
    
    const sessions = await sessionOperations.getAll();
    expect(sessions).toHaveLength(0);
  });

  it('should return null when updating non-existent session', async () => {
    const result = await sessionOperations.update('non-existent', { name: 'Test' });
    expect(result).toBeNull();
  });

  it('should duplicate session', async () => {
    const session = createMockSession({ id: 'original', name: 'Original Session' });
    await sessionsStorage.setValue([session]);
    
    const result = await sessionOperations.duplicate('original');
    
    expect(result.session).not.toBeNull();
    expect(result.session?.name).toBe('Original Session (Copy)');
    expect(result.session?.id).not.toBe('original');
  });

  it('should reorder sessions', async () => {
    const session1 = createMockSession({ id: '1', name: 'First' });
    const session2 = createMockSession({ id: '2', name: 'Second' });
    const session3 = createMockSession({ id: '3', name: 'Third' });
    
    await sessionsStorage.setValue([session1, session2, session3]);
    
    await sessionOperations.reorder(['3', '1', '2']);
    
    const sessions = await sessionOperations.getAll();
    expect(sessions[0].id).toBe('3');
    expect(sessions[1].id).toBe('1');
    expect(sessions[2].id).toBe('2');
  });
});

describe('Backup Operations', () => {
  beforeEach(async () => {
    // Clear backups storage before each test
    const { backupsStorage } = await import('./storage');
    await backupsStorage.setValue([]);
  });

  it('should get all backups (empty initially)', async () => {
    const backups = await backupOperations.getAll();
    expect(backups).toEqual([]);
  });

  it('should create backup for session', async () => {
    const session = createMockSession({ id: 'session-1', name: 'Test Session' });
    await sessionsStorage.setValue([session]);
    
    const backup = await backupOperations.create(session, 'manual');
    
    expect(backup.sessionId).toBe('session-1');
    expect(backup.sessionName).toBe('Test Session');
    expect(backup.reason).toBe('manual');
    // Check key properties rather than full equality since lastBackupAt gets added
    expect(backup.data.id).toBe(session.id);
    expect(backup.data.name).toBe(session.name);
  });

  it('should get backups for specific session', async () => {
    // Clear first
    const { backupsStorage } = await import('./storage');
    await backupsStorage.setValue([]);
    
    const session1 = createMockSession({ id: 'session-1' });
    const session2 = createMockSession({ id: 'session-2' });
    
    await sessionsStorage.setValue([session1, session2]);
    
    await backupOperations.create(session1, 'auto');
    await backupOperations.create(session1, 'manual');
    await backupOperations.create(session2, 'auto');
    
    const backups = await backupOperations.getForSession('session-1');
    expect(backups).toHaveLength(2);
    expect(backups.every(b => b.sessionId === 'session-1')).toBe(true);
  });

  it('should delete backup', async () => {
    // First clear and reset
    const { backupsStorage } = await import('./storage');
    await backupsStorage.setValue([]);
    
    const session = createMockSession({ id: 'session-1' });
    await sessionsStorage.setValue([session]);
    
    const backup = await backupOperations.create(session, 'manual');
    const backupsBefore = await backupOperations.getAll();
    expect(backupsBefore.length).toBeGreaterThan(0);
    
    await backupOperations.delete(backup.id);
    
    const backupsAfter = await backupOperations.getAll();
    expect(backupsAfter.find(b => b.id === backup.id)).toBeUndefined();
  });
});

describe('Workspace Operations', () => {
  beforeEach(async () => {
    // Clear workspaces and sessions storage before each test
    const { workspacesStorage, sessionsStorage } = await import('./storage');
    await workspacesStorage.setValue([]);
    await sessionsStorage.setValue([]);
  });

  it('should create workspace', async () => {
    const workspace = await workspaceOperations.create('Work', 'blue');
    
    expect(workspace.name).toBe('Work');
    expect(workspace.color).toBe('blue');
    expect(workspace.sessionIds).toEqual([]);
  });

  it('should update workspace', async () => {
    const workspace = await workspaceOperations.create('Work', 'blue');
    
    const updated = await workspaceOperations.update(workspace.id, { 
      name: 'Updated Work',
      color: 'green',
    });
    
    expect(updated?.name).toBe('Updated Work');
    expect(updated?.color).toBe('green');
  });

  it('should add session to workspace', async () => {
    const workspace = await workspaceOperations.create('Work', 'blue');
    const session = createMockSession({ id: 'session-1' });
    await sessionsStorage.setValue([session]);
    
    await workspaceOperations.addSession(workspace.id, 'session-1');
    
    const workspaces = await workspaceOperations.getAll();
    expect(workspaces[0].sessionIds).toContain('session-1');
    
    const sessions = await sessionOperations.getAll();
    expect(sessions[0].workspace).toBe(workspace.id);
  });

  it('should remove session from workspace', async () => {
    const workspace = await workspaceOperations.create('Work', 'blue');
    const session = createMockSession({ id: 'session-1' });
    await sessionsStorage.setValue([session]);
    
    await workspaceOperations.addSession(workspace.id, 'session-1');
    await workspaceOperations.removeSession(workspace.id, 'session-1');
    
    const workspaces = await workspaceOperations.getAll();
    expect(workspaces[0].sessionIds).not.toContain('session-1');
  });

  it('should delete workspace and clear session references', async () => {
    const workspace = await workspaceOperations.create('Work', 'blue');
    const session = createMockSession({ id: 'session-1' });
    await sessionsStorage.setValue([session]);
    
    await workspaceOperations.addSession(workspace.id, 'session-1');
    await workspaceOperations.delete(workspace.id);
    
    const workspaces = await workspaceOperations.getAll();
    expect(workspaces).toHaveLength(0);
    
    const sessions = await sessionOperations.getAll();
    expect(sessions[0].workspace).toBeUndefined();
  });
});

describe('Free Tier Limits', () => {
  it('should enforce session limit for free users', async () => {
    // Fill up to limit
    for (let i = 0; i < 5; i++) {
      const session = createMockSession({ id: `session-${i}`, name: `Session ${i}` });
      const sessions = await sessionOperations.getAll();
      sessions.push(session);
      await sessionsStorage.setValue(sessions);
    }
    
    const canAdd = await sessionOperations.canAdd();
    expect(canAdd.allowed).toBe(false);
    expect(canAdd.remaining).toBe(0);
  });

  it('should allow unlimited sessions for pro users', async () => {
    await settingsOperations.update({ isPro: true });
    
    // Fill up beyond free limit
    for (let i = 0; i < 10; i++) {
      const session = createMockSession({ id: `session-${i}`, name: `Session ${i}` });
      const sessions = await sessionOperations.getAll();
      sessions.push(session);
      await sessionsStorage.setValue(sessions);
    }
    
    const canAdd = await sessionOperations.canAdd();
    expect(canAdd.allowed).toBe(true);
    expect(canAdd.limit).toBe(Infinity);
  });
});
