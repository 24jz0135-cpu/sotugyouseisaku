import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image/image.dart' as img;
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'data_store.dart';
import 'result_transfer.dart';
import 'login_page.dart';
import 'lan_page.dart';
import 'lan_connection.dart';
part 'web_design.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LedgerStore.instance.init();
  runApp(const OisoApp());
}

const _themes = <String, _Palette>{
  'light': _Palette(
    'ライト',
    Color(0xffffffff),
    Color(0xff334155),
    Color(0xfff8fafc),
    Color(0xff493b35),
    Color(0x14000000),
  ),
  'dark': _Palette(
    'ダーク',
    Color(0xff172033),
    Color(0xffcbd5e1),
    Color(0xff1e293b),
    Color(0xffa78bfa),
    Color(0x24e2e8f0),
  ),
  'brown': _Palette(
    'ブラウン',
    Color(0xfffff9f2),
    Color(0xff5b3828),
    Color(0xfffff9f2),
    Color(0xff5b3828),
    Color(0x295c301f),
  ),
  'ocean': _Palette(
    'オーシャン',
    Color(0xfff9fdff),
    Color(0xff15518b),
    Color(0xfff8fdff),
    Color(0xff07559d),
    Color(0x2e3890c9),
  ),
  'forest': _Palette(
    'フォレスト',
    Color(0xfffbfffc),
    Color(0xff14532d),
    Color(0xfff0fdf4),
    Color(0xff15803d),
    Color(0x26226534),
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
  bool useLocalData = false;
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
        fontFamily: 'Inter',
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: c.accent,
            foregroundColor: Colors.white,
            elevation: 0,
            minimumSize: const Size(0, 42),
            textStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(3),
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: c.accent,
            side: BorderSide(color: c.line),
            minimumSize: const Size(0, 38),
            textStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(3),
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          isDense: true,
          filled: true,
          fillColor: c.bg,
          contentPadding: const EdgeInsets.all(12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(3),
            borderSide: BorderSide(color: c.line),
          ),
        ),

        scaffoldBackgroundColor: c.bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: c.accent,
          brightness: theme == 'dark' ? Brightness.dark : Brightness.light,
          surface: c.surface,
          primary: c.accent,
          onSurface: c.fg,
        ),
        textTheme: TextTheme(
          bodyMedium: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w400,
            color: c.fg,
          ),
          bodyLarge: TextStyle(fontSize: 14, color: c.fg),
          titleLarge: TextStyle(fontWeight: FontWeight.w500),
        ),
        appBarTheme: AppBarTheme(
          backgroundColor: c.header,
          foregroundColor: c.headerText,
          surfaceTintColor: Colors.transparent,
          systemOverlayStyle: c.name == 'ブラウン' || theme == 'dark'
              ? SystemUiOverlayStyle.light
              : SystemUiOverlayStyle.dark,
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
      home: useLocalData
          ? _Shell(
              theme: theme,
              palette: c,
              onTheme: setTheme,
              onLogin: () => setState(() => useLocalData = false),
            )
          : LoginPage(
              onContinueLocally: () => setState(() => useLocalData = true),
            ),
    );
  }
}

class _Shell extends StatefulWidget {
  const _Shell({
    required this.onLogin,
    required this.theme,
    required this.palette,
    required this.onTheme,
  });
  final String theme;
  final _Palette palette;
  final ValueChanged<String> onTheme;
  final VoidCallback onLogin;
  @override
  State<_Shell> createState() => _ShellState();
}

