import { useEffect, useState } from 'react';
import { compareVersions } from 'compare-versions';
import { Modal } from '../components/Modal';
import { useT } from '../i18n/use-translation';
import './UpdaterPanel.css';

const RELEASES_PAGE = 'https://github.com/kujirashark/sharkmd/releases';
const LATEST_API = 'https://api.github.com/repos/kujirashark/sharkmd/releases/latest';

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
  const res = await fetch(LATEST_API, {
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
 * We fetch the latest *published* GitHub release and compare it
 * against the version baked into package.json. The user then chooses
 * whether to open the release page in their browser to download
 * manually.
 *
 * Draft releases don't appear in `/releases/latest` — we surface
 * that fact in the error state with a "browse all releases" button
 * so the user can still get to the page manually.
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
// verbatim at build time.
import pkg from '../../package.json' with { type: 'json' };
const CURRENT_VERSION: string = pkg.version;

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function UpdaterPanel({ open, onClose }: UpdaterPanelProps) {
  const t = useT();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

  const refetch = () => setRetryCount((c) => c + 1);

  // Re-fetch every time the panel becomes visible (or on retry).
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setStatus({ kind: 'loading' });
    fetchLatestRelease()
      .then((release) => {
        if (!mounted) return;
        const latestVer = release.tagName.replace(/^v/, '');
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
  }, [open, t, retryCount]);

  const openUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal open={open} onClose={onClose} title={t('update.title')}>
      <div className="updater-panel">
        {status.kind === 'loading' && (
          <div className="updater-state" data-testid="updater-loading">
            <div className="updater-spinner-large" aria-hidden="true" />
            <p className="updater-headline">{t('update.checking')}</p>
            <p className="updater-meta">{t('update.checkingHint')}</p>
          </div>
        )}

        {status.kind === 'upToDate' && (
          <div className="updater-state updater-state-good" data-testid="updater-uptodate">
            <div className="updater-icon updater-icon-good" aria-hidden="true">✓</div>
            <p className="updater-headline" data-testid="updater-uptodate-headline">
              {t('update.upToDate')}
            </p>
            <p className="updater-version-tag">v{status.version}</p>
            <p className="updater-meta">{t('update.upToDateHint')}</p>
            <div className="updater-actions">
              <button
                className="updater-btn"
                data-testid="updater-browse-releases"
                onClick={() => openUrl(RELEASES_PAGE)}
              >
                {t('update.browseReleases')}
              </button>
              <button
                className="updater-btn updater-btn-primary"
                data-testid="updater-close"
                onClick={onClose}
              >
                {t('update.close')}
              </button>
            </div>
          </div>
        )}

        {status.kind === 'newer' && (
          <div className="updater-state updater-state-good" data-testid="updater-newer">
            <div className="updater-version-row">
              <span className="updater-version-current">v{status.release.tagName}</span>
              <span className="updater-version-arrow" aria-hidden="true">↓</span>
              <span className="updater-version-current updater-version-mine">v{CURRENT_VERSION}</span>
            </div>
            <p className="updater-headline">{t('update.newerTitle')}</p>
            <p className="updater-meta">
              {t('update.publishedAt', { date: formatDate(status.release.publishedAt) })}
            </p>
            {status.release.body && (
              <details className="updater-notes">
                <summary>{t('update.releaseNotes')}</summary>
                <pre className="updater-notes-body">{status.release.body}</pre>
              </details>
            )}
            <div className="updater-actions">
              <button
                className="updater-btn updater-btn-primary"
                data-testid="updater-open-release"
                onClick={() => openUrl(status.release.htmlUrl)}
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
          <div className="updater-state updater-state-bad" data-testid="updater-error">
            <div className="updater-icon updater-icon-bad" aria-hidden="true">!</div>
            <p className="updater-headline">{t('update.error.title')}</p>
            <p className="updater-meta">{status.message}</p>
            <p className="updater-hint">
              {status.reason === 'api'
                ? t('update.error.apiHint')
                : t('update.error.networkHint')}
            </p>
            <div className="updater-actions">
              <button
                className="updater-btn"
                data-testid="updater-browse-releases"
                onClick={() => openUrl(RELEASES_PAGE)}
              >
                {t('update.browseReleases')}
              </button>
              <button
                className="updater-btn updater-btn-primary"
                data-testid="updater-retry"
                onClick={refetch}
              >
                {t('update.retry')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
