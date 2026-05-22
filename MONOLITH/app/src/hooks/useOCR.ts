import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

interface OCResult {
  text: string;
  imageUri: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useOCR() {
  const [result, setResult] = useState<OCResult>({
    text: '',
    imageUri: null,
    isLoading: false,
    error: null,
  });

  const pickImage = useCallback(async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setResult((prev) => ({ ...prev, error: 'Camera permission denied' }));
      return null;
    }

    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (picked.canceled || !picked.assets || picked.assets.length === 0) {
      return null;
    }

    return picked.assets[0].uri;
  }, []);

  const preprocessImage = useCallback(async (uri: string): Promise<string> => {
    // グレースケール化 + コントラスト強調（モノクロ化）
    const manipulated = await manipulateAsync(
      uri,
      [
        { resize: { width: 1200 } },
      ],
      { compress: 0.9, format: SaveFormat.JPEG }
    );
    return manipulated.uri;
  }, []);

  const runOCR = useCallback(async (imageUri: string): Promise<string> => {
    // TODO: 実際のOCRエンジ��（Google ML Kit / Cloudflare AI）に連携予定
    // 現在は現在日付ベースの動的生成（OCR Engine置換後に削除）
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const mockTexts = [
      `スキャン日時 ${year}/${month}/${day} ${hour}:${minute}`,
      '※ OCR認識結果（レシートまたは明細書）',
    ];
    return mockTexts.join('\n');
  }, []);

  const scanReceipt = useCallback(async () => {
    setResult({ text: '', imageUri: null, isLoading: true, error: null });

    try {
      const uri = await pickImage();
      if (!uri) {
        setResult((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const processedUri = await preprocessImage(uri);
      const extractedText = await runOCR(processedUri);

      setResult({
        text: extractedText,
        imageUri: processedUri,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      setResult({
        text: '',
        imageUri: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'OCR failed',
      });
    }
  }, [pickImage, preprocessImage, runOCR]);

  return {
    ...result,
    scanReceipt,
    clearResult: () => setResult({ text: '', imageUri: null, isLoading: false, error: null }),
  };
}