class _ShellState extends State<_Shell> {
  int tab = 0;
  List<Map<String, dynamic>> records = [];
  List<Map<String, dynamic>> reviews = [];
  List<File> photos = [];
  Map<String, Map<String, dynamic>> receiptStates = {};
  Map<String, dynamic> settings = {};
  bool loading = true;
  bool sendingPhotos=false;
  String sendProgress="";
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
    receiptStates = {
      for (final row in await LedgerStore.instance.receipts()) '${row['path']}': row,
    };
    if (mounted) setState(() => loading = false);
  }

  Future<void> _persistRecords() async {
    await LedgerStore.instance.saveRecords(records);
    if (mounted) setState(() {});
  }

  Future<void> _refreshPhotos() async {
    photos = await LedgerStore.instance.photos();
    receiptStates = {
      for (final row in await LedgerStore.instance.receipts()) '${row['path']}': row,
    };
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

  Future<void> _sendPhotosToPc() async {
    if (sendingPhotos) return;
    await _refreshPhotos();
    if (!mounted) return;
    if (photos.isEmpty) {
      _message('先にレシートを撮影するか、写真を追加してください');
      return;
    }
    final selected = <String>{};
    final chosen = await showDialog<List<File>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (c, update) => AlertDialog(
          title: const Text('PCへ送る写真を選ぶ'),
          content: SizedBox(
            width: 360,
            height: 360,
            child: ListView(
              children: photos
                  .map(
                    (f) => CheckboxListTile(
                      value: selected.contains(f.path),
                      onChanged: (value) => update(() {
                        if (value == true) {
                          selected.add(f.path);
                        } else {
                          selected.remove(f.path);
                        }
                      }),
                      title: Image.file(
                        f,
                        height: 110,
                        fit: BoxFit.contain,
                        errorBuilder: (_, _, _) => const Text('画像を開けません'),
                      ),
                      subtitle: Text('写真 ${photos.indexOf(f) + 1}'),
                    ),
                  )
                  .toList(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c),
              child: const Text('戻る'),
            ),
            FilledButton(
              onPressed: selected.isEmpty
                  ? null
                  : () => Navigator.pop(
                      c,
                      photos.where((f) => selected.contains(f.path)).toList(),
                    ),
              child: Text('${selected.length}枚を送信'),
            ),
          ],
        ),
      ),
    );
    if (chosen == null || !mounted) return;
    setState(() {
      sendingPhotos = true;
      sendProgress = 'PCを確認しています…';
    });
    var sent = 0;
    try {
      final lan = Lan();
      await lan.load();
      await lan.connect();
      for (final file in chosen) {
        if (mounted)
          setState(
            () => sendProgress = 'PCへ送信中… ${sent + 1}/${chosen.length}枚',
          );
        await lan.sendPhoto(file);
        sent++;
      }
      _message('$sent枚をPCに保存しました。PCの「スマホから届いた写真」を確認してください');
      if (mounted) setState(() => sendProgress = '$sent枚をPCに保存しました');
    } catch (e) {
      final message = e is FormatException
          ? e.message
          : 'PCに送信できませんでした。同じWi-FiとPCの起動状態を確認してください';
      _message('$sent/${chosen.length}枚を保存済み。$message');
      if (mounted)
        setState(
          () =>
              sendProgress = '$sent/${chosen.length}枚を保存済み。未送信の写真を選び直して再送できます',
        );
    } finally {
      if (mounted) setState(() => sendingPhotos = false);
    }
  }

  Future<void> _shareReceiptBatch() async {
    final pending = photos.where((file) {
      final status = '${receiptStates[file.path]?['status'] ?? 'unprocessed'}';
      return status == 'unprocessed' || status == 'failed';
    }).take(10).toList();
    if (pending.isEmpty) {
      _message('共有できる未解析レシートがありません');
      return;
    }
    await SharePlus.instance.share(ShareParams(
      files: pending.map((file) => XFile(file.path)).toList(),
      text: 'レシート画像を1枚ずつ読み取り、CSVのみを返してください。列は receiptId,date,vendor,amount,category,transactionType,paymentMethod,confidence。金額は税込円、日付はYYYY-MM-DD。売上はincome、仕入はpurchase、経費はexpense、現金はcash、掛はcredit。読めない値は空欄にしてください。',
    ));
  }
  Future<void> _exportLedgerCsv() async {
    final rows = <String>[
      'date,transaction_type,payment_method,vendor,amount,category,status,receipt_id',
      ...records.map((r) {
        final date = '${r['timestamp'] ?? ''}'.split('T').first;
        final values = [date, r['transaction_type'] ?? 'expense', r['payment_method'] ?? 'cash', r['vendor_name'] ?? '', r['amount'] ?? 0, r['category'] ?? '', r['status'] ?? 'pending', r['receipt_id'] ?? ''];
        return values.map((v) => '"${'$v'.replaceAll('"', '""')}"').join(',');
      }),
    ];
    final file = File(p.join((await getTemporaryDirectory()).path, 'oaiso-ledger-${DateTime.now().year}.csv'));
    await file.writeAsString('\uFEFF${rows.join('\r\n')}');
    await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], text: 'Oaiso帳簿データCSV'));
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
        receiptStates: receiptStates,
        onShareBatch: _shareReceiptBatch,
        onSendToPc: _sendPhotosToPc,
        onReceiveResults:()=>_openReviewPage(readCode:true),
        sending: sendingPhotos,
        sendProgress: sendProgress,
        onAdd: _addPhoto,
        onDelete: (file) async {
          await LedgerStore.instance.deletePhoto(file.path);
          for (final record in records.where((r) => r['image_path'] == file.path)) {
            record['image_path'] = null;
          }
          await _persistRecords();
          await _refreshPhotos();
        },
      ),
      _HistoryPage(
        onExport: _exportLedgerCsv,
        onReview: _openReviewPage,
        records: records,
        onChange: (r) async {
          records = r;
          await _persistRecords();
        },
        onAdd: () => _showAddRecord(),
      ),
      ReceiptReviewPage(
        reviews: reviews,
        onApprove: _approveReview,
        onChange: (r) async {
          await LedgerStore.instance.saveReviews(r);
          await _refreshPhotos();
          if (mounted) setState(() => reviews = r);
        },
      ),
    ];
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => LanConnectionPage(onSendPhotos:_sendPhotosToPc,onReceiveResults:()=>_openReviewPage(readCode:true)))),
        icon: const Icon(Icons.qr_code_scanner), label: const Text('PC接続'),
      ),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(76),
        child: _WebHeader(
          theme: widget.theme,
          palette: widget.palette,
          onTheme: widget.onTheme,
          onSettings: _openThemeSettings,
          onHelp: _help,
          onRefresh: _load,
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
      bottomNavigationBar: _WebNav(
        palette: widget.palette,
        index: tab > 2 ? 2 : tab,
        onTap: (v) => setState(() => tab = v),
      ),
    );
  }

  void _openReviewPage({bool readCode=false}) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReceiptReviewPage(
      readCodeOnOpen:readCode,
      reviews: reviews,
      onApprove: _approveReview,
      onChange: (rows) async {
        await LedgerStore.instance.saveReviews(rows);
        await _refreshPhotos();
        if (mounted) setState(() => reviews = rows);
      },
    )));
  }
  Future<void> _approveReview(Map<String, dynamic> row) async {
    final receiptId = '${row['receiptId'] ?? row['receipt_id'] ?? ''}';
    final existingIndex = records.indexWhere((r) => receiptId.isNotEmpty && '${r['receipt_id'] ?? ''}' == receiptId);
    final category = '${row['category'] ?? 'その他'}';
    final kind = '${row['transaction_type'] ?? (category == '売上高' ? 'income' : (category == '仕入高' ? 'purchase' : 'expense'))}';
    final receiptRows = await LedgerStore.instance.receipts();
    final receiptIndex = receiptRows.indexWhere((r) => '${r['id']}' == receiptId);
    final receipt = receiptIndex >= 0 ? receiptRows[receiptIndex] : null;
    final record = <String, dynamic>{
      'id': existingIndex >= 0 ? records[existingIndex]['id'] : DateTime.now().microsecondsSinceEpoch.toString(),
      'timestamp': '${row['date'] ?? DateTime.now().toIso8601String().substring(0, 10)}T00:00:00.000',
      'sensor_type': 'AI_REVIEW',
      'raw_text': row['vendor'],
      'vendor_name': row['vendor'],
      'amount': int.tryParse('${row['amount'] ?? ''}') ?? 0,
      'category': category,
      'transaction_type': kind,
      'payment_method': '${row['payment_method'] ?? 'cash'}',
      'status': 'confirmed',
      if (receiptId.isNotEmpty) 'receipt_id': receiptId,
      if (receipt != null) 'image_path': receipt['path'],
    };
    if (existingIndex >= 0) {
      records[existingIndex] = record;
    } else {
      records.insert(0, record);
    }
    await _persistRecords();
    if (receiptId.isNotEmpty) await LedgerStore.instance.linkReceipt(receiptId, '${record['id']}');
    await _refreshPhotos();
  }
  Future<void> _showAddRecord([Map<String, dynamic>? existing]) async {
    final vendor = TextEditingController(text: existing?['vendor_name']?.toString() ?? '');
    final amount = TextEditingController(text: existing?['amount']?.toString() ?? '');
    final category = TextEditingController(text: existing?['category']?.toString() ?? '');
    var transactionType = '${existing?['transaction_type'] ?? 'expense'}';
    var paymentMethod = '${existing?['payment_method'] ?? 'cash'}';
    var occurredAt = DateTime.tryParse('${existing?['timestamp'] ?? ''}') ?? DateTime.now();
    const categories = <String>[
      '売上高', '仕入高', '租税公課', '荷造運賃', '水道光熱費', '旅費交通費',
      '通信費', '広告宣伝費', '接待交際費', '損害保険料', '修繕費', '消耗品費',
      '福利厚生費', '給料賃金', '外注工賃', '利子割引料', '地代家賃', '貸倒金',
      '減価償却費', '車両費', '新聞図書費', '研修費', '雑費', 'その他',
    ];
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, refresh) => AlertDialog(
          title: Text(existing == null ? '取引を登録' : '取引を編集'),
          content: SizedBox(
            width: 420,
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                DropdownButtonFormField<String>(
                  value: transactionType,
                  decoration: const InputDecoration(labelText: '取引種別'),
                  items: const [
                    DropdownMenuItem(value: 'income', child: Text('売上')),
                    DropdownMenuItem(value: 'purchase', child: Text('仕入')),
                    DropdownMenuItem(value: 'expense', child: Text('経費')),
                  ],
                  onChanged: (v) => refresh(() => transactionType = v ?? 'expense'),
                ),
                TextField(controller: vendor, decoration: const InputDecoration(labelText: '取引先・内容')),
                TextField(controller: amount, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '金額（円・税込、返金はマイナス）')),
                DropdownButtonFormField<String>(
                  value: categories.contains(category.text) ? category.text : 'その他',
                  decoration: const InputDecoration(labelText: '科目'),
                  items: categories.map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(),
                  onChanged: (v) => category.text = v ?? 'その他',
                ),
                DropdownButtonFormField<String>(
                  value: paymentMethod,
                  decoration: const InputDecoration(labelText: '決済方法'),
                  items: const [
                    DropdownMenuItem(value: 'cash', child: Text('現金・即時決済')),
                    DropdownMenuItem(value: 'credit', child: Text('掛・後払い')),
                  ],
                  onChanged: (v) => refresh(() => paymentMethod = v ?? 'cash'),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('取引日'),
                  subtitle: Text('${occurredAt.year}-${occurredAt.month.toString().padLeft(2, '0')}-${occurredAt.day.toString().padLeft(2, '0')}'),
                  trailing: const Icon(Icons.calendar_month),
                  onTap: () async {
                    final picked = await showDatePicker(context: ctx, initialDate: occurredAt, firstDate: DateTime(2000), lastDate: DateTime(2100));
                    if (picked != null) refresh(() => occurredAt = picked);
                  },
                ),
                const Align(alignment: Alignment.centerLeft, child: Text('税込金額で記録します。税区分や掛の入金・支払管理は今後の帳簿拡張で扱います。', style: TextStyle(fontSize: 11))),
              ]),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('キャンセル')),
            FilledButton(onPressed: () {
              final parsedAmount = int.tryParse(amount.text.replaceAll(',', '').trim());
              if (vendor.text.trim().isEmpty || parsedAmount == null || parsedAmount == 0) {
                ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('取引先・内容と金額を入力してください。返品・返金はマイナスで入力します')));
                return;
              }
              Navigator.pop(ctx, {
                'vendor': vendor.text.trim(),
                'amount': '$parsedAmount',
                'category': category.text.trim().isEmpty ? 'その他' : category.text.trim(),
                'transaction_type': transactionType,
                'payment_method': paymentMethod,
                'timestamp': DateTime(occurredAt.year, occurredAt.month, occurredAt.day).toIso8601String(),
              });
            }, child: const Text('保存')),
          ],
        ),
      ),
    );
    vendor.dispose();
    amount.dispose();
    category.dispose();
    if (result == null) return;
    if (existing == null) {
      records.insert(0, {
        'id': DateTime.now().microsecondsSinceEpoch.toString(),
        'timestamp': result['timestamp'],
        'sensor_type': 'MANUAL',
        'raw_text': result['vendor'],
        'vendor_name': result['vendor'],
        'amount': int.tryParse(result['amount'] ?? '') ?? 0,
        'category': result['category'],
        'transaction_type': result['transaction_type'],
        'payment_method': result['payment_method'],
        'status': 'pending',
      });
    } else {
      existing['vendor_name'] = result['vendor'];
      existing['raw_text'] = result['vendor'];
      existing['amount'] = int.tryParse(result['amount'] ?? '') ?? 0;
      existing['category'] = result['category'];
      existing['transaction_type'] = result['transaction_type'];
      existing['payment_method'] = result['payment_method'];
      existing['timestamp'] = result['timestamp'];
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
      content: const Text('取引は種別・決済方法・取引日を入力して登録します。撮影したレシートは端末に保存し、最大10枚を共有して外部AIで手動解析できます。結果CSVを読み込み、確認後に帳簿へ登録してください。データは端末内に保存されます。'),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('閉じる'))],
    ),
  );
}

