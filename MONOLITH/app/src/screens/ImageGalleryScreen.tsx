import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { MonochromeButton } from '../components/MonochromeButton';

interface ImageEntry {
  id: number;
  imageUrl: string;
  ocrText: string;
  createdAt: string;
  category: string;
}

// 画像一覧画面
export const ImageGalleryScreen: React.FC = () => {
  const [images, setImages] = useState<ImageEntry[]>([
    // モックデータ
    { id: 1, imageUrl: '', ocrText: 'レシートテスト', createdAt: '2026-04-28', category: '食費' },
  ]);
  const [selectedImage, setSelectedImage] = useState<ImageEntry | null>(null);

  const handleDelete = (id: number) => {
    Alert.alert('削除確認', 'この画像を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => setImages((prev) => prev.filter((img) => img.id !== id)),
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>保存した画像</Text>
      <Text style={styles.subtitle}>{images.length} 件の画像</Text>

      {images.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>保存された画像がありません</Text>
          <Text style={styles.emptySubText}>レシートをスキャンして保存しましょう</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {images.map((img) => (
            <TouchableOpacity
              key={img.id}
              style={styles.thumb}
              onPress={() => setSelectedImage(img)}
            >
              <View style={styles.thumbPlaceholder}>
                <Text style={styles.thumbText}>📷</Text>
              </View>
              <Text style={styles.thumbDate}>{img.createdAt}</Text>
              <Text style={styles.thumbCategory}>{img.category}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedImage && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>画像詳細</Text>
            <View style={styles.modalPlaceholder}>
              <Text style={styles.modalPlaceholderText}>📷</Text>
            </View>
            <Text style={styles.modalDate}>{selectedImage.createdAt}</Text>
            <Text style={styles.modalCategory}>{selectedImage.category}</Text>
            <Text style={styles.modalOcr}>{selectedImage.ocrText}</Text>
            <View style={styles.modalActions}>
              <MonochromeButton
                label="閉じる"
                variant="secondary"
                onPress={() => setSelectedImage(null)}
                style={styles.modalBtn}
              />
              <MonochromeButton
                label="削除"
                variant="primary"
                onPress={() => {
                  handleDelete(selectedImage.id);
                  setSelectedImage(null);
                }}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      )}
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
    marginBottom: 4,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 20,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#555',
  },
  emptySubText: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  thumb: {
    width: '47%',
    borderWidth: 2,
    borderColor: '#000000',
    padding: 8,
    backgroundColor: '#ffffff',
  },
  thumbPlaceholder: {
    height: 100,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbText: {
    fontSize: 32,
  },
  thumbDate: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
  },
  thumbCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    width: '100%',
    padding: 20,
    borderWidth: 2,
    borderColor: '#000000',
  },
  modalHeader: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 16,
  },
  modalPlaceholder: {
    height: 200,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalPlaceholderText: {
    fontSize: 48,
  },
  modalDate: {
    fontSize: 12,
    color: '#888',
  },
  modalCategory: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },
  modalOcr: {
    fontSize: 12,
    color: '#555',
    marginTop: 8,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
  },
});
