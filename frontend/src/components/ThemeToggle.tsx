import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from './ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/Popover';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme" className="relative">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-36 p-2">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setTheme('light')}
            className={`px-3 py-2 text-sm text-left rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              theme === 'light' ? 'font-medium bg-gray-100 dark:bg-gray-700' : ''
            }`}
          >
            ☀️ Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`px-3 py-2 text-sm text-left rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              theme === 'dark' ? 'font-medium bg-gray-100 dark:bg-gray-700' : ''
            }`}
          >
            🌙 Dark
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`px-3 py-2 text-sm text-left rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              theme === 'system' ? 'font-medium bg-gray-100 dark:bg-gray-700' : ''
            }`}
          >
            💻 System
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
