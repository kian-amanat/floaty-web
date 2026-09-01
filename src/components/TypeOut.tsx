import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

/** Reveals a string a character at a time, the way the azimuth line lands. */
export default function TypeOut({
  text,
  speed = 34,
  delay = 0,
  style,
  play = true,
}: {
  text: string;
  speed?: number;
  delay?: number;
  style?: StyleProp<TextStyle>;
  play?: boolean;
}) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!play) { setN(0); return; }
    let i = 0;
    let tick: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      tick = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length) clearInterval(tick);
      }, speed);
    }, delay);
    return () => { clearTimeout(start); if (tick) clearInterval(tick); };
  }, [text, speed, delay, play]);

  return <Text style={style}>{text.slice(0, n)}</Text>;
}
