import React, { useState } from 'react';
import { Settings, Palette, Globe, Key } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useUIStore } from '../../store/useUIStore';
import { themeCatalog } from '../../design-system/tokens';
import { LanguageCode } from '../../i18n';

const AGENT_TOKEN_KEY = 'vpsgui_auth_token';

export function SettingsPage() {
  const { theme, setTheme, language, setLanguage } = useUIStore();
  const [agentToken, setAgentToken] = useState(() => localStorage.getItem(AGENT_TOKEN_KEY) || '');
  const [tokenSaved, setTokenSaved] = useState(false);

  const handleSaveToken = () => {
    if (agentToken.trim()) {
      localStorage.setItem(AGENT_TOKEN_KEY, agentToken.trim());
    } else {
      localStorage.removeItem(AGENT_TOKEN_KEY);
    }
    setTokenSaved(true);
    setTimeout(() => setTokenSaved(false), 2000);
  };

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

        {/* Agent Token */}
        <Card className="bg-card/70 border-border/70 p-5 space-y-4 md:col-span-2">
          <div className="flex items-center space-x-2 border-b border-border pb-3">
            <Key className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Agent Token</h3>
          </div>

          <p className="text-xs text-muted-foreground">
            The vpsgui-agent daemon prints a token to its logs on install/startup (also saved to{' '}
            <code className="font-mono text-[11px]">agent/.agent-token</code>). Paste it here to authorize
            terminal command execution and Docker/service start, stop, and restart actions.
          </p>

          {/* A bare password input outside a <form> makes browsers log a DOM warning and breaks
              password-manager association; the field also had no label and no submit-on-Enter. */}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveToken();
            }}
          >
            <label htmlFor="vpsgui-agent-token" className="sr-only">
              Agent token
            </label>
            <Input
              id="vpsgui-agent-token"
              name="vpsgui-agent-token"
              type="password"
              value={agentToken}
              onChange={(e) => setAgentToken(e.target.value)}
              placeholder="Paste agent token..."
              autoComplete="off"
              spellCheck={false}
              className="text-xs bg-card font-mono flex-1"
            />
            <Button type="submit" size="sm" className="text-xs shrink-0">
              {tokenSaved ? 'Saved' : 'Save'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
