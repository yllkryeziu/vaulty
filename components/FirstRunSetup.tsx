import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface FirstRunSetupProps {
    onComplete: () => void;
}

export const FirstRunSetup: React.FC<FirstRunSetupProps> = ({ onComplete }) => {
    const [apiKey, setApiKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!apiKey.trim()) {
            setError('Please enter an API key');
            return;
        }

        setIsLoading(true);

        try {
            await invoke('save_api_key', { apiKey: apiKey.trim() });
            onComplete();
        } catch (err) {
            console.error('Failed to save API key:', err);
            setError('Failed to save API key. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = () => {
        // Save empty string to mark setup as completed
        invoke('save_api_key', { apiKey: '' })
            .then(() => onComplete())
            .catch(console.error);
    };

    return (
        <div className="fixed inset-0 bg-black flex items-center justify-center p-8 z-50">
            <div className="max-w-2xl w-full bg-neutral-950 border border-neutral-800 rounded-lg p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-900 rounded-full mb-4">
                        <KeyRound size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome to Vaulty</h1>
                    <p className="text-neutral-400">
                        To extract exercises from PDFs, you'll need a Google Gemini API key.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="api-key" className="block text-sm font-medium text-neutral-300 mb-2">
                            Gemini API Key
                        </label>
                        <input
                            id="api-key"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter your Gemini API key"
                            className="w-full bg-neutral-900 text-white p-3 rounded-md border border-neutral-700 focus:ring-2 focus:ring-white focus:border-white outline-none font-mono text-sm"
                            disabled={isLoading}
                        />
                        <p className="text-xs text-neutral-500 mt-2">
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

                    {error && (
                        <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 bg-white text-black font-semibold py-3 px-5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                'Continue'
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleSkip}
                            disabled={isLoading}
                            className="bg-transparent border border-neutral-700 text-neutral-300 font-semibold py-3 px-5 rounded-md transition-colors hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-neutral-600"
                        >
                            Skip for Now
                        </button>
                    </div>

                    <p className="text-xs text-neutral-500 text-center">
                        You can always set your API key later in Settings
                    </p>
                </form>
            </div>
        </div>
    );
};
