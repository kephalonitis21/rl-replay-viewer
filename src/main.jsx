import React,{useEffect,useRef,useState} from "react";
import * as THREE from "three";
import {createRoot} from "react-dom/client";
import "./styles.css";
import {createReplayPlugins} from "./replayPlugins.js";
const ASSETS="https://cdn.jsdelivr.net/npm/@rlrml/player@1.3.1/public/";
const CAMERA_STORAGE="rl-replay-viewer-cameras-v1";

function App(){
  const host=useRef(null),viewport=useRef(null),player=useRef(null),wasPlaying=useRef(false),nameplateScaleRef=useRef(1.5),drawCanvas=useRef(null),drawHistory=useRef([]),drawRedo=useRef([]),drawing=useRef(false),flyKeys=useRef(new Set()),flyFrame=useRef(null),flyModeRef=useRef(false),flyState=useRef({yaw:0,pitch:-0.2,last:0}),flyLook=useRef({active:false,x:0,y:0}),selectedRef=useRef(""),povBoostHudRef=useRef(null),drawModeRef=useRef(false),controlsRef=useRef(null),replayLoadRef=useRef(0),loadedRef=useRef(false),povSlotsRef=useRef([]),playingRef=useRef(false),durationRef=useRef(0),progressRef=useRef(0),shortcutsOpenRef=useRef(false),coverageRef=useRef({enabled:false,blue:true,orange:true,players:{},opacity:0.32}),coverageRosterRef=useRef([]);
  const [status,setStatus]=useState("Drop a .replay file here"),[loaded,setLoaded]=useState(false),[playing,setPlaying]=useState(false),[controlsHeight,setControlsHeight]=useState(105);
  const [ballCam,setBallCam]=useState(false),[recordedBallCam,setRecordedBallCam]=useState(false),[replayBallCam,setReplayBallCam]=useState(true),[players,setPlayers]=useState([]),[povSlots,setPovSlots]=useState([]),[selected,setSelected]=useState(""),[progress,setProgress]=useState(0),[duration,setDuration]=useState(0),[speed,setSpeed]=useState(1),[controlsVisible,setControlsVisible]=useState(true),[nameplateScale,setNameplateScale]=useState(1.5),[drawMode,setDrawMode]=useState(false),[drawColor,setDrawColor]=useState("#ef4444"),[drawThickness,setDrawThickness]=useState(5),[drawTool,setDrawTool]=useState("pen"),[cameraMode,setCameraMode]=useState("free"),[cameraPreset,setCameraPreset]=useState(""),[shortcutsOpen,setShortcutsOpen]=useState(false),[customCameras,setCustomCameras]=useState(()=>{try{return JSON.parse(localStorage.getItem(CAMERA_STORAGE)||"[]")}catch{return[]}}),[boostVisible,setBoostVisible]=useState(true),[events,setEvents]=useState([]),[coverageOpen,setCoverageOpen]=useState(false),[coverageSettings,setCoverageSettings]=useState({enabled:false,blue:true,orange:true,players:{},opacity:0.32});

  useEffect(()=>{
    loadedRef.current=loaded;
    povSlotsRef.current=povSlots;
    playingRef.current=playing;
    durationRef.current=duration;
    progressRef.current=progress;
    shortcutsOpenRef.current=shortcutsOpen;
  },[loaded,povSlots,playing,duration,progress,shortcutsOpen]);

  useEffect(()=>()=>{try{player.current?.dispose?.()}catch{};if(flyFrame.current)cancelAnimationFrame(flyFrame.current)},[]);

  function setPlayback(next){
    const p=player.current;if(!p)return;
    playingRef.current=next;
    p.setState({playing:next});
    setPlaying(next);
  }
  function togglePlay(){setPlayback(!playingRef.current)}
  function seek(time, resume=playingRef.current){
    const p=player.current;if(!p||!durationRef.current)return;
    const t=Math.max(0,Math.min(durationRef.current,time));
    p.setState({currentTime:t,playing:resume});
    setProgress(t);
    setPlaying(resume);
  }
  function scrub(e){seek(Number(e.target.value),wasPlaying.current)}
  function beginScrub(){wasPlaying.current=playing; if(playing)setPlayback(false)}
  function endScrub(e){seek(Number(e.target.value),wasPlaying.current)}
  function nudge(delta){seek(progressRef.current+delta,false)}
  function changeSpeed(value){
    const next=Number(value);setSpeed(next);player.current?.setState({speed:next});
  }
  function fullscreen(){const el=viewport.current;if(!el)return;document.fullscreenElement?document.exitFullscreen():el.requestFullscreen?.()}
  function choose(id){
    selectedRef.current=id;
    setSelected(id);
    if(!id){
      setReplayBallCam(true);
      if(povBoostHudRef.current)povBoostHudRef.current.style.display="none";
      player.current?.setState({attachedPlayerId:null,cameraViewMode:"free"});
      return;
    }
    setReplayBallCam(true);
    player.current?.setState({attachedPlayerId:id,cameraViewMode:"follow",useReplayBallCam:true});
  }
  function choosePovSlot(slot){const entry=povSlotsRef.current[slot-1];if(!entry)return;if(flyModeRef.current)toggleFly();choose(entry.id)}
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
  function syncCoverageSettings(next){coverageRef.current=next;setCoverageSettings(next)}
  function toggleCoverage(){syncCoverageSettings({...coverageRef.current,enabled:!coverageRef.current.enabled})}
  function toggleCoverageTeam(team){syncCoverageSettings({...coverageRef.current,[team]:!coverageRef.current[team]})}
  function toggleCoveragePlayer(id){syncCoverageSettings({...coverageRef.current,players:{...coverageRef.current.players,[id]:!coverageRef.current.players[id]}})}
  function resetCoveragePlayers(roster){const players={};roster.forEach(x=>{players[x.id]=true});coverageRosterRef.current=roster;syncCoverageSettings({...coverageRef.current,players})}

  function resizeDrawing(){const c=drawCanvas.current,v=viewport.current;if(!c||!v)return;const r=v.getBoundingClientRect(),d=window.devicePixelRatio||1;c.width=Math.max(1,Math.round(r.width*d));c.height=Math.max(1,Math.round(r.height*d));c.style.width=r.width+"px";c.style.height=r.height+"px";c.getContext("2d").setTransform(d,0,0,d,0,0);redraw()}
  function redraw(){const c=drawCanvas.current,v=viewport.current;if(!c||!v)return;const ctx=c.getContext("2d"),r=v.getBoundingClientRect();ctx.clearRect(0,0,r.width,r.height);for(const st of drawHistory.current){ctx.save();ctx.globalCompositeOperation=st.tool==="erase"?"destination-out":"source-over";ctx.strokeStyle=st.color;ctx.lineWidth=st.width;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();st.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.restore()}}
  function drawSegment(st,from,to){const c=drawCanvas.current;if(!c)return;const ctx=c.getContext("2d");ctx.save();ctx.globalCompositeOperation=st.tool==="erase"?"destination-out":"source-over";ctx.strokeStyle=st.color;ctx.lineWidth=st.width;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.restore()}
  function startDraw(e){if(!drawMode)return;drawing.current=true;const r=drawCanvas.current.getBoundingClientRect();drawHistory.current.push({tool:drawTool,color:drawColor,width:drawThickness,points:[{x:e.clientX-r.left,y:e.clientY-r.top}]});drawRedo.current=[]}
  function moveDraw(e){if(!drawing.current)return;const r=drawCanvas.current.getBoundingClientRect(),st=drawHistory.current.at(-1);const point={x:e.clientX-r.left,y:e.clientY-r.top};const previous=st.points.at(-1);st.points.push(point);drawSegment(st,previous,point)}
  function endDraw(e){drawing.current=false;try{e?.currentTarget?.releasePointerCapture?.(e.pointerId)}catch{}}
  function clearDraw(){drawing.current=false;drawHistory.current=[];drawRedo.current=[];redraw()}
  function exitDraw(){clearDraw();setDrawMode(false);const p=player.current;if(p?.controls)p.controls.enabled=!flyModeRef.current}
  function toggleDraw(){if(drawModeRef.current){exitDraw();return}setDrawMode(true);const p=player.current;if(p?.controls)p.controls.enabled=false}
  function handleDrawPointerDown(e){if(!drawMode)return;e.currentTarget.setPointerCapture?.(e.pointerId);startDraw(e)}
  function handleDrawPointerMove(e){if(drawMode)moveDraw(e)}
  function undoDraw(){if(drawHistory.current.length){drawRedo.current.push(drawHistory.current.pop());redraw()}}
  function redoDraw(){if(drawRedo.current.length){drawHistory.current.push(drawRedo.current.pop());redraw()}}
  function cameraPose(position,target,up=[0,1,0],fov=48){const p=player.current;if(!p)return;p.setState({attachedPlayerId:null,cameraViewMode:"free"});const c=p.camera;c.position.set(...position);c.up.set(...up);c.fov=fov;c.updateProjectionMatrix();c.lookAt(...target);p.controls.target.set(...target);p.controls.update();setSelected("");selectedRef.current="";if(povBoostHudRef.current)povBoostHudRef.current.style.display="none";setCameraMode("free");flyModeRef.current=false}
  function builtInCamera(v){setCameraPreset(v);if(v==="blue-goal")cameraPose([0,1800,-6900],[0,650,0]);else if(v==="orange-goal")cameraPose([0,1800,6900],[0,650,0]);else if(v==="top")cameraPose([0,9000,0],[0,0,0],[-1,0,0],50);else if(v==="side")cameraPose([7200,2200,0],[0,500,0],[0,1,0],58)}
  function saveCamera(){const p=player.current;if(!p)return;const name=window.prompt("Name this camera preset:");if(!name?.trim())return;const c=p.camera,item={id:crypto.randomUUID(),name:name.trim(),position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov};const next=[...customCameras,item];setCustomCameras(next);localStorage.setItem(CAMERA_STORAGE,JSON.stringify(next));setCameraPreset("custom:"+item.id)}
  function loadCustomCamera(id){const item=customCameras.find(x=>x.id===id),p=player.current;if(!item||!p)return;p.setState({attachedPlayerId:null,cameraViewMode:"free"});p.camera.position.fromArray(item.position);p.camera.quaternion.fromArray(item.quaternion);p.camera.fov=item.fov||48;p.camera.updateProjectionMatrix();p.controls.enabled=true;setSelected("");selectedRef.current="";if(povBoostHudRef.current)povBoostHudRef.current.style.display="none";setCameraMode("free")}
  function deleteCustomCamera(id){const next=customCameras.filter(x=>x.id!==id);setCustomCameras(next);localStorage.setItem(CAMERA_STORAGE,JSON.stringify(next));if(cameraPreset==="custom:"+id)setCameraPreset("")}
  function startFlyLoop(){if(flyFrame.current)return;const forward=new THREE.Vector3(),right=new THREE.Vector3();const tick=(now)=>{const p=player.current;if(!p||!flyModeRef.current){flyFrame.current=null;return}const dt=Math.min(.05,(now-flyState.current.last)/1000);flyState.current.last=now;const c=p.camera,spd=1400;forward.set(0,0,-1).applyQuaternion(c.quaternion);right.set(1,0,0).applyQuaternion(c.quaternion);if(flyKeys.current.has("KeyW"))c.position.addScaledVector(forward,spd*dt);if(flyKeys.current.has("KeyS"))c.position.addScaledVector(forward,-spd*dt);if(flyKeys.current.has("KeyD"))c.position.addScaledVector(right,spd*dt);if(flyKeys.current.has("KeyA"))c.position.addScaledVector(right,-spd*dt);if(flyKeys.current.has("ShiftLeft")||flyKeys.current.has("ShiftRight"))c.position.y+=1400*dt;if(flyKeys.current.has("ControlLeft")||flyKeys.current.has("ControlRight"))c.position.y-=1400*dt;p.controls.target.copy(c.position).addScaledVector(forward,1000);flyFrame.current=requestAnimationFrame(tick)};flyFrame.current=requestAnimationFrame(tick)}
  function toggleFly(){const p=player.current;if(!p)return;const next=!flyModeRef.current;flyModeRef.current=next;setCameraMode(next?"fly":"free");p.setState({attachedPlayerId:null,cameraViewMode:"free"});p.controls.enabled=!next&&!drawModeRef.current;flyLook.current={active:false,x:0,y:0};if(next){const e=new THREE.Euler().setFromQuaternion(p.camera.quaternion,"YXZ");flyState.current={yaw:e.y,pitch:e.x,last:performance.now()};flyKeys.current.clear();startFlyLoop()}else{flyKeys.current.clear();if(flyFrame.current){cancelAnimationFrame(flyFrame.current);flyFrame.current=null}}}
  function flyPointerDown(e){
    if(!flyModeRef.current||drawModeRef.current||e.button!==0)return;
    flyLook.current={active:true,x:e.clientX,y:e.clientY};
    document.body.style.cursor="grabbing";
    e.preventDefault();
    e.stopPropagation();
  }
  function flyPointerMove(e){
    if(!flyModeRef.current||!flyLook.current.active)return;
    const s=flyState.current;
    s.yaw-=(e.clientX-flyLook.current.x)*.002;
    s.pitch=Math.max(-1.45,Math.min(1.45,s.pitch-(e.clientY-flyLook.current.y)*.002));
    flyLook.current.x=e.clientX;
    flyLook.current.y=e.clientY;
    player.current?.camera.rotation.set(s.pitch,s.yaw,0,"YXZ");
    e.preventDefault();
  }
  function flyPointerUp(e){
    flyLook.current.active=false;
    try{e?.currentTarget?.releasePointerCapture?.(e.pointerId)}catch{}
    document.body.style.cursor="";
  }
  useEffect(()=>{
    function key(e){
      if(!loadedRef.current)return;
      if(/^Digit[1-6]$/.test(e.code)){const slot=Number(e.code.slice(5));if(povSlots[slot-1]){e.preventDefault();e.stopPropagation();choosePovSlot(slot)}return;}
      if(e.code==="Space"){e.preventDefault();e.stopPropagation();togglePlay();return;}
      const tag=e.target?.tagName;
      const editable=e.target?.isContentEditable||tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT";
      if(editable)return;
      else if(e.code==="KeyV"){e.preventDefault();toggleDraw()}
      else if(e.code==="KeyF"){e.preventDefault();toggleFly()}
      else if(e.key==="?"){e.preventDefault();setShortcutsOpen(v=>!v)}
      else if(flyModeRef.current&&["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","ControlLeft","ControlRight"].includes(e.code)){e.preventDefault();return}
      else if(e.code==="Escape"){if(flyModeRef.current){e.preventDefault();toggleFly()}else if(drawModeRef.current){e.preventDefault();exitDraw()}else if(shortcutsOpenRef.current){e.preventDefault();setShortcutsOpen(false)}}
      else if(e.code==="KeyH"){e.preventDefault();toggleControls()}
      else if(e.code==="ArrowLeft"){e.preventDefault();nudge(e.shiftKey?-1:-0.1)}
      else if(e.code==="ArrowRight"){e.preventDefault();nudge(e.shiftKey?1:0.1)}
      else if(e.code==="Home"){e.preventDefault();seek(0,false)}
      else if(e.code==="End"){e.preventDefault();seek(duration,false)}
    }
    window.addEventListener("keydown",key);
    return()=>window.removeEventListener("keydown",key);
  },[]);

  useEffect(()=>{const down=e=>{if(flyModeRef.current&&["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","ControlLeft","ControlRight"].includes(e.code)){e.preventDefault();flyKeys.current.add(e.code)}};const up=e=>flyKeys.current.delete(e.code);const clear=()=>{flyKeys.current.clear();flyLook.current.active=false};window.addEventListener("keydown",down,true);window.addEventListener("keyup",up,true);window.addEventListener("blur",clear);document.addEventListener("visibilitychange",clear);return()=>{window.removeEventListener("keydown",down,true);window.removeEventListener("keyup",up,true);window.removeEventListener("blur",clear);document.removeEventListener("visibilitychange",clear)}},[]);
  useEffect(()=>{drawModeRef.current=drawMode;const p=player.current;if(p?.controls)p.controls.enabled=!drawMode&&!flyModeRef.current},[drawMode,cameraMode,loaded]);
  useEffect(()=>{const el=controlsRef.current;if(!el||!controlsVisible||drawMode){if(drawMode||!controlsVisible)setControlsHeight(0);return}const update=()=>setControlsHeight(el.offsetHeight);update();const ro=new ResizeObserver(update);ro.observe(el);return()=>ro.disconnect()},[controlsVisible,drawMode,loaded]);
  useEffect(()=>{
    const canvas=player.current?.renderer?.domElement;
    if(!canvas||!loaded)return;
    canvas.classList.add("flyCamCanvas");
    canvas.style.touchAction="none";
    canvas.style.cursor=flyModeRef.current?"grab":"default";
    const down=e=>{
      if(!flyModeRef.current||drawModeRef.current||e.button!==0)return;
      const path=e.composedPath?.()||[];
      if(e.target!==canvas&&!path.includes(canvas))return;
      flyPointerDown(e);
    };
    const move=e=>{
      if(!flyLook.current.active)return;
      flyPointerMove(e);
    };
    const up=e=>{
      if(!flyLook.current.active)return;
      flyPointerUp(e);
    };
    window.addEventListener("pointerdown",down,true);
    window.addEventListener("pointermove",move,true);
    window.addEventListener("pointerup",up,true);
    window.addEventListener("pointercancel",up,true);
    return()=>{
      window.removeEventListener("pointerdown",down,true);
      window.removeEventListener("pointermove",move,true);
      window.removeEventListener("pointerup",up,true);
      window.removeEventListener("pointercancel",up,true);
      canvas.classList.remove("flyCamCanvas");
      canvas.style.touchAction="";
      canvas.style.cursor="";
      document.body.style.cursor="";
      flyLook.current.active=false;
    };
  },[loaded,cameraMode]);

  useEffect(()=>{resizeDrawing();const ro=new ResizeObserver(resizeDrawing);if(viewport.current)ro.observe(viewport.current);window.addEventListener("resize",resizeDrawing);return()=>{ro.disconnect();window.removeEventListener("resize",resizeDrawing)}},[loaded]);

  async function loadReplay(file){
    if(!file?.name.toLowerCase().endsWith(".replay")){setStatus("Please choose a .replay file.");return}
    const loadId=++replayLoadRef.current;
    try{
      setStatus("Loading replay…");setLoaded(false);loadedRef.current=false;setPlaying(false);playingRef.current=false;setProgress(0);progressRef.current=0;setDuration(0);durationRef.current=0;setReplayBallCam(true);
      player.current?.dispose?.();player.current=null;host.current?.replaceChildren();
      const bytes=new Uint8Array(await file.arrayBuffer());
      const {createPlayer,createNameTagPlugin,createScoredTextPlugin}=await import("@rlrml/player");
      const p=await createPlayer(host.current,bytes,{assetBase:ASSETS,autoplay:false,effects:true,environment:false,motionInterpolation:"linear",initialSkipPostGoalTransitionsEnabled:true,plugins:createReplayPlugins({createNameTagPlugin,createScoredTextPlugin,nameplateScaleRef,povBoostHudRef,selectedRef,coverageRef})});
      if(loadId!==replayLoadRef.current){p.dispose?.();return}
      player.current=p;
      const renderer=p.renderer;
      renderer?.setPixelRatio?.(1);
      if(renderer?.shadowMap)renderer.shadowMap.enabled=false;
      const uiState={time:-1,playing:null,duration:null,ballCam:null,replayBallCam:null,speed:null};
      p.subscribe?.(s=>{
        const time=s.currentTime||0;
        const playing=!!s.playing;
        const durationValue=s.duration||0;
        const ballCamValue=!!s.ballCamEnabled;
        const replayBallCamValue=s.useReplayBallCam!==false;
        const speedValue=s.speed||1;
        if(uiState.playing!==playing){uiState.playing=playing;setPlaying(playing)}
        if(uiState.duration!==durationValue){uiState.duration=durationValue;setDuration(durationValue)}
        if(uiState.ballCam!==ballCamValue){uiState.ballCam=ballCamValue;setBallCam(ballCamValue);setRecordedBallCam(ballCamValue)}
        if(uiState.replayBallCam!==replayBallCamValue){uiState.replayBallCam=replayBallCamValue;setReplayBallCam(replayBallCamValue)}
        if(uiState.speed!==speedValue){uiState.speed=speedValue;setSpeed(speedValue)}
        if(Math.abs(time-uiState.time)>=0.05||!playing){uiState.time=time;setProgress(time)}
      });
      const replayRoster=Array.isArray(p.replay?.players)?p.replay.players:[];
      const adapterRoster=typeof p.adapter?.getAllPlayers==="function"?p.adapter.getAllPlayers():[];
      const sourceRoster=replayRoster.length?replayRoster:adapterRoster;
      const mapped=sourceRoster.map((x,index)=>{
        const team=Number.isFinite(Number(x.team))?Number(x.team):(x.isTeamZero?0:1);
        return {id:String(x.id),name:x.name||"Player",team,index};
      });
      const blue=mapped.filter(x=>x.team===0).sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base"})||a.index-b.index);
      const orange=mapped.filter(x=>x.team===1).sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base"})||a.index-b.index);
      const slots=[...blue.slice(0,3),...orange.slice(0,3)];
      setPlayers(mapped.map(x=>({id:x.id,name:x.name})));
      setPovSlots(slots);
      resetCoveragePlayers(mapped);
      selectedRef.current="";setSelected("");
      setEvents((p.replay?.timelineEvents||[]).filter(e=>["goal","shot","save","demo","demolition"].includes(e.kind)).map((e,i)=>({id:i,time:e.time,kind:e.kind,player:e.playerName||""})));
      setLoaded(true);loadedRef.current=true;setStatus(file.name);
    }catch(err){console.error(err);if(loadId===replayLoadRef.current){setStatus("Could not load this replay.");setLoaded(false);}}
  }
  function drop(e){e.preventDefault();loadReplay(e.dataTransfer.files?.[0])}

  return <main className="app">
    <header><div><h1>RL Replay Viewer</h1><span>Season 24 browser playback</span></div><label className="fileButton">Open replay<input type="file" accept=".replay" onChange={e=>loadReplay(e.target.files?.[0])}/></label></header>
    <section className="viewer" ref={viewport} onDragOver={e=>e.preventDefault()} onDrop={drop}>
      <div className="playerHost" ref={host}/><canvas ref={drawCanvas} className={"drawCanvas "+(drawMode?"active":"")} onPointerDown={handleDrawPointerDown} onPointerMove={handleDrawPointerMove} onPointerUp={endDraw} onPointerCancel={endDraw}/>
      {!loaded&&<div className="drop"><strong>{status}</strong><small>Drag a Rocket League .replay file here, or use Open replay.</small></div>}
      {loaded&&<div className="hud"><div ref={povBoostHudRef} className="povBoostHud"><div className="povBoostValue">0</div><div className="povBoostLabel">BOOST</div></div>
        <div className="top"><span>{status}</span><span>{duration?format(progress)+" / "+format(duration):""}</span></div>
        <div className="utilityButtons"><button className="controlsToggle" onClick={toggleControls}>{controlsVisible?"Hide controls":"Show controls"}</button><button className={"controlsToggle "+(coverageSettings.enabled?"active":"")} onClick={()=>setCoverageOpen(v=>!v)}>Coverage</button><button className="controlsToggle" onClick={()=>setShortcutsOpen(v=>!v)}>⌨ Shortcuts</button></div>
        {coverageOpen&&<div className="coveragePanel">
          <div className="coverageHeader"><strong>Coverage</strong><button onClick={toggleCoverage}>{coverageSettings.enabled?"ON":"OFF"}</button></div>
          <div className="coverageTeams">
            {["blue","orange"].map(team=><div key={team} className="coverageTeam">
              <button className={"coverageTeamToggle "+team+(coverageSettings[team]?" on":"")} onClick={()=>toggleCoverageTeam(team)}>{team==="blue"?"Blue":"Orange"}</button>
              <div className="coveragePlayers">{coverageRosterRef.current.filter(p=>p.team===(team==="blue"?0:1)).slice(0,3).map(p=><button key={p.id} className={"coveragePlayer "+team+(coverageSettings.players[p.id]!==false?" on":"")} onClick={()=>toggleCoveragePlayer(p.id)} title={p.name}>{p.name}</button>)}</div>
            </div>)}
          </div>
          <label className="coverageOpacity">Opacity <input type="range" min="0.10" max="0.70" step="0.05" value={coverageSettings.opacity} onChange={e=>syncCoverageSettings({...coverageRef.current,opacity:Number(e.target.value)})}/><span>{Math.round(coverageSettings.opacity*100)}%</span></label><div className="coverageHint">110° · 1900 UU · follows car direction</div>
        </div>}
        {shortcutsOpen&&<div className="shortcutsPanel"><div className="shortcutsHeader"><strong>Keyboard Shortcuts</strong><button onClick={()=>setShortcutsOpen(false)}>Close</button></div><div className="shortcutGrid"><div><h3>Playback</h3><p><kbd>Space</kbd><span>Play / Pause</span></p><p><kbd>←</kbd> <kbd>→</kbd><span>Seek ±0.1 sec</span></p><p><kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd><span>Seek ±1 sec</span></p><p><kbd>Home</kbd><span>Go to beginning</span></p><p><kbd>End</kbd><span>Go to end</span></p><h3>Viewer</h3><p><kbd>V</kbd><span>Toggle drawing mode</span></p><p><kbd>F</kbd><span>Toggle Fly Cam</span></p></div><div><h3>Fly Cam</h3><p><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd><span>Move</span></p><p><kbd>Shift</kbd><span>Move up</span></p><p><kbd>Ctrl</kbd><span>Move down</span></p><p><kbd>Mouse</kbd><span>Look around</span></p><p><kbd>Esc</kbd><span>Exit Fly Cam / close active mode</span></p><h3>Interface</h3><p><kbd>H</kbd><span>Hide / Show controls</span></p><p><kbd>?</kbd><span>Open / Close shortcuts</span></p></div></div></div>}
        <div className="povBar" style={{bottom:controlsVisible&&!drawMode?`${controlsHeight+18}px`:"12px"}} aria-label="Player POV shortcuts">{povSlots.map((p,i)=><button key={p.id} className={"povSlot "+(p.team===0?"blue":"orange")+" "+(selected===p.id?"active":"")} onClick={()=>choosePovSlot(i+1)} title={p.name+" POV"}><kbd>{i+1}</kbd><span>{p.name}</span></button>)}</div>
        {controlsVisible&&!drawMode&&<div ref={controlsRef} className="controls">
          <div className="timeline">
            <button className="step" onClick={()=>nudge(-0.1)}>−0.1</button><div className="timelineTrack"><input aria-label="Replay timeline" type="range" min="0" max={duration||0} step="0.01" value={Math.min(progress,duration||0)} onPointerDown={beginScrub} onChange={scrub} onPointerUp={endScrub}/>{events.map(e=><button key={e.id} className={"eventMarker "+e.kind} style={{left:(duration?e.time/duration*100:0)+"%"}} title={e.kind+(e.player?" · "+e.player:"")+" · "+format(e.time)} onClick={()=>seek(e.time,false)}>{e.kind==="goal"?"⚽":e.kind==="shot"?"◉":e.kind==="save"?"🛡":"💥"}</button>)}</div><button className="step" onClick={()=>nudge(0.1)}>+0.1</button>
          </div>
          <div className="bottom">
            <button onClick={togglePlay}>{playing?"Pause":"Play"}</button>
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
            <button onClick={toggleFly}>{cameraMode==="fly"?"Exit Fly Cam":"Fly Cam"}</button><button onClick={saveCamera} disabled={cameraMode!=="fly"}>Save Camera</button>
            {cameraPreset.startsWith("custom:")&&<button onClick={()=>deleteCustomCamera(cameraPreset.slice(7))}>Delete Camera</button>}
            <label className="nameplateControl">Names
              <input type="range" min="0.75" max="3" step="0.05" value={nameplateScale} onChange={e=>changeNameplateScale(e.target.value)} aria-label="Nameplate size"/>
              <span>{nameplateScale.toFixed(2)}×</span>
            </label>
            <button onClick={toggleDraw}>Draw</button>
            <button onClick={fullscreen}>Fullscreen</button>
          </div>
          <div className="hints">Press <b>?</b> for shortcuts · <b>Space</b> Play/Pause · <b>V</b> Draw · <b>F</b> Fly Cam</div>
        </div>}
          {drawMode&&<div className="drawSettings">
            <div className="drawSettingsHeader"><strong>Draw Settings</strong><button onClick={exitDraw}>Exit Draw</button></div>
            <div className="drawColors" aria-label="Marker color">
              {[["#ef4444","Red"],["#3b82f6","Blue"],["#ec4899","Pink"],["#22c55e","Green"]].map(([color,label])=><button key={color} className={"drawColor "+(drawColor===color?"selected":"")} style={{background:color}} title={label} aria-label={label+" marker color"} onClick={()=>{setDrawColor(color);setDrawTool("pen")}} />)}
            </div>
            <label className="drawSize">Size<input type="range" min="1" max="20" value={drawThickness} onChange={e=>setDrawThickness(Number(e.target.value))}/><span>{drawThickness}px</span></label>
            <div className="drawActions"><button onClick={undoDraw}>Undo</button><button onClick={redoDraw}>Redo</button><button onClick={clearDraw}>Clear</button></div>
          </div>}
      </div>}
    </section>
    <footer>Runs entirely in your browser. Replay data is not uploaded.</footer>
  </main>
}
function format(t){const total=Math.max(0,t);const m=Math.floor(total/60);const s=Math.floor(total%60);const cs=Math.floor((total%1)*100);return m+":"+String(s).padStart(2,"0")+"."+String(cs).padStart(2,"0")}
createRoot(document.getElementById("root")).render(<App/>);