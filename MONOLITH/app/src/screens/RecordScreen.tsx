import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { MonochromeButton } from '../components/MonochromeButton';
import { useSensor } from '../hooks/useSensor';
import { useOCR } from '../hooks/useOCR';

// predefined カテゴリリスト
const CATEGORIES = [
  '食費',
  '交通費',
  '住居費',
  '光熱費',
  '医療費',
  '娯楽費',
  '買い物',
  '収入',
  'その他',
] as const;

type ScreenType = 'income' | 'expense';

type Category = (typeof CATEGORIES)[number];

const EXPENSE_CATEGORIES: Category[] = [
  '食費',
  '交通費',
  '住居費',
  '光熱費',
  '医療費',
  '娯楽費',
  '買い物',
  'その他',
];

const INCOME_CATEGORIES: Category[] = ['収入'];

export const RecordScreen: React.FC = () => {
  const [type, setType] = useState<ScreenType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { sensorData, captureEvidence } = useSensor();
  const { text: ocrText, imageUri, isLoading: ocrLoading, scanReceipt, clearResult } = useOCR();

  const visibleCategories = useMemo(() => {
    if (type === 'income') return INCOME_CATEGORIES;
    return EXPENSE_CATEGORIES;
  }, [type]);

  // タブが切り替わったら、現在のカテゴリが不正ならリセット
  React.useEffect(() => {
    if (category && !visibleCategories.includes(category as Category)) {
      setCategory('');
    }
  }, [category, visibleCategories]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const numericAmount = parseInt(amount, 10);
      if (Number.isNaN(numericAmount) || numericAmount <= 0) {
        Alert.alert('エラー', '有効な金額を入力してください');
        return;
      }

      if (!category) {
        Alert.alert('エラー', 'カテゴリを選択してください');
        return;
      }

      const evidence = await captureEvidence();

      const payload = {
        type,
        amount: numericAmount,
        category,
        description: description || ocrText || '',
        sensor: evidence,
        image_url: imageUri,
        ocr_raw_text: ocrText,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      let response: Response | undefined;
      try {
        response = await fetch('https://heated-duncan-edition-handheld.trycloudflare.com/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response?.ok) {
        const text = await response.text().catch(() => '');
        console.error('Save failed:', {
          status: response.status,
          statusText: response.statusText,
          responseText: text,
        });
        Alert.alert('エラー', `保存に失敗しました: ${response.status} ${response.statusText}`);
        throw new Error(`API failed: ${response.status} ${response.statusText}`);
      }

      Alert.alert('保存完了', `取引を記録しました（カテゴリ: ${category}）`);

      // reset（保存完了時にフォーム入力/選択/OCR結果を全部クリア）

      setAmount('');
      setCategory('');
      setDescription('');
      clearResult();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Save error:', msg, err);
      Alert.alert('エラー', `保存に失敗しました: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>取引記録</Text>

      <View style={styles.typeToggle}>
        <MonochromeButton
          label="支出"
          variant={type === 'expense' ? 'primary' : 'secondary'}
          onPress={() => setType('expense')}
          style={styles.toggleBtn}
        />
        <MonochromeButton
          label="収入"
          variant={type === 'income' ? 'primary' : 'secondary'}
          onPress={() => setType('income')}
          style={styles.toggleBtn}
        />
      </View>

      <Text style={styles.label}>金額</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={amount}
        onChangeText={setAmount}
        placeholder="0"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>カテゴリ</Text>
      <View style={styles.categoryGrid}>
        {visibleCategories.map((cat) => (
          <MonochromeButton
            key={cat}
            label={cat}
            variant={category === cat ? 'primary' : 'secondary'}
            onPress={() => setCategory(cat)}
            style={styles.categoryBtn}
          />
        ))}
      </View>

      <Text style={styles.label}>備考 / メモ</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="音声入力または手入力"
        placeholderTextColor="#999"
      />

      <MonochromeButton
        label="レシートをスキャン"
        variant="secondary"
        onPress={scanReceipt}
        style={styles.marginTop}
      />

      {ocrLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.ocrStatus}>OCR 読み取り中...</Text>
        </View>
      )}

      {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />}

      {ocrText.length > 0 && (
        <View style={styles.ocrBox}>
          <Text style={styles.ocrLabel}>OCR 結果</Text>
          <Text style={styles.ocrText}>{ocrText}</Text>
        </View>
      )}

      <MonochromeButton
        label={isSaving ? '保存中...' : '保存する'}
        variant={isSaving ? 'secondary' : 'primary'}
        onPress={handleSave}
        style={styles.marginTop}
        disabled={isSaving}
      />

      <View style={styles.sensorInfo}>
        <Text style={styles.sensorLabel}>センサー証拠</Text>
        <Text style={styles.sensorText}>
          位置: {sensorData.latitude?.toFixed(4) ?? '--'}, {sensorData.longitude?.toFixed(4) ?? '--'}
        </Text>
        <Text style={styles.sensorText}>
          振動検知: {sensorData.vibrationFlag ? 'あり' : 'なし'}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#ffffff',
    flexGrow: 1,
  },
  header: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 20,
    letterSpacing: 1,
  },
  typeToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333333',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 2,
    borderColor: '#00ff00',
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  marginTop: {
    marginTop: 20,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryBtn: {
    minWidth: '30%',
    paddingVertical: 8,
  },
  centered: {
    alignItems: 'center',
    marginTop: 16,
  },
  ocrStatus: {
    marginTop: 8,
    fontSize: 12,
    color: '#555',
  },
  preview: {
    width: '100%',
    height: 200,
    marginTop: 16,
    backgroundColor: '#f5f5f5',
  },
  ocrBox: {
    marginTop: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: '#00ff00',
    backgroundColor: '#f9f9f9',
  },
  ocrLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  ocrText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  sensorInfo: {
    marginTop: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  sensorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  sensorText: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
});

