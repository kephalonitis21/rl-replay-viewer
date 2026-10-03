import * as THREE from "three";

export function createReplayPlugins({createNameTagPlugin,createScoredTextPlugin,nameplateScaleRef,povBoostHudRef,selectedRef,coverageRef}){
  const hideBallIndicatorPlugin=()=>({
    id:"hide-ball-ground-line",
    setup(ctx){ctx.player.ballVerticalLine&&(ctx.player.ballVerticalLine.visible=false)},
    beforeRender(ctx){ctx.player.ballVerticalLine&&(ctx.player.ballVerticalLine.visible=false)}
  });

  const nameplateScalePlugin=()=>{
    let lastScale=-1;
    return {
      id:"nameplate-scale",
      beforeRender(ctx){
        const sc=nameplateScaleRef.current;
        if(sc===lastScale)return;
        lastScale=sc;
        ctx.scene.traverse(obj=>{
          if(!obj.isSprite||obj.renderOrder!==999)return;
          const image=obj.material?.map?.image;
          if(image?.width===256&&image?.height===80){
            const base=obj.userData.__rlReplayNameplateBaseScale||(obj.userData.__rlReplayNameplateBaseScale=obj.scale.clone());
            obj.scale.set(base.x*sc,base.y*sc,base.z);
          }
        });
      }
    };
  };

  const povBoostPlugin=()=>{
    let value=null;
    return {
      id:"pov-boost-hud",
      beforeRender(ctx){
        const hud=povBoostHudRef.current;
        if(!hud)return;
        if(!value)value=hud.querySelector(".povBoostValue");
        const id=selectedRef.current;
        const car=id?ctx.cars.find(c=>c.id===id):null;
        if(!car){hud.style.display="none";return}
        const boost=Math.max(0,Math.min(100,Math.round(Number(car.boost)||0)));
        hud.style.display="flex";
        hud.style.setProperty("--boost",boost+"%");
        if(value)value.textContent=String(boost);
      }
    };
  };

  const coveragePlugin=()=>{
    const meshes=new Map();
    const yawCorrection=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
    const seen=new Set();

    const makeCone=ctx=>{
      const width=THREE.MathUtils.degToRad(110),range=1900,segments=24;
      const positions=new Float32Array((segments+2)*3);
      const indices=[];
      positions.set([0,0,0],0);
      for(let i=0;i<=segments;i++){
        const a=-width/2+(width*i/segments);
        const o=(i+1)*3;
        positions[o]=Math.sin(a)*range;
        positions[o+1]=0;
        positions[o+2]=Math.cos(a)*range;
        if(i<segments)indices.push(0,i+1,i+2);
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
      geometry.setIndex(indices);
      const material=new THREE.MeshBasicMaterial({
        color:0x3b82f6,
        transparent:true,
        opacity:.32,
        depthWrite:false,
        side:THREE.DoubleSide
      });
      const mesh=new THREE.Mesh(geometry,material);
      mesh.renderOrder=20;
      mesh.visible=false;
      ctx.scene.add(mesh);
      return mesh;
    };

    return {
      id:"coverage-cones",
      setup(){},
      beforeRender(ctx){
        const settings=coverageRef.current;
        seen.clear();
        for(const car of ctx.cars||[]){
          const id=String(car.id);
          seen.add(id);
          let mesh=meshes.get(id);
          if(!mesh){
            mesh=makeCone(ctx);
            meshes.set(id,mesh);
          }
          const team=Number(car.team)===0?"blue":"orange";
          const object=car.object3d;
          const visible=!!settings.enabled&&!!settings[team]&&settings.players[id]!==false&&!!object&&car.visible!==false;
          mesh.visible=visible;
          if(!visible)continue;
          object.getWorldPosition(mesh.position);
          object.getWorldQuaternion(mesh.quaternion);
          mesh.quaternion.multiply(yawCorrection);
          mesh.position.y+=1.5;
          mesh.material.color.set(team==="blue"?0x3b82f6:0xf59e0b);
          mesh.material.opacity=settings.opacity??.32;
        }
        for(const [id,mesh] of meshes){
          if(!seen.has(id))mesh.visible=false;
        }
      },
      teardown(ctx){
        for(const mesh of meshes.values()){
          mesh.geometry.dispose();
          mesh.material.dispose();
          ctx.scene.remove(mesh);
        }
        meshes.clear();
      }
    };
  };

  return [
    createNameTagPlugin(),
    nameplateScalePlugin(),
    hideBallIndicatorPlugin(),
    povBoostPlugin(),
    coveragePlugin(),
    createScoredTextPlugin()
  ];
}
