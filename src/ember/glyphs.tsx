/* Line glyphs, drawn rather than pulled from an icon font — the project ships
   none and these are few. Stroke colour is driven by the focus animations. */

import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

type P = { size?: number; tint?: string };

export const Mail = ({ size = 19, tint = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="2.5" y="5.5" width="19" height="13" rx="3.5" fill="none" stroke={tint} strokeWidth={1.5} />
    <Path d="M4.5 8.8l6.2 4.2a2.3 2.3 0 0 0 2.6 0l6.2-4.2" fill="none" stroke={tint} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

export const Lock = ({ size = 19, tint = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="4.2" y="10.4" width="15.6" height="10.4" rx="3.2" fill="none" stroke={tint} strokeWidth={1.5} />
    <Path d="M7.9 10.4V8.1a4.1 4.1 0 0 1 8.2 0v2.3" fill="none" stroke={tint} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

export const User = ({ size = 19, tint = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="8.4" r="3.9" fill="none" stroke={tint} strokeWidth={1.5} />
    <Path d="M4.6 20.2a7.6 7.6 0 0 1 14.8 0" fill="none" stroke={tint} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

export const Eye = ({ size = 20, tint = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M2 12s3.5-5.8 10-5.8S22 12 22 12s-3.5 5.8-10 5.8S2 12 2 12Z" fill="none" stroke={tint} strokeWidth={1.5} strokeLinejoin="round" />
    <Circle cx="12" cy="12" r="2.9" fill="none" stroke={tint} strokeWidth={1.5} />
  </Svg>
);

export const Slash = ({ size = 20, tint = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 4 20 20" stroke={tint} strokeWidth={1.7} strokeLinecap="round" fill="none" />
  </Svg>
);

export const Arrow = ({ size = 18, tint = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke={tint} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const Tick = ({ size = 20, tint = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4.5 12.5l5 5L19.5 7" fill="none" stroke={tint} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const Cross = ({ size = 14, tint = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 6 18 18M18 6 6 18" fill="none" stroke={tint}
      strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);

export const Google = ({ size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.7l7.8 6.1C12.3 14 17.7 9.5 24 9.5Z" />
    <Path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5Z" />
    <Path fill="#FBBC05" d="M10.4 28.2a14.6 14.6 0 0 1 0-8.4l-7.8-6.1a24 24 0 0 0 0 20.6l7.8-6.1Z" />
    <Path fill="#34A853" d="M24 47.5c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.7-4.5-13.6-10.5l-7.8 6.1C6.5 41.6 14.6 47.5 24 47.5Z" />
  </Svg>
);

export const Apple = ({ size = 19, tint = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path fill={tint} d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.865-1.7.025-3.25.99-4.12 2.51-1.76 3.05-.45 7.56 1.26 10.03.84 1.21 1.83 2.57 3.14 2.52 1.26-.05 1.74-.81 3.26-.81 1.52 0 1.95.81 3.28.79 1.36-.02 2.22-1.23 3.05-2.45.96-1.4 1.36-2.76 1.38-2.83-.03-.01-2.65-1.02-2.68-4.04Z" />
    <Path fill={tint} d="M14.2 4.9c.69-.84 1.16-2 1.03-3.16-1 .04-2.21.66-2.92 1.5-.64.74-1.2 1.93-1.05 3.06 1.11.09 2.25-.57 2.94-1.4Z" />
  </Svg>
);
