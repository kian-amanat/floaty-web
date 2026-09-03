import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import WeightSlider from '../components/WeightSlider';

/* The dial is authored against the capture's 640x480 frame, so the screen just
   hands it whatever space it has and lets it keep that aspect — stretching it
   to fill a tall phone screen is what pulled the composition apart. */
export default function WeightScreen() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const measure = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.centre} onLayout={measure}>
        {/* never gated on the measured box: onLayout can fail to fire and the
            dial would then not render at all — it falls back to window size */}
        <WeightSlider initial={17} box={box} />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#222322' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
