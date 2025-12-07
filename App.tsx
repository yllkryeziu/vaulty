import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Extractor } from './components/Extractor';
import { Database } from './components/Database';
import { Settings } from './components/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppSettings } from './types';
import { SETTINGS_KEY } from './constants';

const MainLayout = () => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 h-full overflow-hidden relative">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/database" replace />} />
            <Route path="/extractor" element={<Extractor />} />
            <Route path="/database" element={<Database />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
};

const App = () => {
  // Check for API key on mount
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Load Settings
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      const parsed: AppSettings = JSON.parse(savedSettings);
      if (parsed.apiKey) {
        setApiKey(parsed.apiKey);
      }
    }

    // Load Theme
    const savedTheme = localStorage.getItem('vaulty_theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
      if (savedTheme === 'dark') document.documentElement.classList.add('dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }

    setIsLoading(false);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('vaulty_theme', newTheme);

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (isLoading) return <div className="flex h-screen w-full items-center justify-center bg-neutral-50 dark:bg-neutral-950 dark:text-neutral-200">Loading Vaulty...</div>;

  return (
    <HashRouter>
      <ApiKeyContext.Provider value={{ apiKey, setApiKey }}>
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
          <MainLayout />
        </ThemeContext.Provider>
      </ApiKeyContext.Provider>
    </HashRouter>
  );
};

// Contexts
interface ApiKeyContextType {
  apiKey: string | null;
  setApiKey: (key: string) => void;
}
export const ApiKeyContext = React.createContext<ApiKeyContextType>({ apiKey: null, setApiKey: () => { } });

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}
export const ThemeContext = React.createContext<ThemeContextType>({ theme: 'light', toggleTheme: () => { } });

export default App;