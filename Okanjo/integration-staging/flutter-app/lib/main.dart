import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:image/image.dart' as img;
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'data_store.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LedgerStore.instance.init();
  runApp(const OisoApp());
}

const _themes = <String, _Palette>{
  'light': _Palette(
    'ライト',
    Color(0xfff7f4ed),
    Color(0xff332b27),
    Color(0xfffdfbf7),
    Color(0xffa64b32),
    Color(0xffd8cfc0),
  ),
  'dark': _Palette(
    'ダーク',
    Color(0xff17191b),
    Color(0xfff2eee7),
    Color(0xff222629),
    Color(0xffb399e8),
    Color(0xff41474b),
  ),
  'brown': _Palette(
    'ブラウン',
    Color(0xffeee4d5),
    Color(0xff342821),
    Color(0xfffbf8f2),
    Color(0xff76513e),
    Color(0xffd4c6b3),
  ),
  'ocean': _Palette(
    'オーシャン',
    Color(0xffe7f1f3),
    Color(0xff20343b),
    Color(0xfff8fcfc),
    Color(0xff2784a0),
    Color(0xffc5dce1),
  ),
  'forest': _Palette(
    'フォレスト',
    Color(0xffe8f2eb),
    Color(0xff18392a),
    Color(0xfffbfdfb),
    Color(0xff168243),
    Color(0xffc9dfd0),
  ),
};

class _Palette {
  const _Palette(
    this.name,
    this.bg,
    this.fg,
    this.surface,
    this.accent,
    this.line,
  );
  final String name;
  final Color bg, fg, surface, accent, line;
}

class OisoApp extends StatefulWidget {
  const OisoApp({super.key});
  @override
  State<OisoApp> createState() => _OisoAppState();
}

class _OisoAppState extends State<OisoApp> {
  String theme = LedgerStore.instance.theme;
  void setTheme(String value) {
    setState(() => theme = value);
    LedgerStore.instance.saveTheme(value);
  }

  @override
  Widget build(BuildContext context) {
    final c = _themes[theme] ?? _themes['light']!;
    return MaterialApp(
      title: 'OISO',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: c.bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: c.accent,
          brightness: theme == 'dark' ? Brightness.dark : Brightness.light,
          surface: c.surface,
        ),
        textTheme: const TextTheme(
          bodyMedium: TextStyle(fontWeight: FontWeight.w400, letterSpacing: .1),
          titleLarge: TextStyle(fontWeight: FontWeight.w500),
        ),
        appBarTheme: AppBarTheme(
          backgroundColor: c.bg,
          foregroundColor: c.fg,
          elevation: 0,
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: c.surface,
          indicatorColor: c.accent.withValues(alpha: .12),
          labelTextStyle: WidgetStateProperty.all(
            TextStyle(fontSize: 11, color: c.fg),
          ),
        ),
        cardTheme: CardThemeData(
          color: c.surface,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(5),
            side: BorderSide(color: c.line),
          ),
        ),
        dividerColor: c.line,
      ),
      home: _Shell(theme: theme, palette: c, onTheme: setTheme),
    );
  }
}

class _Shell extends StatefulWidget {
  const _Shell({
    required this.theme,
    required this.palette,
    required this.onTheme,
  });
  final String theme;
  final _Palette palette;
  final ValueChanged<String> onTheme;
  @override
  State<_Shell> createState() => _ShellState();
}

