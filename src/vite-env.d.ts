/**
 * Ambient types for the environment variables ARKA reads in the browser bundle.
 *
 * Declared explicitly rather than pulling in `vite/client` (whose `ImportMetaEnv`
 * carries an `any` index signature) so that a typo in a variable name is a compile
 * error instead of a silent `undefined` — which, for a flag that gates demo data,
 * would mean failing open into fixtures.
 *
 * Only `VITE_`-prefixed variables reach the client. Server-side keys
 * (`GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, provider tokens) are deliberately
 * absent here: they must never be bundled.
 */
interface ImportMetaEnv {
  /**
   * `'true'` permits locally-generated demo fixtures in the client.
   *
   * Defaults to absent, which means live-only. Fixtures admitted by this flag are
   * labelled `SEED` or `SIMULATED` wherever they appear — the flag permits demo
   * data, it never disguises it.
   */
  readonly VITE_USE_DEMO_DATA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
