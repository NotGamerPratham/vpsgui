import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Cpu, Play, Pause, Square, RotateCw, Search, RefreshCw, AlertCircle, Radio, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { apiClient, ApiError } from '../../api/client';
import { livePollDelay, isHaltingStatus } from '../../lib/livePoll';

interface ServiceItem {
  id: string;
  name: string;
  alias: string;
  status: 'active' | 'inactive' | 'failed';
  subState: string;
  /** null when the agent could not determine boot-time enablement. */
  enabled: boolean | null;
  category: string;
}

/**
 * How often the unit list is re-read while live.
 *
 * Slower than the 3s telemetry poll on purpose: this runs two `systemctl` calls (`list-units` plus
 * `list-unit-files`) over several hundred units, which is far heavier than reading /proc, and a
 * service's state changes on a human timescale rather than a per-second one.
 */
const LIVE_INTERVAL_MS = 5000;

export function ServicesPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionServiceId, setActionServiceId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Live refresh is on by default; the toggle is there for a host under load. */
  const [live, setLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  /**
   * Set when the agent rejected our credentials, which also stops the loop.
   *
   * The agent locks a client out after repeated failed authentication, so a poller holding a stale
   * token would re-arm that lockout every few seconds and take the page down with 429s. The
   * telemetry poller learned this the same way.
   */
  const [halted, setHalted] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failuresRef = useRef(0);
  /** Guards against two loads overlapping when one response is slower than the interval. */
  const inFlightRef = useRef(false);

  /**
   * Read the unit list.
   *
   * `silent` keeps a background refresh from flashing the spinner and blanking the table every few
   * seconds - the list should update underneath the operator, not flicker. Only the first load and
   * an explicit Refresh show the loading state.
   */
  const loadServices = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (!silent) setLoading(true);

    try {
      const res = await apiClient.get<ServiceItem[]>('/system/services');
      // Report the host's real unit list, or nothing. The previous fallback presented seven
      // invented units (nginx, docker, postgresql, redis...) as "active" whenever the agent was
      // unreachable, so a bare host looked like a fully provisioned one.
      setServices(Array.isArray(res) ? res : []);
      setLoadError(null);
      setLastUpdated(new Date());
      failuresRef.current = 0;
    } catch (e) {
      const authFailure = e instanceof ApiError && isHaltingStatus(e.status);

      if (authFailure) {
        // Stop rather than retry: continuing would extend the agent's lockout indefinitely.
        setHalted(
          e.status === 429
            ? 'Locked out by the agent after repeated failed attempts. Live refresh stopped.'
            : 'Unauthorized - set a valid Agent Token under Settings. Live refresh stopped.'
        );
        setLoadError(
          e.status === 429
            ? 'Locked out by the agent after repeated failed attempts. Wait a few minutes.'
            : 'Unauthorized - set a valid Agent Token under Settings to list systemd units.'
        );
        setServices([]);
      } else {
        failuresRef.current += 1;
        setLoadError(
          `Could not reach the agent: ${e instanceof Error ? e.message : 'unknown error'}`
        );
        // A transient failure must not wipe a list that was correct a moment ago; the error banner
        // already says the reading is stale.
        if (!silent) setServices([]);
      }
    } finally {
      inFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  /**
   * The live loop.
   *
   * Chained timeouts rather than setInterval: on a host where `systemctl` takes longer than the
   * interval, an interval would queue overlapping requests and pile load onto an already-slow
   * machine. Each tick is scheduled only after the previous one finishes.
   */
  useEffect(() => {
    if (!live || halted) return;

    let cancelled = false;

    const tick = async () => {
      // Polling a hidden tab spends the host's CPU on a list nobody is looking at.
      if (typeof document !== 'undefined' && document.hidden) {
        schedule(LIVE_INTERVAL_MS);
        return;
      }
      await loadServices({ silent: true });
      if (cancelled) return;
      schedule(livePollDelay(LIVE_INTERVAL_MS, failuresRef.current));
    };

    function schedule(delay: number) {
      if (cancelled) return;
      timerRef.current = setTimeout(tick, delay);
    }

    schedule(LIVE_INTERVAL_MS);

    // Coming back to the tab should show current state at once. Without this the operator stares
    // at a reading up to one interval old, which is exactly when they are least likely to notice
    // it is stale - they just switched to this tab to check something.
    const onVisible = () => {
      if (document.hidden || cancelled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      void loadServices({ silent: true }).then(() => schedule(LIVE_INTERVAL_MS));
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [live, halted, loadServices]);

  const handleAction = async (svc: ServiceItem, action: 'start' | 'stop' | 'restart') => {
    setActionServiceId(svc.id);
    setActionError(null);
    try {
      // Runs `systemctl <action> <name>` on the host via the agent (requires an Agent Token under
      // Settings). The result is honoured: previously the row flipped to the requested state even
      // when the call failed, so a service that refused to stop still showed as stopped.
      const res = await apiClient.post<{ success: boolean; output: string }>(
        '/system/services/action',
        { name: svc.name, action },
        60000
      );
      if (!res?.success) {
        setActionError(`${action} ${svc.name} failed: ${(res?.output || 'unknown error').slice(0, 300)}`);
      }
    } catch (e) {
      setActionError(
        `${action} ${svc.name} failed: ${e instanceof Error ? e.message : 'agent unreachable'}`
      );
    } finally {
      setActionServiceId(null);
    }
    // Re-read the real unit state instead of guessing it from the requested action.
    await loadServices();
  };

  const filteredServices = services.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.alias.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <span>Linux Systemd Services Manager</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inspect, start, stop, restart, and manage active systemd unit daemons on your host Linux VPS.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Live state, and when the list was last actually read - so a frozen page is
              distinguishable from a host on which nothing is changing. */}
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
            <span
              className={`h-2 w-2 rounded-full ${
                halted
                  ? 'bg-rose-500'
                  : live
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-muted-foreground/50'
              }`}
            />
            {halted
              ? 'stopped'
              : live
                ? `live${lastUpdated ? ` · ${lastUpdated.toLocaleTimeString()}` : ''}`
                : 'paused'}
          </span>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // Restarting after a lockout has to clear the halt, or the loop stays stopped.
              setHalted(null);
              failuresRef.current = 0;
              setLive((v) => !v);
            }}
            className="gap-1.5 text-xs"
          >
            {live && !halted ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{live && !halted ? 'Pause' : 'Resume'}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setHalted(null);
              failuresRef.current = 0;
              void loadServices();
            }}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{actionError}</span>
        </div>
      )}

      {loadError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search systemd services..."
            className="pl-9 text-xs bg-card"
          />
        </div>

        <div className="text-xs text-muted-foreground font-mono">
          Total Services: <strong className="text-foreground">{filteredServices.length}</strong>
        </div>
      </div>

      {!loading && !loadError && services.length === 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
          No systemd units reported. systemd is only available on Linux hosts.
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((svc) => (
          <Card key={svc.id} className="bg-card/80 border-border/70 hover:border-primary/40 transition-all flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-foreground font-mono">{svc.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{svc.alias}</p>
                  </div>
                </div>

                <Badge
                  variant={svc.status === 'active' ? 'success' : svc.status === 'failed' ? 'destructive' : 'outline'}
                  className="text-[10px] px-1.5 py-0 font-mono"
                >
                  {svc.status.toUpperCase()} ({svc.subState})
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0 flex-1 flex flex-col justify-between">
              {/* Colour follows the real unit state; this row used to render green with a live
                  "pinging" indicator even for stopped and failed units. */}
              <div className="flex items-center justify-between text-[11px] border-t border-border/40 pt-2 text-muted-foreground">
                <span>Unit Status:</span>
                <span
                  className={`font-mono font-semibold flex items-center gap-1 ${svc.status === 'active'
                      ? 'text-emerald-400'
                      : svc.status === 'failed'
                        ? 'text-rose-400'
                        : 'text-muted-foreground'
                    }`}
                >
                  <Radio className={`h-3 w-3 ${svc.status === 'active' ? 'animate-ping' : ''}`} /> {svc.subState}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Start on boot:</span>
                <span className="font-mono">
                  {svc.enabled === null ? 'unknown' : svc.enabled ? 'enabled' : 'disabled'}
                </span>
              </div>

              <div className="flex items-center space-x-1.5 pt-2">
                {svc.status === 'active' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(svc, 'stop')}
                    disabled={actionServiceId === svc.id}
                    className="h-7 text-[10px] gap-1 hover:bg-rose-500/20 hover:text-rose-400 border-border/60"
                  >
                    <Square className="h-3 w-3" />
                    <span>Stop</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(svc, 'start')}
                    disabled={actionServiceId === svc.id}
                    className="h-7 text-[10px] gap-1 hover:bg-emerald-500/20 hover:text-emerald-400 border-border/60"
                  >
                    <Play className="h-3 w-3" />
                    <span>Start</span>
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(svc, 'restart')}
                  disabled={actionServiceId === svc.id}
                  className="h-7 text-[10px] gap-1 hover:bg-primary/20 hover:text-primary border-border/60"
                >
                  <RotateCw className={`h-3 w-3 ${actionServiceId === svc.id ? 'animate-spin' : ''}`} />
                  <span>Restart</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