class _ShellState extends State<_Shell> {
  int tab = 0;
  List<Map<String, dynamic>> records = [];
  List<Map<String, dynamic>> reviews = [];
  List<File> photos = [];
  Map<String, dynamic> settings = {};
  bool loading = true;
  final picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    records = LedgerStore.instance.records();
    reviews = LedgerStore.instance.reviews();
    settings = LedgerStore.instance.settings();
    photos = await LedgerStore.instance.photos();
    if (mounted) setState(() => loading = false);
  }

  Future<void> _persistRecords() async {
    await LedgerStore.instance.saveRecords(records);
    if (mounted) setState(() {});
  }

  Future<void> _persistReviews() async {
    await LedgerStore.instance.saveReviews(reviews);
    if (mounted) setState(() {});
  }

  Future<void> _refreshPhotos() async {
    photos = await LedgerStore.instance.photos();
    if (mounted) setState(() {});
  }

  Future<void> _addPhoto(ImageSource source) async {
    final x = await picker.pickImage(source: source, imageQuality: 92);
    if (x == null) return;
    if (await File(x.path).length() > 15 * 1024 * 1024) {
      _message('写真は15MB以下を選んでください');
      return;
    }
    await LedgerStore.instance.savePhoto(File(x.path));
    await _refreshPhotos();
    _message('写真を端末に保存しました');
  }

  void _message(String text) {
    if (mounted)
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    if (loading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final pages = [
      _HomePage(
        records: records,
        photos: photos,
        palette: widget.palette,
        settings: settings,
        goReceipts: () => setState(() => tab = 1),
        goHistory: () => setState(() => tab = 2),
      ),
      _ReceiptsPage(
        photos: photos,
        onAdd: _addPhoto,
        onDelete: (file) async {
          await LedgerStore.instance.deletePhoto(file.path);
          records.removeWhere((r) => r['image_path'] == file.path);
          await _persistRecords();
          await _refreshPhotos();
        },
      ),
      _HistoryPage(
        records: records,
        onChange: (r) async {
          records = r;
          await _persistRecords();
        },
        onRelay: _relay,
      ),
      _ReviewPage(
        reviews: reviews,
        onChange: (r) async {
          reviews = r;
          await _persistReviews();
        },
      ),
    ];
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: widget.palette.accent,
                borderRadius: BorderRadius.circular(3),
              ),
              child: const Text(
                'お',
                style: TextStyle(color: Colors.white, fontSize: 20),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '新宿ビストロ・エッジ',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                  Text(
                    '端末内に保存中',
                    style: TextStyle(
                      fontSize: 11,
                      color: widget.palette.accent,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: '使い方',
              onPressed: _help,
              icon: const Icon(Icons.help_outline),
            ),
            PopupMenuButton<String>(
              tooltip: 'カラーテーマ',
              icon: const Icon(Icons.palette_outlined),
              onSelected: (v) {
                if (v == 'settings') {
                  _openThemeSettings();
                } else {
                  widget.onTheme(v);
                }
              },
              itemBuilder: (_) => [
                ..._themes.entries.map(
                  (e) => PopupMenuItem<String>(
                    value: e.key,
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 10,
                          backgroundColor: e.value.accent,
                        ),
                        const SizedBox(width: 10),
                        Text(e.value.name),
                        const Spacer(),
                        if (e.key == widget.theme)
                          const Icon(Icons.check, size: 18),
                      ],
                    ),
                  ),
                ),
                const PopupMenuDivider(),
                const PopupMenuItem<String>(
                  value: 'settings',
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(Icons.tune),
                    title: Text('詳細設定'),
                  ),
                ),
              ],
            ),
            IconButton(
              tooltip: '更新',
              onPressed: _load,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
      ),
      body: Stack(
        children: [
          if (settings['backgroundPhoto'] is String &&
              File(settings['backgroundPhoto']).existsSync())
            Positioned.fill(
              child: Image.file(
                File(settings['backgroundPhoto']),
                fit: BoxFit.cover,
              ),
            ),
          if (settings['backgroundPhoto'] is String &&
              File(settings['backgroundPhoto']).existsSync() &&
              settings['backgroundDim'] == true)
            Positioned.fill(
              child: ColoredBox(
                color: widget.palette.bg.withValues(alpha: .58),
              ),
            ),
          IndexedStack(index: tab, children: pages),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab > 2 ? 2 : tab,
        onDestinationSelected: (v) => setState(() => tab = v),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view),
            label: '経費帳',
          ),
          NavigationDestination(
            icon: Icon(Icons.photo_camera_outlined),
            selectedIcon: Icon(Icons.photo_camera),
            label: 'レシート保管',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: '履歴一覧',
          ),
        ],
      ),
      floatingActionButton: tab == 0
          ? FloatingActionButton(
              onPressed: () => _showAddRecord(),
              backgroundColor: widget.palette.accent,
              foregroundColor: Colors.white,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }

  Future<void> _showAddRecord([Map<String, dynamic>? existing]) async {
    final vendor = TextEditingController(
      text: existing?['vendor_name']?.toString() ?? '',
    );
    final amount = TextEditingController(
      text: existing?['amount']?.toString() ?? '',
    );
    final category = TextEditingController(
      text: existing?['category']?.toString() ?? '',
    );
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(existing == null ? '経費を登録' : '記録を編集'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: vendor,
              decoration: const InputDecoration(labelText: '店舗・内容'),
            ),
            TextField(
              controller: amount,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: '金額'),
            ),
            TextField(
              controller: category,
              decoration: const InputDecoration(labelText: 'カテゴリ'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('キャンセル'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, {
              'vendor': vendor.text,
              'amount': amount.text,
              'category': category.text,
            }),
            child: const Text('保存'),
          ),
        ],
      ),
    );
    if (result == null) return;
    if (existing == null)
      records.insert(0, {
        'id': DateTime.now().microsecondsSinceEpoch.toString(),
        'timestamp': DateTime.now().toIso8601String(),
        'sensor_type': 'MANUAL',
        'raw_text': result['vendor'],
        'vendor_name': result['vendor'],
        'amount': int.tryParse(result['amount'] ?? '') ?? 0,
        'category': result['category'],
        'status': 'pending',
      });
    else {
      existing['vendor_name'] = result['vendor'];
      existing['raw_text'] = result['vendor'];
      existing['amount'] = int.tryParse(result['amount'] ?? '') ?? 0;
      existing['category'] = result['category'];
    }
    await _persistRecords();
  }

  void _openThemeSettings() => Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => _ThemeSettingsPage(
        theme: widget.theme,
        settings: settings,
        onTheme: widget.onTheme,
        onSettings: (s) async {
          settings = s;
          await LedgerStore.instance.saveSettings(s);
          if (mounted) setState(() {});
        },
      ),
    ),
  );
  void _help() => showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('使い方'),
      content: const Text(
        'レシート保管で撮影・選択した写真は端末内に保存されます。履歴一覧で記録を確認し、PCへ送信（Relay）からOISO2 Bridgeへ転送できます。解析結果CSVは「解析結果の確認」画面から読み込み、内容を確認して確定してください。',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('閉じる'),
        ),
      ],
    ),
  );

  Future<void> _relay() async {
    final previousConfig = settings['relayConfig'];
    final configText = TextEditingController(
      text: previousConfig is Map ? jsonEncode(previousConfig) : '',
    );
    final value = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'PCへ送信（Relay）',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text('Bridgeが表示するRelay QRを読み取るか、QRの内容を貼り付けてください。'),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: () async {
                final code = await Navigator.push<String>(
                  ctx,
                  MaterialPageRoute(builder: (_) => const _QrPage()),
                );
                if (code != null && ctx.mounted) Navigator.pop(ctx, code);
              },
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('QRを読み取る'),
            ),
            TextField(
              controller: configText,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Relay設定JSON',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, configText.text),
              child: const Text('接続して送信'),
            ),
          ],
        ),
      ),
    );
    if (value == null || value.trim().isEmpty) return;
    try {
      final config = jsonDecode(value) as Map<String, dynamic>;
      if (config['format'] != 'oiso-relay') {
        throw const FormatException('Relay設定ではありません');
      }
      final endpoint = Uri.parse(config['uploadUrl'] as String);
      if (endpoint.scheme != 'https' ||
          endpoint.host != 'discord.com' ||
          !endpoint.path.startsWith('/api/webhooks/')) {
        throw const FormatException('Bridgeが発行したDiscord送信先ではありません');
      }
      final expiry = config['expiresAt'];
      final expiryTime = expiry is num
          ? DateTime.fromMillisecondsSinceEpoch(expiry.toInt())
          : DateTime.tryParse('$expiry');
      if (expiryTime == null || DateTime.now().isAfter(expiryTime)) {
        throw const FormatException('Relay QRの有効期限が切れています');
      }
      settings['relayConfig'] = config;
      final sent = List<String>.from(config['sentReceiptIds'] ?? []);
      final unsent = photos
          .where((f) => !sent.contains(p.basename(f.path)))
          .toList();
      if (unsent.isEmpty) {
        _message('送信する未送信写真はありません');
        return;
      }
      var delivered = 0;
      for (var start = 0; start < unsent.length; start += 10) {
        final batch = unsent.skip(start).take(10).toList();
        final size = batch.fold<int>(0, (sum, file) => sum + file.lengthSync());
        if (size > 20 * 1024 * 1024) {
          throw const FormatException('一度に送れる写真の合計は20MBまでです');
        }
        final uri = endpoint.replace(
          queryParameters: {...endpoint.queryParameters, 'wait': 'true'},
        );
        http.Response? response;
        for (var attempt = 0; attempt < 3; attempt++) {
          final req = http.MultipartRequest('POST', uri);
          req.fields['payload_json'] = jsonEncode({
            'content':
                'OISO Relay ${config['sessionId'] ?? ''} · ${batch.length}件',
          });
          for (var i = 0; i < batch.length; i++) {
            req.files.add(
              await http.MultipartFile.fromPath(
                'files[$i]',
                batch[i].path,
                filename: p.basename(batch[i].path),
              ),
            );
          }
          response = await http.Response.fromStream(await req.send());
          if (response.statusCode != 429) break;
          final wait =
              double.tryParse(response.headers['retry-after'] ?? '') ?? 1;
          await Future<void>.delayed(
            Duration(milliseconds: (wait * 1000).round()),
          );
        }
        if (response == null ||
            response.statusCode < 200 ||
            response.statusCode >= 300) {
          throw HttpException(
            'Relay送信エラー: HTTP ${response?.statusCode ?? '不明'}',
          );
        }
        sent.addAll(batch.map((file) => p.basename(file.path)));
        config['sentReceiptIds'] = sent;
        settings['relayConfig'] = config;
        await LedgerStore.instance.saveSettings(settings);
        delivered += batch.length;
      }
      _message('$delivered枚をPCの受信箱へ送信しました');
    } catch (e) {
      _message('Relay設定を確認してください: $e');
    }
  }
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
    final monthRecords = records.where((r) {
      final date = DateTime.tryParse('${r['timestamp'] ?? ''}');
      return date != null && date.year == now.year && date.month == now.month;
    }).toList();
    final total = monthRecords.fold<int>(
      0,
      (sum, r) => sum + _num(r['amount']),
    );
    final pending = monthRecords.where((r) => !_confirmed(r)).length;
    final confirmed = monthRecords.length - pending;
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 28),
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                '日々の経費帳',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w500),
              ),
            ),
            Text(
              DateTime.now().toLocal().toString().substring(0, 10),
              style: const TextStyle(fontSize: 12),
            ),
          ],
        ),
        const SizedBox(height: 18),
        _PhotoSurface(
          target: 'total',
          settings: settings,
          palette: palette,
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: palette.accent.withValues(alpha: .80),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '記録した経費の合計',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
                const Divider(color: Colors.white38, height: 24),
                Text(
                  '¥${_money(total)}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 38,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '● 未確定  $pending 件',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    Text(
                      '● 確定済み  $confirmed 件',
                      style: const TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: _StatCard(
                title: '未確定の記録',
                count: pending,
                palette: palette,
                target: 'pending',
                settings: settings,
              ),
            ),
            Expanded(
              child: _StatCard(
                title: '確定済み経費',
                count: confirmed,
                palette: palette,
                target: 'confirmed',
                settings: settings,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        _Surface(
          target: 'recent',
          settings: settings,
          palette: palette,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionTitle('最近の記録'),
              if (records.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 28),
                  child: Center(child: Text('経費データがありません')),
                )
              else
                ...records
                    .take(4)
                    .map((r) => _RecordTile(record: r, palette: palette)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Surface(
          target: 'backup',
          settings: settings,
          palette: palette,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '端末バックアップ',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${photos.length}枚のレシート画像を保存中',
                      style: TextStyle(
                        color: palette.fg.withValues(alpha: .65),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => _backup(context),
                icon: Icon(Icons.download_outlined, color: palette.accent),
              ),
              IconButton(
                onPressed: () => _restore(context),
                icon: Icon(Icons.upload_outlined, color: palette.accent),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: goReceipts,
          icon: const Icon(Icons.add_a_photo_outlined),
          label: const Text('レシートを保管する'),
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
          icon: const Icon(Icons.fact_check_outlined),
          label: const Text('解析結果の確認'),
        ),
        TextButton(onPressed: goHistory, child: const Text('履歴一覧を見る')),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.title,
    required this.count,
    required this.palette,
    required this.target,
    required this.settings,
  });
  final String title;
  final int count;
  final _Palette palette;
  final String target;
  final Map<String, dynamic> settings;
  @override
  Widget build(BuildContext context) => _PhotoSurface(
    target: target,
    settings: settings,
    palette: palette,
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.surface.withValues(alpha: .86),
        border: Border.all(color: palette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 12)),
          Text('$count 件', style: const TextStyle(fontSize: 22)),
          const Text('¥0', style: TextStyle(fontSize: 11)),
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
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(18),
    children: [
      const _SectionTitle('レシートを端末に保存'),
      const SizedBox(height: 12),
      const Text('ここでは文字の読み取りやAI解析はしません。画像はこの端末に保存し、あとでPCのOISO2へ送れます。'),
      const SizedBox(height: 14),
      Row(
        children: [
          Expanded(
            child: FilledButton.icon(
              onPressed: () => onAdd(ImageSource.camera),
              icon: const Icon(Icons.camera_alt_outlined),
              label: const Text('撮影する'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => onAdd(ImageSource.gallery),
              icon: const Icon(Icons.photo_library_outlined),
              label: const Text('写真を選ぶ'),
            ),
          ),
        ],
      ),
      const SizedBox(height: 22),
      _SectionTitle('保存した写真  ${photos.length}枚'),
      const SizedBox(height: 10),
      if (photos.isEmpty)
        const Center(
          child: Padding(
            padding: EdgeInsets.all(36),
            child: Text('保存した写真はありません'),
          ),
        )
      else
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: photos.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
          ),
          itemBuilder: (ctx, i) =>
              _PhotoThumb(file: photos[i], onDelete: () => onDelete(photos[i])),
        ),
    ],
  );
}

