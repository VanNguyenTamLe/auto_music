{
  const state = function (e) {
    if (e === 1 || e === 3) {
      action();
    }
  };
  //
  const action = function () {
    const player = document.getElementById("movie_player");
    if (player) {
      if (player.getAvailableQualityLevels) {
        const levels = player.getAvailableQualityLevels();
        if (levels) {
          if (levels.length) {
            const quality = 'tiny';
            if (quality) {
              player.setPlaybackQuality(quality);
              player.setPlaybackQualityRange(quality, quality);
            }
          }
        }
      }
    }
  };
  //
  const listen = function () {
    const player = document.getElementById("movie_player");
    if (player && player.addEventListener && player.getPlayerState) {
      player.addEventListener("onStateChange", state);
    } else {
      window.setTimeout(listen, 1000);
    }
  };
  //
  listen();
  action();
}