/**
 * Dictionary loader for the spell-check Worker.
 *
 * Vite turns `import x from './foo.aff?url'` into a static module-level
 * constant (the file's URL in the dev server / production bundle). That
 * means `getDictionary()` can call `fetch(affUrl)` from inside the
 * Worker and stream the bytes into `nspell`.
 *
 * Supported languages are an open map — adding a new dictionary is just
 * an entry here plus installing the matching `dictionary-XX` package.
 */
import enAff from './en_US.aff?url';
import enDic from './en_US.dic?url';
// `dictionary-zh-cn` is not on npm; the Chinese language is wired in
// settings as a placeholder for v0.5+ — see UpdaterPanel TODO. We keep
// `zhAff` / `zhDic` typed as string? so future code can opt-in.
import zhAff from './zh_CN.aff?url';
import zhDic from './zh_CN.dic?url';

type Dictionary = {
  aff: Uint8Array;
  dic: Uint8Array;
};

interface DictionaryUrls {
  aff: string;
  dic: string;
}

const TABLES: Record<string, DictionaryUrls> = {
  'en-US': { aff: enAff, dic: enDic },
  'zh-CN': { aff: zhAff, dic: zhDic },
};

async function fetchAsBytes(url: string): Promise<Uint8Array> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load dictionary asset ${url}: ${resp.status}`);
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Returns a Dictionary ready for `nspell(...)`.
 * Throws when the requested language has no bundled dictionary.
 */
export async function getDictionary(lang: string): Promise<Dictionary> {
  const urls = TABLES[lang];
  if (!urls) {
    throw new Error(`No dictionary registered for language "${lang}". Supported: ${Object.keys(TABLES).join(', ')}`);
  }
  // Parallel fetch — aff is small (~3 KB) so the roundtrip is dominated
  // by dic, but running them concurrently still saves a few ms on slow
  // connections.
  const [aff, dic] = await Promise.all([
    fetchAsBytes(urls.aff),
    fetchAsBytes(urls.dic),
  ]);
  return { aff, dic };
}

/** Public list of supported language codes — used by Settings UI. */
export const SUPPORTED_LANGUAGES: ReadonlyArray<string> = Object.keys(TABLES);
