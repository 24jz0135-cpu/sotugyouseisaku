import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
    _ready = true;
  }

  List<Map<String, dynamic>> records() =>
      _decodeList(_prefs.getString(_recordsKey));
  List<Map<String, dynamic>> reviews() =>
      _decodeList(_prefs.getString(_reviewsKey));
  Map<String, dynamic> settings() => _decodeMap(_prefs.getString(_settingsKey));
  List<Map<String, dynamic>> presets() =>
      _decodeList(_prefs.getString(_presetsKey));
  String get theme => _prefs.getString(_themeKey) ?? 'light';

  Future<void> saveRecords(List<Map<String, dynamic>> value) async =>
      _prefs.setString(_recordsKey, jsonEncode(value));
  Future<void> saveReviews(List<Map<String, dynamic>> value) async =>
      _prefs.setString(_reviewsKey, jsonEncode(value));
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
      'version': 1,
      'records': records(),
      'reviews': reviews(),
      'theme': theme,
      'settings': settings(),
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
    await saveRecords(restoredRecords);
    await saveReviews(
      List<Map<String, dynamic>>.from(
        (data['reviews'] as List? ?? []).map(
          (e) => Map<String, dynamic>.from(e),
        ),
      ),
    );
    if (data['theme'] is String) await saveTheme(data['theme']);
    final restoredSettings = data['settings'] is Map
        ? Map<String, dynamic>.from(data['settings'])
        : <String, dynamic>{};
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
      final receiptId = image['id'];
      if (receiptId != null) {
        for (final record in restoredRecords) {
          if (record['receipt_id'] == receiptId ||
              record['receiptId'] == receiptId)
            record['image_path'] = file.path;
        }
      }
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
    if (restoredSettings.isNotEmpty) await saveSettings(restoredSettings);
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