class _PhotoThumb extends StatelessWidget {
  const _PhotoThumb({required this.file, required this.onDelete});
  final File file;
  final VoidCallback onDelete;
  @override
  Widget build(BuildContext context) => Stack(
    fit: StackFit.expand,
    children: [
      GestureDetector(
        onTap: () => showDialog<void>(
          context: context,
          builder: (_) =>
              Dialog(child: InteractiveViewer(child: Image.file(file))),
        ),
        child: Image.file(
          file,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => const Icon(Icons.broken_image),
        ),
      ),
      Positioned(
        right: 4,
        top: 4,
        child: IconButton.filled(
          onPressed: () async {
            final ok = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('写真を削除しますか？'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('キャンセル'),
                  ),
                  FilledButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('削除'),
                  ),
                ],
              ),
            );
            if (ok == true) onDelete();
          },
          icon: const Icon(Icons.delete_outline, size: 18),
        ),
      ),
    ],
  );
}

class _HistoryPage extends StatefulWidget {
  const _HistoryPage({
    required this.records,
    required this.onChange,
    required this.onRelay,
  });
  final List<Map<String, dynamic>> records;
  final ValueChanged<List<Map<String, dynamic>>> onChange;
  final VoidCallback onRelay;
  @override
  State<_HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<_HistoryPage> {
  String filter = 'すべて';
  @override
  Widget build(BuildContext context) {
    final filtered = widget.records
        .where(
          (r) =>
              filter == 'すべて' ||
              (filter == '確定済み' ? _confirmed(r) : !_confirmed(r)),
        )
        .toList();
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const _SectionTitle('記録データ履歴'),
        const SizedBox(height: 12),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'すべて', label: Text('すべて')),
            ButtonSegment(value: '未確定', label: Text('未確定')),
            ButtonSegment(value: '確定済み', label: Text('確定済み')),
          ],
          selected: {filter},
          onSelectionChanged: (v) => setState(() => filter = v.first),
        ),
        const SizedBox(height: 14),
        if (filtered.isEmpty)
          const Padding(
            padding: EdgeInsets.all(30),
            child: Center(child: Text('該当する経費データがありません')),
          )
        else
          ...filtered.map(
            (r) => _RecordCard(
              record: r,
              onEdit: () async {
                final result = await _editRecord(context, r);
                if (result != null) {
                  final all = [...widget.records];
                  final i = all.indexWhere((x) => x['id'] == r['id']);
                  if (i >= 0) all[i] = result;
                  widget.onChange(all);
                }
              },
              onConfirm: () {
                final all = [...widget.records];
                final i = all.indexWhere((x) => x['id'] == r['id']);
                if (i >= 0) all[i]['status'] = 'confirmed';
                widget.onChange(all);
              },
            ),
          ),
        const SizedBox(height: 16),
        _Surface(
          target: 'relay',
          settings: LedgerStore.instance.settings(),
          palette: _themes[LedgerStore.instance.theme]!,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'PCへ送信（Relay）',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              const Text(
                'OISO2 BridgeのQRを読み込み、保存済みレシートをPCへ送信します。',
                style: TextStyle(fontSize: 12),
              ),
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: widget.onRelay,
                icon: const Icon(Icons.qr_code_2),
                label: const Text('Bridgeへ接続して送信'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => _backup(context),
          icon: const Icon(Icons.save_alt),
          label: const Text('端末バックアップを保存'),
        ),
      ],
    );
  }
}

