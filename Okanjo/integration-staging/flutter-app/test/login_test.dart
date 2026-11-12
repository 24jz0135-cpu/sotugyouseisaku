import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:instant_ledger/login_page.dart';

void main() {
  testWidgets(
    'validates fields, toggles password and never fakes authentication',
    (tester) async {
      var entered = 0;
      await tester.pumpWidget(
        MaterialApp(home: LoginPage(onContinueLocally: () => entered++)),
      );
      await tester.ensureVisible(find.byKey(const Key('login-submit')));
      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pumpAndSettle();
      expect(find.text('メールアドレスを入力してください'), findsOneWidget);
      expect(find.text('パスワードを入力してください'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('login-email')), 'invalid');
      await tester.enterText(
        find.byKey(const Key('login-password')),
        'test-secret',
      );
      await tester.tap(find.byTooltip('パスワードを表示'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextField>(
              find.descendant(
                of: find.byKey(const Key('login-password')),
                matching: find.byType(TextField),
              ),
            )
            .obscureText,
        false,
      );
      await tester.ensureVisible(find.byKey(const Key('login-submit')));
      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pumpAndSettle();
      expect(find.text('メールアドレスの形式を確認してください'), findsOneWidget);
      await tester.enterText(
        find.byKey(const Key('login-email')),
        'tester@example.com',
      );
      await tester.ensureVisible(find.byKey(const Key('login-submit')));
      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pumpAndSettle();
      expect(entered, 0);
      expect(find.textContaining('アカウントへのログインは準備中'), findsOneWidget);
      expect(
        tester
            .widget<TextField>(
              find.descendant(
                of: find.byKey(const Key('login-password')),
                matching: find.byType(TextField),
              ),
            )
            .controller!
            .text,
        isEmpty,
      );
      await tester.ensureVisible(find.byKey(const Key('login-local')));
      await tester.tap(find.byKey(const Key('login-local')));
      expect(entered, 1);
    },
  );

  for (final brightness in Brightness.values) {
    for (final scale in [1.0, 1.5]) {
      testWidgets('login fits 320px with $brightness and text scale $scale', (
        tester,
      ) async {
        tester.view.physicalSize = const Size(320, 700);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData(brightness: brightness),
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(scale)),
              child: LoginPage(onContinueLocally: () {}),
            ),
          ),
        );
        await tester.ensureVisible(find.byKey(const Key('login-local')));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    }
  }

  testWidgets('optional login screen preview', (tester) async {
    final output = Platform.environment['OISO_LOGIN_PREVIEW'];
    if (output == null) return;
    await tester.runAsync(() async {
      final font = FontLoader('PreviewJapanese')
        ..addFont(
          File(
            'C:/Windows/Fonts/meiryo.ttc',
          ).readAsBytes().then((b) => ByteData.sublistView(b)),
        );
      await font.load();
      await (FontLoader('Outfit')
            ..addFont(rootBundle.load('assets/fonts/Outfit.ttf')))
          .load();
      await (FontLoader('MaterialIcons')
            ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf')))
          .load();
    });
    tester.view.physicalSize = const Size(390, 1040);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final boundary = GlobalKey();
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(
          fontFamily: 'PreviewJapanese',
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff493b35)),
          scaffoldBackgroundColor: Colors.white,
        ),
        home: RepaintBoundary(
          key: boundary,
          child: LoginPage(onContinueLocally: () {}),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      final image =
          await (boundary.currentContext!.findRenderObject()
                  as RenderRepaintBoundary)
              .toImage();
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await File(output).writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
  });
}
