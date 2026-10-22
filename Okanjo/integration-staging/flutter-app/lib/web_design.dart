part of 'main.dart';

class _WebHeader extends StatelessWidget {
  const _WebHeader({
    required this.theme,
    required this.palette,
    required this.onTheme,
    required this.onSettings,
    required this.onHelp,
    required this.onRefresh,
  });
  final String theme;
  final _Palette palette;
  final ValueChanged<String> onTheme;
  final VoidCallback onSettings, onHelp, onRefresh;
  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: theme == 'dark' || theme == 'brown'
        ? SystemUiOverlayStyle.light
        : SystemUiOverlayStyle.dark,
    child: ColoredBox(
      color: palette.header,
      child: SafeArea(
        bottom: false,
        child: Container(
          height: 76,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: palette.line)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: palette.accent,
                  borderRadius: BorderRadius.circular(3),
                ),
                child: const Icon(
                  LucideIcons.store,
                  size: 22,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '新宿ビストロ・エッジ',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: 'Outfit',
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: palette.headerText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Row(
                        children: [
                          Icon(
                            LucideIcons.award,
                            size: 10,
                            color: palette.name == 'フォレスト'
                                ? palette.fg
                                : const Color(0xff60a5fa),
                          ),
                          const SizedBox(width: 2),
                          Text(
                            '青色申告 (BLUE)',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: palette.name == 'フォレスト'
                                  ? palette.fg
                                  : const Color(0xff60a5fa),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              _headerButton(
                '使い方ガイド',
                const Text(
                  '?',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                onHelp,
              ),
              const SizedBox(width: 6),
              DecoratedBox(
                decoration: BoxDecoration(
                  border: Border.all(color: palette.line),
                  borderRadius: BorderRadius.circular(3),
                ),
                child: SizedBox(
                  width: 32,
                  height: 36,
                  child: PopupMenuButton<String>(
                    tooltip: 'テーマを選択',
                    padding: EdgeInsets.zero,
                    icon: Icon(
                      LucideIcons.palette,
                      size: 18,
                      color: palette.headerText,
                    ),
                    onSelected: (v) =>
                        v == 'settings' ? onSettings() : onTheme(v),
                    itemBuilder: (_) => [
                      ..._themes.entries.map(
                        (e) => PopupMenuItem(
                          value: e.key,
                          child: Row(
                            children: [
                              Container(
                                width: 16,
                                height: 16,
                                decoration: BoxDecoration(
                                  color: switch (e.key) {
                                    'light' => Colors.white,
                                    'dark' => Colors.black,
                                    _ => e.value.accent,
                                  },
                                  border: Border.all(
                                    color: const Color(0xff9e9e9e),
                                  ),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                e.value.name,
                                style: const TextStyle(fontSize: 12),
                              ),
                              const Spacer(),
                              if (theme == e.key)
                                const Icon(LucideIcons.check, size: 16),
                            ],
                          ),
                        ),
                      ),
                      const PopupMenuDivider(),
                      const PopupMenuItem(
                        value: 'settings',
                        child: Row(
                          children: [
                            Icon(LucideIcons.slidersHorizontal, size: 16),
                            SizedBox(width: 10),
                            Text('詳細設定', style: TextStyle(fontSize: 12)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 6),
              _headerButton(
                'データを更新',
                const Icon(LucideIcons.rotateCw, size: 18),
                onRefresh,
              ),
            ],
          ),
        ),
      ),
    ),
  );
  Widget _headerButton(String label, Widget child, VoidCallback action) =>
      SizedBox(
        width: 32,
        height: 36,
        child: IconButton(
          tooltip: label,
          onPressed: action,
          padding: EdgeInsets.zero,
          style: IconButton.styleFrom(
            foregroundColor: palette.headerText,
            backgroundColor: palette.headerText.withValues(alpha: .03),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(3),
              side: BorderSide(color: palette.line),
            ),
          ),
          icon: child,
        ),
      );
}

class _HistoryPageState extends State<_HistoryPage> {
  String filter = 'すべて';
  @override
  Widget build(BuildContext context) {
    final c = _themes[LedgerStore.instance.theme] ?? _themes['light']!;
    final rows = widget.records
        .where(
          (r) =>
              filter == 'すべて' ||
              (filter == '確定済み' ? _confirmed(r) : !_confirmed(r)),
        )
        .toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('記録データ履歴', style: _webHeading(20)),
        const SizedBox(height: 16),
        Row(
          children: ['すべて', '未確定', '確定済み']
              .map(
                (name) => Expanded(
                  child: InkWell(
                    onTap: () => setState(() => filter = name),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: filter == name ? c.accent : c.line,
                            width: filter == name ? 2 : 1,
                          ),
                        ),
                      ),
                      child: Text(
                        name,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: filter == name ? c.accent : c.muted,
                        ),
                      ),
                    ),
                  ),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 16),
        _Surface(
          target: 'backup',
          settings: LedgerStore.instance.settings(),
          palette: c,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '端末バックアップ',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                '会計データと保存済みレシート画像を、.oaiso ファイルとして保存できます。',
                style: TextStyle(fontSize: 10, height: 1.5, color: c.muted),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => _backup(context),
                      icon: const Icon(LucideIcons.download, size: 14),
                      label: const Text('バックアップ'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _restore(context),
                      icon: const Icon(LucideIcons.upload, size: 14),
                      label: const Text('復元'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _Surface(
          target: 'relay',
          settings: LedgerStore.instance.settings(),
          palette: c,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('PCへ送信（Relay）', style: _webHeading(16)),
              const SizedBox(height: 6),
              Text(
                'PCのOISO2 Bridgeが作成した一時QRを読み込むと、保存済みレシートをDiscordアプリなしでPCへ配送できます。',
                style: TextStyle(fontSize: 12, height: 1.6, color: c.muted),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: widget.onRelay,
                  child: const Text('QRを読み取る・送信する'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Center(
              child: Text(
                '該当する経費データがありません',
                style: TextStyle(fontSize: 13, color: c.muted),
              ),
            ),
          )
        else
          ...rows.map(
            (r) => _RecordCard(
              record: r,
              onEdit: () async {
                final result = await _editRecord(context, r);
                if (result != null) {
                  final all = [...widget.records];
                  final i = all.indexWhere((v) => v['id'] == r['id']);
                  if (i >= 0) all[i] = result;
                  widget.onChange(all);
                }
              },
              onConfirm: () {
                final all = widget.records
                    .map((v) => Map<String, dynamic>.from(v))
                    .toList();
                final i = all.indexWhere((v) => v['id'] == r['id']);
                if (i >= 0) all[i]['status'] = 'confirmed';
                widget.onChange(all);
              },
            ),
          ),
        const SizedBox(height: 16),
        // Native-only functions remain reachable without changing the Web dashboard.
        OutlinedButton.icon(
          onPressed: widget.onAdd,
          icon: const Icon(LucideIcons.plus, size: 16),
          label: const Text('記録を追加'),
        ),
        OutlinedButton.icon(
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => _ReviewPage(
                reviews: LedgerStore.instance.reviews(),
                onChange: (r) => LedgerStore.instance.saveReviews(r),
              ),
            ),
          ),
          icon: const Icon(LucideIcons.fileCheck, size: 16),
          label: const Text('解析結果の確認'),
        ),
      ],
    );
  }
}

// Values are shared with the mobile Web prototype's style.css.
extension _WebPalette on _Palette {
  Color get muted => switch (name) {
    'ダーク' => const Color(0xff94a3b8),
    'ブラウン' => const Color(0xff8b6857),
    'オーシャン' => const Color(0xff5a83aa),
    'フォレスト' => const Color(0xff5b7c66),
    _ => const Color(0xff64748b),
  };
  Color get header => switch (name) {
    'ブラウン' => const Color(0xff5b301f),
    'オーシャン' => const Color(0xffc8ebfb),
    'フォレスト' => const Color(0xffa5d9b3),
    _ => bg,
  };
  Color get headerText => name == 'ブラウン' ? const Color(0xfffff9f2) : fg;
  Color get total => name == 'ブラウン' ? const Color(0xffe9ddcd) : accent;
  Color get totalText => name == 'ブラウン' ? accent : Colors.white;
}

TextStyle _webHeading(double size, {Color? color}) => TextStyle(
  fontFamily: 'Outfit',
  fontSize: size,
  fontWeight: FontWeight.w800,
  letterSpacing: -.4,
  color: color,
);

class _WebNav extends StatelessWidget {
  const _WebNav({
    required this.palette,
    required this.index,
    required this.onTap,
  });
  final _Palette palette;
  final int index;
  final ValueChanged<int> onTap;
  @override
  Widget build(BuildContext context) => ColoredBox(
    color: palette.header,
    child: SafeArea(
      top: false,
      child: Container(
        height: 68,
        foregroundDecoration: BoxDecoration(
          border: Border(top: BorderSide(color: palette.line)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: List.generate(3, (i) {
            final active = index == i;
            final color = palette.name == 'ブラウン'
                ? (active ? const Color(0xffe9ddcd) : Colors.white)
                : active
                ? palette.accent
                : palette.muted;
            return Expanded(
              child: InkWell(
                onTap: () => onTap(i),
                child: Container(
                  decoration: BoxDecoration(
                    border: Border(
                      top: BorderSide(
                        color: active ? color : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        [
                          LucideIcons.layoutDashboard,
                          LucideIcons.camera,
                          LucideIcons.history,
                        ][i],
                        size: 26,
                        color: color,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        ['ホーム', 'レシート保管', '履歴一覧'][i],
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                          color: color,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    ),
  );
}

class _HomePage extends StatelessWidget {
  const _HomePage({
    required this.records,
    required this.photos,
    required this.palette,
    required this.settings,
    required this.goReceipts,
    required this.goHistory,
  });
  final List<Map<String, dynamic>> records;
  final List<File> photos;
  final _Palette palette;
  final Map<String, dynamic> settings;
  final VoidCallback goReceipts, goHistory;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final month = records.where((r) {
      final d = DateTime.tryParse('${r['timestamp'] ?? ''}');
      return d != null && d.year == now.year && d.month == now.month;
    }).toList();
    final pending = month.where((r) => !_confirmed(r)).toList();
    final verified = month.where(_confirmed).toList();
    int sum(List<Map<String, dynamic>> rows) =>
        rows.fold(0, (a, r) => a + _num(r['amount']));
    final total = sum(month);
    final categories = <String, int>{};
    for (final r in month) {
      final name = '${r['category'] ?? '未分類'}';
      categories[name] = (categories[name] ?? 0) + _num(r['amount']);
    }
    final groups = categories.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(child: Text('ダッシュボード', style: _webHeading(20))),
            Text(
              '${now.month}月${now.day}日${['月', '火', '水', '木', '金', '土', '日'][now.weekday - 1]}曜日',
              style: TextStyle(fontSize: 10, color: palette.muted),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _PhotoSurface(
          target: 'total',
          settings: settings,
          palette: palette,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            color: palette.total.withValues(
              alpha: (settings['widgetPhotos'] as Map? ?? {})['total'] == null
                  ? 1
                  : .75,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '今月の経費合計',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: palette.totalText,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '¥${_money(total)}',
                  style: TextStyle(
                    fontSize: 34,
                    height: 1.1,
                    fontWeight: FontWeight.w600,
                    color: palette.totalText,
                  ),
                ),
                const SizedBox(height: 6),
                // No invented percentage: actual previous-month comparison only.
                Text(
                  _monthTrend(records, now, total),
                  style: TextStyle(fontSize: 12, color: palette.totalText),
                ),
              ],
            ),
          ),
        ),
        Row(
          children: [
            Expanded(
              child: _WebStat(
                title: '未確定ファクト',
                rows: pending,
                palette: palette,
                settings: settings,
                target: 'pending',
              ),
            ),
            Expanded(
              child: _WebStat(
                title: '確定済み経費',
                rows: verified,
                palette: palette,
                settings: settings,
                target: 'confirmed',
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        _Surface(
          target: 'categories',
          settings: settings,
          palette: palette,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('経費カテゴリ内訳', style: _webHeading(15, color: palette.muted)),
              const SizedBox(height: 12),
              if (groups.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Center(
                    child: Text(
                      '経費データがありません',
                      style: TextStyle(fontSize: 13, color: palette.muted),
                    ),
                  ),
                )
              else
                ...groups.map(
                  (g) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                g.key,
                                style: const TextStyle(fontSize: 12),
                              ),
                            ),
                            Text(
                              '¥${_money(g.value)} (${total == 0 ? '0' : (g.value / total * 100).toStringAsFixed(1)}%)',
                              style: const TextStyle(fontSize: 11),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(3),
                          child: LinearProgressIndicator(
                            minHeight: 6,
                            value: total <= 0
                                ? 0
                                : (g.value / total).clamp(0, 1),
                            color: palette.accent,
                            backgroundColor: palette.line,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _PhotoSurface(
          target: 'recent',
          settings: settings,
          palette: palette,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('要確認の現場ファクト', style: _webHeading(15, color: palette.muted)),
              const SizedBox(height: 12),
              if (records.where((r) => !_confirmed(r)).isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0x0d10b981),
                    borderRadius: BorderRadius.zero,
                    border: Border.all(color: const Color(0x3310b981)),
                  ),
                  child: const Text(
                    '✓ 全ての現場ファクトが確定されています！',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Color(0xff34d399)),
                  ),
                )
              else
                ...records
                    .where((r) => !_confirmed(r))
                    .take(3)
                    .map(
                      (r) => InkWell(
                        onTap: goHistory,
                        child: _RecordTile(record: r, palette: palette),
                      ),
                    ),
            ],
          ),
        ),
      ],
    );
  }
}

String _monthTrend(
  List<Map<String, dynamic>> records,
  DateTime now,
  int total,
) {
  final previous = DateTime(now.year, now.month - 1);
  final amount = records
      .where((r) {
        final d = DateTime.tryParse('${r['timestamp']}');
        return d?.year == previous.year && d?.month == previous.month;
      })
      .fold<int>(0, (sum, r) => sum + _num(r['amount']));
  if (amount == 0) return '前月の記録なし';
  final change = (total - amount) / amount * 100;
  return '前月比 ${change >= 0 ? '+' : ''}${change.toStringAsFixed(1)}%';
}

class _WebStat extends StatelessWidget {
  const _WebStat({
    required this.title,
    required this.rows,
    required this.palette,
    required this.settings,
    required this.target,
  });
  final String title, target;
  final List<Map<String, dynamic>> rows;
  final _Palette palette;
  final Map<String, dynamic> settings;
  @override
  Widget build(BuildContext context) => _PhotoSurface(
    target: target,
    settings: settings,
    palette: palette,
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(border: Border.all(color: palette.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontSize: 11, color: palette.muted)),
          const SizedBox(height: 8),
          Text(
            '${rows.length} 件',
            style: TextStyle(
              fontSize: 32,
              height: 1.1,
              fontWeight: FontWeight.w600,
              color: palette.fg,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '¥${_money(rows.fold<int>(0, (s, r) => s + _num(r['amount'])))}',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    ),
  );
}

class _ReceiptsPage extends StatelessWidget {
  const _ReceiptsPage({
    required this.photos,
    required this.onAdd,
    required this.onDelete,
  });
  final List<File> photos;
  final Future<void> Function(ImageSource) onAdd;
  final Future<void> Function(File) onDelete;
  @override
  Widget build(BuildContext context) {
    final palette = _themes[LedgerStore.instance.theme] ?? _themes['light']!;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('レシートを端末に保存', style: _webHeading(20)),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: palette.surface,
            border: Border.all(color: palette.line),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Column(
            children: [
              Icon(LucideIcons.camera, size: 38, color: palette.accent),
              const SizedBox(height: 16),
              const Text(
                '撮影した画像を保管する',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              Text(
                'ここでは文字の読み取りやAI解析はしません。画像はこの端末に保存し、あとでPCのOISO2へ送って解析します。',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  height: 1.7,
                  color: palette.muted,
                ),
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                icon: const Icon(LucideIcons.camera, size: 18),
                label: const Text('写真を追加する'),
                onPressed: () async {
                  final source = await showModalBottomSheet<ImageSource>(
                    context: context,
                    builder: (ctx) => SafeArea(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          ListTile(
                            leading: const Icon(LucideIcons.camera),
                            title: const Text('撮影する'),
                            onTap: () => Navigator.pop(ctx, ImageSource.camera),
                          ),
                          ListTile(
                            leading: const Icon(LucideIcons.images),
                            title: const Text('写真を選ぶ'),
                            onTap: () =>
                                Navigator.pop(ctx, ImageSource.gallery),
                          ),
                        ],
                      ),
                    ),
                  );
                  if (source != null) await onAdd(source);
                },
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.shieldCheck, size: 13, color: palette.muted),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      '画像はこの端末内に保存されます',
                      style: TextStyle(fontSize: 11, color: palette.muted),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (photos.isNotEmpty) ...[
          const SizedBox(height: 20),
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: Text('保存した写真 ${photos.length}枚', style: _webHeading(15)),
            children: [
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: photos.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                itemBuilder: (_, i) => _PhotoThumb(
                  file: photos[i],
                  onDelete: () => onDelete(photos[i]),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
