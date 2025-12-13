import { useState } from 'react';
import { 
  Play, 
  Trash2, 
  Edit2, 
  Copy, 
  ChevronDown, 
  ChevronUp,
  Monitor,
  ExternalLink,
  Layers,
} from 'lucide-react';
import type { Session } from '../types/session';
import { formatDate, getDomain, getFaviconUrl, SESSION_COLORS, TAB_GROUP_COLORS } from '../types/session';

interface SessionCardProps {
  session: Session;
  onRestore: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}

export function SessionCard({ session, onRestore, onDelete, onEdit, onDuplicate }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const colorClasses = SESSION_COLORS[session.color];
  
  // Get unique favicons (max 6)
  const favicons = session.windows
    .flatMap(w => w.tabs)
    .slice(0, 6)
    .map(tab => ({
      url: getFaviconUrl(tab.url, tab.favIconUrl),
      title: tab.title,
    }));

  return (
    <div className="session-card bg-white hover:bg-slate-50 transition-colors">
      {/* Main row */}
      <div className="flex items-start gap-3 p-3">
        {/* Color indicator */}
        <div className={`color-indicator h-12 ${colorClasses.bg}`} />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-slate-900 truncate">
                  {session.name}
                </h3>
                {session.isTracking && (
                  <span className="tracking-indicator w-2 h-2 bg-green-500 rounded-full" title="Tracking" />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {session.tabCount} tab{session.tabCount !== 1 ? 's' : ''} in {session.windowCount} window{session.windowCount !== 1 ? 's' : ''} 
                <span className="mx-1">-</span>
                {formatDate(session.updatedAt)}
              </p>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={onRestore}
                className="p-1.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
                title="Restore session"
              >
                <Play className="w-4 h-4" />
              </button>
              <button
                onClick={onEdit}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDuplicate}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                title="Duplicate"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          
          {/* Tags */}
          {session.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {session.tags.map(tag => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          {/* Favicon preview */}
          <div className="flex items-center justify-between mt-2">
            <div className="favicon-grid">
              {favicons.map((fav, i) => (
                <img
                  key={i}
                  src={fav.url}
                  alt=""
                  className="w-4 h-4 rounded-sm"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://www.google.com/s2/favicons?domain=example.com&sz=32';
                  }}
                />
              ))}
              {session.tabCount > 6 && (
                <span className="text-[10px] text-slate-400 ml-1">
                  +{session.tabCount - 6}
                </span>
              )}
            </div>
            
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {session.windows.map((window, windowIndex) => (
            <div key={window.id} className="bg-slate-50 rounded-lg p-2">
              {/* Window header */}
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-600">
                  Window {windowIndex + 1}
                </span>
                <span className="text-xs text-slate-400">
                  ({window.tabs.length} tab{window.tabs.length !== 1 ? 's' : ''})
                </span>
              </div>
              
              {/* Tab groups */}
              {window.tabGroups.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {window.tabGroups.map(group => (
                    <span
                      key={group.id}
                      className="tab-group-badge"
                      style={{
                        backgroundColor: `${TAB_GROUP_COLORS[group.color]}20`,
                        color: TAB_GROUP_COLORS[group.color],
                      }}
                    >
                      <Layers className="w-2.5 h-2.5 inline mr-1" />
                      {group.title || 'Untitled'}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Tabs list */}
              <div className="space-y-1">
                {window.tabs.slice(0, 5).map(tab => {
                  const group = tab.groupId !== undefined 
                    ? window.tabGroups.find(g => g.id === tab.groupId)
                    : null;
                  
                  return (
                    <a
                      key={tab.id}
                      href={tab.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-1 text-xs text-slate-600 hover:bg-white rounded transition-colors group"
                      style={group ? {
                        borderLeft: `2px solid ${TAB_GROUP_COLORS[group.color]}`,
                        paddingLeft: '6px',
                      } : undefined}
                    >
                      <img
                        src={getFaviconUrl(tab.url, tab.favIconUrl)}
                        alt=""
                        className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://www.google.com/s2/favicons?domain=example.com&sz=32';
                        }}
                      />
                      <span className="truncate flex-1">{tab.title || getDomain(tab.url)}</span>
                      <ExternalLink className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    </a>
                  );
                })}
                {window.tabs.length > 5 && (
                  <p className="text-[10px] text-slate-400 pl-6">
                    +{window.tabs.length - 5} more tab{window.tabs.length - 5 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
