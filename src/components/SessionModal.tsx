import { useState, useEffect } from 'react';
import { X, Monitor, Layers } from 'lucide-react';
import type { Session, SessionColor, Window } from '../types/session';
import { SESSION_COLORS, getFaviconUrl, TAB_GROUP_COLORS } from '../types/session';

interface SessionModalProps {
  session: Session | null; // null = create new
  onClose: () => void;
  onSave: (name: string, color?: string, tags?: string[]) => void;
}

const COLORS: SessionColor[] = [
  'teal', 'blue', 'indigo', 'purple', 'pink', 
  'red', 'orange', 'amber', 'green', 'slate'
];

export function SessionModal({ session, onClose, onSave }: SessionModalProps) {
  const [name, setName] = useState(session?.name || '');
  const [color, setColor] = useState<SessionColor>(session?.color || 'teal');
  const [tagsInput, setTagsInput] = useState(session?.tags.join(', ') || '');
  const [preview, setPreview] = useState<Window[] | null>(null);
  const [loading, setLoading] = useState(!session);
  const [error, setError] = useState<string | null>(null);

  // Load preview for new sessions
  useEffect(() => {
    if (!session) {
      loadPreview();
    }
  }, [session]);

  const loadPreview = async () => {
    try {
      const windows = await chrome.runtime.sendMessage({ type: 'CAPTURE_CURRENT_WINDOWS' });
      setPreview(windows);
      
      if (windows.length === 0) {
        setError('No browser windows to save');
      }
    } catch (err) {
      console.error('Failed to load preview:', err);
      setError('Failed to capture windows');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Session name is required');
      return;
    }
    
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    onSave(name.trim(), color, tags);
  };

  const isEditing = !!session;
  const windows = session?.windows || preview || [];
  const tabCount = windows.reduce((sum, w) => sum + w.tabs.length, 0);

  return (
    <div 
      className="modal-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="modal-content bg-white dark:bg-slate-800 rounded-xl w-[360px] max-h-[520px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEditing ? 'Edit Session' : 'Save Session'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Name input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Session Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g., Work Research, Shopping, Project X"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg 
                       bg-white dark:bg-slate-900 text-slate-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${SESSION_COLORS[c].bg} ${
                    color === c 
                      ? 'ring-2 ring-offset-2 ring-teal-500' 
                      : 'hover:scale-110'
                  }`}
                  title={c.charAt(0).toUpperCase() + c.slice(1)}
                />
              ))}
            </div>
          </div>

          {/* Tags input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., work, research, important"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg 
                       bg-white dark:bg-slate-900 text-slate-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Preview */}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Preview ({tabCount} tabs in {windows.length} windows)
              </label>
              
              {loading ? (
                <div className="flex items-center justify-center p-4 text-slate-400">
                  <span className="animate-spin mr-2">+</span>
                  Loading preview...
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {windows.map((window, i) => (
                    <div key={window.id} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Monitor className="w-3 h-3 text-slate-400" />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          Window {i + 1} ({window.tabs.length} tabs)
                        </span>
                      </div>
                      
                      {/* Tab groups preview */}
                      {window.tabGroups.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {window.tabGroups.map(group => (
                            <span
                              key={group.id}
                              className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: `${TAB_GROUP_COLORS[group.color]}20`,
                                color: TAB_GROUP_COLORS[group.color],
                              }}
                            >
                              <Layers className="w-2.5 h-2.5 inline mr-0.5" />
                              {group.title || 'Untitled'}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-1">
                        {window.tabs.slice(0, 8).map(tab => (
                          <img
                            key={tab.id}
                            src={getFaviconUrl(tab.url, tab.favIconUrl)}
                            alt=""
                            className="w-4 h-4 rounded-sm"
                            title={tab.title}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://www.google.com/s2/favicons?domain=example.com&sz=32';
                            }}
                          />
                        ))}
                        {window.tabs.length > 8 && (
                          <span className="text-[10px] text-slate-400">
                            +{window.tabs.length - 8}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (preview?.length === 0)}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEditing ? 'Save Changes' : 'Save Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
