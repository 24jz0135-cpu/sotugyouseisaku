import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { RecordScreen } from './src/screens/RecordScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { ImageGalleryScreen } from './src/screens/ImageGalleryScreen';
import { MonochromeButton } from './src/components/MonochromeButton';

type Screen = 'record' | 'analytics' | 'images';

export default function App() {
  const [screen, setScreen] = useState<Screen>('record');

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <MonochromeButton
          label="記録"
          variant={screen === 'record' ? 'primary' : 'secondary'}
          onPress={() => setScreen('record')}
          style={styles.navBtn}
        />
        <MonochromeButton
          label="分析"
          variant={screen === 'analytics' ? 'primary' : 'secondary'}
          onPress={() => setScreen('analytics')}
          style={styles.navBtn}
        />
        <MonochromeButton
          label="画像"
          variant={screen === 'images' ? 'primary' : 'secondary'}
          onPress={() => setScreen('images')}
          style={styles.navBtn}
        />
      </View>

      <View style={styles.content}>
        {screen === 'record' ? (
          <RecordScreen />
        ) : screen === 'analytics' ? (
          <AnalyticsScreen />
        ) : (
          <ImageGalleryScreen />
        )}
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  nav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,

    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,

    backgroundColor: '#ffffff',
    borderTopWidth: 2,
    borderTopColor: '#000000',

    gap: 12,
  },
  navBtn: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 64,
  },
});