class _RecordCard extends StatelessWidget {
  const _RecordCard({
    required this.record,
    required this.onEdit,
    required this.onConfirm,
  });
  final Map<String, dynamic> record;
  final VoidCallback onEdit, onConfirm;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          _RecordTile(
            record: record,
            palette: _themes[LedgerStore.instance.theme]!,
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: onEdit,
                icon: const Icon(Icons.edit_outlined, size: 17),
                label: const Text('編集'),
              ),
              if (!_confirmed(record))
                FilledButton.tonalIcon(
                  onPressed: onConfirm,
                  icon: const Icon(Icons.check, size: 17),
                  label: const Text('確定'),
                ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _RecordTile extends StatelessWidget {
  const _RecordTile({required this.record, required this.palette});
  final Map<String, dynamic> record;
  final _Palette palette;
  @override
  Widget build(BuildContext context) {
    final when = DateTime.tryParse('${record['timestamp'] ?? ''}');
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        record['sensor_type'] == 'CAMERA'
            ? Icons.photo_camera_outlined
            : Icons.receipt_outlined,
        color: palette.accent,
      ),
      title: Text(
        '${record['vendor_name'] ?? record['raw_text'] ?? '記録'}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        '${record['category'] ?? '未分類'} · ${when == null ? '日付なし' : '${when.year}/${when.month}/${when.day}'} · ${_confirmed(record) ? '確定済み' : '未確定'}',
      ),
      trailing: Text(
        '¥${_money(_num(record['amount']))}',
        style: const TextStyle(fontWeight: FontWeight.w500),
      ),
    );
  }
}

class _ThemeSettingsPage extends StatefulWidget {
  const _ThemeSettingsPage({
    required this.theme,
    required this.settings,
    required this.onTheme,
    required this.onSettings,
  });
  final String theme;
  final Map<String, dynamic> settings;
  final ValueChanged<String> onTheme;
  final ValueChanged<Map<String, dynamic>> onSettings;
  @override
  State<_ThemeSettingsPage> createState() => _ThemeSettingsPageState();
}

