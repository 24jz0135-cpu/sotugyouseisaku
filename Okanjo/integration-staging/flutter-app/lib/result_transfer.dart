import 'dart:convert';
import 'package:http/http.dart' as http;

Uri resultShareUri(String value) {
  final uri = Uri.tryParse(value.trim());
  final ip = uri?.host.split('.').map(int.tryParse).toList();
  final private =
      ip != null &&
      ip.length == 4 &&
      ip.every((n) => n != null && n >= 0 && n <= 255) &&
      (ip[0] == 10 ||
          (ip[0] == 192 && ip[1] == 168) ||
          (ip[0] == 172 && ip[1]! >= 16 && ip[1]! <= 31));
  if (uri == null ||
      uri.scheme != 'http' ||
      !private ||
      uri.userInfo.isNotEmpty ||
      uri.hasQuery ||
      uri.hasFragment ||
      uri.port < 1 ||
      uri.port > 65535 ||
      !RegExp(r'^/s/[A-Za-z0-9_-]{32}/$').hasMatch(uri.path)) {
    throw const FormatException('PCの「スマホで修正するQR」で作成したURLを使ってください');
  }
  return uri;
}

Future<String> receiveResultCsv(String value, {http.Client? client}) async {
  final uri = resultShareUri(value).resolve('data');
  final connection = client ?? http.Client();
  try {
    return await (() async {
      final request = http.Request('GET', uri)..followRedirects = false;
      final response = await connection.send(request);
      if (response.statusCode != 200) {
        throw const FormatException('共有が終了したか期限切れです。PCでQRを作り直してください');
      }
      final bytes = <int>[];
      await for (final chunk in response.stream) {
        if (bytes.length + chunk.length > 3 * 1024 * 1024) {
          throw const FormatException('受信データが大きすぎます');
        }
        bytes.addAll(chunk);
      }
      final data = jsonDecode(utf8.decode(bytes));
      if (data is! Map ||
          data['format'] != 'oiso-result' ||
          data['csv'] is! String ||
          utf8.encode(data['csv'] as String).length > 2 * 1024 * 1024) {
        throw const FormatException('OISOの解析結果ではありません');
      }
      return data['csv'] as String;
    })().timeout(const Duration(seconds: 20));
  } finally {
    connection.close();
  }
}
