/* What the form will and will not accept.

   Kept apart from the screen so the rules read in one place, and so they can be
   checked without mounting anything. */

import { strengthOf, PASSES } from './passwordStrength';

export type Mode = 'login' | 'signup';

export type Values = {
  name: string;
  email: string;
  password: string;
  confirm: string;
};

export type Errors = Partial<Record<keyof Values, string>>;

/* Deliberately loose: something@something.tld with no spaces. Anything stricter
   rejects addresses that are perfectly valid, and the real check is always the
   mail that gets sent. Password strength is not defined here — it comes from
   ./passwordStrength, so the rules the meter lists are the rules enforced. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validate(mode: Mode, v: Values): Errors {
  const e: Errors = {};

  if (mode === 'signup' && !v.name.trim()) e.name = 'Tell us what to call you.';

  if (!v.email.trim()) e.email = 'Enter your email.';
  else if (!EMAIL.test(v.email.trim())) e.email = 'That does not look like an email address.';

  if (!v.password) e.password = 'Enter your password.';
  else if (mode === 'signup' && strengthOf(v.password).score < PASSES) {
    /* the meter under the field already lists what is missing, so the message
       only has to say that the bar has not been cleared */
    e.password = 'Not strong enough yet.';
  }

  if (mode === 'signup') {
    if (!v.confirm) e.confirm = 'Type your password again.';
    else if (v.confirm !== v.password) e.confirm = 'These two do not match.';
  }

  return e;
}

export const isClean = (e: Errors) => Object.keys(e).length === 0;
