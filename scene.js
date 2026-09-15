import * as THREE from './vendor/three.module.js';
const holder=document.querySelector('#scene');
export function createFarm(){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#cde4d0');scene.fog=new THREE.Fog('#cde4d0',28,65);
 const camera=new THREE.PerspectiveCamera(39,1,.1,100);const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;holder.append(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xfff8dc,0x547556,2.3));const sun=new THREE.DirectionalLight(0xfff4d4,3);sun.position.set(-6,14,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15});scene.add(sun);
 const materials=new Map();function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.88}));return materials.get(color)}
 const box=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,16,12),cone=new THREE.ConeGeometry(1,1,12);
 function mesh(parent,geo,color,pos,scale){const m=new THREE.Mesh(geo,mat(color));m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 mesh(scene,box,'#86aa59',[0,-.6,0],[17,1.1,14]);mesh(scene,box,'#bbcca0',[0,-1.25,0],[17,.3,14]);
 // A small barn, garden and fence give the countable animals a stable spatial frame.
 mesh(scene,box,'#bc6040',[-5,1.2,-4],[3,2.5,2.5]);const roof=mesh(scene,cone,'#3c584b',[-5,3.1,-4],[2.4,1.6,2.4]);roof.rotation.y=Math.PI/4;
 mesh(scene,box,'#f8e7b5',[-5,.8,-2.73],[1.15,1.8,.1]);mesh(scene,box,'#416053',[-5,.8,-2.65],[.08,1.8,.1]);
 for(let x=-7;x<=7;x+=2){mesh(scene,box,'#f2d9a5',[x,.5,-6],[.15,1.3,.15]);}for(const y of [.3,.85])mesh(scene,box,'#f2d9a5',[0,y,-6],[14,.13,.13]);
 for(const [x,z] of [[6,-4],[7,3],[-7,3]]){mesh(scene,box,'#876343',[x,.8,z],[.3,1.8,.3]);mesh(scene,sphere,'#547844',[x,2.2,z],[1.1,1.2,1.1]);mesh(scene,sphere,'#6c9149',[x-.5,2.7,z],[.8,.9,.8]);}
 for(let i=0;i<12;i++){const x=-7+i*1.25;mesh(scene,sphere,'#e7bf63',[x,.07,6],[.12,.14,.12]);}
 const herd=new THREE.Group();scene.add(herd);let animals=[],angle=0,paused=false,celebrate=false,clock=0;
 function animal(kind){const g=new THREE.Group();const color={cat:'#dfaa63',rooster:'#d89843',donkey:'#8c9698',pig:'#eda5a2',horse:'#a87248',dog:'#ead4ad',goat:'#eee7cf',bull:'#745449'}[kind];
  if(kind==='rooster'){
   mesh(g,sphere,color,[0,.8,0],[.45,.6,.5]);mesh(g,sphere,'#f1cb69',[0,1.45,.18],[.27,.3,.27]);mesh(g,cone,'#e29b26',[0,1.4,.53],[.18,.3,.18]).rotation.x=Math.PI/2;
   for(let i=0;i<3;i++)mesh(g,sphere,'#b63e34',[0,1.73,.02+i*.12],[.09,.16,.1]);for(const x of [-.18,.18])mesh(g,box,'#b77a28',[x,.2,0],[.08,.4,.08]);for(let i=0;i<3;i++)mesh(g,sphere,'#315b43',[(i-1)*.14,1,-.5],[.12,.55,.18]);
  }else{
   mesh(g,sphere,color,[0,.72,0],[.48,.42,.7]);mesh(g,sphere,color,[0,1.12,.55],[.37,.38,.35]);
   for(const x of [-.3,.3])for(const z of [-.4,.4])mesh(g,box,color,[x,.3,z],[.17,.6,.18]);
   const long=['donkey','horse'].includes(kind);for(const x of [-.23,.23]){const ear=mesh(g,cone,color,[x,long?1.72:1.5,.5],[.17,long?.65:.3,.17]);ear.rotation.z=x*.7;}
   mesh(g,sphere,kind==='pig'?'#d47b83':color,[0,1.02,.82],[kind==='pig'?.27:.23,.2,.18]);
   if(['bull','goat'].includes(kind))for(const x of [-.38,.38]){const h=mesh(g,cone,'#f5ddb1',[x,1.53,.48],[.12,.5,.12]);h.rotation.z=-x*1.4;}
   if(kind==='goat')mesh(g,cone,'#e0d7ba',[0,.76,.77],[.12,.3,.12]).rotation.z=Math.PI;
   if(kind==='dog')for(const x of [-.36,.36])mesh(g,sphere,'#71523e',[x,1.12,.49],[.12,.3,.17]);
   mesh(g,sphere,color,[0,.95,-.73],[.09,.32,.09]).rotation.x=-.5;
  }
  const ey=kind==='rooster'?1.5:1.2,ex=kind==='rooster'?.16:.18,ez=kind==='rooster'?.4:.83;for(const x of [-ex,ex])mesh(g,sphere,'#24362f',[x,ey,ez],[.045,.06,.04]);return g;
 }
 function populate(kind,count){herd.clear();animals=[];const columns=Math.min(count,5),rows=Math.ceil(count/5);for(let i=0;i<count;i++){const g=animal(kind);const row=Math.floor(i/5),n=Math.min(5,count-row*5);g.position.set((i%5-(n-1)/2)*2,0,row*2.5-(rows-1)*1.25+.6);herd.add(g);animals.push(g)}celebrate=false;angle=0;positionCamera()}
 function positionCamera(){camera.position.set(Math.sin(angle)*19,13,Math.cos(angle)*19);camera.lookAt(0,.3,0)}
 function resize(){const {width,height}=holder.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix()}
 new ResizeObserver(resize).observe(holder);positionCamera();populate('pig',7);
 renderer.setAnimationLoop(()=>{if(document.hidden)return;if(!paused){clock+=.025;animals.forEach((a,i)=>{a.position.y=celebrate&&!matchMedia('(prefers-reduced-motion: reduce)').matches?Math.abs(Math.sin(clock*3+i*.3))*.45:0;});}renderer.render(scene,camera)});
 return {populate,rotate(d){angle=THREE.MathUtils.clamp(angle+d,-.55,.55);positionCamera()},resetView(){angle=0;positionCamera()},pause(v){paused=v},celebrate(){celebrate=true},stats(){return {animals:animals.length,geometries:renderer.info.memory.geometries,calls:renderer.info.render.calls}}};
}
