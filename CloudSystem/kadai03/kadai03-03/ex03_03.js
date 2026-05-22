$(function() {
  const img = $('#coin');

  // 初期表示: 裏画像
  img.attr('src', 'img/10yen_ura.jpg');

  // ボタン: クリックで画像とボタン文言を切り替える
  $('#flip').on('click', function () {
    const btn = $('#flip');
    const isUra = img.attr('src') === 'img/10yen_ura.jpg';

    if (isUra) {
      // 裏 -> 表
      img.attr('src', 'img/10yen_omote.webp');
      btn.val('裏にする');
    } else {
      // 表 -> 裏
      img.attr('src', 'img/10yen_ura.jpg');
      btn.val('表にする');
    }
  });


  // 「次の課題へ」リンク
  // （p が無い場合でも表示されるように、ここでpを作る）
  $('body').append(
    $('<p>').append(
      $('<a>', { href: 'ex03_04.html', text: '次の課題へ' })
    )
  );
});

