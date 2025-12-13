import { useState, useEffect } from 'react';
import { X, Sun, Moon, Monitor, Crown, Check, ExternalLink, Download, Upload, Shield } from 'lucide-react';
import type { Settings } from '../types/session';
import { DEFAULT_SETTINGS } from '../types/session';
import { getPaymentStatus, openPaymentPage, type UserPaymentStatus } from '../lib/payment';

interface SettingsModalProps {
  onClose: () => void;
  onSettingsChange: () => void;
}

export function SettingsModal({ onClose, onSettingsChange }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<UserPaymentStatus | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      setSettings(data);

      // Load payment status
      try {
        const status = await getPaymentStatus();
        setPaymentStatus(status);
        
        // Sync payment status with settings
        if (status.paid && !data.isPro) {
          await chrome.runtime.sendMessage({ 
            type: 'UPDATE_SETTINGS', 
            payload: { isPro: true } 
          });
          setSettings({ ...data, isPro: true });
          onSettingsChange();
        }
      } catch (error) {
        console.log('Payment status check failed:', error);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updates: Partial<Settings>) => {
    try {
      await chrome.runtime.sendMessage({ 
        type: 'UPDATE_SETTINGS', 
        payload: updates 
      });
      setSettings(prev => ({ ...prev, ...updates }));
      onSettingsChange();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleUpgrade = () => {
    setLoadingPayment(true);
    openPaymentPage();
    setTimeout(() => {
      setLoadingPayment(false);
    }, 1000);
  };

  const handleExport = async () => {
    try {
      const data = await chrome.runtime.sendMessage({ type: 'EXPORT_DATA' });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tabvault-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await chrome.runtime.sendMessage({ type: 'IMPORT_DATA', payload: data });
        onSettingsChange();
        alert('Data imported successfully!');
      } catch (error) {
        console.error('Import failed:', error);
        alert('Failed to import data. Please check the file format.');
      }
    };
    input.click();
  };

  const isPro = settings.isPro || paymentStatus?.paid;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-80">
          <p className="text-center text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="modal-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="modal-content bg-white dark:bg-slate-800 rounded-xl w-[340px] max-h-[500px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Pro Status / Upgrade */}
          {!isPro ? (
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/30 rounded-xl p-4 border border-teal-200 dark:border-teal-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Upgrade to Pro</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Unlimited sessions & more</p>
                </div>
              </div>
              <div className="space-y-1 mb-3 text-xs text-slate-600 dark:text-slate-400">
                <p>- Unlimited saved sessions</p>
                <p>- Workspaces for organization</p>
                <p>- Automatic cloud backup</p>
                <p>- Session history & undo</p>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={loadingPayment}
                className="w-full px-4 py-2.5 text-sm font-medium text-white 
                         bg-gradient-to-r from-teal-500 to-cyan-500 
                         hover:from-teal-600 hover:to-cyan-600 
                         rounded-xl transition-all shadow-md
                         disabled:opacity-70 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
              >
                {loadingPayment ? 'Opening...' : '$2.99/mo or $29 Lifetime'}
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-green-700 dark:text-green-400 font-semibold">Pro Activated</span>
                  {paymentStatus?.paidAt && (
                    <p className="text-xs text-green-600 dark:text-green-500">
                      Since {new Date(paymentStatus.paidAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              {[
                { value: 'light', icon: Sun, label: 'Light' },
                { value: 'dark', icon: Moon, label: 'Dark' },
                { value: 'system', icon: Monitor, label: 'System' },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => saveSettings({ theme: value as Settings['theme'] })}
                  className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
                    settings.theme === value
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${
                    settings.theme === value 
                      ? 'text-teal-600 dark:text-teal-400' 
                      : 'text-slate-500'
                  }`} />
                  <span className={`text-xs font-medium ${
                    settings.theme === value 
                      ? 'text-teal-600 dark:text-teal-400' 
                      : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Restore Options */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Restore Options
            </label>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-600 dark:text-slate-400">Restore tab groups</span>
                <button
                  onClick={() => saveSettings({ restoreTabGroups: !settings.restoreTabGroups })}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    settings.restoreTabGroups ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                    settings.restoreTabGroups ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-600 dark:text-slate-400">Restore window positions</span>
                <button
                  onClick={() => saveSettings({ restoreWindowPositions: !settings.restoreWindowPositions })}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    settings.restoreWindowPositions ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                    settings.restoreWindowPositions ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-600 dark:text-slate-400">Confirm before restore</span>
                <button
                  onClick={() => saveSettings({ confirmBeforeRestore: !settings.confirmBeforeRestore })}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    settings.confirmBeforeRestore ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                    settings.confirmBeforeRestore ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-600 dark:text-slate-400">Close current tabs on restore</span>
                <button
                  onClick={() => saveSettings({ closeCurrentBeforeRestore: !settings.closeCurrentBeforeRestore })}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    settings.closeCurrentBeforeRestore ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                    settings.closeCurrentBeforeRestore ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </label>
            </div>
          </div>

          {/* Data Management */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              <Shield className="w-4 h-4 inline mr-1" />
              Data Backup
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={handleImport}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Export your sessions regularly to prevent data loss.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <p className="text-xs text-slate-500">TabVault v1.0.0</p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
