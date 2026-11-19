import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:instant_ledger/lan_connection.dart';

void main() {
  test(
    'Dart client pins PC certificate, authenticates and rejects an impostor',
    () async {
      final dir = await Directory.systemTemp.createTemp('oaiso-lan-client-');
      final process = await Process.start('node', [
        '../../デスクトップ/OISO/oiso2/bridge/lan-helper/fixture-server.mjs',
        dir.path,
      ]);
      process.stderr.drain<void>();
      try {
        final line = await process.stdout
            .transform(utf8.decoder)
            .transform(const LineSplitter())
            .first
            .timeout(const Duration(seconds: 15));
        final c = Map<String, dynamic>.from(jsonDecode(line));
        expect(c['host'], isNotNull, reason: 'LANテストにはPCのプライベートIPv4アドレスが必要です');
        final lan = Lan();
        final paired = await lan.request(
          'POST',
          '/pair',
          connection: c,
          body: {'secret': c['secret'], 'name': 'test'},
        );
        lan.pairing = {...c, 'token': paired['token']};
        expect(
          (await lan.request('GET', '/health'))['serverId'],
          c['serverId'],
        );
        await expectLater(
          lan.request(
            'GET',
            '/health',
            connection: {...lan.pairing!, 'fingerprint': '0' * 64},
          ),
          throwsA(isA<HandshakeException>()),
        );
        await expectLater(
          lan.request(
            'GET',
            '/health',
            connection: {...lan.pairing!, 'token': 'invalid'},
          ),
          throwsFormatException,
        );
      } finally {
        process.kill();
        await process.exitCode;
        await dir.delete(recursive: true);
      }
    },
    timeout: const Timeout(Duration(seconds: 30)),
  );
}
