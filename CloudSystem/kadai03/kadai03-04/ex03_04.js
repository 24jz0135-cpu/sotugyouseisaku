$(function() {
    const seasonToFile = {
        spring: '春.jpg',
        summer: '夏.jpg',
        autumn: '秋.jpg',
        winter: '冬.jpg'
    };

    const $img = $('#seasonImage');
    const $select = $('#monthSelect');

    function updateImage() {
        const season = $select.val();
        const file = seasonToFile[season];
        if (!file) return;
        $img.attr('src', `img/${file}`);
    }

    // 初期表示も更新
    updateImage();

    $select.on('change', updateImage);

    $('body').prepend($('<p>'));    
    $('p').append($('<a>',{href:'ex03_03.html', text:'次の課題へ'}));

});

