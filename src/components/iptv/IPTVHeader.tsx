import { LayoutGrid, Settings, User, Power, type LucideIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import TVFocusable from './TVFocusable';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import {
  getActivePlaylistDisplayName,
  getXtreamCredentialsForApp,
  shouldUseXtreamApiForActivePlaylist,
} from '@/lib/playlistsStorage';
import { usePlaylistCredentialsRevision } from '@/hooks/usePlaylistCredentialsRevision';
import { useBackendApiRevision } from '@/hooks/useBackendApiRevision';
import { useAppDataReloadRevision } from '@/hooks/useAppDataReloadRevision';
import { getDeviceMacAddressForDisplay } from '@/lib/deviceMac';
import { HOME_PATH, TV_QUICK_TEST } from '@/lib/tvQuickTest';
import {
  fetchXtreamAccountSnapshot,
  formatXtreamExpDateDisplay,
  type XtreamAccountSnapshot,
} from '@/services/xtream';

interface HeaderActionItem {
  icon: LucideIcon;
  label: 'Settings' | 'Profile' | 'Power';
  onSelect?: () => void;
}

function attemptExitApp(): void {
  const nav = window.navigator as Navigator & { app?: { exitApp?: () => void } };
  if (typeof nav.app?.exitApp === 'function') {
    nav.app.exitApp();
    return;
  }
  window.close();
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0 py-1 border-b border-border/20 last:border-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-tight">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground break-words leading-snug">{value}</span>
    </div>
  );
}

function formatTrialLabel(raw: string | undefined): string {
  if (raw == null || raw === '') return '—';
  if (raw === '1' || raw.toLowerCase() === 'true') return 'Yes';
  if (raw === '0' || raw.toLowerCase() === 'false') return 'No';
  return raw;
}

