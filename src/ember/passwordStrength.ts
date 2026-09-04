/* ---------------------------------------------------------------------------
   Password strength.

   The rules and scoring from the shadcn `password-input-2` component, kept as
   plain data so they can be checked without mounting anything and so the form's
   validation and the meter cannot drift apart — both read from here.

   The component's own `aria-invalid` treats a score under 4 as unacceptable, so
   that is the bar the form enforces too.
--------------------------------------------------------------------------- */

export type StrengthScore = 0 | 1 | 2 | 3 | 4 | 5;

export const REQUIREMENTS = [
  { regex: /.{8,}/, text: 'At least 8 characters' },
  { regex: /[0-9]/, text: 'At least 1 number' },
  { regex: /[a-z]/, text: 'At least 1 lowercase letter' },
  { regex: /[A-Z]/, text: 'At least 1 uppercase letter' },
  { regex: /[!-\/:-@[-`{-~]/, text: 'At least 1 special character' },
] as const;

export type Requirement = { met: boolean; text: string };
export type Strength = { score: StrengthScore; requirements: Requirement[] };

/** The bar that has to be cleared to create an account. */
export const PASSES = 4;

export const CAPTIONS: Record<StrengthScore, string> = {
  0: 'Enter a password',
  1: 'Weak',
  2: 'Getting there',
  3: 'Good',
  4: 'Strong',
  5: 'Very strong',
};

/* Warm through the middle and green only at the top, so "done" is the one
   moment the screen leaves its own palette. */
export const TONES: Record<StrengthScore, string> = {
  0: 'rgba(255,255,255,0.10)',
  1: '#E4573D',
  2: '#E8621F',
  3: '#F0A03A',
  4: '#F5C451',
  5: '#3FBF7F',
};

export function strengthOf(password: string): Strength {
  const requirements = REQUIREMENTS.map((r) => ({
    met: r.regex.test(password),
    text: r.text,
  }));
  return {
    score: requirements.filter((r) => r.met).length as StrengthScore,
    requirements,
  };
}