class _PhotoThumb extends StatelessWidget {
  const _PhotoThumb({required this.file, required this.status, required this.onDelete});
  final File file;
  final String status;
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
        left: 6,
        bottom: 6,
        child: DecoratedBox(
          decoration: BoxDecoration(color: Colors.black.withValues(alpha: .72), borderRadius: BorderRadius.circular(4)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
            child: Text(_receiptStatusLabel(status), style: const TextStyle(color: Colors.white, fontSize: 10)),
          ),
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
    required this.onExport,
    required this.onReview,
    required this.records,
    required this.onChange,
    required this.onAdd,
  });
  final List<Map<String, dynamic>> records;
  final VoidCallback onExport;
  final VoidCallback onReview;
  final ValueChanged<List<Map<String, dynamic>>> onChange;
  final VoidCallback onAdd;
  @override
  State<_HistoryPage> createState() => _HistoryPageState();
}

class _RecordCard extends StatelessWidget {
  const _RecordCard({
    required this.record,
    required this.onEdit,
    required this.onConfirm,
    required this.onDelete,
  });
  final Map<String, dynamic> record;
  final VoidCallback onEdit, onConfirm, onDelete;
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
              IconButton(
                tooltip: '取引を削除',
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline, size: 19),
              ),
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
        '${_transactionLabel(record)} • ${record['category'] ?? '未分類'} • ${when == null ? '日付なし' : '${when.year}/${when.month}/${when.day}'} • ${record['payment_method'] == 'credit' ? '掛' : '現金'} • ${_confirmed(record) ? '確認済み' : '未確認'}',
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
  Widget build(BuildContext context) {
    final c = _themes[theme] ?? _themes['light']!;
    Future<void> choose(String value) async {
      setState(() => target = value);
      final action = await showModalBottomSheet<String>(
        context: context,
        builder: (ctx) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(LucideIcons.images),
                title: const Text('端末の写真を選ぶ'),
                onTap: () => Navigator.pop(ctx, 'gallery'),
              ),
              ListTile(
                leading: const Icon(LucideIcons.camera),
                title: const Text('撮影する'),
                onTap: () => Navigator.pop(ctx, 'camera'),
              ),
              ListTile(
                leading: const Icon(LucideIcons.folder),
                title: const Text('保管済みレシートから選ぶ'),
                onTap: () => Navigator.pop(ctx, 'saved'),
              ),
            ],
          ),
        ),
      );
      if (action == 'gallery') await _choosePhoto(ImageSource.gallery);
      if (action == 'camera') await _choosePhoto(ImageSource.camera);
      if (action == 'saved') await _selectExisting();
    }

    Widget photoCard(String key, String title, String text, IconData icon) {
      final photoPath = key == 'background'
          ? settings['backgroundPhoto']
          : (settings['widgetPhotos'] as Map? ?? {})[key];
      final has = key == 'background'
          ? settings['backgroundPhoto'] != null
          : (settings['widgetPhotos'] as Map? ?? {})[key] != null;
      return Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: c.surface,
          border: Border.all(color: c.line),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (photoPath is String && File(photoPath).existsSync()) ...[
              SizedBox(
                width: double.infinity,
                height: 140,
                child: Image.file(File(photoPath), fit: BoxFit.cover),
              ),
              const SizedBox(height: 8),
              const Text(
                '設定中の写真',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
            ],
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  color: c.accent.withValues(alpha: .1),
                  child: Icon(icon, size: 19, color: c.accent),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        text,
                        style: TextStyle(
                          fontSize: 10,
                          height: 1.5,
                          color: c.muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (has)
                  OutlinedButton.icon(
                    icon: const Icon(LucideIcons.imageOff, size: 18),
                    label: Text(key == 'background' ? '背景写真を解除' : 'カード写真を解除'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 44),
                    ),
                    onPressed: () {
                      setState(() {
                        if (key == 'background') {
                          settings.remove('backgroundPhoto');
                        } else {
                          final photos = Map<String, dynamic>.from(
                            settings['widgetPhotos'] ?? {},
                          );
                          photos.remove(key);
                          settings['widgetPhotos'] = photos;
                        }
                      });
                      widget.onSettings(settings);
                    },
                  ),
                OutlinedButton(
                  onPressed: () => choose(key),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 44),
                  ),
                  child: Text(has ? '写真を変更' : '写真を選ぶ'),
                ),
              ],
            ),
            if (has) ...[
              const SizedBox(height: 6),
              Text(
                '解除しても元の写真は削除されません。',
                style: TextStyle(fontSize: 11, color: c.muted),
              ),
            ],
          ],
        ),
      );
    }

    Widget dimControl(String key, String title) => SwitchListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
      title: Text(
        title,
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
      ),
      subtitle: Text(
        '画面の文字やカードを読みやすくします。',
        style: TextStyle(fontSize: 9, color: c.muted),
      ),
      value: key == 'background'
          ? settings['backgroundDim'] == true
          : (settings['widgetDim'] as Map? ?? {})[key] == true,
      onChanged: (v) {
        setState(() {
          if (key == 'background') {
            settings['backgroundDim'] = v;
          } else {
            final values = Map<String, dynamic>.from(
              settings['widgetDim'] ?? {},
            );
            values[key] = v;
            settings['widgetDim'] = values;
          }
        });
        widget.onSettings(settings);
      },
    );
    final selected = target == 'background' ? 'total' : target;
    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(76),
        child: _WebHeader(
          theme: theme,
          palette: c,
          onTheme: (v) {
            setState(() => theme = v);
            widget.onTheme(v);
          },
          onSettings: () {},
          onHelp: () => showDialog<void>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('写真の設定'),
              content: const Text(
                '背景やカードに写真を設定できます。写真を選んだ後に範囲を調整し、見た目を名前付きで保存できます。',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('閉じる'),
                ),
              ],
            ),
          ),
          onRefresh: () =>
              setState(() => settings = LedgerStore.instance.settings()),
        ),
      ),
      body: Stack(
        children: [
          if (settings['backgroundPhoto'] is String &&
              File(settings['backgroundPhoto']).existsSync()) ...[
            Positioned.fill(
              child: Image.file(
                File(settings['backgroundPhoto']),
                fit: BoxFit.cover,
              ),
            ),
            if (settings['backgroundDim'] == true)
              Positioned.fill(
                child: ColoredBox(color: c.bg.withValues(alpha: .58)),
              ),
          ],
          ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(LucideIcons.arrowLeft, size: 16),
                  label: const Text('テーマに戻る', style: TextStyle(fontSize: 12)),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'THEME CUSTOMIZATION',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                  color: c.accent,
                ),
              ),
              const SizedBox(height: 3),
              Text('詳細設定', style: _webHeading(20)),
              const SizedBox(height: 5),
              Text(
                '背景やウィジェットに好きな写真を設定できます。',
                style: TextStyle(fontSize: 12, color: c.muted),
              ),
              const SizedBox(height: 22),
              _Surface(
                target: 'presets',
                settings: const {},
                palette: c,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            '見た目を保存',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        Icon(LucideIcons.layers2, size: 19, color: c.accent),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '背景やウィジェットの設定をまとめて保存できます。',
                      style: TextStyle(fontSize: 10, color: c.muted),
                    ),
                    const SizedBox(height: 13),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: name,
                            maxLength: 24,
                            style: const TextStyle(fontSize: 11),
                            decoration: const InputDecoration(
                              hintText: '例：春のテーマ',
                              counterText: '',
                              contentPadding: EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 10,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 7),
                        FilledButton.icon(
                          icon: const Icon(LucideIcons.bookmarkPlus, size: 14),
                          label: const Text('保存'),
                          onPressed: () async {
                            if (name.text.trim().isEmpty) return;
                            final list = LedgerStore.instance.presets()
                              ..add({
                                'name': name.text.trim(),
                                'theme': theme,
                                'settings': jsonDecode(jsonEncode(settings)),
                                'createdAt': DateTime.now().toIso8601String(),
                              });
                            await LedgerStore.instance.savePresets(list);
                            if (mounted) setState(() => name.clear());
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 9),
                    if (LedgerStore.instance.presets().isEmpty)
                      Center(
                        child: Text(
                          '保存した設定はありません。',
                          style: TextStyle(fontSize: 9, color: c.muted),
                        ),
                      )
                    else
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 108),
                        child: ListView(
                          shrinkWrap: true,
                          children: LedgerStore.instance
                              .presets()
                              .asMap()
                              .entries
                              .map((entry) {
                                final preset = entry.value;
                                return Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        '${preset['name']}',
                                        style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                    TextButton(
                                      onPressed: () {
                                        setState(() {
                                          theme = preset['theme'] ?? 'light';
                                          settings = Map<String, dynamic>.from(
                                            jsonDecode(
                                              jsonEncode(
                                                preset['settings'] ?? {},
                                              ),
                                            ),
                                          );
                                        });
                                        widget.onTheme(theme);
                                        widget.onSettings(settings);
                                      },
                                      child: const Text(
                                        '適用',
                                        style: TextStyle(fontSize: 9),
                                      ),
                                    ),
                                    IconButton(
                                      tooltip: '設定を削除',
                                      icon: const Icon(
                                        LucideIcons.trash2,
                                        size: 14,
                                      ),
                                      onPressed: () async {
                                        final list =
                                            LedgerStore.instance.presets()
                                              ..removeAt(entry.key);
                                        await LedgerStore.instance.savePresets(
                                          list,
                                        );
                                        if (mounted) setState(() {});
                                      },
                                    ),
                                  ],
                                );
                              })
                              .toList(),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              photoCard(
                'background',
                '背景',
                'アプリの背景に写真を設定します。',
                LucideIcons.image,
              ),
              dimControl('background', '背景写真を薄く表示'),
              const SizedBox(height: 16),
              const Text(
                '写真を設定するウィジェット',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 7),
              DropdownButtonFormField<String>(
                initialValue: selected,
                style: TextStyle(fontSize: 11, color: c.fg),
                items: const [
                  DropdownMenuItem(value: 'total', child: Text('今月の経費合計')),
                  DropdownMenuItem(value: 'pending', child: Text('未確定ファクト')),
                  DropdownMenuItem(value: 'confirmed', child: Text('確定済み経費')),
                  DropdownMenuItem(
                    value: 'categories',
                    child: Text('経費カテゴリ内訳'),
                  ),
                  DropdownMenuItem(value: 'recent', child: Text('要確認の現場ファクト')),
                  DropdownMenuItem(value: 'backup', child: Text('端末バックアップ')),
                  DropdownMenuItem(value: 'relay', child: Text('PCへ送信（Relay）')),
                ],
                onChanged: (v) => setState(() => target = v ?? 'total'),
              ),
              const SizedBox(height: 16),
              photoCard(
                selected,
                'ウィジェット',
                '選択したカードに写真を設定します。',
                LucideIcons.layoutDashboard,
              ),
              dimControl(selected, 'ウィジェット写真を薄く表示'),
            ],
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

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

