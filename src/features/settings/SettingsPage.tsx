import React from 'react';
import { Settings, Palette, Globe, Bell, Shield, Key } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useUIStore } from '../../store/useUIStore';
import { themeCatalog, ThemeName } from '../../design-system/tokens';
import { i18nTranslations, LanguageCode } from '../../i18n';

export function SettingsPage() {
  const { theme, setTheme, language, setLanguage } = useUIStore();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <span>VS Code Style Global Preferences</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure appearance theme palette, default SSH credentials, multi-language localization, and notification integrations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Theme Settings Card */}
        <Card className="bg-card/70 border-border/70 p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-border pb-3">
            <Palette className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Theme & Visual Palette</h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {themeCatalog.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`p-3 rounded-lg border text-left text-xs transition-all ${
                  theme === t.id ? 'border-primary bg-primary/10 font-bold' : 'border-border/60 bg-muted/20 hover:border-border'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className="h-3.5 w-3.5 rounded-full border border-border" style={{ backgroundColor: t.accent }} />
                  <span className="text-foreground">{t.name}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Localization & Language */}
        <Card className="bg-card/70 border-border/70 p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-border pb-3">
            <Globe className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Language & Localization</h3>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['en', 'de', 'fr', 'es', 'hi', 'ja'] as LanguageCode[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`p-2.5 rounded-lg border text-center text-xs font-mono uppercase transition-all ${
                  language === lang ? 'border-primary bg-primary/10 font-bold text-primary' : 'border-border/60 bg-muted/20 text-muted-foreground'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
