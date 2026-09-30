/**
 * Host half of `dsh-selection-toolbar`.
 *
 * The plugin is a pure Client plugin: every feature lives in the browser
 * bundle (`./client`), which the client module system discovers through this
 * package's `dsh.client` declaration. The Host half exists only so the Loader
 * has a real entry to activate — the Node side of the client module system
 * scans *enabled Loader entries* for web `dsh.client` packages, so the row
 * inserted by `cordis.patch.yml` is what makes the browser bundle part of the
 * boot graph. It therefore owns no Config, no Service and no route.
 *
 * Note: the Client half registers itself with
 * `window.__ModuleLoader__.load({ id })`, and that id must be this package's
 * name, because the id is the graph row key the Client loader executes.
 *
 * @module dsh-selection-toolbar
 */

/** Cordis plugin name for the entry inserted by `cordis.patch.yml`. */
export const name = 'selection-toolbar';

/** Nothing to do on the Host: this plugin contributes only a Client half. */
export function apply() {}