class ReceiptReviewPage extends StatefulWidget {
  const ReceiptReviewPage({
    super.key,
    required this.reviews,
    required this.onChange,
    this.onApprove,
    this.receive = receiveResultCsv,
    this.readCodeOnOpen=false,
    this.scanResultCode,
  });
  final List<Map<String, dynamic>> reviews;
  final Future<void> Function(List<Map<String, dynamic>>) onChange;
  final Future<void> Function(Map<String, dynamic>)? onApprove;
  final Future<String> Function(String) receive;
  final bool readCodeOnOpen;
  final Future<String?> Function(BuildContext)? scanResultCode;
  @override
  State<ReceiptReviewPage> createState() => ReceiptReviewPageState();
}

class ReceiptReviewPageState extends State<ReceiptReviewPage> {
  bool receiving = false;
  late List<Map<String, dynamic>> reviewRows;
  @override
  void initState() {
    super.initState();
    reviewRows = widget.reviews;
    if(widget.readCodeOnOpen) WidgetsBinding.instance.addPostFrameCallback((_){if(mounted)_scanResultCode();});
  }

  @override
  void didUpdateWidget(covariant ReceiptReviewPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.reviews, widget.reviews))
      reviewRows = widget.reviews;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('解析結果の確認')),
    body: ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const Text('PCの④「結果をスマホへ渡すコードを表示」で出たコードを読み取ります。接続登録用のコードとは別です。受信後に店舗名・日付・金額・科目を修正できます。'),
        FilledButton.icon(onPressed:receiving?null:_scanResultCode,icon:const Icon(Icons.qr_code_scanner),label:const Text('④ PCの結果コードを読む')),
        const SizedBox(height:12),
        FilledButton.icon(
          onPressed: receiving ? null : _receiveFromPc,
          icon: const Icon(Icons.qr_code_scanner),
          label: Text(receiving ? 'PCから受信中…' : 'URLを貼り付けて受け取る'),
        ),
        const SizedBox(height: 14),
        FilledButton.icon(
          onPressed: receiving ? null : _importCsv,
          icon: const Icon(Icons.file_open_outlined),
          label: const Text('解析結果CSVを読み込む'),
        ),
        const SizedBox(height: 12),
        if (reviewRows.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(28),
              child: Text('確認待ちの解析結果はありません'),
            ),
          )
        else
          ...reviewRows.map(
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

  Future<void> _acceptCsv(String text) async {
    if (text.length > 2 * 1024 * 1024)
      throw const FormatException('CSVは2MB以内にしてください');
    final rows = _parseCsv(text);
    if (rows.length < 2) throw const FormatException('明細入りのOISO解析CSVを選んでください');
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
    final existing = reviewRows
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
            'transaction_type': m['transactionType'] ??
                (m['category'] == '売上高'
                    ? 'income'
                    : (m['category'] == '仕入高' ? 'purchase' : 'expense')),
            'payment_method': m['paymentMethod'] ?? 'cash',
            'confidence': '${m['confidence'] ?? ''}',
            'confirmed': false,
          };
        })
        .whereType<Map<String, dynamic>>()
        .toList();
    if (reviewRows.length + data.length > 5000)
      throw const FormatException('保存件数の上限は5000件です');
    if (!await _saveReviewChanges([...reviewRows, ...data])) return;
    for (final row in data) {
      await LedgerStore.instance.setReceiptStatus('${row['receiptId']}', 'needs_review');
    }
    if (mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${data.length}件を追加しました。重複する明細は修正内容を保護しました。')),
      );
  }

  Future<bool> _saveReviewChanges(List<Map<String, dynamic>> list) async {
    try {
      await widget.onChange(list);
      if (mounted) setState(() => reviewRows = list);
      return true;
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('保存できませんでした: $e')));
      return false;
    }
  }

  Future<void> _scanResultCode() async {
    if(receiving)return;
    setState(()=>receiving=true);
    try {
      final code=widget.scanResultCode!=null
        ? await widget.scanResultCode!(context)
        : await Navigator.push<String>(context,MaterialPageRoute(builder:(_)=>const _QrPage(title:'④ PCの結果コードを読む')));
      if(code==null||!mounted)return;
      await _receiveResult(code);
    } catch(e) {
      if(mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e is FormatException?e.message:'コードを読み取れませんでした。カメラの利用許可を確認してください。')));
    } finally {if(mounted)setState(()=>receiving=false);}
  }

  Future<void> _receiveFromPc() async {
    final controller = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('PCの解析結果を受け取る'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('PCで「スマホで修正するQRを作成」を押し、そのQRを読み取ってください。URLの貼り付けも使えます。'),
              TextField(
                controller: controller,
                decoration: const InputDecoration(labelText: '結果受信用URL'),
                keyboardType: TextInputType.url,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('戻る'),
          ),
          TextButton(
            onPressed: () async {
              final scanned = await Navigator.push<String>(
                ctx,
                MaterialPageRoute(
                  builder: (_) => const _QrPage(title: 'PCの結果受信用QRを読む'),
                ),
              );
              if (scanned != null && ctx.mounted) Navigator.pop(ctx, scanned);
            },
            child: const Text('QRを読む'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('受信'),
          ),
        ],
      ),
    );
    if (value == null || !mounted) return;
    await _receiveResult(value);
  }

  Future<void> _receiveResult(String value) async {
    setState(() => receiving = true);
    try {
      resultShareUri(value);
      final csv = await widget.receive(value);
      if (mounted) await _acceptCsv(csv);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is FormatException?e.message:'受信できませんでした。同じWi-FiとPCの起動状態を確認してください。')),
        );
    } finally {
      if (mounted) setState(() => receiving = false);
    }
  }

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
      await _acceptCsv(text);
      if (mounted) setState(() {});
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('CSVを読み込めません: $e')));
    }
  }

  Future<void> _confirm(Map<String, dynamic> record) async {
    final issues = _reviewIssues(record);
    if (issues.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('確認前に修正してください: ${issues.join('・')}')),
      );
      return;
    }
    final list = [...reviewRows];
    final index = list.indexOf(record);
    if (index < 0) return;
    list[index] = {...record, 'confirmed': true};
    if (widget.onApprove != null) {
      await widget.onApprove!(list[index]);
    }
    await _saveReviewChanges(list);
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
        content: SingleChildScrollView(
          child: Column(
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
      final list = [...reviewRows];
      final i = list.indexOf(r);
      list[i] = {
        ...r,
        'date': date.text,
        'vendor': vendor.text,
        'amount': amount.text.trim(),
        'category': category.text,
        'confirmed': false,
      };
      await _saveReviewChanges(list);
    }
  }

  Future<void> _exportCsv() async {
    final confirmed = reviewRows.where(
      (r) => r['confirmed'] == true && _reviewIssues(r).isEmpty,
    );
    final lines = [
      'receiptId,date,vendor,amount,category,transactionType,paymentMethod,confidence',
      ...confirmed.map(
        (r) => [
          r['receiptId'] ?? r['id'],
          r['date'],
          r['vendor'],
          r['amount'],
          r['category'],
          r['transaction_type'] ?? 'expense',
          r['payment_method'] ?? 'cash',
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

class _QrPage extends StatefulWidget {
  const _QrPage({this.title = 'Relay QRを読み取る'});
  final String title;
  @override
  State<_QrPage> createState() => _QrPageState();
}

class _QrPageState extends State<_QrPage> {
  bool returned = false;
  final scanner=MobileScannerController();
  @override void dispose(){scanner.dispose();super.dispose();}
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title)),
    body: MobileScanner(
      controller:scanner,
      errorBuilder:(_,_)=>const Center(child:Padding(padding:EdgeInsets.all(24),child:Text('カメラを使用できません。端末設定でOISOのカメラ利用を許可してください。'))),
      onDetect: (capture) {
        final raw = capture.barcodes.firstOrNull?.rawValue;
        if (raw != null && context.mounted && !returned) {
          returned = true;
          Navigator.pop(context, raw);
        }
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
      padding: const EdgeInsets.all(16),
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
      borderRadius: BorderRadius.zero,
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

Future<Map<String, dynamic>?> _editRecord(BuildContext context, Map<String, dynamic> record) async {
  final vendor = TextEditingController(text: '${record['vendor_name'] ?? ''}');
  final amount = TextEditingController(text: '${record['amount'] ?? 0}');
  final category = TextEditingController(text: '${record['category'] ?? ''}');
  var type = '${record['transaction_type'] ?? 'expense'}';
  var payment = '${record['payment_method'] ?? 'cash'}';
  var date = DateTime.tryParse('${record['timestamp'] ?? ''}') ?? DateTime.now();
  final saved = await showDialog<bool>(
    context: context,
    builder: (ctx) => StatefulBuilder(builder: (ctx, refresh) => AlertDialog(
      title: const Text('取引を編集'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButtonFormField<String>(value: type, decoration: const InputDecoration(labelText: '取引種別'), items: const [
          DropdownMenuItem(value: 'income', child: Text('売上')),
          DropdownMenuItem(value: 'purchase', child: Text('仕入')),
          DropdownMenuItem(value: 'expense', child: Text('経費')),
        ], onChanged: (v) => refresh(() => type = v ?? 'expense')),
        TextField(controller: vendor, decoration: const InputDecoration(labelText: '取引先・内容')),
        TextField(controller: amount, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '金額（円・税込、返金はマイナス）')),
        TextField(controller: category, decoration: const InputDecoration(labelText: '科目')),
        DropdownButtonFormField<String>(value: payment, decoration: const InputDecoration(labelText: '決済方法'), items: const [
          DropdownMenuItem(value: 'cash', child: Text('現金・即時決済')),
          DropdownMenuItem(value: 'credit', child: Text('掛・後払い')),
        ], onChanged: (v) => refresh(() => payment = v ?? 'cash')),
        ListTile(title: const Text('取引日'), subtitle: Text('${date.year}-${date.month}-${date.day}'), trailing: const Icon(Icons.calendar_month), onTap: () async {
          final selected = await showDatePicker(context: ctx, initialDate: date, firstDate: DateTime(2000), lastDate: DateTime(2100));
          if (selected != null) refresh(() => date = selected);
        }),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('キャンセル')),
        FilledButton(onPressed: () {
          if (vendor.text.trim().isEmpty || (int.tryParse(amount.text.replaceAll(',', '').trim()) ?? 0) == 0) {
            ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('取引先と金額を入力してください。返品・返金はマイナスで入力します')));
            return;
          }
          Navigator.pop(ctx, true);
        }, child: const Text('保存')),
      ],
    )),
  );
  final editedVendor = vendor.text;
  final editedAmount = int.tryParse(amount.text.replaceAll(',', '').trim()) ?? 0;
  final editedCategory = category.text;
  vendor.dispose(); amount.dispose(); category.dispose();
  if (saved != true) return null;
  return {
    ...record,
    'vendor_name': editedVendor,
    'raw_text': editedVendor,
    'amount': editedAmount,
    'category': editedCategory,
    'transaction_type': type,
    'payment_method': payment,
    'timestamp': DateTime(date.year, date.month, date.day).toIso8601String(),
  };
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

String _transactionLabel(Map<String, dynamic> row) => switch ('${row['transaction_type'] ?? 'expense'}') {
  'income' => '売上',
  'purchase' => '仕入',
  _ => '経費',
};
String _receiptStatusLabel(String value) => switch (value) {
  'processing' => '解析中',
  'needs_review' => '確認待ち',
  'registered' => '登録済み',
  'failed' => '要再処理',
  _ => '未解析',
};
String _money(int value) => value.toString().replaceAllMapped(
  RegExp(r'(?<=\d)(?=(\d{3})+$)'),
  (_) => ',',
);
bool _confirmed(Map<String, dynamic> record) =>
    record['status'] == 'confirmed' ||
    record['status'] == 'verified' ||
    record['status'] == '確定済み';
