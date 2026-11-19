import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

bool privateAddress(String host) {
  final parts = host.split('.').map(int.tryParse).toList();
  if (parts.length != 4 || parts.any((n) => n == null || n < 0 || n > 255)) {
    return false;
  }
  return parts[0] == 10 ||
      (parts[0] == 192 && parts[1] == 168) ||
      (parts[0] == 172 && parts[1]! >= 16 && parts[1]! <= 31);
}

class Lan {
  static const storage = FlutterSecureStorage();
  Map<String, dynamic>? pairing;
  Future<void> load() async {
    final s = await storage.read(key: 'oiso2-lan-pair');
    if (s != null) pairing = Map<String, dynamic>.from(jsonDecode(s));
  }

  Future<void> forget() async {
    pairing = null;
    await storage.delete(key: 'oiso2-lan-pair');
  }

  Future<dynamic> request(
    String method,
    String route, {
    Object? body,
    Map<String, dynamic>? connection,
  }) async {
    final c = connection ?? pairing;
    if (c == null) throw const FormatException('PCとペアリングしてください');
    if (!privateAddress(c['host'] as String)) {
      throw const FormatException('同一LAN内のPCを指定してください');
    }
    final client = HttpClient(context: SecurityContext(withTrustedRoots: false))
      ..connectionTimeout = const Duration(seconds: 5);
    client.badCertificateCallback = (cert, host, port) =>
        sha256.convert(cert.der).toString() == c['fingerprint'];
    try {
      final req = await client.openUrl(
        method,
        Uri(scheme: 'https', host: c['host'], port: c['port'], path: route),
      );
      if (c['token'] != null) {
        req.headers.set(
          HttpHeaders.authorizationHeader,
          'Bearer ${c['token']}',
        );
      }
      if (body != null) {
        req.headers.contentType = ContentType.json;
        req.write(jsonEncode(body));
      }
      final res = await req.close().timeout(const Duration(seconds: 90));
      final bytes = <int>[];
      await for (final chunk in res.timeout(const Duration(seconds: 90))) {
        bytes.addAll(chunk);
        if (bytes.length > 200 * 1024 * 1024) {
          throw const FormatException('受信データが大きすぎます');
        }
      }
      final value = jsonDecode(utf8.decode(bytes));
      if (res.statusCode >= 400) {
        throw FormatException(value['error']?.toString() ?? '接続エラー');
      }
      return value;
    } finally {
      client.close(force: true);
    }
  }

  Future<void> pair(String qr) async {
    dynamic c;
    try {
      c = jsonDecode(qr.trim());
    } catch (_) {
      throw const FormatException(
        '接続用ではないコードです。PCの「スマホで読むコードを表示」で作り直してください。結果受信用のコードは別の画面で読み取ります。',
      );
    }
    if (c is! Map ||
        !['oiso2-lan-pair', 'oaiso-lan-pair'].contains(c['format']) ||
        c['version'] != 1) {
      throw const FormatException(
        '接続用ではないコードです。PCの「スマホで読むコードを表示」で作ったコードを読み取ってください。',
      );
    }
    if (c['host'] is! String ||
        !privateAddress(c['host']) ||
        c['port'] is! int ||
        c['port'] < 1 ||
        c['port'] > 65535 ||
        c['fingerprint'] is! String ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(c['fingerprint']) ||
        c['serverId'] is! String ||
        c['secret'] is! String ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(c['secret']) ||
        c['expires'] is! int) {
      throw const FormatException('接続コードの情報が不足しています。PCでコードを作り直してください。');
    }
    if (c['expires'] < DateTime.now().millisecondsSinceEpoch) {
      throw const FormatException(
        '接続コードの有効期限が切れています。PCでコードを作り直し、5分以内に読み取ってください。繰り返す場合はスマホとPCの日時を自動設定にしてください。',
      );
    }
    final result = await request(
      'POST',
      '/pair',
      body: {'secret': c['secret'], 'name': 'Oaiso Android'},
      connection: Map<String, dynamic>.from(c),
    );
    if (result['serverId'] != c['serverId']) {
      throw const FormatException('PCの識別情報が一致しません');
    }
    pairing = {
      'host': c['host'],
      'port': c['port'],
      'fingerprint': c['fingerprint'],
      'serverId': c['serverId'],
      'token': result['token'],
      'deviceId': result['deviceId'],
    };
    await storage.write(key: 'oiso2-lan-pair', value: jsonEncode(pairing));
  }

  Future<void> connect() async {
    if (pairing == null) throw const FormatException('初回はPC画面のQRコードを読み取ってください');
    try {
      final h = await request('GET', '/health');
      if (h['serverId'] == pairing!['serverId']) return;
    } catch (_) {
      /* Try authenticated rediscovery below. */
    }
    final socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
    socket.broadcastEnabled = true;
    final candidates = <Map<String, dynamic>>[];
    final sub = socket.listen((event) {
      if (event == RawSocketEvent.read) {
        final data = socket.receive();
        if (data == null) return;
        try {
          final r = jsonDecode(utf8.decode(data.data));
          if (r['format'] == 'oaiso-lan' &&
              r['serverId'] == pairing!['serverId'] &&
              r['port'] is int &&
              privateAddress(data.address.address)) {
            candidates.add({
              ...pairing!,
              'host': data.address.address,
              'port': r['port'],
            });
          }
        } catch (_) {}
      }
    });
    try {
      socket.send(
        utf8.encode('OAISO_DISCOVER_V1'),
        InternetAddress('255.255.255.255'),
        8795,
      );
      await Future<void>.delayed(const Duration(seconds: 2));
    } finally {
      await sub.cancel();
      socket.close();
    }
    for (final c in candidates) {
      try {
        final h = await request('GET', '/health', connection: c);
        if (h['serverId'] == pairing!['serverId']) {
          pairing = c;
          await storage.write(
            key: 'oiso2-lan-pair',
            value: jsonEncode(pairing),
          );
          return;
        }
      } catch (_) {}
    }
    throw const FormatException(
      'PCが見つかりません。同じWi-Fi・PC補助アプリの起動・ファイアウォールを確認してください',
    );
  }
}
