import { useEffect, useState } from 'react';
import { compareVersions } from 'compare-versions';
import { Modal } from '../components/Modal';
import { useT } from '../i18n/use-translation';
import './UpdaterPanel.css';

const RELEASE_API = 'https://api.github.com/repos/kujirashark/sharkmd/releases/latest';

export interface ReleaseInfo {
  tagName: string;
  /** Raw markdown release notes — may be empty. */
  body: string;
  publishedAt: string;
  htmlUrl: string;
  name: string;
}

/** Public for tests + future automation. Throws on HTTP / network error. */
export async function fetchLatestRelease(): Promise<ReleaseInfo> {
  const res = await fetch(RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    const err: Error & { status?: number } = new Error(
      `GitHub API responded with HTTP ${res.status}`,
    );
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  return {
    tagName: json.tag_name ?? '',
    body: json.body ?? '',
    publishedAt: json.published_at ?? '',
    htmlUrl: json.html_url ?? '',
    name: json.name ?? json.tag_name ?? '',
  };
}

/**
 * UpdaterPanel — manual update check (v0.4 "no signing key" path).
 *
 * UX: user clicks Help → Check for Updates → this panel opens.
 * We fetch the latest GitHub release and compare it against the
 * version baked into package.json. The user then chooses whether to
 * open the release page in their browser to download manually.
 *
 * The dialog intentionally does NOT integrate tauri-plugin-updater.
 * See plan §"关键决策汇总".
 */
type Status =
  | { kind: 'loading' }
  | { kind: 'upToDate'; version: string }
  | { kind: 'newer'; release: ReleaseInfo }
  | { kind: 'error'; reason: 'api' | 'network'; message: string };

export interface UpdaterPanelProps {
  open: boolean;
  onClose: () => void;
}

// Imported via `with { type: 'json' }` so Vite includes the file
// verbatim at build time. The version is the build-time version of
// the app — not the runtime version, which is irrelevant for an
// in-app updater dialog that compares to the published release.
import pkg from '../../package.json' with { type: 'json' };
const CURRENT_VERSION: string = pkg.version;

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Locale-aware but deterministic enough: en-CA gives ISO-style
  // YYYY-MM-DD; fall back to whatever the browser picks.
  return d.toLocaleDateString();
}

export function UpdaterPanel({ open, onClose }: UpdaterPanelProps) {
  const t = useT();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  // Re-fetch every time the panel becomes visible. Cleanup is a no-op
  // since we drive state via setStatus, but we guard against state
  // updates after unmount with a mounted flag.
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setStatus({ kind: 'loading' });
    fetchLatestRelease()
      .then((release) => {
        if (!mounted) return;
        const latestVer = release.tagName.replace(/^v/, '');
        // compareVersions: -1 if current < latest, 0 equal, 1 current > latest.
        const cmp = compareVersions(CURRENT_VERSION, latestVer);
        if (cmp < 0) {
          setStatus({ kind: 'newer', release });
        } else {
          setStatus({ kind: 'upToDate', version: CURRENT_VERSION });
        }
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        if (e && typeof e === 'object' && 'status' in e) {
          const status = (e as { status?: number }).status ?? 0;
          setStatus({
            kind: 'error',
            reason: 'api',
            message: t('update.error.apiError', { status }),
          });
        } else {
          setStatus({
            kind: 'error',
            reason: 'network',
            message: t('update.error.networkError'),
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, [open, t]);

  const openRelease = (url: string) => {
    // Use noopener + noreferrer for the GitHub release page. We avoid
    // window.open returning null on browsers that block popups — the
    // call site always shows the user a button so this is intentional.
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal open={open} onClose={onClose} title={t('update.title')}>
      <div className="updater-panel">
        {status.kind === 'loading' && (
          <div className="updater-loading" data-testid="updater-loading">
            <span className="updater-spinner" aria-hidden="true" />
            <span>{t('update.checking')}</span>
          </div>
        )}

        {status.kind === 'upToDate' && (
          <div className="updater-state" data-testid="updater-uptodate">
            <p className="updater-headline">{t('update.upToDate')}</p>
            <p className="updater-meta">
              {t('update.currentVersion', { version: status.version })}
            </p>
            <div className="updater-actions">
              <button
                className="updater-btn"
                data-testid="updater-close"
                onClick={onClose}
              >
                {t('update.close')}
              </button>
            </div>
          </div>
        )}

        {status.kind === 'newer' && (
          <div className="updater-state" data-testid="updater-newer">
            <p className="updater-headline">
              {t('update.latestVersion', { version: status.release.tagName })}
            </p>
            <p className="updater-meta">
              {t('update.publishedAt', { date: formatDate(status.release.publishedAt) })}
            </p>
            {status.release.body && (
              <details className="updater-notes" open>
                <summary>{t('update.releaseNotes')}</summary>
                <pre className="updater-notes-body">{status.release.body}</pre>
              </details>
            )}
            <div className="updater-actions">
              <button
                className="updater-btn updater-btn-primary"
                data-testid="updater-open-release"
                onClick={() => openRelease(status.release.htmlUrl)}
              >
                {t('update.openRelease')}
              </button>
              <button
                className="updater-btn"
                data-testid="updater-close"
                onClick={onClose}
              >
                {t('update.close')}
              </button>
            </div>
          </div>
        )}

        {status.kind === 'error' && (
          <div className="updater-state updater-error" data-testid="updater-error">
            <p className="updater-headline">{t('update.error.title')}</p>
            <p className="updater-meta">{status.message}</p>
            <div className="updater-actions">
              <button
                className="updater-btn"
                data-testid="updater-close"
                onClick={onClose}
              >
                {t('update.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}