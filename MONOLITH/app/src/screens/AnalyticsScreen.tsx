import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MonochromeButton } from '../components/MonochromeButton';

interface Entry {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  created_at: string;
}

// カテゴリリスト（RecordScreenと合わせる）
const CATEGORIES = ['すべて', '食費', '交通費', '住居費', '光熱費', '医療費', '娯楽費', '買い物', '収入', 'その他'];

export const AnalyticsScreen: React.FC = () => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('すべて');

  useEffect(() => {
    // TODO: Cloudflare Workers APIから取得
    const mock: Entry[] = [
      { id: 1, type: 'expense', amount: 1240, category: '食費', description: '昼食', created_at: '2025-01-15T12:00:00Z' },
      { id: 2, type: 'expense', amount: 560, category: '交通費', description: '電車', created_at: '2025-01-15T08:30:00Z' },
      { id: 3, type: 'income', amount: 50000, category: '収入', description: '給与', created_at: '2025-01-10T09:00:00Z' },
    ];
    setEntries(mock);
  }, []);

  // フィルタリング（type + category）
  const filtered = entries.filter((e) => {
    const typeMatch = typeFilter === 'all' || e.type === typeFilter;
    const categoryMatch = categoryFilter === 'すべて' || e.category === categoryFilter;
    return typeMatch && categoryMatch;
  });

  // 選択中カテゴリの集計
  const categoryTotal = filtered.reduce((sum, e) => sum + e.amount, 0);
  const typeIncome = entries.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const typeExpense = entries.filter((e) => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const balance = typeIncome - typeExpense;

  const maxBarValue = Math.max(typeIncome, typeExpense, 1);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>分析</Text>

      <View style={styles.summary}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>収入</Text>
          <Text style={styles.summaryValue}>¥{typeIncome.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>支出</Text>
          <Text style={styles.summaryValue}>¥{typeExpense.toLocaleString()}</Text>
        </View>
        <View style={[styles.summaryBox, balance >= 0 ? styles.positive : styles.negative]}>
          <Text style={styles.summaryLabel}>残高</Text>
          <Text style={styles.summaryValue}>¥{balance.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>収支比率</Text>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>収入</Text>
          <View style={styles.barBackground}>
            <View style={[styles.bar, styles.incomeBar, { width: `${(typeIncome / maxBarValue) * 100}%` }]} />
          </View>
        </View>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>支出</Text>
          <View style={styles.barBackground}>
            <View style={[styles.bar, styles.expenseBar, { width: `${(typeExpense / maxBarValue) * 100}%` }]} />
          </View>
        </View>
      </View>

      {/* タイプフィルター */}
      <Text style={styles.sectionLabel}>タイプ</Text>
      <View style={styles.filterRow}>
        <MonochromeButton label="すべて" variant={typeFilter === 'all' ? 'primary' : 'secondary'} onPress={() => setTypeFilter('all')} style={styles.filterBtn} />
        <MonochromeButton label="収入" variant={typeFilter === 'income' ? 'primary' : 'secondary'} onPress={() => setTypeFilter('income')} style={styles.filterBtn} />
        <MonochromeButton label="支出" variant={typeFilter === 'expense' ? 'primary' : 'secondary'} onPress={() => setTypeFilter('expense')} style={styles.filterBtn} />
      </View>

      {/* カテゴリフィルター */}
      <Text style={styles.sectionLabel}>カテゴリ</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <MonochromeButton key={cat} label={cat} variant={categoryFilter === cat ? 'primary' : 'secondary'} onPress={() => setCategoryFilter(cat)} style={styles.categoryBtn} />
          ))}
        </View>
      </ScrollView>

      {/* 選択中カテゴリの合計表示 */}
      {categoryFilter !== 'すべて' && (
        <View style={styles.categoryTotal}>
          <Text style={styles.categoryTotalLabel}>{categoryFilter} 合計</Text>
          <Text style={styles.categoryTotalValue}>¥{categoryTotal.toLocaleString()}</Text>
        </View>
      )}

      <Text style={styles.listHeader}>取引一覧</Text>
      {filtered.length === 0 ? (
        <Text style={styles.empty}>データがありません</Text>
      ) : (
        filtered.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={[styles.badge, item.type === 'income' ? styles.badgeIncome : styles.badgeExpense]}>
                {item.type === 'income' ? '収入' : '支出'}
              </Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('ja-JP')}</Text>
            </View>
            <Text style={styles.amount}>¥{item.amount.toLocaleString()}</Text>
            <Text style={styles.category}>{item.category}</Text>
            {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          </View>
        ))
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
    marginBottom: 20,
    letterSpacing: 1,
  },
  summary: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  summaryBox: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    alignItems: 'center',
  },
  positive: {
    backgroundColor: '#000000',
  },
  negative: {
    backgroundColor: '#333333',
    borderColor: '#333333',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    marginTop: 4,
  },
  chartContainer: {
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: {
    width: 40,
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  barBackground: {
    flex: 1,
    height: 16,
    backgroundColor: '#eeeeee',
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  bar: {
    height: '100%',
  },
  incomeBar: {
    backgroundColor: '#000000',
  },
  expenseBar: {
    backgroundColor: '#555555',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterBtn: {
    flex: 1,
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  categoryBtn: {
    paddingHorizontal: 12,
  },
  categoryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
  },
  categoryTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  categoryTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  listHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 20,
  },
  card: {
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    fontSize: 10,
    fontWeight: '900',
    paddingVertical: 2,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  badgeIncome: {
    backgroundColor: '#000000',
    color: '#ffffff',
  },
  badgeExpense: {
    backgroundColor: '#ffffff',
    color: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
  },
  date: {
    fontSize: 12,
    color: '#888',
  },
  amount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  category: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    marginTop: 2,
  },
  desc: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
});