class _ThemeSettingsPageState extends State<_ThemeSettingsPage> {
  late String theme;
  late Map<String, dynamic> settings;
  String target = 'background';
  final name = TextEditingController();
  @override
  void initState() {
    super.initState();
    theme = widget.theme;
    settings = Map<String, dynamic>.from(widget.settings);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('詳細設定')),
    body: ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const _SectionTitle('カラーテーマ'),
        ..._themes.entries.map(
          (e) => RadioListTile<String>(
            contentPadding: EdgeInsets.zero,
            value: e.key,
            groupValue: theme,
            onChanged: (v) {
              if (v != null) {
                setState(() => theme = v);
                widget.onTheme(v);
              }
            },
            title: Row(
              children: [
                CircleAvatar(radius: 10, backgroundColor: e.value.accent),
                const SizedBox(width: 10),
                Text(e.value.name),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        const _SectionTitle('背景・ウィジェットの写真'),
        const Text('対象を選び、端末内の写真を設定できます。写真は枠に合わせて表示されます。'),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: target,
          decoration: const InputDecoration(
            labelText: '写真を設定する場所',
            border: OutlineInputBorder(),
          ),
          items: const [
            DropdownMenuItem(value: 'background', child: Text('画面背景')),
            DropdownMenuItem(value: 'total', child: Text('経費合計')),
            DropdownMenuItem(value: 'pending', child: Text('未確定の記録')),
            DropdownMenuItem(value: 'confirmed', child: Text('確定済み経費')),
            DropdownMenuItem(value: 'recent', child: Text('最近の記録')),
            DropdownMenuItem(value: 'backup', child: Text('端末バックアップ')),
            DropdownMenuItem(value: 'relay', child: Text('PCへ送信（Relay）')),
          ],
          onChanged: (v) => setState(() => target = v ?? 'background'),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _selectExisting,
                icon: const Icon(Icons.photo_library_outlined),
                label: const Text('保存済み写真から選ぶ'),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              onPressed: () => _choosePhoto(ImageSource.camera),
              icon: const Icon(Icons.camera_alt_outlined),
              tooltip: '撮影して設定',
            ),
          ],
        ),
        if (target == 'background'
            ? settings['backgroundPhoto'] != null
            : (settings['widgetPhotos'] as Map? ?? {})[target] != null)
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('背景写真を薄く表示'),
            value: target == 'background'
                ? (settings['backgroundDim'] as bool? ?? false)
                : (((settings['widgetDim'] as Map? ?? {})[target]) as bool? ??
                      false),
            onChanged: (v) {
              setState(() {
                if (target == 'background')
                  settings['backgroundDim'] = v;
                else {
                  final d = Map<String, dynamic>.from(
                    settings['widgetDim'] ?? {},
                  );
                  d[target] = v;
                  settings['widgetDim'] = d;
                }
              });
              widget.onSettings(settings);
            },
          ),
        const Divider(height: 28),
        const _SectionTitle('テーマ設定を保存'),
        TextField(
          controller: name,
          decoration: const InputDecoration(
            labelText: '設定名',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: () async {
            if (name.text.trim().isEmpty) return;
            final list = LedgerStore.instance.presets()
              ..add({
                'name': name.text.trim(),
                'theme': theme,
                'settings': settings,
                'createdAt': DateTime.now().toIso8601String(),
              });
            await LedgerStore.instance.savePresets(list);
            setState(() {});
            name.clear();
          },
          child: const Text('現在の設定を保存'),
        ),
        ...LedgerStore.instance.presets().map(
          (preset) => ListTile(
            title: Text('${preset['name']}'),
            subtitle: Text(_themes[preset['theme']]?.name ?? 'ライト'),
            trailing: Wrap(
              children: [
                IconButton(
                  onPressed: () {
                    setState(() {
                      theme = preset['theme'] ?? 'light';
                      settings = Map<String, dynamic>.from(
                        preset['settings'] ?? {},
                      );
                    });
                    widget.onTheme(theme);
                    widget.onSettings(settings);
                  },
                  icon: const Icon(Icons.check),
                ),
                IconButton(
                  onPressed: () async {
                    final list = LedgerStore.instance.presets()..remove(preset);
                    await LedgerStore.instance.savePresets(list);
                    setState(() {});
                  },
                  icon: const Icon(Icons.delete_outline),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
  Future<void> _choosePhoto(ImageSource source) async {
    final x = await ImagePicker().pickImage(source: source, imageQuality: 92);
    if (x == null) return;
    await _cropAndAssign(File(x.path));
  }

  Future<void> _selectExisting() async {
    final files = await LedgerStore.instance.photos();
    if (!mounted) return;
    if (files.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('保存済み写真がありません。写真を撮影するか、ギャラリーから追加してください。')),
      );
      return;
    }
    final selected = await showDialog<File>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('保存済み写真'),
        content: SizedBox(
          width: 360,
          height: 400,
          child: GridView.builder(
            itemCount: files.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
            ),
            itemBuilder: (_, i) => GestureDetector(
              onTap: () => Navigator.pop(ctx, files[i]),
              child: Image.file(files[i], fit: BoxFit.cover),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('キャンセル'),
          ),
        ],
      ),
    );
    if (selected != null) await _cropAndAssign(selected);
  }

  Future<void> _cropAndAssign(File source) async {
    final bytes = await source.readAsBytes();
    if (!mounted) return;
    final aspect = switch (target) {
      'background' => 0.58,
      'total' => 2.1,
      'recent' => 1.45,
      _ => 1.8,
    };
    final cropped = await showDialog<Uint8List>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _CropDialog(bytes: bytes, aspect: aspect),
    );
    if (cropped == null) return;
    final saved = await LedgerStore.instance.saveThemePhoto(cropped);
    setState(() {
      if (target == 'background')
        settings['backgroundPhoto'] = saved;
      else {
        final m = Map<String, dynamic>.from(settings['widgetPhotos'] ?? {});
        m[target] = saved;
        settings['widgetPhotos'] = m;
      }
    });
    widget.onSettings(settings);
  }
}

class _ReviewPage extends StatefulWidget {
  const _ReviewPage({required this.reviews, required this.onChange});
  final List<Map<String, dynamic>> reviews;
  final ValueChanged<List<Map<String, dynamic>>> onChange;
  @override
  State<_ReviewPage> createState() => _ReviewPageState();
}

class _ReviewPageState extends State<_ReviewPage> {
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('解析結果の確認')),
    body: ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const Text('PCで解析したレシートCSVを読み込み、商品名・金額・カテゴリを確認して保存します。'),
        const SizedBox(height: 14),
        FilledButton.icon(
          onPressed: _importCsv,
          icon: const Icon(Icons.file_open_outlined),
          label: const Text('解析結果CSVを読み込む'),
        ),
        const SizedBox(height: 12),
        if (widget.reviews.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(28),
              child: Text('確認待ちの解析結果はありません'),
            ),
          )
        else
          ...widget.reviews.map(
            (r) => Card(
              child: ListTile(
                title: Text('${r['vendor'] ?? '店舗未確認'} · ¥${r['amount'] ?? 0}'),
                subtitle: Text(
                  '${r['date'] ?? ''} · ${r['category'] ?? '未分類'} · ${r['confirmed'] == true ? '確認済み' : '未確認'}${_reviewIssues(r).isEmpty ? '' : ' · 要確認: ${_reviewIssues(r).join('・')}'}',
                ),
                trailing: Wrap(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit_outlined),
                      onPressed: () => _edit(r),
                    ),
                    IconButton(
                      icon: const Icon(Icons.check_circle_outline),
                      onPressed: () => _confirm(r),
                    ),
                  ],
                ),
              ),
            ),
          ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _exportCsv,
          icon: const Icon(Icons.download_outlined),
          label: const Text('確認結果をCSVに保存'),
        ),
      ],
    ),
  );

  Future<void> _importCsv() async {
    final files = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['csv'],
    );
    if (files.isEmpty) return;
    try {
      final sourcePath = files.single.path;
      if (sourcePath == null) throw const FormatException('選択したファイルを開けません');
      final text = await File(sourcePath).readAsString(encoding: utf8);
      if (text.length > 2 * 1024 * 1024)
        throw const FormatException('CSVは2MB以内にしてください');
      final rows = _parseCsv(text);
      if (rows.length < 2)
        throw const FormatException('明細入りのOISO解析CSVを選んでください');
      final headers = rows.first.map((s) => s.trim()).toList();
      const required = ['receiptId', 'date', 'vendor', 'amount', 'category'];
      if (headers.toSet().length != headers.length ||
          !required.every(headers.contains)) {
        throw const FormatException(
          'receiptId・date・vendor・amount・category列が必要です',
        );
      }
      if (rows.length - 1 > 5000)
        throw const FormatException('一度に読み込める明細は5000件までです');
      final seen = <String>{};
      final existing = widget.reviews
          .map((r) => '${r['receiptId'] ?? r['id'] ?? ''}')
          .toSet();
      final data = rows
          .skip(1)
          .where((r) => r.any((v) => v.trim().isNotEmpty))
          .map((row) {
            if (row.length != headers.length)
              throw const FormatException('CSVの列数が一致しません');
            final m = <String, dynamic>{};
            for (var i = 0; i < headers.length && i < row.length; i++) {
              m[headers[i]] = row[i].trim();
            }
            final id = '${m['receiptId'] ?? ''}'.trim();
            if (id.isEmpty || !seen.add(id))
              throw const FormatException('receiptIdが空欄または重複しています');
            if (existing.contains(id)) return null;
            return <String, dynamic>{
              'receiptId': id,
              'date': '${m['date'] ?? ''}',
              'vendor': m['vendor'] ?? '',
              'amount': '${m['amount'] ?? ''}'
                  .replaceAll(',', '')
                  .replaceAll('¥', ''),
              'category': m['category'] ?? '',
              'confidence': '${m['confidence'] ?? ''}',
              'confirmed': false,
            };
          })
          .whereType<Map<String, dynamic>>()
          .toList();
      widget.onChange([...widget.reviews, ...data]);
      setState(() {});
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('CSVを読み込めません: $e')));
    }
  }

  void _confirm(Map<String, dynamic> record) {
    final issues = _reviewIssues(record);
    if (issues.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('確認前に修正してください: ${issues.join('・')}')),
      );
      return;
    }
    final list = [...widget.reviews];
    final index = list.indexOf(record);
    if (index < 0) return;
    list[index] = {...record, 'confirmed': true};
    widget.onChange(list);
    setState(() {});
  }

  Future<void> _edit(Map<String, dynamic> r) async {
    final vendor = TextEditingController(text: '${r['vendor'] ?? ''}');
    final date = TextEditingController(text: '${r['date'] ?? ''}');
    final amount = TextEditingController(text: '${r['amount'] ?? ''}');
    final category = TextEditingController(text: '${r['category'] ?? ''}');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('解析結果を編集'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: date,
              decoration: const InputDecoration(labelText: '日付（YYYY-MM-DD）'),
            ),
            TextField(
              controller: vendor,
              decoration: const InputDecoration(labelText: '店舗・商品名'),
            ),
            TextField(
              controller: amount,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: '金額'),
            ),
            TextField(
              controller: category,
              decoration: const InputDecoration(labelText: 'カテゴリ'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('戻る'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('保存'),
          ),
        ],
      ),
    );
    if (ok == true) {
      final list = [...widget.reviews];
      final i = list.indexOf(r);
      list[i] = {
        ...r,
        'date': date.text,
        'vendor': vendor.text,
        'amount': int.tryParse(amount.text) ?? 0,
        'category': category.text,
        'confirmed': false,
      };
      widget.onChange(list);
      setState(() {});
    }
  }

  Future<void> _exportCsv() async {
    final confirmed = widget.reviews.where(
      (r) => r['confirmed'] == true && _reviewIssues(r).isEmpty,
    );
    final lines = [
      'receiptId,date,vendor,amount,category,confidence',
      ...confirmed.map(
        (r) => [
          r['receiptId'] ?? r['id'],
          r['date'],
          r['vendor'],
          r['amount'],
          r['category'],
          r['confidence'],
        ].map((v) => '"${('$v').replaceAll('"', '""')}"').join(','),
      ),
    ];
    final dir = await getTemporaryDirectory();
    final file = File(p.join(dir.path, 'oiso-review.csv'));
    await file.writeAsString('\uFEFF${lines.join('\r\n')}');
    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path)], text: 'OISO解析結果'),
    );
  }
}

