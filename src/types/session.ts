// Tab representation - matches Chrome's tab structure
export interface Tab {
  id: string;
  url: string;
  title: string;
  favIconUrl?: string;
  pinned: boolean;
  groupId?: number; // Chrome tab group ID
  index: number; // Position in window
}

// Tab group representation - CRITICAL: competitors fail here
export interface TabGroup {
  id: number;
  title: string;
  color: chrome.tabGroups.ColorEnum;
  collapsed: boolean;
}

// Window representation
export interface Window {
  id: string;
  tabs: Tab[];
  tabGroups: TabGroup[];
  focused: boolean;
  state: 'normal' | 'minimized' | 'maximized' | 'fullscreen';
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

// Session - the main data structure
export interface Session {
  id: string;
  name: string;
  windows: Window[];
  createdAt: number;
  updatedAt: number;
  lastBackupAt?: number;
  tabCount: number;
  windowCount: number;
  tags: string[];
  color: SessionColor;
  isTracking: boolean; // Live tracking mode
  workspace?: string; // Pro feature: workspace grouping
}

// Backup for undo/recovery - CRITICAL: prevents data loss
export interface Backup {
  id: string;
  sessionId: string;
  sessionName: string;
  data: Session;
  createdAt: number;
  reason: 'auto' | 'manual' | 'before_restore' | 'before_delete';
}

// Session colors for visual organization
export type SessionColor = 
  | 'slate' 
  | 'red' 
  | 'orange' 
  | 'amber' 
  | 'green' 
  | 'teal' 
  | 'blue' 
  | 'indigo' 
  | 'purple' 
  | 'pink';

// Workspace for Pro users
export interface Workspace {
  id: string;
  name: string;
  color: SessionColor;
  sessionIds: string[];
  createdAt: number;
}

// Settings
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  isPro: boolean;
  maxFreeSessions: number;
  autoBackupEnabled: boolean;
  autoBackupIntervalMinutes: number;
  backupRetentionDays: number;
  restoreTabGroups: boolean;
  restoreWindowPositions: boolean;
  showNotifications: boolean;
  confirmBeforeRestore: boolean;
  closeCurrentBeforeRestore: boolean;
}

// Daily usage stats
export interface DailyStats {
  date: string; // YYYY-MM-DD
  sessionsSaved: number;
  sessionsRestored: number;
  tabsSaved: number;
  tabsRestored: number;
}

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  isPro: false,
  maxFreeSessions: 5,
  autoBackupEnabled: true,
  autoBackupIntervalMinutes: 30,
  backupRetentionDays: 7,
  restoreTabGroups: true,
  restoreWindowPositions: true,
  showNotifications: false,
  confirmBeforeRestore: true,
  closeCurrentBeforeRestore: false,
};

// Session colors with their Tailwind classes
export const SESSION_COLORS: Record<SessionColor, { bg: string; text: string; border: string }> = {
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
};

// Tab group colors mapping (Chrome's colors)
export const TAB_GROUP_COLORS: Record<chrome.tabGroups.ColorEnum, string> = {
  grey: '#5f6368',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#188038',
  pink: '#d01884',
  purple: '#a142f4',
  cyan: '#007b83',
  orange: '#fa903e',
};

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Format timestamp to readable date
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;
  
  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} min${mins > 1 ? 's' : ''} ago`;
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  
  // Otherwise show date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

// Get favicon URL with fallback
export function getFaviconUrl(url: string, favIconUrl?: string): string {
  if (favIconUrl && !favIconUrl.startsWith('chrome://')) {
    return favIconUrl;
  }
  
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=32';
  }
}

// Truncate text with ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Get domain from URL
export function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Calculate session stats
export function getSessionStats(session: Session): { tabs: number; windows: number; groups: number } {
  let tabs = 0;
  let groups = 0;
  
  for (const window of session.windows) {
    tabs += window.tabs.length;
    groups += window.tabGroups.length;
  }
  
  return {
    tabs,
    windows: session.windows.length,
    groups,
  };
}
