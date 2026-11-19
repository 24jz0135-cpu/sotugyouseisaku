import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';
import 'package:instant_ledger/lan_connection.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  // This integration test intentionally connects to its local Node fixture.
  HttpOverrides.global = null;
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(
        const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
        (call) async => null,
      );
  test(
    'legacy QR is accepted and invalid/expired/result codes have specific guidance',
    () async {
      final qr = {
        'format': 'oaiso-lan-pair',
        'version': 1,
        'host': '192.168.1.2',
        'port': 8793,
        'fingerprint': 'a' * 64,
        'secret': 'b' * 64,
        'serverId': 'test-server',
        'expires': DateTime.now().millisecondsSinceEpoch + 300000,
      };
      final lan = FakeLan();
      await lan.pair(jsonEncode(qr));
      expect(lan.pairing?['serverId'], 'test-server');
      await expectLater(
        lan.pair(jsonEncode({...qr, 'format': 'other'})),
        throwsA(
          isA<FormatException>().having(
            (e) => e.message,
            'guidance',
            contains('接続用ではない'),
          ),
        ),
      );
      await expectLater(
        lan.pair('http://192.168.1.2:8789/s/result'),
        throwsA(
          isA<FormatException>().having(
            (e) => e.message,
            'guidance',
            contains('接続用ではない'),
          ),
        ),
      );
      await expectLater(
        lan.pair(jsonEncode({...qr, 'expires': 0})),
        throwsA(
          isA<FormatException>().having(
            (e) => e.message,
            'guidance',
            contains('有効期限'),
          ),
        ),
      );
    },
  );
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
        expect(c['format'], 'oiso2-lan-pair');
        await lan.pair(jsonEncode(c));
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

class FakeLan extends Lan {
  @override
  Future<dynamic> request(
    String method,
    String route, {
    Object? body,
    Map<String, dynamic>? connection,
  }) async => {
    'serverId': 'test-server',
    'token': 'test-token',
    'deviceId': 'test-device',
  };
}
