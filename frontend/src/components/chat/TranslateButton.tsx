import { Globe } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu';
import { useTranslation } from '../../hooks/useTranslation';
import { useState } from 'react';

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
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
        >
          <Globe className="w-4 h-4 mr-1" />
          {loading ? `Translating to ${currentLang}...` : 'Translate'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48" sideOffset={8}>
        <DropdownMenuLabel>Translate to...</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto">
          {LANGUAGES.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleTranslate(lang.code)}
              disabled={loading || translatedLangs.has(lang.code)}
            >
              {lang.name}
              {translatedLangs.has(lang.code) && (
                <span className="ml-auto text-xs text-green-600">✓</span>
              )}
              {loading && currentLang === lang.code && (
                <span className="ml-auto text-xs text-blue-600">...</span>
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