class _CropDialog extends StatefulWidget {
  const _CropDialog({required this.bytes, required this.aspect});
  final Uint8List bytes;
  final double aspect;
  @override
  State<_CropDialog> createState() => _CropDialogState();
}

class _CropDialogState extends State<_CropDialog> {
  late final img.Image source;
  double? cropLeft;
  double? cropTop;
  @override
  void initState() {
    super.initState();
    source = img.decodeImage(widget.bytes)!;
  }

  @override
  Widget build(BuildContext context) => Dialog(
    insetPadding: const EdgeInsets.all(18),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            '写真の範囲を選択',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 5),
          const Text(
            '枠を写真の上で動かして、表示する範囲を決めます。',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12),
          ),
          const SizedBox(height: 14),
          LayoutBuilder(
            builder: (context, constraints) {
              final maxW = constraints.maxWidth;
              const h = 390.0;
              final imageAspect = source.width / source.height;
              final imageW = imageAspect > maxW / h ? maxW : h * imageAspect;
              final imageH = imageW / imageAspect;
              final offsetX = (maxW - imageW) / 2;
              final offsetY = (h - imageH) / 2;
              final frameW = widget.aspect > imageW / imageH
                  ? imageW * .88
                  : imageH * .78 * widget.aspect;
              final frameH = frameW / widget.aspect;
              cropLeft ??= offsetX + (imageW - frameW) / 2;
              cropTop ??= offsetY + (imageH - frameH) / 2;
              final x = cropLeft!.clamp(offsetX, offsetX + imageW - frameW);
              final y = cropTop!.clamp(offsetY, offsetY + imageH - frameH);
              final cropRect = Rect.fromLTWH(x, y, frameW, frameH);
              return SizedBox(
                width: maxW,
                height: h,
                child: Stack(
                  children: [
                    Center(
                      child: SizedBox(
                        width: imageW,
                        height: imageH,
                        child: Image.memory(widget.bytes, fit: BoxFit.fill),
                      ),
                    ),
                    Positioned.fill(
                      child: IgnorePointer(
                        child: CustomPaint(
                          painter: _CropShadePainter(cropRect),
                        ),
                      ),
                    ),
                    Positioned.fromRect(
                      rect: cropRect,
                      child: GestureDetector(
                        onPanUpdate: (d) => setState(() {
                          cropLeft = (x + d.delta.dx).clamp(
                            offsetX,
                            offsetX + imageW - frameW,
                          );
                          cropTop = (y + d.delta.dy).clamp(
                            offsetY,
                            offsetY + imageH - frameH,
                          );
                        }),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.white, width: 2),
                            boxShadow: const [
                              BoxShadow(color: Colors.black26, blurRadius: 3),
                            ],
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.open_with,
                              color: Colors.white,
                              shadows: [
                                Shadow(color: Colors.black, blurRadius: 3),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('キャンセル'),
              ),
              const SizedBox(width: 8),
              FilledButton(onPressed: _saveCrop, child: const Text('この範囲を使う')),
            ],
          ),
        ],
      ),
    ),
  );

  void _saveCrop() {
    final media = MediaQuery.sizeOf(context);
    final boxW = media.width - 68;
    const boxH = 390.0;
    final imageAspect = source.width / source.height;
    final imageW = imageAspect > boxW / boxH ? boxW : boxH * imageAspect;
    final imageH = imageW / imageAspect;
    final offX = (boxW - imageW) / 2;
    final offY = (boxH - imageH) / 2;
    final frameW = widget.aspect > imageW / imageH
        ? imageW * .88
        : imageH * .78 * widget.aspect;
    final frameH = frameW / widget.aspect;
    final left = (cropLeft ?? offX + (imageW - frameW) / 2) - offX;
    final top = (cropTop ?? offY + (imageH - frameH) / 2) - offY;
    final sx = (left / imageW * source.width).round().clamp(
      0,
      source.width - 1,
    );
    final sy = (top / imageH * source.height).round().clamp(
      0,
      source.height - 1,
    );
    final sw = (frameW / imageW * source.width).round().clamp(
      1,
      source.width - sx,
    );
    final sh = (frameH / imageH * source.height).round().clamp(
      1,
      source.height - sy,
    );
    final cropped = img.copyCrop(source, x: sx, y: sy, width: sw, height: sh);
    Navigator.pop(
      context,
      Uint8List.fromList(img.encodeJpg(cropped, quality: 92)),
    );
  }
}

