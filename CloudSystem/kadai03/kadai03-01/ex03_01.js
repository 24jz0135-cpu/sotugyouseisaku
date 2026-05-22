$(function() {
    // 動作確認用（表示されない場合はscript読み込み/実行が失敗している）
    console.log('ex03_01.js loaded');

    $('body').prepend($('<p>'));
    $('p').append("ひながたドキュメントの本文です。<br>")
          .append($('<a>',{href:'ex03_02.html', text:'次の課題へ'}));
});
