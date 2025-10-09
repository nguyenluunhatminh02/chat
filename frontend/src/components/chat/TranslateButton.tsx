import { Globe } from 'lucide-react';
import { Button } from '../ui/Button';

import { useTranslation } from '../../hooks/useTranslation';
import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu';

interface TranslateButtonProps {
  messageId: string;
  onTranslated?: (translation: string, language: string) => void;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ru', name: 'Русский' },
  { code: 'ar', name: 'العربية' },
];

export function TranslateButton({ messageId, onTranslated }: TranslateButtonProps) {
  const { translateMessage, loading } = useTranslation();
  const [translatedLangs, setTranslatedLangs] = useState<Set<string>>(new Set());
  const [currentLang, setCurrentLang] = useState<string>('');

  const handleTranslate = async (langCode: string) => {
    console.log('🌐 Frontend: Starting translation to:', langCode, 'for message:', messageId);
    setCurrentLang(langCode);

    try {
      const translation = await translateMessage(messageId, langCode);

      console.log('🌐 Frontend: Translation result:', {
        success: !!translation,
        translatedText: translation?.translatedText,
        targetLanguage: translation?.targetLanguage,
      });

      if (translation?.translatedText) {
        console.log('✅ Frontend: Adding translation to state');
        setTranslatedLangs((prev) => new Set(prev).add(langCode));
        onTranslated?.(translation.translatedText, langCode);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Translation failed';
      console.error('❌ Frontend: Translation failed:', message);
      onTranslated?.(`[Translation failed: ${message}]`, langCode);
    } finally {
      setCurrentLang('');
    }
  };

  return (
    <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" disabled={loading}>
        <Globe className="w-4 h-4 mr-1" />
        {loading ? `Translating to ${currentLang}...` : 'Translate'}
      </Button>
    </DropdownMenuTrigger>

    {/* ✅ Portal + mở lên trên + z-index cao */}
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="start"
        side="top"             // mở lên trên thay vì xuống dưới
        sideOffset={8}
        collisionPadding={8}   // né mép màn hình
        className="z-[9999] min-w-[12rem] p-1 rounded-xl border bg-white/95 text-gray-900 shadow-xl
           dark:bg-neutral-900/95 dark:text-neutral-100 dark:border-neutral-700 backdrop-blur "
      >
        <DropdownMenuLabel>Translate to…</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleTranslate(lang.code)}
            disabled={loading || translatedLangs.has(lang.code)}
            className='p-1.5 rounded-full hover:bg-gray-200 active:bg-gray-300 text-gray-600 hover:text-gray-800'
          >
            {lang.name}
            {translatedLangs.has(lang.code) && (
              <span className="ml-auto text-xs text-green-600">✓</span>
            )}
            {loading && currentLang === lang.code && (
              <span className="ml-auto text-xs">…</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenu>
  );
}
