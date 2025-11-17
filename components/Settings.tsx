import React, { useState, useEffect } from 'react';
import { KeyRound, Moon, Eye, EyeOff, Save, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const Settings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      const key = await invoke<string | null>('get_api_key');
      if (key && key.length > 0) {
        setApiKey(key);
        setIsApiKeySet(true);
      }
    } catch (err) {
      console.error('Failed to load API key:', err);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSaveSuccess(false);
    setIsSaving(true);

    try {
      await invoke('save_api_key', { apiKey: apiKey.trim() });
      setIsApiKeySet(apiKey.trim().length > 0);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save API key:', err);
      setError('Failed to save API key. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <header className="mb-6 pb-4 border-b border-neutral-900">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-neutral-400">Manage your application settings.</p>
      </header>

      <div className="space-y-8 max-w-2xl">
        {/* API Key Section */}
        <div className="bg-neutral-950/50 rounded-lg border border-neutral-900">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-3">
              <KeyRound size={20} />
              <span>API Configuration</span>
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Your Google Gemini API key is stored securely and encrypted.
            </p>
          </div>
          <div className="border-t border-neutral-900 p-6">
            <label htmlFor="api-key" className="block text-sm font-medium text-neutral-400">
              Gemini API Key
            </label>
            <div className="mt-2 space-y-3">
              <div className="flex items-center gap-3">
                {isEditing ? (
                  <>
                    <input
                      id="api-key"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your Gemini API key"
                      className="flex-1 bg-neutral-800 text-white p-2 rounded-md border border-neutral-700 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm font-mono"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-2 text-neutral-400 hover:text-white rounded-md hover:bg-neutral-800"
                      title={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      id="api-key"
                      type="text"
                      disabled
                      value={isApiKeySet ? '••••••••••••••••••••••••••••••• Set' : 'Not Set'}
                      className="flex-1 bg-neutral-800 text-neutral-400 p-2 rounded-md border border-neutral-700 outline-none cursor-not-allowed text-sm font-mono"
                    />
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${isApiKeySet ? 'bg-green-800/50 text-green-300' : 'bg-red-800/50 text-red-300'}`}>
                      {isApiKeySet ? 'Configured' : 'Missing'}
                    </span>
                  </>
                )}
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              {saveSuccess && (
                <div className="bg-green-900/50 border border-green-700 text-green-300 p-3 rounded-md text-sm">
                  API key saved successfully!
                </div>
              )}

              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-white text-black font-semibold py-2 px-4 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:ring-2 focus:ring-white flex items-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        loadApiKey();
                        setError(null);
                      }}
                      disabled={isSaving}
                      className="bg-transparent border border-neutral-700 text-neutral-300 font-semibold py-2 px-4 rounded-md transition-colors hover:bg-neutral-900 disabled:opacity-50 text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-neutral-800 text-white font-semibold py-2 px-4 rounded-md transition-colors hover:bg-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  >
                    {isApiKeySet ? 'Update API Key' : 'Set API Key'}
                  </button>
                )}
              </div>

              <p className="text-xs text-neutral-500">
                Get your API key from{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-neutral-950/50 rounded-lg border border-neutral-900 opacity-60">
          <div className="p-6">
             <h2 className="text-lg font-semibold text-white flex items-center gap-3">
              <Moon size={20} />
              <span>Appearance</span>
            </h2>
             <p className="text-sm text-neutral-400 mt-1">
              Customize the look and feel of the application.
            </p>
          </div>
           <div className="border-t border-neutral-900 p-6 flex justify-between items-center">
             <div>
                <label htmlFor="dark-mode" className="block text-sm font-medium text-neutral-400">
                Dark Mode
                </label>
                <p className="text-xs text-neutral-500 mt-1">Light mode coming soon.</p>
             </div>
             <div className="relative w-11 h-6 bg-neutral-700 rounded-full cursor-not-allowed">
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
