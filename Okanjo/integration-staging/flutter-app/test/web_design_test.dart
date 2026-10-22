import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:instant_ledger/main.dart';
import 'package:instant_ledger/data_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;
  setUpAll(() async {
    directory = await Directory.systemTemp.createTemp('oaiso-design-test-');
    SharedPreferences.setMockInitialValues({});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(const MethodChannel('plugins.flutter.io/path_provider'),
          (_) async => directory.path);
    await LedgerStore.instance.init();
    await LedgerStore.instance.saveRecords([
      {'id':'design-1','timestamp':DateTime.now().toIso8601String(),
       'vendor_name':'テスト店舗','amount':1250,'category':'消耗品費','status':'pending'},
      {'id':'design-2','timestamp':DateTime.now().toIso8601String(),
       'vendor_name':'確定済み店舗','amount':750,'category':'交通費','status':'confirmed'},
    ]);
  });
  tearDownAll(() async => directory.delete(recursive:true));

  for (final width in [320.0, 390.0]) {
    for (final theme in ['light','dark','brown','ocean','forest']) {
      testWidgets('$theme at $width: dashboard, capture, history and settings fit', (tester) async {
        tester.view.physicalSize=Size(width,844);
        tester.view.devicePixelRatio=1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await LedgerStore.instance.saveTheme(theme);
        await tester.pumpWidget(const OisoApp());
        await tester.runAsync(() async { await Future<void>.delayed(const Duration(milliseconds:100)); });
        await tester.pumpAndSettle();
        expect(find.text('ダッシュボード'),findsOneWidget);
        expect(find.text('¥2,000'),findsOneWidget);
        expect(find.text('¥1,250'),findsWidgets);
        expect(find.text('¥750'),findsOneWidget);
        expect(tester.takeException(),isNull);
        await tester.tap(find.text('レシート保管'));
        await tester.pumpAndSettle();
        expect(find.text('写真を追加する'),findsOneWidget);
        expect(tester.takeException(),isNull);
        await tester.tap(find.text('履歴一覧'));
        await tester.pumpAndSettle();
        expect(find.text('端末バックアップ'),findsOneWidget);
        expect(tester.takeException(),isNull);
        await tester.tap(find.byTooltip('テーマを選択'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('詳細設定'));
        await tester.pumpAndSettle();
        expect(find.text('THEME CUSTOMIZATION'),findsOneWidget);
        expect(find.text('見た目を保存'),findsOneWidget);
        expect(tester.takeException(),isNull);
      });
    }
  }
}
