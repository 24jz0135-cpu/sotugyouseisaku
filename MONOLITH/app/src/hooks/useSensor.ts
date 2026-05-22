import { useState, useEffect, useCallback, useRef } from 'react';
import { Accelerometer, LocationObject } from 'expo-sensors';
import * as Location from 'expo-location';

interface SensorData {
  latitude: number | null;
  longitude: number | null;
  vibrationFlag: number; // 0 or 1
  timestamp: number;
}

export function useSensor() {
  const [data, setData] = useState<SensorData>({
    latitude: null,
    longitude: null,
    vibrationFlag: 0,
    timestamp: Date.now(),
  });
  const [isAvailable, setIsAvailable] = useState(false);
  const vibrationRef = useRef(0);

  // 位置情報取得
  const requestLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission denied');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setData((prev) => ({
      ...prev,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      timestamp: Date.now(),
    }));
  }, []);

  // 加速度センサー（振動検知）
  useEffect(() => {
    let subscription: any;

    const subscribe = async () => {
      const isAccelAvailable = await Accelerometer.isAvailableAsync();
      setIsAvailable(isAccelAvailable);
      if (!isAccelAvailable) return;

      Accelerometer.setUpdateInterval(500); // 500ms
      subscription = Accelerometer.addListener((accelerometerData) => {
        const { x, y, z } = accelerometerData;
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        // 振動閾値: 1.5G 以上を検知
        const isVibrating = magnitude > 1.5 ? 1 : 0;
        vibrationRef.current = isVibrating;
        setData((prev) => ({
          ...prev,
          vibrationFlag: isVibrating,
          timestamp: Date.now(),
        }));
      });
    };

    subscribe();
    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  const captureEvidence = useCallback(async (): Promise<SensorData> => {
    await requestLocation();
    return {
      ...data,
      vibrationFlag: vibrationRef.current,
      timestamp: Date.now(),
    };
  }, [data, requestLocation]);

  return {
    sensorData: data,
    isAvailable,
    captureEvidence,
  };
}

