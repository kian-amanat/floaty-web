/* ---------------------------------------------------------------------------
   The handful of rules that only exist on the web.

   Chrome paints autofilled inputs with its own background and text colour, and
   it does it through a pseudo-class no React Native style can reach — so an
   autofilled field arrives as a pale box sitting inside our dark one. Clipping
   that background to the glyphs removes it without having to paint a solid
   colour back over the top, which would break the translucent field.

   The absurd transition delay is the standard way to stop Chrome re-applying
   the background a moment after paint; there is no event to hook instead.
--------------------------------------------------------------------------- */

import { Platform } from 'react-native';
import { c } from './tokens';

const CSS = `
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
input:-webkit-autofill:active {
  -webkit-background-clip: text !important;
  background-clip: text !important;
  -webkit-text-fill-color: ${c.text} !important;
  caret-color: ${c.hot} !important;
  transition: background-color 100000s ease-in-out 0s !important;
}
input:-webkit-autofill::first-line {
  font-family: inherit;
  font-size: inherit;
}
/* Chrome's reveal-password control duplicates the eye already in the field */
input::-ms-reveal,
input::-webkit-credentials-auto-fill-button {
  display: none !important;
  visibility: hidden;
  pointer-events: none;
}
`;

let installed = false;

export function installWebStyles() {
  if (installed || Platform.OS !== 'web') return;
  if (typeof document === 'undefined' || !document.head) return;
  installed = true;
  const el = document.createElement('style');
  el.setAttribute('data-ember', 'true');
  el.textContent = CSS;
  document.head.appendChild(el);
}
