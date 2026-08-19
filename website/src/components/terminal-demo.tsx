import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

type Line =
  | { kind: 'command'; text: string }
  | { kind: 'output'; text: string; tone?: 'muted' | 'ok' | 'warn' | 'key' };

/**
 * An illustrative session against a fictional host, not a recording of anyone's
 * server. The shape of the JSON matches what /api/v1/system/telemetry really
 * returns, including `smartHealth: null` — the agent reports null for anything
 * it cannot determine, and the demo would be dishonest if it hid that.
 */
const SESSION: Line[] = [
  { kind: 'command', text: 'curl -s $VPS/api/v1/health' },
  { kind: 'output', text: '{ "status": "ok", "agent": "vpsgui-agent", "uptime": 184203 }', tone: 'ok' },
  { kind: 'output', text: '' },
  { kind: 'command', text: 'curl -s $VPS/api/v1/system/telemetry -H "$AUTH"' },
  { kind: 'output', text: '{' },
  { kind: 'output', text: '  "cpuPercent": 12.4,      "cpuCores": 16,', tone: 'key' },
  { kind: 'output', text: '  "memUsedBytes": 9138470912,', tone: 'key' },
  { kind: 'output', text: '  "memTotalBytes": 33619402752,', tone: 'key' },
  { kind: 'output', text: '  "loadAvg": [0.42, 0.55, 0.61],', tone: 'key' },
  { kind: 'output', text: '  "smartHealth": null      // no smartctl on this host', tone: 'warn' },
  { kind: 'output', text: '}' },
  { kind: 'output', text: '' },
  { kind: 'command', text: 'curl -s $VPS/api/v1/docker/containers -H "$AUTH"' },
  { kind: 'output', text: 'postgres-16     running   up 6 days', tone: 'ok' },
  { kind: 'output', text: 'redis-alpine    running   up 6 days', tone: 'ok' },
  { kind: 'output', text: 'nginx-proxy     running   up 2 days', tone: 'ok' },
  { kind: 'output', text: 'backup-runner   exited    (0) 4 hours ago', tone: 'muted' },
];

const TONE_CLASS = {
  muted: 'text-terminal-dim',
  ok: 'text-terminal-accent',
  warn: 'text-warning',
  key: 'text-terminal-fg',
  undefined: 'text-terminal-fg/80',
} as const;

const TYPE_MS = 26;
const AFTER_COMMAND_MS = 320;
const AFTER_OUTPUT_MS = 90;
const RESTART_MS = 4200;

export function TerminalDemo({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(reduced ? SESSION.length : 0);
  const [typed, setTyped] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Readers who asked for less motion get the finished transcript, not a
    // sped-up animation.
    if (reduced) {
      setVisible(SESSION.length);
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const run = (index: number) => {
      if (cancelled) return;

      if (index >= SESSION.length) {
        timer = window.setTimeout(() => {
          if (cancelled) return;
          setVisible(0);
          setTyped('');
          run(0);
        }, RESTART_MS);
        return;
      }

      const line = SESSION[index];

      if (line.kind === 'output') {
        setVisible(index + 1);
        timer = window.setTimeout(() => run(index + 1), AFTER_OUTPUT_MS);
        return;
      }

      // Type the command one character at a time, then commit it.
      let char = 0;
      const tick = () => {
        if (cancelled) return;
        char += 1;
        setTyped(line.text.slice(0, char));

        if (char < line.text.length) {
          timer = window.setTimeout(tick, TYPE_MS);
        } else {
          timer = window.setTimeout(() => {
            if (cancelled) return;
            setTyped('');
            setVisible(index + 1);
            run(index + 1);
          }, AFTER_COMMAND_MS);
        }
      };
      tick();
    };

    run(0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reduced]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible, typed]);

  const pending = SESSION[visible];
  const showCaret = !reduced;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-terminal-border bg-terminal',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-terminal-border px-4 py-2.5">
        <span className="font-mono text-xs text-terminal-dim">agent api &middot; vps.example.com</span>
        <span className="font-mono text-xs text-terminal-dim">bash</span>
      </div>

      {/* Fixed height so the surrounding layout never jumps as lines land. */}
      <div
        ref={scrollRef}
        className="h-[19rem] overflow-y-auto px-4 py-3 font-mono text-[0.78125rem] leading-6 sm:text-[0.8125rem]"
      >
        {SESSION.slice(0, visible).map((line, i) => (
          <div key={i} className="whitespace-pre">
            {line.kind === 'command' ? (
              <>
                <span className="text-terminal-accent">$ </span>
                <span className="text-terminal-fg">{line.text}</span>
              </>
            ) : (
              <span className={TONE_CLASS[line.tone ?? 'undefined']}>
                {line.text || ' '}
              </span>
            )}
          </div>
        ))}

        {typed && pending?.kind === 'command' ? (
          <div className="whitespace-pre">
            <span className="text-terminal-accent">$ </span>
            <span className="text-terminal-fg">{typed}</span>
            {showCaret ? (
              <span className="ml-px inline-block w-[0.55em] animate-caret bg-terminal-accent align-text-bottom text-transparent">
                .
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
