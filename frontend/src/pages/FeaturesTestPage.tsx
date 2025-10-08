import { useState } from 'react';
import { VoiceRecorder } from '../components/chat/VoiceRecorder';
import { ScheduleMessageModal } from '../components/chat/ScheduleMessageModal';
import { TranslateButton } from '../components/chat/TranslateButton';
import { PresenceDot } from '../components/chat/PresenceDot';
import { TypingIndicator } from '../components/chat/TypingIndicatorNew';
import { MessageInputWithDrafts } from '../components/chat/DraftExamples';
import type { UserStatus } from '../hooks/useUserPresence';

interface Translation {
  language: string;
  text: string;
  timestamp: Date;
}

export function FeaturesTestPage() {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${result}`]);
  };

  const statuses: UserStatus[] = ['ONLINE', 'OFFLINE', 'AWAY', 'BUSY', 'DO_NOT_DISTURB'];

  return (
    <div className="min-h-screen py-8 bg-gray-50">
      <div className="container max-w-6xl px-4 mx-auto space-y-8">
        {/* Header */}
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">
            🧪 Features Test Page
          </h1>
          <p className="text-gray-600">
            Test all 6 new features here. Open browser console (F12) for detailed logs.
          </p>
        </div>

        {/* Backend Status Warning */}
        <div className="p-4 border-l-4 border-yellow-400 bg-yellow-50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="mb-2 font-semibold text-yellow-900">Backend Not Running</h3>
              <p className="mb-2 text-sm text-yellow-800">
                Errors like "<code className="px-1 font-mono text-xs bg-yellow-100 rounded">ERR_CONNECTION_REFUSED</code>" are <strong>normal</strong> because backend is not started.
              </p>
              <div className="space-y-1 text-sm text-yellow-800">
                <p><strong>✅ Works without backend:</strong> Presence Dots, Voice Recorder, Schedule Modal, Translation Button (UI only)</p>
                <p><strong>⏳ Needs backend:</strong> Typing Indicator, Message Drafts (API + persistence)</p>
              </div>
              <details className="mt-2">
                <summary className="text-sm font-medium text-yellow-900 cursor-pointer hover:text-yellow-700">
                  🚀 How to start backend?
                </summary>
                <pre className="p-2 mt-2 overflow-x-auto text-xs bg-yellow-100 rounded">
cd backend
npm run start:dev
                </pre>
              </details>
            </div>
          </div>
        </div>

        {/* Test Results Panel */}
        {testResults.length > 0 && (
          <div className="p-4 border border-green-200 rounded-lg bg-green-50">
            <h3 className="mb-2 font-semibold text-green-900">✅ Test Results:</h3>
            <div className="space-y-1 overflow-y-auto max-h-40">
              {testResults.map((result, i) => (
                <div key={i} className="font-mono text-sm text-green-800">
                  {result}
                </div>
              ))}
            </div>
            <button
              onClick={() => setTestResults([])}
              className="mt-2 text-xs text-green-600 underline hover:text-green-800"
            >
              Clear Results
            </button>
          </div>
        )}

        {/* 1. User Presence Dots */}
        <section className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">👤</span>
            <h2 className="text-2xl font-semibold">1. User Presence Status</h2>
          </div>
          <p className="mb-4 text-gray-600">
            Test different user status indicators with colors and tooltips.
          </p>
          <div className="flex flex-wrap gap-6">
            {statuses.map(status => (
              <div
                key={status}
                className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50"
              >
                <PresenceDot status={status} showTooltip />
                <span className="font-medium">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 2. Voice Recorder */}
        <section className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🎤</span>
            <h2 className="text-2xl font-semibold">2. Voice Recorder</h2>
          </div>
          <p className="mb-4 text-gray-600">
            Click record button, speak, then stop. Play to preview, send to test callback.
          </p>
          <div className="inline-block p-4 rounded-lg bg-gray-50">
            <VoiceRecorder
              onRecordComplete={(blob, duration) => {
                console.log('✅ Voice recorded:', { size: blob.size, duration, type: blob.type });
                addTestResult(`Voice recorded: ${duration.toFixed(1)}s, ${(blob.size / 1024).toFixed(1)}KB`);
                alert(`✅ Voice Recorded!\nDuration: ${duration.toFixed(1)}s\nSize: ${(blob.size / 1024).toFixed(1)}KB`);
              }}
              onCancel={() => {
                console.log('❌ Recording cancelled');
                addTestResult('Recording cancelled');
              }}
            />
          </div>
        </section>

        {/* 3. Schedule Message */}
        <section className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📅</span>
            <h2 className="text-2xl font-semibold">3. Schedule Message</h2>
          </div>
          <p className="mb-4 text-gray-600">
            Open modal, select future date & time, schedule the message.
          </p>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-6 py-3 font-medium text-white bg-blue-500 rounded-lg shadow-sm hover:bg-blue-600"
          >
            Open Schedule Modal
          </button>
          
          <ScheduleMessageModal
            open={showScheduleModal}
            onClose={() => {
              console.log('Modal closed');
              setShowScheduleModal(false);
            }}
            onSchedule={(date) => {
              console.log('✅ Message scheduled for:', date);
              addTestResult(`Message scheduled for: ${date.toLocaleString()}`);
              alert(`✅ Message Scheduled!\n${date.toLocaleString()}`);
              setShowScheduleModal(false);
            }}
          />
        </section>

        {/* 4. Translation Button */}
        <section className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🌍</span>
            <h2 className="text-2xl font-semibold">4. Translation Button</h2>
          </div>
          <p className="mb-4 text-gray-600">
            Click translation button and select a language. Dropdown shows 10 languages with hover effects.
          </p>
          <div className="p-4 space-y-3 rounded-lg bg-gray-50">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="mb-1 text-sm text-gray-500">Sample Message:</p>
                <p className="font-medium">"Hello, how are you? I hope you're having a great day!"</p>
              </div>
              <TranslateButton
                messageId="test-msg-123"
                onTranslated={(translatedText, lang) => {
                  console.log('✅ Translated:', { lang, text: translatedText });
                  addTestResult(`Translation: ${lang} - ${translatedText}`);
                  // Add to translations state
                  setTranslations(prev => [
                    ...prev,
                    { language: lang, text: translatedText, timestamp: new Date() }
                  ]);
                }}
              />
            </div>
            <div className="p-3 text-sm border-l-4 border-green-400 bg-green-50">
              <strong>✅ Demo Mode:</strong> Using <code className="px-1 text-xs font-mono bg-green-100 rounded">test-msg-123</code> triggers backend demo mode.
              <br />
              <strong>🎉 Full Test:</strong> Translation API works with mock data! Try Vietnamese, Japanese, or French!
            </div>
          </div>

          {/* Translation Results */}
          {translations.length > 0 && (
            <div className="p-4 mt-4 border border-green-200 rounded-lg bg-green-50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-green-900">
                  ✅ Translation Results ({translations.length})
                </h3>
                <button
                  onClick={() => setTranslations([])}
                  className="px-3 py-1 text-xs text-gray-600 transition-colors bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-3">
                {translations.map((trans, i) => {
                  const languageNames: Record<string, string> = {
                    en: 'English',
                    vi: 'Tiếng Việt 🇻🇳',
                    ja: '日本語 🇯🇵',
                    zh: '中文 🇨🇳',
                    ko: '한국어 🇰🇷',
                    fr: 'Français 🇫🇷',
                    es: 'Español 🇪🇸',
                    de: 'Deutsch 🇩🇪',
                    ru: 'Русский 🇷🇺',
                    ar: 'العربية 🇸🇦',
                  };
                  
                  return (
                    <div key={i} className="p-3 transition-shadow bg-white border border-green-200 rounded-lg hover:shadow-md">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded">
                            {trans.language.toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            {languageNames[trans.language] || trans.language}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {trans.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-gray-800">{trans.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 5. Typing Indicator */}
        <section className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">💬</span>
            <h2 className="text-2xl font-semibold">5. Typing Indicator</h2>
          </div>
          <p className="mb-4 text-gray-600">
            Shows when other users are typing (requires backend WebSocket connection).
          </p>
          
          {/* How to Test Banner */}
          <div className="p-4 mb-4 border-l-4 border-blue-400 bg-blue-50">
            <h3 className="mb-2 font-semibold text-blue-900">🧪 How to Test:</h3>
            <ol className="space-y-1 text-sm text-blue-800">
              <li><strong>1.</strong> Open this page in <strong>2 tabs</strong> (or 2 browsers)</li>
              <li><strong>2.</strong> In Tab 1: Click the input below and start typing</li>
              <li><strong>3.</strong> In Tab 2: Watch for animated dots (🟣🔵⚫) appear</li>
              <li><strong>4.</strong> Stop typing → Dots disappear after 3 seconds</li>
            </ol>
            <p className="mt-2 text-xs text-blue-600">
              💡 Tip: Right-click tab → Duplicate, or use Chrome + Firefox
            </p>
          </div>
          
          <div className="p-4 rounded-lg bg-gray-50">
            <TypingIndicator currentUserId='system' conversationId="test-conv-123" />
            
            {/* Test Input */}
            <div className="mt-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Type here to test (other tabs will see your typing):
              </label>
              <input
                type="text"
                placeholder="Start typing and watch other tabs..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={() => {
                  // Typing event is handled by WebSocket automatically
                }}
              />
            </div>
          </div>
        </section>

        {/* 6. Message Drafts */}
        <section className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📝</span>
            <h2 className="text-2xl font-semibold">6. Message Drafts (Auto-save)</h2>
          </div>
          <p className="mb-4 text-gray-600">
            Type message, it auto-saves after 1 second. Refresh page to test restore.
          </p>
          <div className="p-4 rounded-lg bg-gray-50">
            <MessageInputWithDrafts
              conversationId="test-conv-123"
              onSend={async (content) => {
                console.log('✅ Sending message:', content);
                addTestResult(`Message sent: "${content.substring(0, 50)}..."`);
                setMessages([...messages, content]);
                alert(`✅ Message Sent!\n"${content}"`);
              }}
            />
          </div>
          
          {messages.length > 0 && (
            <div className="p-4 mt-4 border border-blue-200 rounded-lg bg-blue-50">
              <h3 className="mb-2 font-semibold text-blue-900">📨 Sent Messages:</h3>
              <ul className="space-y-2">
                {messages.map((msg, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
                    <span className="font-mono text-blue-600">#{i + 1}</span>
                    <span className="flex-1">{msg}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Testing Instructions */}
        <section className="p-6 border border-blue-200 rounded-lg bg-blue-50">
          <h2 className="mb-4 text-xl font-semibold text-blue-900">📋 Testing Checklist</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-medium text-blue-800">Without Backend:</h3>
              <ul className="space-y-1 text-sm text-blue-700">
                <li>✅ Presence Dots - Visual test</li>
                <li>✅ Voice Recorder - Recording test</li>
                <li>✅ Schedule Modal - UI test</li>
                <li>✅ Translation Button - UI test</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-blue-800">Requires Backend:</h3>
              <ul className="space-y-1 text-sm text-blue-700">
                <li>🔌 Translation - API integration</li>
                <li>🔌 Typing Indicator - WebSocket</li>
                <li>🔌 Drafts - API persistence</li>
                <li>🔌 Schedule - Cron job test</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Quick Commands */}
        <section className="p-6 text-white bg-gray-800 rounded-lg">
          <h2 className="mb-4 text-xl font-semibold">⚡ Quick Test Commands</h2>
          <div className="space-y-3 font-mono text-sm">
            <div>
              <p className="mb-1 text-gray-400"># Start Backend:</p>
              <code className="block px-3 py-1 bg-gray-900 rounded">cd backend && npm run start:dev</code>
            </div>
            <div>
              <p className="mb-1 text-gray-400"># Test Translation API:</p>
              <code className="block px-3 py-1 bg-gray-900 rounded">
                {`curl -X POST http://localhost:3000/translation/msg-123 -H "Content-Type: application/json" -d '{"targetLanguage":"vi"}'`}
              </code>
            </div>
            <div>
              <p className="mb-1 text-gray-400"># Test Drafts API:</p>
              <code className="block px-3 py-1 bg-gray-900 rounded">
                curl http://localhost:3000/drafts/user -H "X-User-Id: user-1"
              </code>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="py-4 text-sm text-center text-gray-500">
          <p>💡 Open Browser DevTools Console (F12) to see detailed logs</p>
          <p className="mt-1">📚 See FRONTEND_TESTING_GUIDE.md for complete testing documentation</p>
        </div>
      </div>
    </div>
  );
}
