import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:instant_ledger/result_transfer.dart';
import 'package:instant_ledger/main.dart';

const link = 'http://192.168.1.2:8789/s/abcdefghijklmnopqrstuvwxyz123456/';
const csv =
    'receiptId,date,vendor,amount,category,confidence\nR-1,2026-11-10,誤読店舗,1250,消耗品費,0.8';

void main() {
  test(
    'accepts only local result links and retrieves bounded result CSV',
    () async {
      for (final bad in [
        'https://example.com/',
        'http://127.0.0.1:8788/api/inbox',
        link + '?x=1',
        link.replaceFirst('192.168.1.2', '8.8.8.8'),
        link.replaceFirst('192.168.1.2', '192.168.1.999'),
      ]) {
        expect(() => resultShareUri(bad), throwsFormatException);
      }
      final received = await receiveResultCsv(
        link,
        client: MockClient((req) async {
          expect(req.url.path.endsWith('/data'), isTrue);
          expect(req.followRedirects, isFalse);
          return http.Response(
            jsonEncode({'format': 'oiso-result', 'csv': csv}),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
      );
      expect(received, csv);
      for (final response in [
        http.Response('', 404),
        http.Response('{}', 200),
        http.Response('x' * (3 * 1024 * 1024 + 1), 200),
      ]) {
        await expectLater(
          receiveResultCsv(link, client: MockClient((_) async => response)),
          throwsFormatException,
        );
      }
    },
  );

  testWidgets(
    'receive, correct, confirm and re-receive preserve manual edits',
    (tester) async {
      var rows = <Map<String, dynamic>>[];
      await tester.pumpWidget(
        MaterialApp(
          home: StatefulBuilder(
            builder: (context, setState) => ReceiptReviewPage(
              reviews: rows,
              receive: (_) async => csv,
              onChange: (next) async {
                setState(() => rows = next);
              },
            ),
          ),
        ),
      );
      Future<void> receive() async {
        await tester.tap(find.text('PCの結果をQRで受け取る'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField), link);
        await tester.tap(find.text('受信'));
        await tester.pumpAndSettle();
      }

      await receive();
      expect(rows.single['confirmed'], false);
      await tester.tap(find.byIcon(Icons.edit_outlined));
      await tester.pumpAndSettle();
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(1), '修正した店舗');
      await tester.enterText(fields.at(2), '');
      await tester.tap(find.text('保存'));
      await tester.pumpAndSettle();
      expect(rows.single['amount'], '');
      await tester.tap(find.byIcon(Icons.check_circle_outline));
      await tester.pumpAndSettle();
      expect(rows.single['confirmed'], false);
      await tester.tap(find.byIcon(Icons.edit_outlined));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).at(2), '1500');
      await tester.tap(find.text('保存'));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.check_circle_outline));
      await tester.pumpAndSettle();
      expect(rows.single['confirmed'], true);
      await receive();
      expect(rows.length, 1);
      expect(rows.single['vendor'], '修正した店舗');
      expect(rows.single['amount'], '1500');
      expect(rows.single['confirmed'], true);
      expect(tester.takeException(), isNull);
    },
  );
}
