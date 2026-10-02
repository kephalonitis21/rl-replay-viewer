import React,{useEffect,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {createPlayer,createNameTagPlugin,createScoredTextPlugin} from "@rlrml/player";
import "./styles.css";
const ASSETS="https://cdn.jsdelivr.net/npm/@rlrml/player@1.3.1/public/";

function App(){
  const host=useRef(null),viewport=useRef(null),player=useRef(null);
  const [status,setStatus]=useState("Drop a .replay file here"),[loaded,setLoaded]=useState(false),[playing,setPlaying]=useState(false);
  const [ballCam,setBallCam]=useState(false),[players,setPlayers]=useState([]),[selected,setSelected]=useState(""),[progress,setProgress]=useState(0),[duration,setDuration]=useState(0);

  useEffect(()=>{
    const originalRAF=window.requestAnimationFrame.bind(window),originalCAF=window.cancelAnimationFrame.bind(window);
    let last=0,id=0;const timers=new Map();
    window.requestAnimationFrame=cb=>{const n=++id;const delay=Math.max(0,16.67-(performance.now()-last));const t=window.setTimeout(()=>{timers.delete(n);const r=originalRAF(time=>{last=time;cb(time)});timers.set(n,r)},delay);timers.set(n,t);return n};
    window.cancelAnimationFrame=n=>{const t=timers.get(n);if(t!==undefined){clearTimeout(t);originalCAF(t);timers.delete(n)}};
    return()=>{window.requestAnimationFrame=originalRAF;window.cancelAnimationFrame=originalCAF;for(const t of timers.values())clearTimeout(t);timers.clear()};
  },[]);
  useEffect(()=>()=>{try{player.current?.dispose?.()}catch{}},[]);
  function togglePlay(){const p=player.current;if(!p)return;const next=!p.snapshot?.playing;p.setState({playing:next});setPlaying(next)}
  function reset(){player.current?.setState({currentTime:0,playing:false});setPlaying(false)}
  function fullscreen(){const el=viewport.current;if(!el)return;document.fullscreenElement?document.exitFullscreen():el.requestFullscreen?.()}
  function choose(id){setSelected(id);setBallCam(true);player.current?.setState({attachedPlayerId:id,cameraViewMode:"follow",ballCamEnabled:true})}
  function toggleBall(){const next=!ballCam;setBallCam(next);player.current?.setState({ballCamEnabled:next})}
  async function loadReplay(file){
    if(!file?.name.toLowerCase().endsWith(".replay")){setStatus("Please choose a .replay file.");return}
    try{
      setStatus("Loading replay…");setLoaded(false);player.current?.dispose?.();player.current=null;host.current?.replaceChildren();
      const bytes=new Uint8Array(await file.arrayBuffer());
      const p=await createPlayer(host.current,bytes,{assetBase:ASSETS,autoplay:false,effects:false,environment:false,motionInterpolation:"linear",initialSkipPostGoalTransitionsEnabled:true,plugins:[createNameTagPlugin(),createScoredTextPlugin()]});
      player.current=p;
      p.subscribe?.(s=>{setPlaying(!!s.playing);setProgress(s.currentTime||0);setDuration(s.duration||0);setBallCam(!!s.ballCamEnabled)});
      const roster=p.replay?.players||[];setPlayers(roster.map(x=>({id:x.id,name:x.name||"Player"})));setSelected(roster[0]?.id||"");
      setLoaded(true);setStatus(file.name);
    }catch(err){console.error(err);setStatus("Could not load this replay.");}
  }
  function drop(e){e.preventDefault();loadReplay(e.dataTransfer.files?.[0])}
  return <main className="app">
    <header><div><h1>RL Replay Viewer</h1><span>Season 24 browser playback</span></div><label className="fileButton">Open replay<input type="file" accept=".replay" onChange={e=>loadReplay(e.target.files?.[0])}/></label></header>
    <section className="viewer" ref={viewport} onDragOver={e=>e.preventDefault()} onDrop={drop}>
      <div className="playerHost" ref={host}/>
      {!loaded&&<div className="drop"><strong>{status}</strong><small>Drag a Rocket League .replay file here, or use Open replay.</small></div>}
      {loaded&&<div className="hud"><div className="top"><span>{status}</span><span>{duration?format(progress)+" / "+format(duration):""}</span></div><div className="bottom">
        <button onClick={togglePlay}>{playing?"Pause":"Play"}</button><button onClick={reset}>Reset</button><button onClick={toggleBall}>{ballCam?"Ball Cam":"Free Cam"}</button>
        <select value={selected} onChange={e=>choose(e.target.value)}><option value="">Player POV</option>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button onClick={fullscreen}>Fullscreen</button>
      </div></div>}
    </section>
    <footer>Runs entirely in your browser. Replay data is not uploaded.</footer>
  </main>
}
function format(t){const s=Math.max(0,Math.floor(t));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}
createRoot(document.getElementById("root")).render(<App/>);