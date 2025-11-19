import React, { useState, useContext, useEffect } from 'react';
import { Key, Save, AlertTriangle, ExternalLink, Moon, Sun } from 'lucide-react';
import { Button } from './Button';
import { ApiKeyContext, ThemeContext } from '../App.tsx';
import { SETTINGS_KEY } from '../constants';

export const Settings = () => {
  const { apiKey, setApiKey } = useContext(ApiKeyContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [inputKey, setInputKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (apiKey) setInputKey(apiKey);
  }, [apiKey]);

  const handleSave = () => {
    setApiKey(inputKey);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ apiKey: inputKey }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Settings</h1>
        <p className="text-neutral-500 dark:text-neutral-400">Manage your application preferences and connections.</p>
      </div>
      
      {/* Appearance */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 mb-6">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white">
                {theme === 'dark' ? <Moon size={24}/> : <Sun size={24}/>}
              </div>
              <div>
                  <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-1">Appearance</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Toggle between light and dark themes.</p>
              </div>
           </div>
           <button 
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 ${theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-200'}`}
           >
              <span 
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} 
              />
           </button>
        </div>
      </div>

      {/* API Key */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
            <Key size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-1">Gemini API Key</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              Vaulty uses Google's Gemini 2.5 Flash model to analyze your documents. 
              Your key is stored locally on your device and never sent to our servers.
            </p>
            
            <div className="flex gap-2 mb-4">
                <input 
                  type="password" 
                  className="flex-1 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                  placeholder="AIzaSy..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                />
                <Button onClick={handleSave} icon={saved ? <Key size={16}/> : <Save size={16}/>}>
                  {saved ? 'Saved' : 'Save Key'}
                </Button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-3 items-start">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-400">
                    <p className="font-semibold mb-1">Don't have a key?</p>
                    <p className="mb-2">You can get a free API key from Google AI Studio.</p>
                    <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center underline hover:text-amber-900 dark:hover:text-amber-300"
                    >
                        Get API Key <ExternalLink size={10} className="ml-1"/>
                    </a>
                </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 border-t border-neutral-200 dark:border-neutral-800 pt-6">
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Data Management</h4>
        <div className="flex gap-4">
             <Button variant="secondary" onClick={() => {
                 if(window.confirm("Are you sure you want to clear all database data? This cannot be undone.")) {
                     localStorage.clear();
                     window.location.reload();
                 }
             }} className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:border-red-800 dark:border-neutral-700 dark:bg-transparent">
                Clear Local Database
             </Button>
        </div>
      </div>
    </div>
  );
};