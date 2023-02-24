{

    const listen = function () {
        // const player = document.querySelector('video');
        // if (player && player.addEventListener) {
        //     // player.addEventListener("ended", );
        //     player.addEventListener('ended', (event) => {
        //         console.log('inject js');
        //     });
        // } else {
        //     window.setTimeout(listen, 1000);
        // }

        window.addEventListener('beforeunload', function (event) {
            // Chấp nhận thông báo
            event.returnValue = true;
            console.log(document.title);
            // Thay đổi tiêu đề của thông báo để đảm bảo nó được ẩn
            window.setTimeout(function () {
                document.title = "";
            }, 0);
        });

        window.setTimeout(listen, 1000);
    };
    //
    listen();
    // action();

    // main();

}