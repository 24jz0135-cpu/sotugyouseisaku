import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite/sqflite.dart';

class LedgerStore {
  LedgerStore._();
  static final LedgerStore instance = LedgerStore._();
  static const _recordsKey = 'instant_ledger_local_db';
  static const _reviewsKey = 'instant-ledger-reviews';
  static const _themeKey = 'instant-ledger-theme';
  static const _settingsKey = 'instant-ledger-flutter-settings';
  static const _presetsKey = 'instant-ledger-flutter-presets';

  late SharedPreferences _prefs;
  late Directory _root;
  late Directory _receipts;
  late Directory _themePhotos;
  late Database _db;
  List<Map<String, dynamic>> _recordCache = [];
  bool _ready = false;

  Future<void> init() async {
    if (_ready) return;
    _prefs = await SharedPreferences.getInstance();
    final docs = await getApplicationDocumentsDirectory();
    _root = Directory(p.join(docs.path, 'OISO'));
    _receipts = Directory(p.join(_root.path, 'receipts'));
    _themePhotos = Directory(p.join(_root.path, 'theme-photos'));
    await _receipts.create(recursive: true);
    await _themePhotos.create(recursive: true);
    _db = await openDatabase(
      p.join(_root.path, 'oaiso.sqlite'),
      version: 2,
      onCreate: (db, version) async {
        await db.execute('''CREATE TABLE records (
          id TEXT PRIMARY KEY,
          occurred_at TEXT NOT NULL,
          transaction_type TEXT NOT NULL DEFAULT 'expense',
          payment_method TEXT NOT NULL DEFAULT 'cash',
          amount INTEGER NOT NULL DEFAULT 0,
          category TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending',
          receipt_path TEXT,
          payload TEXT NOT NULL
        )''');
        await db.execute('''CREATE TABLE receipts (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'unprocessed',
          added_at TEXT NOT NULL,
          linked_record_id TEXT,
          last_error TEXT
        )''');
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await db.execute('''CREATE TABLE IF NOT EXISTS receipts (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'unprocessed',
            added_at TEXT NOT NULL,
            linked_record_id TEXT,
            last_error TEXT
          )''');
        }
      },
    );
    final existing = await _db.query('records', limit: 1);
    if (existing.isEmpty) {
      final legacy = _decodeList(_prefs.getString(_recordsKey));
      if (legacy.isNotEmpty) await _writeRecords(legacy);
    }
    _recordCache = (await _db.query('records', orderBy: 'occurred_at DESC'))
        .map((row) => Map<String, dynamic>.from(jsonDecode(row['payload'] as String)))
        .toList();
    for (final file in _receipts.listSync().whereType<File>()) {
      final rows = await _db.query('receipts', where: 'path = ?', whereArgs: [file.path]);
      if (rows.isEmpty) {
        await _db.insert('receipts', {
          'id': p.basenameWithoutExtension(file.path),
          'path': file.path,
          'status': 'unprocessed',
          'added_at': file.statSync().modified.toIso8601String(),
        });
      }
    }
    _ready = true;
  }

  List<Map<String, dynamic>> records() =>
      _recordCache.map((e) => Map<String, dynamic>.from(e)).toList();
  List<Map<String, dynamic>> reviews() =>
      _decodeList(_prefs.getString(_reviewsKey));
  Map<String, dynamic> settings() => _decodeMap(_prefs.getString(_settingsKey));
  List<Map<String, dynamic>> presets() =>
      _decodeList(_prefs.getString(_presetsKey));
  String get theme => _prefs.getString(_themeKey) ?? 'light';

  Future<void> saveRecords(List<Map<String, dynamic>> value) async {
    await init();
    await _writeRecords(value);
    _recordCache = value.map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future<void> _writeRecords(List<Map<String, dynamic>> value) async {
    await _db.transaction((txn) async {
      await txn.delete('records');
      final batch = txn.batch();
      for (final record in value) {
        final id = '${record['id'] ?? DateTime.now().microsecondsSinceEpoch}';
        final timestamp = '${record['timestamp'] ?? DateTime.now().toIso8601String()}';
        final normalized = Map<String, dynamic>.from(record)
          ..['id'] = id
          ..['timestamp'] = timestamp
          ..putIfAbsent('transaction_type', () => 'expense')
          ..putIfAbsent('payment_method', () => 'cash');
        batch.insert('records', {
          'id': id,
          'occurred_at': timestamp,
          'transaction_type': normalized['transaction_type'],
          'payment_method': normalized['payment_method'],
          'amount': _asInt(normalized['amount']),
          'category': '${normalized['category'] ?? ''}',
          'status': '${normalized['status'] ?? 'pending'}',
          'receipt_path': normalized['image_path'],
          'payload': jsonEncode(normalized),
        });
      }
      await batch.commit(noResult: true);
    });
  }

  Future<List<Map<String, dynamic>>> receipts() async {
    await init();
    return (await _db.query('receipts', orderBy: 'added_at DESC'))
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<void> setReceiptStatus(String id, String status, {String? error}) async {
    await init();
    await _db.update('receipts', {'status': status, 'last_error': error}, where: 'id = ?', whereArgs: [id]);
  }

  Future<void> linkReceipt(String id, String recordId) async {
    await init();
    await _db.update('receipts', {'status': 'registered', 'linked_record_id': recordId, 'last_error': null}, where: 'id = ?', whereArgs: [id]);
  }
  Future<void> saveReviews(List<Map<String, dynamic>> value) async {
    if (!await _prefs.setString(_reviewsKey, jsonEncode(value))) {
      throw const FileSystemException('解析結果を端末に保存できませんでした');
    }
  }

  Future<void> saveSettings(Map<String, dynamic> value) async =>
      _prefs.setString(_settingsKey, jsonEncode(value));
  Future<void> savePresets(List<Map<String, dynamic>> value) async =>
      _prefs.setString(_presetsKey, jsonEncode(value));
  Future<void> saveTheme(String value) async =>
      _prefs.setString(_themeKey, value);

  Future<String> savePhoto(File source) async {
    await init();
    final bytes = await source.readAsBytes();
    final id = sha256.convert(bytes).toString();
    final ext = p.extension(source.path).isEmpty
        ? '.jpg'
        : p.extension(source.path);
    final target = File(p.join(_receipts.path, '$id$ext'));
    if (!await target.exists()) await target.writeAsBytes(bytes, flush: true);
    await _db.insert('receipts', {
      'id': id,
      'path': target.path,
      'status': 'unprocessed',
      'added_at': DateTime.now().toIso8601String(),
    }, conflictAlgorithm: ConflictAlgorithm.ignore);
    return target.path;
  }

  Future<String> saveThemePhoto(Uint8List bytes) async {
    await init();
    final file = File(
      p.join(
        _themePhotos.path,
        'theme_${DateTime.now().microsecondsSinceEpoch}.jpg',
      ),
    );
    await file.writeAsBytes(bytes, flush: true);
    return file.path;
  }

  Future<List<File>> themePhotos() async {
    await init();
    final files = _themePhotos.listSync().whereType<File>().toList();
    files.sort(
      (a, b) => b.statSync().modified.compareTo(a.statSync().modified),
    );
    return files;
  }

  Future<void> deletePhoto(String path) async {
    if (path.startsWith(_receipts.path)) {
      await _db.delete('receipts', where: 'path = ?', whereArgs: [path]);
    }
    if (path.startsWith(_receipts.path) && await File(path).exists())
      await File(path).delete();
  }

  Future<List<File>> photos() async {
    await init();
    final files = _receipts.listSync().whereType<File>().toList();
    files.sort(
      (a, b) => b.statSync().modified.compareTo(a.statSync().modified),
    );
    return files;
  }

  Future<String> exportBackup() async {
    await init();
    final images = <Map<String, dynamic>>[];
    for (final file in await photos()) {
      images.add({
        'name': p.basename(file.path),
        'sourcePath': file.path,
        'bytes': base64Encode(await file.readAsBytes()),
      });
    }
    final themeImages = <Map<String, dynamic>>[];
    for (final file in await themePhotos()) {
      themeImages.add({
        'name': p.basename(file.path),
        'sourcePath': file.path,
        'bytes': base64Encode(await file.readAsBytes()),
      });
    }
    return jsonEncode({
      'format': 'oaiso',
      'version': 2,
      'schemaVersion': 2,
      'records': records(),
      'receiptStates': await receipts(),
      'reviews': reviews(),
      'theme': theme,
      'settings': settings(),
      'presets': presets(),
      'receiptImages': images,
      'themeImages': themeImages,
    });
  }

  Future<void> importBackup(String source) async {
    await init();
    final data = jsonDecode(source) as Map<String, dynamic>;
    final format = data['format'];
    if (format != 'oaiso' && format != 'oaiso-backup')
      throw const FormatException('OISOバックアップではありません');
    final restoredRecords = List<Map<String, dynamic>>.from(
      (data['records'] as List? ?? []).map((e) => Map<String, dynamic>.from(e)),
    );
    // Validate the whole backup before changing saved records or images.
    for (final key in ['reviews', 'presets']) {
      for (final value in (data[key] as List? ?? [])) {
        Map<String, dynamic>.from(value);
      }
    }
    if (data['settings'] != null) {
      final settings = Map<String, dynamic>.from(data['settings']);
      if (settings['widgetPhotos'] != null) {
        Map<String, dynamic>.from(settings['widgetPhotos']);
      }
    }
    for (final value in [
      ...(data['receiptImages'] as List? ?? data['receipts'] as List? ?? []),
      ...(data['themeImages'] as List? ?? []),
    ]) {
      final image = Map<String, dynamic>.from(value);
      final encoded =
          image['bytes'] as String? ??
          _dataUrlPayload(image['dataUrl'] as String?);
      if (encoded == null) throw const FormatException('画像データがありません');
      base64Decode(encoded);
      if (image['name'] != null) image['name'] as String;
    }
    final restoredReviews = List<Map<String, dynamic>>.from(
      (data['reviews'] as List? ?? []).map((e) => Map<String, dynamic>.from(e)),
    );
    final restoredSettings = data['settings'] is Map
        ? Map<String, dynamic>.from(data['settings'])
        : <String, dynamic>{};
    final themePaths = <String, String>{};
    final images =
        (data['receiptImages'] as List?) ?? (data['receipts'] as List? ?? []);
    for (final imageValue in images) {
      final image = Map<String, dynamic>.from(imageValue);
      final encoded =
          image['bytes'] as String? ??
          _dataUrlPayload(image['dataUrl'] as String?);
      if (encoded == null) continue;
      final name =
          image['name'] as String? ??
          '${image['id'] ?? DateTime.now().microsecondsSinceEpoch}.jpg';
      final file = File(p.join(_receipts.path, p.basename(name)));
      if (!await file.exists()) await file.writeAsBytes(base64Decode(encoded));
      await _db.insert('receipts', {
        'id': '${image['id'] ?? p.basenameWithoutExtension(name)}',
        'path': file.path,
        'status': 'unprocessed',
        'added_at': DateTime.now().toIso8601String(),
      }, conflictAlgorithm: ConflictAlgorithm.ignore);
      for (final record in restoredRecords) {
        final oldPath = record['image_path'];
        if (oldPath is String &&
            (oldPath == image['sourcePath'] ||
                p.basename(oldPath) == p.basename(name))) {
          record['image_path'] = file.path;
        }
      }
      final receiptId = image['id'];
      if (receiptId != null) {
        for (final record in restoredRecords) {
          if (record['receipt_id'] == receiptId ||
              record['receiptId'] == receiptId)
            record['image_path'] = file.path;
        }
      }
    }
    for (final stateValue in (data['receiptStates'] as List? ?? [])) {
      final state = Map<String, dynamic>.from(stateValue);
      final oldPath = state['path'] ?? state['sourcePath'];
      final name = p.basename('${oldPath ?? state['id'] ?? ''}');
      final file = File(p.join(_receipts.path, name));
      if (!await file.exists()) continue;
      await _db.insert('receipts', {
        'id': '${state['id'] ?? p.basenameWithoutExtension(name)}',
        'path': file.path,
        'status': '${state['status'] ?? 'unprocessed'}',
        'added_at': '${state['added_at'] ?? DateTime.now().toIso8601String()}',
        'linked_record_id': state['linked_record_id'],
        'last_error': state['last_error'],
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }
    for (final imageValue in (data['themeImages'] as List? ?? [])) {
      final image = Map<String, dynamic>.from(imageValue);
      final encoded = image['bytes'] as String?;
      if (encoded == null) continue;
      final name = p.basename(
        image['name'] as String? ??
            'theme_${DateTime.now().microsecondsSinceEpoch}.jpg',
      );
      final file = File(p.join(_themePhotos.path, name));
      if (!await file.exists()) await file.writeAsBytes(base64Decode(encoded));
      final oldPath = image['sourcePath'];
      if (oldPath is String) {
        themePaths[oldPath] = file.path;
        if (restoredSettings['backgroundPhoto'] == oldPath)
          restoredSettings['backgroundPhoto'] = file.path;
        final widgetPhotos = Map<String, dynamic>.from(
          restoredSettings['widgetPhotos'] ?? {},
        );
        for (final key in widgetPhotos.keys.toList()) {
          if (widgetPhotos[key] == oldPath) widgetPhotos[key] = file.path;
        }
        restoredSettings['widgetPhotos'] = widgetPhotos;
      }
    }
    await saveSettings(restoredSettings);
    await saveReviews(restoredReviews);
    if (data['theme'] is String) await saveTheme(data['theme']);
    dynamic remap(dynamic value) {
      if (value is String) return themePaths[value] ?? value;
      if (value is List) return value.map(remap).toList();
      if (value is Map) {
        return value.map((key, item) => MapEntry(key, remap(item)));
      }
      return value;
    }

    if (data['presets'] != null) {
      await savePresets(
        List<Map<String, dynamic>>.from(
          (data['presets'] as List).map(
            (e) => Map<String, dynamic>.from(remap(e)),
          ),
        ),
      );
    }
    await saveRecords(restoredRecords);
  }

  String? _dataUrlPayload(String? value) => value != null && value.contains(',')
      ? value.substring(value.indexOf(',') + 1)
      : null;

  static List<Map<String, dynamic>> _decodeList(String? value) {
    if (value == null) return [];
    try {
      return List<Map<String, dynamic>>.from(
        (jsonDecode(value) as List).map((e) => Map<String, dynamic>.from(e)),
      );
    } catch (_) {
      return [];
    }
  }

  static Map<String, dynamic> _decodeMap(String? value) {
    if (value == null) return {};
    try {
      return Map<String, dynamic>.from(jsonDecode(value));
    } catch (_) {
      return {};
    }
  }
}

int _asInt(dynamic value) => value is num ? value.round() : int.tryParse('$value') ?? 0;
