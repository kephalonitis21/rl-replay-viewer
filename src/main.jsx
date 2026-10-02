import React,{useEffect,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import "./styles.css";
const ASSETS="https://cdn.jsdelivr.net/npm/@rlrml/player@1.3.1/public/";

function App(){
  const host=useRef(null),viewport=useRef(null),player=useRef(null),wasPlaying=useRef(false),nameplateScaleRef=useRef(1.5);
  const [status,setStatus]=useState("Drop a .replay file here"),[loaded,setLoaded]=useState(false),[playing,setPlaying]=useState(false);
  const [ballCam,setBallCam]=useState(false),[recordedBallCam,setRecordedBallCam]=useState(false),[replayBallCam,setReplayBallCam]=useState(true),[players,setPlayers]=useState([]),[selected,setSelected]=useState(""),[progress,setProgress]=useState(0),[duration,setDuration]=useState(0),[speed,setSpeed]=useState(1),[controlsVisible,setControlsVisible]=useState(true),[nameplateScale,setNameplateScale]=useState(1.5);

  useEffect(()=>()=>{try{player.current?.dispose?.()}catch{}},[]);

  function setPlayback(next){
    const p=player.current;if(!p)return;
    p.setState({playing:next});
    setPlaying(next);
  }
  function togglePlay(){setPlayback(!playing)}
  function reset(){player.current?.setState({currentTime:0,playing:false});setPlaying(false)}
  function seek(time, resume=playing){
    const p=player.current;if(!p||!duration)return;
    const t=Math.max(0,Math.min(duration,time));
    p.setState({currentTime:t,playing:resume});
    setProgress(t);
    setPlaying(resume);
  }
  function scrub(e){seek(Number(e.target.value),wasPlaying.current)}
  function beginScrub(){wasPlaying.current=playing; if(playing)setPlayback(false)}
  function endScrub(e){seek(Number(e.target.value),wasPlaying.current)}
  function nudge(delta){seek(progress+delta,false)}
  function changeSpeed(value){
    const next=Number(value);setSpeed(next);player.current?.setState({speed:next});
  }
  function fullscreen(){const el=viewport.current;if(!el)return;document.fullscreenElement?document.exitFullscreen():el.requestFullscreen?.()}
  function choose(id){
    setSelected(id);
    if(!id){
      setReplayBallCam(true);
      player.current?.setState({attachedPlayerId:null,cameraViewMode:"free"});
      return;
    }
    setReplayBallCam(true);
    player.current?.setState({attachedPlayerId:id,cameraViewMode:"follow",useReplayBallCam:true});
  }
  function setBallCamMode(mode){
    const p=player.current;
    if(!p)return;
    if(mode==="recorded"){
      setReplayBallCam(true);
      p.setState({useReplayBallCam:true});
      return;
    }
    const enabled=mode==="on";
    setReplayBallCam(false);
    setBallCam(enabled);
    p.setState({ballCamEnabled:enabled});
  }
  function toggleControls(){setControlsVisible(v=>!v)}
  function changeNameplateScale(value){nameplateScaleRef.current=Number(value);setNameplateScale(Number(value))}

  useEffect(()=>{
    function key(e){
      if(!loaded)return;
      const tag=e.target?.tagName;
      if(tag==="INPUT"||tag==="SELECT"||tag==="BUTTON")return;
      if(e.code==="Space"){e.preventDefault();togglePlay()}
      else if(e.code==="KeyH"){e.preventDefault();toggleControls()}
      else if(e.code==="ArrowLeft"){e.preventDefault();nudge(e.shiftKey?-1:-0.1)}
      else if(e.code==="ArrowRight"){e.preventDefault();nudge(e.shiftKey?1:0.1)}
      else if(e.code==="Home"){e.preventDefault();seek(0,false)}
      else if(e.code==="End"){e.preventDefault();seek(duration,false)}
    }
    window.addEventListener("keydown",key);
    return()=>window.removeEventListener("keydown",key);
  });

  async function loadReplay(file){
    if(!file?.name.toLowerCase().endsWith(".replay")){setStatus("Please choose a .replay file.");return}
    try{
      setStatus("Loading replay…");setLoaded(false);setPlaying(false);setProgress(0);setDuration(0);setReplayBallCam(true);
      player.current?.dispose?.();player.current=null;host.current?.replaceChildren();
      const bytes=new Uint8Array(await file.arrayBuffer());
      const {createPlayer,createNameTagPlugin}=await import("@rlrml/player");
      const nameplateScalePlugin=()=>({
        id:"nameplate-scale",
        beforeRender(ctx){
          ctx.scene.traverse(obj=>{
            if(!obj.isSprite||obj.renderOrder!==999)return;
            const image=obj.material?.map?.image;
            if(image?.width===256&&image?.height===80){
              const base=obj.userData.__rlReplayNameplateBaseScale||(obj.userData.__rlReplayNameplateBaseScale=obj.scale.clone());
              obj.scale.set(base.x*nameplateScaleRef.current,base.y*nameplateScaleRef.current,base.z);
            }
          });
        }
      });
      const p=await createPlayer(host.current,bytes,{assetBase:ASSETS,autoplay:false,effects:false,environment:false,motionInterpolation:"linear",initialSkipPostGoalTransitionsEnabled:true,plugins:[createNameTagPlugin(),nameplateScalePlugin()]});
      player.current=p;
      const renderer=p.renderer;
      renderer?.setPixelRatio?.(1);
      if(renderer?.shadowMap)renderer.shadowMap.enabled=false;
      p.subscribe?.(s=>{setPlaying(!!s.playing);setProgress(s.currentTime||0);setDuration(s.duration||0);setBallCam(!!s.ballCamEnabled);setRecordedBallCam(!!s.ballCamEnabled);setReplayBallCam(s.useReplayBallCam!==false);setSpeed(s.speed||1)});
      const roster=p.replay?.players||[];
      setPlayers(roster.map(x=>({id:x.id,name:x.name||"Player"})));
      setSelected(roster[0]?.id||"");
      setLoaded(true);setStatus(file.name);
    }catch(err){console.error(err);setStatus("Could not load this replay.");setLoaded(false);}
  }
  function drop(e){e.preventDefault();loadReplay(e.dataTransfer.files?.[0])}

  return <main className="app">
    <header><div><h1>RL Replay Viewer</h1><span>Season 24 browser playback</span></div><label className="fileButton">Open replay<input type="file" accept=".replay" onChange={e=>loadReplay(e.target.files?.[0])}/></label></header>
    <section className="viewer" ref={viewport} onDragOver={e=>e.preventDefault()} onDrop={drop}>
      <div className="playerHost" ref={host}/>
      {!loaded&&<div className="drop"><strong>{status}</strong><small>Drag a Rocket League .replay file here, or use Open replay.</small></div>}
      {loaded&&<div className="hud">
        <div className="top"><span>{status}</span><span>{duration?format(progress)+" / "+format(duration):""}</span></div>
        <button className="controlsToggle" onClick={toggleControls}>{controlsVisible?"Hide controls":"Show controls"}</button>
        {controlsVisible&&<div className="controls">
          <div className="timeline">
            <button className="step" onClick={()=>nudge(-0.1)} title="Back 0.1 seconds">−0.1</button>
            <input aria-label="Replay timeline" type="range" min="0" max={duration||0} step="0.01" value={Math.min(progress,duration||0)} onPointerDown={beginScrub} onChange={scrub} onPointerUp={endScrub}/>
            <button className="step" onClick={()=>nudge(0.1)} title="Forward 0.1 seconds">+0.1</button>
          </div>
          <div className="bottom">
            <button onClick={togglePlay}>{playing?"Pause":"Play"}</button>
            <button onClick={reset}>Reset</button>
            <select value={speed} onChange={e=>changeSpeed(e.target.value)} aria-label="Playback speed">
              {[0.25,0.5,1,1.5,2,4].map(x=><option key={x} value={x}>{x}×</option>)}
            </select>
            <select value={replayBallCam?"recorded":(ballCam?"on":"off")} onChange={e=>setBallCamMode(e.target.value)} disabled={!selected} aria-label="Ball cam mode">
              <option value="recorded">Ball Cam: Recorded {recordedBallCam?"ON":"OFF"}</option>
              <option value="on">Ball Cam: ON (manual)</option>
              <option value="off">Ball Cam: OFF (manual)</option>
            </select>
            <select value={selected} onChange={e=>choose(e.target.value)}><option value="">Free Camera</option>{players.map(p=><option key={p.id} value={p.id}>{p.name} POV</option>)}</select>
            <label className="nameplateControl">Names
              <input type="range" min="0.75" max="3" step="0.05" value={nameplateScale} onChange={e=>changeNameplateScale(e.target.value)} aria-label="Nameplate size"/>
              <span>{nameplateScale.toFixed(2)}×</span>
            </label>
            <button onClick={fullscreen}>Fullscreen</button>
          </div>
          <div className="hints">Space Play/Pause · H Hide/Show Controls · ←/→ 0.1s · Shift+←/→ 1s · Home/End jump</div>
        </div>}
      </div>}
    </section>
    <footer>Runs entirely in your browser. Replay data is not uploaded.</footer>
  </main>
}
function format(t){const total=Math.max(0,t);const m=Math.floor(total/60);const s=Math.floor(total%60);const cs=Math.floor((total%1)*100);return m+":"+String(s).padStart(2,"0")+"."+String(cs).padStart(2,"0")}
createRoot(document.getElementById("root")).render(<App/>);