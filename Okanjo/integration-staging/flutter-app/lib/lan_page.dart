import 'dart:io';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'lan_connection.dart';

class LanConnectionPage extends StatefulWidget {
  const LanConnectionPage({super.key, this.onSendPhotos,this.onReceiveResults});
  final Future<void> Function()? onSendPhotos;
  final VoidCallback? onReceiveResults;
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
        status = '初回はPCのOaisoで「スマホで読むコードを表示」を押してください';
      }
    });
  }

  Future<void> run(Future<void> Function() action) async {
    if (mounted) setState(() => busy = true);
    try {
      await action();
    } catch (e) {
      if (e is FormatException) {
        status = e.message;
      } else if (e is HandshakeException) {
        status = 'PCの本人確認ができませんでした。PCで接続コードを作り直してください。';
      } else if (e is SocketException || e is TimeoutException) {
        status = 'PCに通信できません。同じWi-FiとPCの起動状態、Windowsの接続許可を確認してください。';
      } else {
        status = '接続を完了できませんでした。もう一度お試しください。 $e';
      }
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
        const Text('Oaiso 0.2.3 · 未確定・確定対応', style: TextStyle(fontSize: 14)),
        const Icon(Icons.devices, size: 64),
        const SizedBox(height: 24),
        const Text(
          'OISO2とつなぐ',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        const Text(
          'PCで「OISO2を起動.cmd」を開き、同じWi-Fiにつないでください。PC画面の「スマホで読むコードを表示」で作ったコードを読み取ります。',
        ),
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
        if (widget.onSendPhotos != null)
          FilledButton.icon(
            onPressed: busy ? null : () => run(widget.onSendPhotos!),
            icon: const Icon(Icons.send_outlined),
            label: const Text('レシートの写真をPCへ送る'),
          ),
        const Text('送った写真はPCの「スマホから届いた写真」で確認できます。'),
        const SizedBox(height:20),
        if(widget.onReceiveResults!=null) FilledButton.icon(onPressed:busy?null:widget.onReceiveResults,icon:const Icon(Icons.qr_code_scanner),label:const Text('④ PCの結果コードを読む')),
        const Text('PCの④で表示した結果受信用のコードを読み取ります。初回接続のコードではありません。'),
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
