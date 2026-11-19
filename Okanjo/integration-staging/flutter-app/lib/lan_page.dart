import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'lan_connection.dart';

class LanConnectionPage extends StatefulWidget {
  const LanConnectionPage({super.key});
  @override
  State<LanConnectionPage> createState() => _LanConnectionPageState();
}

class _LanConnectionPageState extends State<LanConnectionPage> {
  final lan = Lan();
  bool busy = true;
  String status = '接続情報を確認しています…';
  @override
  void initState() {
    super.initState();
    run(() async {
      await lan.load();
      if (lan.pairing != null) {
        await lan.connect();
        status = 'PCに接続しました';
      } else {
        status = '初回はOISO2の「LAN接続QRを表示」を押してください';
      }
    });
  }

  Future<void> run(Future<void> Function() action) async {
    if (mounted) setState(() => busy = true);
    try {
      await action();
    } catch (e) {
      status =
          '接続できませんでした。${e is FormatException ? e.message : e}\n同じWi-FiとPCの起動状態を確認してください。';
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> scan() async {
    final qr = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const _PairScanner()),
    );
    if (qr != null)
      await run(() async {
        await lan.pair(qr);
        await lan.connect();
        status = 'PCに接続しました。次回から読み取りは不要です。';
      });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('PCとLAN接続')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Icon(Icons.devices, size: 64),
        const SizedBox(height: 24),
        const Text(
          'OISO2とつなぐ',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        const Text('同じWi-FiのPCでOISO2 Bridgeを起動し、「LAN接続QRを表示」で作ったQRを読み取ります。'),
        const SizedBox(height: 24),
        Semantics(liveRegion: true, child: Text(status)),
        if (lan.pairing != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text('登録PC: ${lan.pairing!['host']}'),
          ),
        const SizedBox(height: 24),
        if (busy) const Center(child: CircularProgressIndicator()),
        FilledButton.icon(
          onPressed: busy ? null : scan,
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('PCの接続QRを読む'),
        ),
        OutlinedButton(
          onPressed: busy || lan.pairing == null
              ? null
              : () => run(() async {
                  await lan.connect();
                  status = 'PCに再接続しました';
                }),
          child: const Text('保存したPCに再接続'),
        ),
        if (lan.pairing != null)
          TextButton(
            onPressed: busy
                ? null
                : () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (c) => AlertDialog(
                        title: const Text('接続情報を削除しますか？'),
                        content: const Text(
                          '再接続にはQRの読み取りが必要です。PC側でも端末の接続解除ができます。',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(c, false),
                            child: const Text('戻る'),
                          ),
                          TextButton(
                            onPressed: () => Navigator.pop(c, true),
                            child: const Text('削除'),
                          ),
                        ],
                      ),
                    );
                    if (ok == true)
                      await run(() async {
                        await lan.forget();
                        status = '接続情報を削除しました';
                      });
                  },
            child: const Text('接続情報を削除'),
          ),
        const SizedBox(height: 24),
        const Text('この画面はPCとの接続・認証を行います。レシートの送受信には既存の結果共有・画像共有機能を使ってください。'),
      ],
    ),
  );
}

class _PairScanner extends StatefulWidget {
  const _PairScanner();
  @override
  State<_PairScanner> createState() => _PairScannerState();
}

class _PairScannerState extends State<_PairScanner> {
  final scanner = MobileScannerController();
  bool scanned = false;
  @override
  void dispose() {
    scanner.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('OISO2の接続QRを読む')),
    body: MobileScanner(
      controller: scanner,
      errorBuilder: (context, error) => const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('カメラを使用できません。端末の設定からOISOのカメラ権限を許可してください。'),
        ),
      ),
      onDetect: (capture) {
        if (scanned) return;
        for (final barcode in capture.barcodes) {
          final value = barcode.rawValue;
          if (value != null) {
            scanned = true;
            Navigator.pop(context, value);
            break;
          }
        }
      },
    ),
  );
}
