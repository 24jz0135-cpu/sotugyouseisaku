$(function() {
    // きょうの日付が奇数か偶数かを表示
    const day = new Date().getDate(); // 1〜31

    let parity = '';
    if (day % 2 === 0) {
        parity = '偶数です';
    } else {
        parity = '奇数です';
    }

    $('body').prepend($('<p>'));
    $('p').append(`今日の日付は${day}日で、${parity}<br>`);
    $('p').append($('<a>',{href:'ex03_03.html', text:'次の課題へ'}));

});