class _CropShadePainter extends CustomPainter {
  const _CropShadePainter(this.crop);
  final Rect crop;
  @override
  void paint(Canvas canvas, Size size) {
    final outside = Path()
      ..addRect(Offset.zero & size)
      ..addRect(crop)
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(
      outside,
      Paint()..color = Colors.black.withValues(alpha: .55),
    );
  }

  @override
  bool shouldRepaint(covariant _CropShadePainter oldDelegate) =>
      oldDelegate.crop != crop;
}

class _QrPage extends StatelessWidget {
  const _QrPage();
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Relay QRを読み取る')),
    body: MobileScanner(
      onDetect: (capture) {
        final raw = capture.barcodes.firstOrNull?.rawValue;
        if (raw != null && context.mounted) Navigator.pop(context, raw);
      },
    ),
  );
}

class _Surface extends StatelessWidget {
  const _Surface({
    required this.target,
    required this.settings,
    required this.palette,
    required this.child,
  });
  final String target;
  final Map<String, dynamic> settings;
  final _Palette palette;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final path = target == 'background'
        ? settings['backgroundPhoto']
        : (settings['widgetPhotos'] as Map? ?? {})[target];
    final dim = target == 'background'
        ? settings['backgroundDim'] == true
        : ((settings['widgetDim'] as Map? ?? {})[target] == true);
    final hasImage = path is String && File(path).existsSync();
    return Container(
      decoration: BoxDecoration(
        color: palette.surface,
        image: hasImage
            ? DecorationImage(
                image: FileImage(File(path)),
                fit: BoxFit.cover,
                colorFilter: dim
                    ? ColorFilter.mode(
                        palette.surface.withValues(alpha: .55),
                        BlendMode.srcOver,
                      )
                    : null,
              )
            : null,
        border: Border.all(color: palette.line),
        borderRadius: BorderRadius.circular(4),
      ),
      padding: const EdgeInsets.all(14),
      child: child,
    );
  }
}

