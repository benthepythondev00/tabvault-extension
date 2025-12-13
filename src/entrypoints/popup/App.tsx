import { useState, useEffect, useCallback } from 'react';
import { 
  Settings as SettingsIcon, 
  Layers, 
  Search, 
  Loader2, 
  Plus,
  FolderOpen,
} from 'lucide-react';
import type { Session, Settings, Workspace } from '../../types/session';
import { DEFAULT_SETTINGS } from '../../types/session';
import { SessionCard } from '../../components/SessionCard';
import { SettingsModal } from '../../components/SettingsModal';
import { SessionModal } from '../../components/SessionModal';

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [sessionStatus, setSessionStatus] = useState<{ remaining: number; limit: number } | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);

  // Apply theme
  const applyTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, []);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const [sessionsData, workspacesData, settingsData, sessionCan] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }),
        chrome.runtime.sendMessage({ type: 'GET_WORKSPACES' }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ type: 'CAN_ADD_SESSION' }),
      ]);
      
      setSessions(sessionsData);
      setWorkspaces(workspacesData);
      setSettings(settingsData);
      setSessionStatus(sessionCan);
      applyTheme(settingsData.theme);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [applyTheme]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter sessions based on search and workspace
  const filteredSessions = sessions.filter(session => {
    // Filter by workspace
    if (selectedWorkspace && session.workspace !== selectedWorkspace) {
      return false;
    }
    
    // Filter by search
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      if (session.name.toLowerCase().includes(lowerQuery)) return true;
      if (session.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) return true;
      for (const window of session.windows) {
        for (const tab of window.tabs) {
          if (tab.title.toLowerCase().includes(lowerQuery)) return true;
          if (tab.url.toLowerCase().includes(lowerQuery)) return true;
        }
      }
      return false;
    }
    
    return true;
  });

  // Handle save new session
  const handleSaveCurrentSession = async (name: string, color?: string, tags?: string[]) => {
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'CREATE_SESSION',
        payload: { name, color, tags, workspace: selectedWorkspace },
      });
      
      if (result.error) {
        if (result.error === 'FREE_LIMIT_REACHED') {
          alert('You\'ve reached the free tier limit. Upgrade to Pro for unlimited sessions!');
        } else if (result.error === 'NO_WINDOWS') {
          alert('No browser windows to save.');
        }
        return;
      }
      
      // Reload sessions
      await loadData();
      setShowSessionModal(false);
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  // Handle update session
  const handleUpdateSession = async (id: string, updates: { name?: string; color?: string; tags?: string[] }) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SESSION',
        payload: { id, updates },
      });
      
      // Reload sessions
      await loadData();
      setShowSessionModal(false);
      setEditingSession(null);
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  };

  // Handle restore session
  const handleRestoreSession = async (id: string) => {
    if (settings.confirmBeforeRestore) {
      if (!confirm('Restore this session? This will open all tabs from the saved session.')) {
        return;
      }
    }
    
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'RESTORE_SESSION',
        payload: { 
          id,
          closeCurrentTabs: settings.closeCurrentBeforeRestore,
          restoreTabGroups: settings.restoreTabGroups,
          restoreWindowPositions: settings.restoreWindowPositions,
        },
      });
      
      if (!result.success) {
        alert('Failed to restore session: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
    }
  };

  // Handle delete session
  const handleDeleteSession = async (id: string) => {
    if (!confirm('Delete this session? A backup will be created before deletion.')) {
      return;
    }
    
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_SESSION',
        payload: { id },
      });
      
      // Reload sessions
      await loadData();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  // Handle duplicate session
  const handleDuplicateSession = async (id: string) => {
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'DUPLICATE_SESSION',
        payload: { id },
      });
      
      if (result.error === 'FREE_LIMIT_REACHED') {
        alert('You\'ve reached the free tier limit. Upgrade to Pro for unlimited sessions!');
        return;
      }
      
      // Reload sessions
      await loadData();
    } catch (error) {
      console.error('Failed to duplicate session:', error);
    }
  };

  // Handle edit session
  const handleEditSession = (session: Session) => {
    setEditingSession(session);
    setShowSessionModal(true);
  };

  // Handle settings change
  const handleSettingsChange = async () => {
    const settingsData = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    setSettings(settingsData);
    applyTheme(settingsData.theme);
    
    // Refresh session limits
    const sessionCan = await chrome.runtime.sendMessage({ type: 'CAN_ADD_SESSION' });
    setSessionStatus(sessionCan);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[520px] bg-white">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[520px] bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">TabVault</h1>
              <p className="text-xs text-slate-500">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''} saved
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Workspace Filter (Pro only) */}
      {settings.isPro && workspaces.length > 0 && (
        <div className="px-4 py-2 bg-white border-b border-slate-200 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedWorkspace(null)}
            className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              selectedWorkspace === null
                ? 'bg-teal-100 text-teal-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Sessions
          </button>
          {workspaces.map(workspace => (
            <button
              key={workspace.id}
              onClick={() => setSelectedWorkspace(workspace.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                selectedWorkspace === workspace.id
                  ? 'bg-teal-100 text-teal-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {workspace.name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="px-4 py-2 bg-white border-b border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search sessions, tabs, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="tab-content">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <FolderOpen className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">
                {searchQuery ? 'No sessions match your search' : 'No sessions saved yet'}
              </p>
              <p className="text-xs mt-1 text-slate-400">
                {searchQuery ? 'Try a different search term' : 'Click "Save Session" to capture your current tabs'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onRestore={() => handleRestoreSession(session.id)}
                  onDelete={() => handleDeleteSession(session.id)}
                  onEdit={() => handleEditSession(session)}
                  onDuplicate={() => handleDuplicateSession(session.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-4 py-2">
        <div className="flex items-center justify-between">
          {!settings.isPro && sessionStatus && (
            <span className="text-xs text-slate-500">
              {sessionStatus.remaining} of {sessionStatus.limit} sessions
            </span>
          )}
          {settings.isPro && (
            <span className="text-xs text-teal-600 font-medium">Pro - Unlimited</span>
          )}
          <button
            onClick={() => {
              setEditingSession(null);
              setShowSessionModal(true);
            }}
            disabled={!settings.isPro && sessionStatus && sessionStatus.remaining <= 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Save Session
          </button>
        </div>
      </footer>

      {/* Modals */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSettingsChange={handleSettingsChange}
        />
      )}

      {showSessionModal && (
        <SessionModal
          session={editingSession}
          onClose={() => {
            setShowSessionModal(false);
            setEditingSession(null);
          }}
          onSave={editingSession 
            ? (updates) => handleUpdateSession(editingSession.id, updates)
            : handleSaveCurrentSession
          }
        />
      )}
    </div>
  );
}

export default App;
