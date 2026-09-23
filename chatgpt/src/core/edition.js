// THE NIGHT COUNT — which build this is.
//
// Two editions of this game exist: one built by Claude, one by ChatGPT. The
// published site carries both side by side, and DEV MODE offers the other.
// Written by nightcount-site/tools/patch_edition.py — edit it there.
export const EDITION = { id: "chatgpt", name: "ChatGPT" };
export const EDITIONS = [
  { id: "claude", name: "Claude" },
  { id: "chatgpt", name: "ChatGPT" },
];

/**
 * Where edition `id` lives, if this page is on the site that carries both
 * (…/claude/ or …/chatgpt/). Anywhere else — the single-file build, a dev
 * server at the root — there is no sibling to go to, and this says so.
 */
export function editionHref(id) {
  const m = /^(.*\/)(claude|chatgpt)\/(index\.html)?$/.exec(location.pathname);
  return m ? m[1] + id + "/" : null;
}
