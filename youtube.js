const YOUTUBE_TRACKS = ['hTpmFIwhx9s','DPz3w0fsTpc','v0s5dJwLw-o','amd5RO11YGI','uLPG8KFMuUU','jY2tceTZewQ','TPFGLXn5-sA','cUqTyHj6w6g','kdEblFC1VU0','HN1Gh3xOIuc','qiTRC_cAbLY','PH_-nQbGmxA','llA75MTWPP8','aMGe0veDmd0','eW5Sy_ZG9ZQ','JDY7LsGPPZ8','sx9-adj0aLw','_kY7HH6XAHU','b0CFp9cqBnA','q1a-cCY4mxI'];
let ytPlayer, ytReady = false, ytWanted = false, ytResume = false;
let trackIndex = Number.isInteger(prefs.track) && prefs.track >= 0 && prefs.track < YOUTUBE_TRACKS.length ? prefs.track : 0;
if (prefs.sound !== 'none') prefs.sound = 'youtube';
$('trackSelect').value = String(trackIndex);
function ytStatus(message) { $('youtubeStatus').textContent = message; }
function trackTitle() {
  if (!ytReady) return;
  const data = ytPlayer.getVideoData();
  if (data && data.title) {
    $('trackSelect').options[trackIndex].textContent = '曲 '+String(trackIndex+1).padStart(2,'0')+' · '+data.title;
    ytStatus(data.title);
  }
}
function selectTrack(index) {
  trackIndex = (index + YOUTUBE_TRACKS.length) % YOUTUBE_TRACKS.length;
  prefs.track = trackIndex;
  $('trackSelect').value = String(trackIndex);
  $('youtubeLink').href = 'https://www.youtube.com/watch?v=' + YOUTUBE_TRACKS[trackIndex];
  ytResume = false;
  save();
  if (ytReady) {
    if (ytWanted && prefs.sound === 'youtube') ytPlayer.loadVideoById(YOUTUBE_TRACKS[trackIndex]);
    else ytPlayer.cueVideoById(YOUTUBE_TRACKS[trackIndex]);
  }
  ytStatus('曲 '+String(trackIndex+1).padStart(2,'0')+' を選択しました');
}
const stopGeneratedSound = stopSound;
stopSound = function () {
  stopGeneratedSound();
  ytWanted = false;
  if (ytReady) {
    ytResume = running && paused;
    if (ytResume) ytPlayer.pauseVideo();
    else ytPlayer.stopVideo();
  }
  $('preview').textContent = '▷ 10秒試聴';
};
playSound = function () {
  if (prefs.sound === 'none') { stopSound(); return; }
  ytWanted = true;
  if (!navigator.onLine) { ytStatus('オフラインです。音楽の再生には接続が必要です。'); return; }
  if (!ytReady) { ytStatus('プレーヤーを準備中です。準備後、動画の再生ボタンを押してください。'); return; }
  ytPlayer.setVolume(prefs.volume);
  if (ytResume) { ytPlayer.playVideo(); ytResume = false; }
  else ytPlayer.loadVideoById(YOUTUBE_TRACKS[trackIndex]);
};
$('trackSelect').onchange = () => selectTrack(Number($('trackSelect').value));
$('previousTrack').onclick = () => selectTrack(trackIndex - 1);
$('nextTrack').onclick = () => selectTrack(trackIndex + 1);
$('sounds').onclick = event => {
  const button = event.target.closest('button');
  if (!button) return;
  prefs.sound = button.dataset.sound;
  render();
  if (prefs.sound === 'none') stopSound();
  else if (running && !paused) playSound();
};
const originalVolume = $('volume').oninput;
$('volume').oninput = event => {originalVolume(event);if (ytReady) ytPlayer.setVolume(prefs.volume);};
window.onYouTubeIframeAPIReady = () => {
  ytPlayer = new YT.Player('youtubePlayer', {
    width: '100%', height: '240', videoId: YOUTUBE_TRACKS[trackIndex],
    playerVars: {playsinline: 1, controls: 1, origin: location.origin},
    events: {
      onReady: () => {ytReady = true;ytPlayer.setVolume(prefs.volume);trackTitle();if (ytWanted) ytStatus('準備ができました。動画内の再生ボタンを押してください。');},
      onStateChange: event => {
        trackTitle();
        if (event.data === YT.PlayerState.PLAYING) {
          if (prefs.sound === 'none' || (running && paused)) {ytPlayer.pauseVideo();return;}
          ytWanted = true;
        }
        if (event.data === YT.PlayerState.ENDED && running && !paused && ytWanted) selectTrack(trackIndex + 1);
      },
      onAutoplayBlocked: () => ytStatus('動画内の再生ボタンを押すと音楽が始まります。'),
      onError: event => {ytWanted=false;ytStatus('この動画は埋め込みで再生できません（'+event.data+'）。別の曲を選ぶか「YouTubeで開く」をお試しください。');}
    }
  });
};
const youtubeApi = document.createElement('script');
youtubeApi.src = 'https://www.youtube.com/iframe_api';
youtubeApi.onerror = () => ytStatus('YouTubeを読み込めませんでした。接続を確認して再読み込みしてください。');
document.head.append(youtubeApi);
selectTrack(trackIndex);
render();
