(() => {
  const host = $('trackSelect').closest('.card');
  const panel = document.createElement('div');
  panel.className = 'sub';
  panel.innerHTML = `<h2>曲を追加・端末に保存</h2><label class="label" for="addTrackUrl">YouTube URL / MP3の直接URL</label><input id="addTrackUrl" type="url" placeholder="https://…" style="width:100%;padding:12px;border:1px solid #454e6c;border-radius:10px;background:#252e49;color:white"><button id="addTrackButton" class="wide">URLから追加</button><p class="muted">YouTube URLは動画リストに追加します。YouTubeからのMP3変換には別の変換サーバーが必要です（現在未接続）。MP3の直接URLは、配布元が外部取得を許可していれば端末に保存できます。</p><label class="label" for="importAudio">取得済みの音声ファイルを保存</label><input id="importAudio" type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav" multiple style="width:100%"><label class="label" for="savedAudio">この端末に保存した曲</label><select id="savedAudio"><option value="">YouTubeの選択曲を使う</option></select><audio id="localAudio" controls preload="metadata" style="width:100%;margin-top:16px" hidden></audio><div class="row" style="margin-top:10px"><button id="removeSaved">選択曲を端末から削除</button></div><p class="muted" id="audioLibraryStatus" role="status">音声ファイルはこの端末内に保存されます。</p>`;
  host.append(panel);
  const status = text => $('audioLibraryStatus').textContent = text;
  const audio = $('localAudio');
  let dbPromise, objectUrl, requestToken=0, selected='', files=[];
  const openDb = () => dbPromise ||= new Promise((resolve,reject) => {
    const request=indexedDB.open('good-sleep-audio',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('tracks',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  async function transact(mode, operation) {
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('tracks',mode);
      const req=operation(tx.objectStore('tracks'));
      tx.oncomplete=()=>resolve(req.result);
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||new Error('保存できませんでした'));
    });
  }
  async function refresh() {
    files=await transact('readonly',store=>store.getAll());
    $('savedAudio').replaceChildren(new Option('YouTubeの選択曲を使う',''));
    for(const file of files) $('savedAudio').append(new Option(file.name+' · '+(file.blob.size/1048576).toFixed(1)+' MB',file.id));
    $('savedAudio').value=selected;
  }
  async function persist(blob,name) {
    if(!blob.size) throw new Error('音声データが空です');
    const id=crypto.randomUUID();
    await transact('readwrite',store=>store.put({id,name,blob,created:Date.now()}));
    await refresh();
    status(name+' を端末に保存しました。オフラインでも再生できます。');
  }
  const youtubeStop = stopSound, youtubePlay = playSound;
  stopSound = function(){requestToken++;youtubeStop();audio.pause();};
  playSound = function(){
    if(!selected || prefs.sound==='none') {audio.pause();return youtubePlay();}
    const token=++requestToken;
    youtubeStop();
    audio.volume=prefs.volume/100;
    audio.loop=true;
    audio.play().catch(()=>{if(token===requestToken)status('保存した曲の再生ボタンを押してください。');});
  };
  $('savedAudio').onchange=()=>{
    stopSound();selected=$('savedAudio').value;
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
    if(selected){
      const file=files.find(f=>f.id===selected);
      objectUrl=URL.createObjectURL(file.blob);audio.src=objectUrl;audio.hidden=false;
      prefs.sound='youtube';render();
      status(file.name+' を選択しました。「おやすみを始める」で再生します。');
    }else{audio.removeAttribute('src');audio.load();audio.hidden=true;}
    if(running&&!paused)playSound();
  };
  const selectYouTubeTrack=selectTrack;
  selectTrack=function(index){
    if(selected){$('savedAudio').value='';$('savedAudio').onchange();}
    return selectYouTubeTrack(index);
  };
  const volumeInput=$('volume').oninput;
  $('volume').oninput=event=>{volumeInput(event);audio.volume=prefs.volume/100;};
  audio.onplay=()=>{if(prefs.sound==='none'||(running&&paused))audio.pause();};
  $('removeSaved').onclick=async()=>{
    if(!selected){status('削除する保存曲を選んでください。');return;}
    const id=selected;$('savedAudio').value='';$('savedAudio').onchange();
    try{await transact('readwrite',store=>store.delete(id));await refresh();status('選択した音声をこの端末から削除しました。');}catch{status('削除できませんでした。');}
  };
  $('importAudio').onchange=async()=>{
    const chosen=Array.from($('importAudio').files);
    $('importAudio').disabled=true;
    try{for(const file of chosen){if(!file.type.startsWith('audio/')&&!/\.(mp3|m4a|ogg|wav)$/i.test(file.name))throw Error('音声ファイルを選択してください');await persist(file,file.name);}}
    catch(error){status('保存できませんでした。空き容量とファイル形式を確認してください。 '+error.message);}
    finally{$('importAudio').disabled=false;$('importAudio').value='';}
  };
  function parseYouTube(url){
    const u=new URL(url);if(u.protocol!=='https:'&&u.protocol!=='http:')return null;
    const h=u.hostname.toLowerCase();let id;
    if(h==='youtu.be')id=u.pathname.split('/')[1];
    else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(h))id=u.searchParams.get('v')||(/^\/(shorts|embed)\//.test(u.pathname)?u.pathname.split('/')[2]:null);
    return /^[\w-]{11}$/.test(id||'')?id:null;
  }
  let extra=[];try{extra=JSON.parse(localStorage.getItem('gs-extra-youtube')||'[]').filter(id=>/^[\w-]{11}$/.test(id));}catch{}
  const appendVideo=id=>{if(YOUTUBE_TRACKS.includes(id))return YOUTUBE_TRACKS.indexOf(id);YOUTUBE_TRACKS.push(id);const index=YOUTUBE_TRACKS.length-1;$('trackSelect').append(new Option('追加曲 '+(index+1)+' · '+id,String(index)));return index;};
  for(const id of extra)appendVideo(id);
  document.querySelector('label[for="trackSelect"]').textContent='曲を選ぶ（'+YOUTUBE_TRACKS.length+'曲）';
  $('addTrackButton').onclick=async()=>{
    const raw=$('addTrackUrl').value.trim();if(!raw){status('URLを入力してください。');return;}
    const button=$('addTrackButton');button.disabled=true;
    try{
      const id=parseYouTube(raw);
      if(id){
        const index=appendVideo(id);if(!extra.includes(id)){extra.push(id);localStorage.setItem('gs-extra-youtube',JSON.stringify(extra));}
        $('savedAudio').value='';$('savedAudio').onchange();selectTrack(index);
        document.querySelector('label[for="trackSelect"]').textContent='曲を選ぶ（'+YOUTUBE_TRACKS.length+'曲）';
        status('YouTubeリストに追加しました。MP3のダウンロード・保存は行っていません。');
      }else{
        const url=new URL(raw);if(url.protocol!=='https:')throw Error('HTTPSのMP3直接URLを入力してください');
        status('音声をダウンロードしています…');
        const response=await fetch(url.href,{credentials:'omit',signal:AbortSignal.timeout(120000)});
        if(!response.ok)throw Error('配布元が応答しませんでした');
        const blob=await response.blob();
        if(!blob.type.startsWith('audio/'))throw Error('音声ファイルの直接URLを指定してください');
        await persist(blob,decodeURIComponent(url.pathname.split('/').pop())||'追加した音声');
      }
      $('addTrackUrl').value='';
    }catch(error){status('追加できませんでした。配布元が外部取得を許可していない場合は音声ファイルを選択して保存してください。 '+error.message);}
    finally{button.disabled=false;}
  };
  refresh().catch(()=>status('このブラウザでは端末への音声保存を利用できません。'));
})();
