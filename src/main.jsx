import React,{useEffect,useRef,useState} from "react";
import * as THREE from "three";
import {createRoot} from "react-dom/client";
import "./styles.css";
const ASSETS="https://cdn.jsdelivr.net/npm/@rlrml/player@1.3.1/public/";
const CAMERA_STORAGE="rl-replay-viewer-cameras-v1";

function App(){
  const host=useRef(null),viewport=useRef(null),player=useRef(null),wasPlaying=useRef(false),nameplateScaleRef=useRef(1.5),drawCanvas=useRef(null),drawHistory=useRef([]),drawRedo=useRef([]),drawing=useRef(false),flyKeys=useRef(new Set()),flyFrame=useRef(null),flyModeRef=useRef(false),flyState=useRef({yaw:0,pitch:-0.2,last:0});
  const [status,setStatus]=useState("Drop a .replay file here"),[loaded,setLoaded]=useState(false),[playing,setPlaying]=useState(false);
  const [ballCam,setBallCam]=useState(false),[recordedBallCam,setRecordedBallCam]=useState(false),[replayBallCam,setReplayBallCam]=useState(true),[players,setPlayers]=useState([]),[selected,setSelected]=useState(""),[progress,setProgress]=useState(0),[duration,setDuration]=useState(0),[speed,setSpeed]=useState(1),[controlsVisible,setControlsVisible]=useState(true),[nameplateScale,setNameplateScale]=useState(1.5),[drawMode,setDrawMode]=useState(false),[drawColor,setDrawColor]=useState("#ef4444"),[drawThickness,setDrawThickness]=useState(5),[drawTool,setDrawTool]=useState("pen"),[cameraMode,setCameraMode]=useState("free"),[cameraPreset,setCameraPreset]=useState(""),[shortcutsOpen,setShortcutsOpen]=useState(false),[customCameras,setCustomCameras]=useState(()=>{try{return JSON.parse(localStorage.getItem(CAMERA_STORAGE)||"[]")}catch{return[]}}),[miniMapVisible,setMiniMapVisible]=useState(true),[boostVisible,setBoostVisible]=useState(true),[events,setEvents]=useState([]);

  useEffect(()=>()=>{try{player.current?.dispose?.()}catch{};if(flyFrame.current)cancelAnimationFrame(flyFrame.current)},[]);

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

  function resizeDrawing(){const c=drawCanvas.current,v=viewport.current;if(!c||!v)return;const r=v.getBoundingClientRect(),d=window.devicePixelRatio||1;c.width=Math.max(1,Math.round(r.width*d));c.height=Math.max(1,Math.round(r.height*d));c.style.width=r.width+"px";c.style.height=r.height+"px";c.getContext("2d").setTransform(d,0,0,d,0,0);redraw()}
  function redraw(){const c=drawCanvas.current,v=viewport.current;if(!c||!v)return;const ctx=c.getContext("2d"),r=v.getBoundingClientRect();ctx.clearRect(0,0,r.width,r.height);for(const st of drawHistory.current){ctx.save();ctx.globalCompositeOperation=st.tool==="erase"?"destination-out":"source-over";ctx.strokeStyle=st.color;ctx.lineWidth=st.width;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();st.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.restore()}}
  function startDraw(e){if(!drawMode)return;drawing.current=true;const r=drawCanvas.current.getBoundingClientRect();drawHistory.current.push({tool:drawTool,color:drawColor,width:drawThickness,points:[{x:e.clientX-r.left,y:e.clientY-r.top}]});drawRedo.current=[];redraw()}
  function moveDraw(e){if(!drawing.current)return;const r=drawCanvas.current.getBoundingClientRect(),st=drawHistory.current.at(-1);st.points.push({x:e.clientX-r.left,y:e.clientY-r.top});redraw()}
  function endDraw(){drawing.current=false}
  function undoDraw(){if(drawHistory.current.length){drawRedo.current.push(drawHistory.current.pop());redraw()}}
  function redoDraw(){if(drawRedo.current.length){drawHistory.current.push(drawRedo.current.pop());redraw()}}
  function cameraPose(position,target,up=[0,1,0],fov=48){const p=player.current;if(!p)return;p.setState({attachedPlayerId:null,cameraViewMode:"free"});const c=p.camera;c.position.set(...position);c.up.set(...up);c.fov=fov;c.updateProjectionMatrix();c.lookAt(...target);p.controls.target.set(...target);p.controls.update();setSelected("");setCameraMode("free");flyModeRef.current=false}
  function builtInCamera(v){setCameraPreset(v);if(v==="blue-goal")cameraPose([0,1800,-6900],[0,650,0]);else if(v==="orange-goal")cameraPose([0,1800,6900],[0,650,0]);else if(v==="top")cameraPose([0,9000,0],[0,0,0],[-1,0,0],50);else if(v==="side")cameraPose([7200,2200,0],[0,500,0],[0,1,0],58)}
  function saveCamera(){const p=player.current;if(!p)return;const name=window.prompt("Name this camera preset:");if(!name?.trim())return;const c=p.camera,item={id:crypto.randomUUID(),name:name.trim(),position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov};const next=[...customCameras,item];setCustomCameras(next);localStorage.setItem(CAMERA_STORAGE,JSON.stringify(next));setCameraPreset("custom:"+item.id)}
  function loadCustomCamera(id){const item=customCameras.find(x=>x.id===id),p=player.current;if(!item||!p)return;p.setState({attachedPlayerId:null,cameraViewMode:"free"});p.camera.position.fromArray(item.position);p.camera.quaternion.fromArray(item.quaternion);p.camera.fov=item.fov||48;p.camera.updateProjectionMatrix();p.controls.enabled=true;setSelected("");setCameraMode("free")}
  function deleteCustomCamera(id){const next=customCameras.filter(x=>x.id!==id);setCustomCameras(next);localStorage.setItem(CAMERA_STORAGE,JSON.stringify(next));if(cameraPreset==="custom:"+id)setCameraPreset("")}
  function startFlyLoop(){if(flyFrame.current)return;const tick=(now)=>{const p=player.current;if(!p||!flyModeRef.current){flyFrame.current=null;return}const dt=Math.min(.05,(now-flyState.current.last)/1000);flyState.current.last=now;const c=p.camera,spd=1400*(flyKeys.current.has("ShiftLeft")?2.5:1),forward=new THREE.Vector3(0,0,-1).applyQuaternion(c.quaternion),right=new THREE.Vector3(1,0,0).applyQuaternion(c.quaternion);if(flyKeys.current.has("KeyW"))c.position.addScaledVector(forward,spd*dt);if(flyKeys.current.has("KeyS"))c.position.addScaledVector(forward,-spd*dt);if(flyKeys.current.has("KeyD"))c.position.addScaledVector(right,spd*dt);if(flyKeys.current.has("KeyA"))c.position.addScaledVector(right,-spd*dt);if(flyKeys.current.has("Space"))c.position.y+=spd*dt;if(flyKeys.current.has("ControlLeft"))c.position.y-=spd*dt;p.controls.target.copy(c.position).addScaledVector(forward,1000);flyFrame.current=requestAnimationFrame(tick)};flyFrame.current=requestAnimationFrame(tick)}
  function toggleFly(){const p=player.current;if(!p)return;flyModeRef.current=!flyModeRef.current;setCameraMode(flyModeRef.current?"fly":"free");p.setState({attachedPlayerId:null,cameraViewMode:"free"});p.controls.enabled=!flyModeRef.current;if(flyModeRef.current){const e=new THREE.Euler().setFromQuaternion(p.camera.quaternion,"YXZ");flyState.current={yaw:e.y,pitch:e.x,last:performance.now()};startFlyLoop()}else if(flyFrame.current){cancelAnimationFrame(flyFrame.current);flyFrame.current=null}}
  function onFlyMouse(e){if(!flyModeRef.current||document.pointerLockElement!==viewport.current)return;const s=flyState.current;s.yaw-=e.movementX*.002;s.pitch=Math.max(-1.45,Math.min(1.45,s.pitch-e.movementY*.002));player.current.camera.rotation.set(s.pitch,s.yaw,0,"YXZ")}
  function lockFly(){if(flyModeRef.current)viewport.current?.requestPointerLock?.()}

  useEffect(()=>{
    function key(e){
      if(!loaded)return;
      const tag=e.target?.tagName;
      if(tag==="INPUT"||tag==="SELECT"||tag==="BUTTON")return;
      if(e.code==="Space"){e.preventDefault();if(!flyModeRef.current)togglePlay()}
      else if(e.code==="KeyV"){e.preventDefault();setDrawMode(v=>!v)}
      else if(e.code==="KeyF"){e.preventDefault();toggleFly()}
      else if(e.code==="KeyM"){e.preventDefault();setMiniMapVisible(v=>!v)}
      else if(e.code==="KeyB"){e.preventDefault();setBoostVisible(v=>!v)}
      else if(e.key==="?"){e.preventDefault();setShortcutsOpen(v=>!v)}
      else if(e.code==="Escape"){if(flyModeRef.current){e.preventDefault();toggleFly()}else if(drawMode){e.preventDefault();setDrawMode(false)}else if(shortcutsOpen){e.preventDefault();setShortcutsOpen(false)}}
      else if(e.code==="KeyH"){e.preventDefault();toggleControls()}
      else if(e.code==="ArrowLeft"){e.preventDefault();nudge(e.shiftKey?-1:-0.1)}
      else if(e.code==="ArrowRight"){e.preventDefault();nudge(e.shiftKey?1:0.1)}
      else if(e.code==="Home"){e.preventDefault();seek(0,false)}
      else if(e.code==="End"){e.preventDefault();seek(duration,false)}
    }
    window.addEventListener("keydown",key);
    return()=>window.removeEventListener("keydown",key);
  });

  useEffect(()=>{resizeDrawing();const ro=new ResizeObserver(resizeDrawing);if(viewport.current)ro.observe(viewport.current);window.addEventListener("resize",resizeDrawing);return()=>{ro.disconnect();window.removeEventListener("resize",resizeDrawing)}},[loaded]);
  useEffect(()=>{const root=viewport.current;if(!root)return;root.querySelectorAll(".miniMapOverlay").forEach(el=>el.style.display=miniMapVisible?"block":"none");root.querySelectorAll(".sap-bc-boost-bar").forEach(el=>el.style.display=boostVisible?"inline-flex":"none");root.querySelectorAll(".povBoostHud").forEach(el=>el.style.visibility=boostVisible?"visible":"hidden")},[miniMapVisible,boostVisible,loaded]);

  async function loadReplay(file){
    if(!file?.name.toLowerCase().endsWith(".replay")){setStatus("Please choose a .replay file.");return}
    try{
      setStatus("Loading replay…");setLoaded(false);setPlaying(false);setProgress(0);setDuration(0);setReplayBallCam(true);
      player.current?.dispose?.();player.current=null;host.current?.replaceChildren();
      const bytes=new Uint8Array(await file.arrayBuffer());
      const {createPlayer,createNameTagPlugin,createScoredTextPlugin}=await import("@rlrml/player");
      const nameplateScalePlugin=()=>({id:"nameplate-scale",beforeRender(ctx){ctx.scene.traverse(obj=>{if(!obj.isSprite||obj.renderOrder!==999)return;const image=obj.material?.map?.image;if(image?.width===256&&image?.height===80){const base=obj.userData.__rlReplayNameplateBaseScale||(obj.userData.__rlReplayNameplateBaseScale=obj.scale.clone()),pos=obj.userData.__rlReplayNameplateBasePosition||(obj.userData.__rlReplayNameplateBasePosition=obj.position.clone()),sc=nameplateScaleRef.current;obj.scale.set(base.x*sc,base.y*sc,base.z);obj.position.set(pos.x,pos.y+base.y*40*(sc-1),pos.z)}})}});
      const miniMapPlugin=()=>{let root=null,ballDot=null,dots=new Map();const map=v=>({x:50+(v.x/4120)*48,y:50-(v.z/5140)*48});return{id:"mini-map",setup(ctx){root=document.createElement("div");root.className="miniMapOverlay";root.innerHTML='<div class="miniMapField"><div class="miniMapGoal blue"></div><div class="miniMapGoal orange"></div><div class="miniMapBall"></div></div>';ctx.container.appendChild(root);ballDot=root.querySelector(".miniMapBall");ctx.player.adapter.getAllPlayers().forEach(p=>{const d=document.createElement("span");d.className="miniMapCar "+(p.team===0?"teamBlue":"teamOrange");root.firstElementChild.appendChild(d);dots.set(p.id,d)})},beforeRender(ctx){if(!root)return;const b=ctx.ball?.position;if(b){const q=map(b);ballDot.style.left=q.x+"%";ballDot.style.top=q.y+"%"}ctx.cars.forEach(car=>{const d=dots.get(car.id);if(d){const q=map(car.position);d.style.left=q.x+"%";d.style.top=q.y+"%";d.style.opacity=car.visible?"1":"0"}})},teardown(){root?.remove();dots.clear()}}};
      const p=await createPlayer(host.current,bytes,{assetBase:ASSETS,autoplay:false,effects:true,environment:false,motionInterpolation:"linear",initialSkipPostGoalTransitionsEnabled:true,plugins:[createNameTagPlugin(),nameplateScalePlugin(),createScoredTextPlugin()]});
      player.current=p;
      const renderer=p.renderer;
      renderer?.setPixelRatio?.(1);
      if(renderer?.shadowMap)renderer.shadowMap.enabled=false;
      p.subscribe?.(s=>{setPlaying(!!s.playing);setProgress(s.currentTime||0);setDuration(s.duration||0);setBallCam(!!s.ballCamEnabled);setRecordedBallCam(!!s.ballCamEnabled);setReplayBallCam(s.useReplayBallCam!==false);setSpeed(s.speed||1)});
      const roster=p.replay?.players||[];
      setPlayers(roster.map(x=>({id:x.id,name:x.name||"Player"})));
      setSelected(roster[0]?.id||"");
      setEvents((p.replay?.timelineEvents||[]).filter(e=>["goal","shot","save","demo","demolition"].includes(e.kind)).map((e,i)=>({id:i,time:e.time,kind:e.kind,player:e.playerName||""})));
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
        <div className="utilityButtons"><button className="controlsToggle" onClick={toggleControls}>{controlsVisible?"Hide controls":"Show controls"}</button><button className="controlsToggle" onClick={()=>setShortcutsOpen(v=>!v)}>⌨ Shortcuts</button></div>
        {shortcutsOpen&&<div className="shortcutsPanel"><div className="shortcutsHeader"><strong>Keyboard Shortcuts</strong><button onClick={()=>setShortcutsOpen(false)}>Close</button></div><div className="shortcutGrid"><div><h3>Playback</h3><p><kbd>Space</kbd><span>Play / Pause</span></p><p><kbd>←</kbd> <kbd>→</kbd><span>Seek ±0.1 sec</span></p><p><kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd><span>Seek ±1 sec</span></p><p><kbd>Home</kbd><span>Go to beginning</span></p><p><kbd>End</kbd><span>Go to end</span></p><h3>Viewer</h3><p><kbd>V</kbd><span>Toggle drawing mode</span></p><p><kbd>F</kbd><span>Toggle Fly Cam</span></p><p><kbd>M</kbd><span>Show / Hide mini-map</span></p><p><kbd>B</kbd><span>Show / Hide boost</span></p></div><div><h3>Fly Cam</h3><p><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd><span>Move</span></p><p><kbd>Space</kbd><span>Move up</span></p><p><kbd>Ctrl</kbd><span>Move down</span></p><p><kbd>Shift</kbd><span>Move faster</span></p><p><kbd>Mouse</kbd><span>Look around</span></p><p><kbd>Esc</kbd><span>Exit Fly Cam / close active mode</span></p><h3>Interface</h3><p><kbd>H</kbd><span>Hide / Show controls</span></p><p><kbd>?</kbd><span>Open / Close shortcuts</span></p></div></div></div>}
        {controlsVisible&&<div className="controls">
          <div className="timeline">
            <button className="step" onClick={()=>nudge(-0.1)}>−0.1</button><div className="timelineTrack"><input aria-label="Replay timeline" type="range" min="0" max={duration||0} step="0.01" value={Math.min(progress,duration||0)} onPointerDown={beginScrub} onChange={scrub} onPointerUp={endScrub}/>{events.map(e=><button key={e.id} className={"eventMarker "+e.kind} style={{left:(duration?e.time/duration*100:0)+"%"}} title={e.kind+(e.player?" · "+e.player:"")+" · "+format(e.time)} onClick={()=>seek(e.time,false)}>{e.kind==="goal"?"⚽":e.kind==="shot"?"◉":e.kind==="save"?"🛡":"💥"}</button>)}</div><button className="step" onClick={()=>nudge(0.1)}>+0.1</button>
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
            <select value={cameraPreset} onChange={e=>{const v=e.target.value;setCameraPreset(v);if(v.startsWith("custom:"))loadCustomCamera(v.slice(7));else if(v)builtInCamera(v)}} aria-label="Camera presets"><option value="">Camera preset…</option><option value="blue-goal">Blue Goal Overhead</option><option value="orange-goal">Orange Goal Overhead</option><option value="top">Full Field Top Down</option><option value="side">Mid Boost Side Wide</option>{customCameras.length>0&&<optgroup label="My Cameras">{customCameras.map(c=><option key={c.id} value={"custom:"+c.id}>{c.name}</option>)}</optgroup>}</select>
            <button onClick={toggleFly}>{cameraMode==="fly"?"Exit Fly Cam":"Fly Cam"}</button><button onClick={saveCamera} disabled={cameraMode!=="fly"}>Save Camera</button><button onClick={()=>setMiniMapVisible(v=>!v)}>{miniMapVisible?"Hide Map":"Show Map"}</button><button onClick={()=>setBoostVisible(v=>!v)}>{boostVisible?"Hide Boost":"Show Boost"}</button>
            {cameraPreset.startsWith("custom:")&&<button onClick={()=>deleteCustomCamera(cameraPreset.slice(7))}>Delete Camera</button>}
            <label className="nameplateControl">Names
              <input type="range" min="0.75" max="3" step="0.05" value={nameplateScale} onChange={e=>changeNameplateScale(e.target.value)} aria-label="Nameplate size"/>
              <span>{nameplateScale.toFixed(2)}×</span>
            </label>
            <div className="drawControls"><button onClick={()=>setDrawMode(v=>!v)}>{drawMode?"Exit Draw":"Draw"}</button>{drawMode&&<><select value={drawColor} onChange={e=>{setDrawColor(e.target.value);setDrawTool("pen")}}><option value="#ef4444">Red</option><option value="#3b82f6">Blue</option><option value="#ec4899">Pink</option><option value="#22c55e">Green</option></select><select value={drawTool} onChange={e=>setDrawTool(e.target.value)}><option value="pen">Pen</option><option value="erase">Erase</option></select><label className="thickness">Size<input type="range" min="1" max="20" value={drawThickness} onChange={e=>setDrawThickness(Number(e.target.value))}/></label><button onClick={undoDraw}>Undo</button><button onClick={redoDraw}>Redo</button></>}</div>\n            <button onClick={fullscreen}>Fullscreen</button>
          </div>
          <div className="hints">Press <b>?</b> for shortcuts · <b>Space</b> Play/Pause · <b>V</b> Draw · <b>F</b> Fly Cam</div>
        </div>}
      </div>}
    </section>
    <footer>Runs entirely in your browser. Replay data is not uploaded.</footer>
  </main>
}
function format(t){const total=Math.max(0,t);const m=Math.floor(total/60);const s=Math.floor(total%60);const cs=Math.floor((total%1)*100);return m+":"+String(s).padStart(2,"0")+"."+String(cs).padStart(2,"0")}
createRoot(document.getElementById("root")).render(<App/>);