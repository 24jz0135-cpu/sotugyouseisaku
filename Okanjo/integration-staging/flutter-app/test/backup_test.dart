import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:instant_ledger/data_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;
  final store = LedgerStore.instance;
  setUpAll(() async {
    directory = await Directory.systemTemp.createTemp('oiso-backup-test-');
    SharedPreferences.setMockInitialValues({});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/path_provider'),
          (_) async => directory.path,
        );
    await store.init();
  });
  tearDownAll(() async => directory.delete(recursive: true));

  test(
    'backup restores photos, records, reviews and theme presets on another device',
    () async {
      final source = File('${directory.path}/sample.png');
      await source.writeAsBytes([1, 2, 3]);
      final photo = await store.savePhoto(source);
      final themePhoto = await store.saveThemePhoto(
        Uint8List.fromList([4, 5, 6]),
      );
      await store.saveRecords([
        {'id': 'r1', 'image_path': photo, 'amount': 1250},
      ]);
      await store.saveReviews([
        {'receiptId': 'r1', 'confirmed': true},
      ]);
      await store.saveSettings({'backgroundPhoto': themePhoto});
      await store.savePresets([
        {
          'name': '保存済み',
          'settings': {'backgroundPhoto': themePhoto},
        },
      ]);
      final backup = await store.exportBackup();
      // Simulate paths saved on a different device, then restore missing files.
      final foreign = backup.replaceAll(
        jsonEncode(
          directory.path,
        ).substring(1, jsonEncode(directory.path).length - 1),
        '/old-device',
      );
      await File(photo).delete();
      await File(themePhoto).delete();
      await store.saveRecords([]);
      await store.savePresets([]);
      await store.importBackup(foreign);
      expect(store.records().single['image_path'], photo);
      expect(store.records().single['amount'], 1250);
      expect(await File(photo).readAsBytes(), [1, 2, 3]);
      expect(store.reviews().single['confirmed'], true);
      expect(store.settings()['backgroundPhoto'], themePhoto);
      expect(store.presets().single['settings']['backgroundPhoto'], themePhoto);
    },
  );

  test(
    'malformed image or review leaves saved records and settings intact',
    () async {
      await store.saveRecords([
        {'id': 'keep', 'amount': 900},
      ]);
      await store.saveSettings({'backgroundPhoto': 'keep'});
      for (final extra in [
        {
          'receiptImages': [
            {'name': 'bad.png', 'bytes': '%%%'},
          ],
        },
        {
          'reviews': [42],
        },
      ]) {
        await expectLater(
          store.importBackup(
            jsonEncode({
              'format': 'oaiso',
              'records': [
                {'id': 'replacement'},
              ],
              ...extra,
            }),
          ),
          throwsA(anything),
        );
        expect(store.records().single['id'], 'keep');
        expect(store.settings()['backgroundPhoto'], 'keep');
      }
    },
  );
}