const IPTVHeader: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const credRevision = usePlaylistCredentialsRevision();
  const dataReloadRevision = useAppDataReloadRevision();
  const backendApiRevision = useBackendApiRevision();
  const [time, setTime] = useState(new Date());
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  /** Sair: ← Não (default) · Sim → */
  const [exitChoice, setExitChoice] = useState<'no' | 'yes'>('no');
  const exitChoiceRef = useRef<'no' | 'yes'>('no');
  const exitNoBtnRef = useRef<HTMLButtonElement>(null);
  const exitYesBtnRef = useRef<HTMLButtonElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountDetails, setAccountDetails] = useState<XtreamAccountSnapshot | null>(null);
  const [deviceMacDisplay, setDeviceMacDisplay] = useState('—');

  const syncExitChoice = useCallback((v: 'no' | 'yes') => {
    exitChoiceRef.current = v;
    setExitChoice(v);
  }, []);

  const openExitDialog = useCallback(() => {
    syncExitChoice('no');
    setExitDialogOpen(true);
  }, [syncExitChoice]);
  const openAccountDialog = useCallback(() => setAccountOpen(true), []);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!exitDialogOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        (e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
        syncExitChoice('no');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        (e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
        syncExitChoice('yes');
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        (e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
        if (exitChoiceRef.current === 'no') setExitDialogOpen(false);
        else attemptExitApp();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [exitDialogOpen, syncExitChoice]);

  /** Mantém o foco do teclado no botão que corresponde a `exitChoice` (evita anel no “Não” com “Sim” selecionado). */
  useEffect(() => {
    if (!exitDialogOpen) return;
    const t = window.setTimeout(() => {
      if (exitChoice === 'no') exitNoBtnRef.current?.focus({ preventScroll: true });
      else exitYesBtnRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(t);
  }, [exitDialogOpen, exitChoice]);

  useEffect(() => {
    if (!accountOpen) return;
    setDeviceMacDisplay(getDeviceMacAddressForDisplay());
  }, [accountOpen]);

  useEffect(() => {
    if (!accountOpen) return;

    let cancelled = false;
    setAccountError(null);
    setAccountDetails(null);

    if (!shouldUseXtreamApiForActivePlaylist()) {
      setAccountLoading(false);
      return;
    }

    setAccountLoading(true);
    void (async () => {
      try {
        const snap = await fetchXtreamAccountSnapshot(getXtreamCredentialsForApp());
        if (cancelled) return;
        if (!snap) {
          setAccountError('Could not load data from the server.');
          return;
        }
        setAccountDetails(snap);
      } catch {
        if (!cancelled) setAccountError('Failed to load account information.');
      } finally {
        if (!cancelled) setAccountLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountOpen, credRevision, dataReloadRevision, backendApiRevision]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  const isHome = pathname === HOME_PATH;

  const headerActions: HeaderActionItem[] = isHome
    ? [
        { icon: User, label: 'Profile', onSelect: openAccountDialog },
        { icon: Power, label: 'Power', onSelect: openExitDialog },
      ]
    : [
        { icon: Settings, label: 'Settings', onSelect: () => navigate('/settings') },
        { icon: Power, label: 'Power', onSelect: openExitDialog },
      ];

  const playlistLabel = getActivePlaylistDisplayName();
  const creds = getXtreamCredentialsForApp();
  const xtreamActive = shouldUseXtreamApiForActivePlaylist();

  return (
    <>
      <header className="flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-2">
          <TVFocusable
            id={isHome ? 'iptv-home-header-logo' : 'iptv-header-logo'}
            onSelect={() => navigate(HOME_PATH)}
            className="flex items-center gap-3 rounded-lg px-3 py-2"
            focusScale={false}
          >
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center neon-text">
                <span className="font-display font-bold text-primary text-lg">TV</span>
              </div>
              <span className="font-display font-bold text-xl text-foreground tracking-tight">
                Stream<span className="text-primary">Pro</span>
              </span>
            </div>
          </TVFocusable>
          {TV_QUICK_TEST && !isHome ? (
            <TVFocusable
              id="iptv-header-menu"
              onSelect={() => navigate(HOME_PATH)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 glass-card"
              focusScale={false}
              glowOnFocus
            >
              <LayoutGrid className="h-5 w-5 text-muted-foreground" aria-hidden />
              <span className="font-display text-sm font-medium text-foreground">Menu</span>
            </TVFocusable>
          ) : null}
        </div>

        <div className="text-center">
          <div className="font-display text-3xl font-semibold text-foreground tracking-wider">
            {formatTime(time)}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{formatDate(time)}</div>
        </div>

        <div className="flex items-center gap-2">
          {headerActions.map(({ icon: Icon, label, onSelect }) => (
            <TVFocusable
              key={label}
              id={
                isHome && label === 'Profile'
                  ? 'iptv-home-header-profile'
                  : isHome && label === 'Power'
                    ? 'iptv-home-header-power'
                    : undefined
              }
              onSelect={onSelect}
              className="p-3 rounded-xl glass-card"
              focusScale={false}
              glowOnFocus
            >
              <Icon className="w-5 h-5 text-muted-foreground" />
            </TVFocusable>
          ))}
        </div>
      </header>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg gap-2 overflow-y-auto border-border/50 bg-card/95 p-4 shadow-xl backdrop-blur-md sm:max-w-lg">
          <DialogHeader className="space-y-0 pb-0">
            <DialogTitle className="sr-only">Account</DialogTitle>
            <DialogDescription asChild>
              <div className="text-left text-muted-foreground">
                <span className="text-sm leading-snug">
                  Active playlist: <span className="text-foreground font-medium">{playlistLabel}</span>
                </span>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/70 font-mono tabular-nums tracking-wide">
                  <span className="sr-only">Device MAC address </span>
                  {deviceMacDisplay}
                </p>
                {!xtreamActive ? (
                  <span className="mt-1.5 block text-xs leading-snug">
                    This playlist is M3U. Provider account details below are only loaded when an Xtream Code playlist
                    is active.
                  </span>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="px-0">
            {!xtreamActive ? (
              <AccountRow label="Server (Xtream used for content)" value={creds.serverUrl} />
            ) : accountLoading ? (
              <p className="py-3 text-center text-sm text-muted-foreground">Loading…</p>
            ) : accountError ? (
              <p className="py-2 text-center text-sm text-destructive">{accountError}</p>
            ) : accountDetails ? (
              <>
                {!accountDetails.authenticated ? (
                  <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs leading-snug text-destructive">
                    Not authenticated with the panel. Status: {accountDetails.status}
                  </p>
                ) : null}
                <AccountRow label="Username" value={accountDetails.username ?? creds.username} />
                <AccountRow label="Status" value={accountDetails.status} />
                <AccountRow
                  label="Account Renewed"
                  value={formatXtreamExpDateDisplay(accountDetails.createdAtRaw)}
                />
                <AccountRow label="Expires" value={formatXtreamExpDateDisplay(accountDetails.expDateRaw)} />
                <AccountRow
                  label="Connections"
                  value={
                    accountDetails.activeCons != null && accountDetails.maxConnections != null
                      ? `${accountDetails.activeCons} / ${accountDetails.maxConnections}`
                      : accountDetails.maxConnections ?? accountDetails.activeCons ?? '—'
                  }
                />
                <AccountRow label="Trial account" value={formatTrialLabel(accountDetails.isTrial)} />
                <AccountRow label="Server URL" value={creds.serverUrl} />
                {accountDetails.serverTimezone ? (
                  <AccountRow label="Server timezone" value={accountDetails.serverTimezone} />
                ) : null}
              </>
            ) : (
              <p className="py-2 text-center text-sm text-muted-foreground">No data.</p>
            )}
          </div>

          <DialogFooter className="mt-0 gap-2 pt-1 sm:justify-center">
            <DialogClose className={cn(buttonVariants(), 'h-9 w-full font-display sm:w-auto')}>Close</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogContent
          className="max-w-md border-border/50 bg-card/95 text-center shadow-xl backdrop-blur-md sm:text-center"
          onOpenAutoFocus={e => {
            e.preventDefault();
            window.setTimeout(() => exitNoBtnRef.current?.focus({ preventScroll: true }), 0);
          }}
        >
          <DialogHeader className="sm:text-center">
            <DialogTitle className="text-center font-display text-lg">
              Deseja sair do aplicativo?
            </DialogTitle>
            <DialogDescription className="sr-only">
              Setas esquerda e direita alternam entre Não e Sim. Enter confirma.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-row justify-between gap-6 px-1 pt-2">
            <button
              ref={exitNoBtnRef}
              type="button"
              className={cn(
                buttonVariants({ variant: exitChoice === 'no' ? 'default' : 'outline' }),
                'm-0 flex-1 font-display'
              )}
              onClick={() => {
                syncExitChoice('no');
                setExitDialogOpen(false);
              }}
            >
              Não
            </button>
            <button
              ref={exitYesBtnRef}
              type="button"
              className={cn(
                buttonVariants({ variant: exitChoice === 'yes' ? 'default' : 'outline' }),
                'm-0 flex-1 font-display'
              )}
              onClick={() => {
                syncExitChoice('yes');
                attemptExitApp();
              }}
            >
              Sim
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IPTVHeader;