class _PhotoSurface extends StatelessWidget {
  const _PhotoSurface({
    required this.target,
    required this.settings,
    required this.palette,
    required this.child,
  });
  final String target;
  final Map<String, dynamic> settings;
  final _Palette palette;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final path = (settings['widgetPhotos'] as Map? ?? {})[target];
    final dim = (settings['widgetDim'] as Map? ?? {})[target] == true;
    final hasImage = path is String && File(path).existsSync();
    return ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: Container(
        decoration: BoxDecoration(
          color: palette.surface,
          image: hasImage
              ? DecorationImage(
                  image: FileImage(File(path)),
                  fit: BoxFit.cover,
                  colorFilter: dim
                      ? ColorFilter.mode(
                          Colors.white.withValues(alpha: .55),
                          BlendMode.srcOver,
                        )
                      : null,
                )
              : null,
        ),
        child: child,
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          text,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        ),
        const SizedBox(height: 8),
        const Divider(height: 1),
      ],
    ),
  );
}

Future<Map<String, dynamic>?> _editRecord(
  BuildContext context,
  Map<String, dynamic> record,
) async {
  final vendor = TextEditingController(text: '${record['vendor_name'] ?? ''}');
  final amount = TextEditingController(text: '${record['amount'] ?? 0}');
  final category = TextEditingController(text: '${record['category'] ?? ''}');
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('記録を編集'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: vendor,
            decoration: const InputDecoration(labelText: '店舗・内容'),
          ),
          TextField(
            controller: amount,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: '金額'),
          ),
          TextField(
            controller: category,
            decoration: const InputDecoration(labelText: 'カテゴリ'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('キャンセル'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('保存'),
        ),
      ],
    ),
  );
  return result == true
      ? {
          ...record,
          'vendor_name': vendor.text,
          'raw_text': vendor.text,
          'amount': int.tryParse(amount.text) ?? 0,
          'category': category.text,
        }
      : null;
}

Future<void> _backup(BuildContext context) async {
  try {
    final json = await LedgerStore.instance.exportBackup();
    final dir = await getTemporaryDirectory();
    final file = File(
      p.join(
        dir.path,
        'oiso-backup-${DateTime.now().millisecondsSinceEpoch}.oaiso',
      ),
    );
    await file.writeAsString(json);
    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path)], text: 'OISO端末バックアップ'),
    );
  } catch (e) {
    if (context.mounted)
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('バックアップを作成できません: $e')));
  }
}

Future<void> _restore(BuildContext context) async {
  final f = await FilePicker.pickFiles(
    type: FileType.custom,
    allowedExtensions: ['oaiso'],
  );
  if (f.isEmpty) return;
  try {
    final sourcePath = f.single.path;
    if (sourcePath == null) throw const FormatException('選択したファイルを開けません');
    final text = await File(sourcePath).readAsString(encoding: utf8);
    await LedgerStore.instance.importBackup(text);
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('バックアップを復元しました。画面を更新してください。')),
      );
  } catch (e) {
    if (context.mounted)
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('復元できません: $e')));
  }
}

List<List<String>> _parseCsv(String text) {
  final rows = <List<String>>[];
  var row = <String>[];
  final cell = StringBuffer();
  var quoted = false;
  final s = text.replaceFirst('\uFEFF', '');
  for (var i = 0; i < s.length; i++) {
    final c = s[i];
    if (c == '"') {
      if (quoted && i + 1 < s.length && s[i + 1] == '"') {
        cell.write('"');
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (c == ',' && !quoted) {
      row.add(cell.toString());
      cell.clear();
    } else if ((c == '\n' || c == '\r') && !quoted) {
      if (c == '\r' && i + 1 < s.length && s[i + 1] == '\n') i++;
      row.add(cell.toString());
      cell.clear();
      rows.add(row);
      row = [];
    } else {
      cell.write(c);
    }
  }
  if (cell.isNotEmpty || row.isNotEmpty) {
    row.add(cell.toString());
    rows.add(row);
  }
  return rows;
}

int _num(dynamic value) =>
    value is num ? value.round() : int.tryParse('$value') ?? 0;

List<String> _reviewIssues(Map<String, dynamic> row) {
  final issues = <String>[];
  final date = '${row['date'] ?? ''}';
  final parsed = DateTime.tryParse(date);
  if (parsed == null ||
      !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(date) ||
      parsed.toIso8601String().substring(0, 10) != date) {
    issues.add('日付');
  }
  if ('${row['vendor'] ?? ''}'.trim().isEmpty) issues.add('店舗名');
  if (!RegExp(r'^-?\d+$').hasMatch('${row['amount'] ?? ''}')) issues.add('金額');
  if ('${row['category'] ?? ''}'.trim().isEmpty) issues.add('科目');
  return issues;
}

String _money(int value) => value.toString().replaceAllMapped(
  RegExp(r'(?<=\d)(?=(\d{3})+$)'),
  (_) => ',',
);
bool _confirmed(Map<String, dynamic> record) =>
    record['status'] == 'confirmed' ||
    record['status'] == 'verified' ||
    record['status'] == '確定済み';
