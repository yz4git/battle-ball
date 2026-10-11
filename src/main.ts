import * as T from 'three';
import {Match,W,L,K} from './game';
import './style.css';
const el=(id:string)=>document.getElementById(id)!;
const game=new Match();
const renderer=new T.WebGLRenderer({canvas:el('court') as HTMLCanvasElement,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(0xb9d6d9);
const scene=new T.Scene();scene.fog=new T.Fog(0xb9d6d9,30,65);
const camera=new T.PerspectiveCamera(44,1,.1,100);
scene.add(new T.HemisphereLight(0xe2f4ff,0x55705a,2.1));const sun=new T.DirectionalLight(0xffebcf,3);sun.position.set(-9,17,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-15,right:15,top:17,bottom:-17});sun.shadow.bias=-.001;scene.add(sun);
const mat=(color:number,roughness=.8)=>new T.MeshStandardMaterial({color,roughness});
const teal=mat(0x276b79),kitchen=mat(0x50928e),white=mat(0xf4f1db),dark=mat(0x17353c),skin=mat(0xd49c74),grass=mat(0x78926b);
function box(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,parent:T.Object3D=scene){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=h>.1;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function sphere(r:number,x:number,y:number,z:number,m:T.Material,parent:T.Object3D=scene){const mesh=new T.Mesh(new T.SphereGeometry(r,16,10),m);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
box(90,.2,90,0,-.25,0,grass);box(12,.12,20,0,-.09,0,mat(0xa4b7a5));box(W*2,.06,L*2,0,0,0,teal);box(W*2,.012,K*2,0,.036,0,kitchen);
for(const x of [-W,W])box(.045,.015,L*2,x,.05,0,white);
for(const z of [-L,-K,K,L])box(W*2,.015,.045,0,.05,z,white);
for(const s of [-1,1])box(.045,.015,L-K,0,.05,s*(L+K)/2,white);
// Fine geometric net: visible holes, white tape, metal posts.
for(const x of [-W-.18,W+.18])box(.075,1.1,.075,x,.55,0,dark);
for(let x=-W;x<=W;x+=.13)box(.011,.87,.011,x,.48,0,dark);
for(let y=.08;y<=.92;y+=.11)box(W*2,.012,.011,0,y,0,dark);
box(W*2+.35,.045,.045,0,.94,0,white);
// Fenced park with benches, planted trees and a pavilion.
for(const x of [-7,7]){for(let z=-13;z<=13;z+=2)box(.07,2.1,.07,x,1.05,z,dark);for(const y of [.4,1.2,2])box(.03,.025,26,x,y,0,dark);}
for(let i=0;i<18;i++){const x=(i%2?1:-1)*(9+(i%3)*2),z=-17+Math.floor(i/2)*4;box(.25,2,.25,x,1,z,mat(0x72644e));const crown=sphere(1.35,x,2.6,z,mat(i%3===0?0x718961:0x567d65));crown.scale.y=1.5;}
for(const z of [-8,0,8]){box(1.2,.12,2.4,-5,.55,z,mat(0xb48c60));box(.1,.55,.15,-5.4,.25,z-.8,dark);box(.1,.55,.15,-4.6,.25,z+.8,dark);box(.12,.7,2.4,-5.5,.8,z,mat(0xb48c60));}
box(7,.25,3,0,3.5,-12,white);for(const x of [-3,3])box(.15,3.5,.15,x,1.7,-12,dark);
function athlete(color:number,other:boolean){const root=new T.Group();scene.add(root);const shirt=mat(color);const body=box(.55,.67,.32,0,1.13,0,shirt,root);sphere(.21,0,1.7,0,skin,root);const cap=sphere(.22,0,1.8,0,white,root);cap.scale.y=.4;box(.35,.025,.25,0,1.8,other?.19:-.19,white,root);box(.48,.22,.34,0,.7,0,dark,root);
const legs=[new T.Group(),new T.Group()];legs.forEach((g,i)=>{g.position.set(i===0?-.16:.16,.64,0);root.add(g);box(.14,.43,.15,0,-.22,0,skin,g);box(.18,.16,.3,0,-.51,-.045,white,g);});
const arm=new T.Group();arm.position.set(.31,1.35,0);root.add(arm);box(.13,.5,.14,0,-.25,0,skin,arm);box(.07,.3,.07,0,-.54,-.03,dark,arm);const paddle=box(.32,.4,.065,0,-.77,-.03,mat(0x182c36),arm);paddle.rotation.z=.08;box(.26,.33,.07,0,-.77,-.03,mat(other?0xffb75f:0xcaf55c),arm);box(.13,.46,.14,-.34,1.08,0,skin,root);return {root,legs,arm,body};}
const people=[athlete(0x4595dc,false),athlete(0xf18f56,true)];
const ball=sphere(.105,0,1,0,mat(0xd7fa40));for(let i=0;i<8;i++){const a=i*Math.PI/4;const hole=sphere(.025,Math.cos(a)*.09,Math.sin(a)*.09,.055,dark,ball);hole.castShadow=false;}
const shadow=new T.Mesh(new T.CircleGeometry(.15,24),new T.MeshBasicMaterial({color:0x102e39,transparent:true,opacity:.35}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
const marker=new T.Mesh(new T.RingGeometry(.26,.32,32),new T.MeshBasicMaterial({color:0xe7ff8b,side:T.DoubleSide,transparent:true,opacity:.7}));marker.rotation.x=-Math.PI/2;scene.add(marker);
const trail: T.Mesh[]=[];for(let i=0;i<8;i++){const m=sphere(.065,0,-10,0,new T.MeshBasicMaterial({color:0xe1fa7a,transparent:true,opacity:.25*(1-i/8)}));m.castShadow=false;trail.push(m);}
let audio:AudioContext|undefined;let muted=false;function sound(name:string){if(!audio||muted)return;const o=audio.createOscillator(),g=audio.createGain();o.type=name==='hit'?'triangle':'sine';o.frequency.setValueAtTime(name==='hit'?740:name==='bounce'?370:520,audio.currentTime);o.frequency.exponentialRampToValueAtTime(130,audio.currentTime+.09);g.gain.setValueAtTime(.07,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.13);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.14);}game.event=sound;
let active=false,paused=false,mx=0,mz=0,queue=0,lob=false,stickId:number|null=null;const keys=new Set<string>();
function inputShot(high:boolean){if(!active||paused)return;lob=high;queue=.42;game.hit(0,lob,mx,-mz);if(game.last===0&&game.phase==='rally')queue=0;}
for(const [id,high] of [['hit',false],['lob',true]] as const){el(id).addEventListener('pointerdown',e=>{e.preventDefault();el(id).setPointerCapture(e.pointerId);inputShot(high);});}
const stick=el('stick');function stickMove(e:PointerEvent){const r=stick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/(r.width*.34),dy=(e.clientY-r.top-r.height/2)/(r.height*.34),len=Math.max(1,Math.hypot(dx,dy));mx=dx/len;mz=dy/len;el('knob').style.transform=`translate(${mx*32}px,${mz*32}px)`;}
stick.addEventListener('pointerdown',e=>{if(stickId!==null)return;stickId=e.pointerId;stick.setPointerCapture(e.pointerId);stickMove(e);});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)stickMove(e);});function release(e:PointerEvent){if(e.pointerId!==stickId)return;stickId=null;mx=mz=0;el('knob').style.transform='';}stick.addEventListener('pointerup',release);stick.addEventListener('pointercancel',release);
function clear(){keys.clear();mx=mz=queue=0;stickId=null;el('knob').style.transform='';}
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(!e.repeat&&['j','k',' '].includes(e.key.toLowerCase()))inputShot(e.key.toLowerCase()==='k');if(e.key==='Escape')togglePause();});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function togglePause(){if(!active)return;paused=!paused;clear();el('overlay').hidden=!paused;el('start').textContent=paused?'試合を再開 →':'コートに入る →';}
el('pause').onclick=togglePause;document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!paused)togglePause();});window.addEventListener('blur',clear);
el('help').onclick=()=>{el('rules').hidden=!el('rules').hidden;};
el('start').onclick=()=>{audio??=new AudioContext();void audio.resume();if(!active||game.phase==='over'){game.difficulty=Number((el('difficulty') as HTMLSelectElement).value);game.assist=(el('assist') as HTMLSelectElement).value==='on';game.reset();active=true;}paused=false;clear();el('overlay').hidden=true;};
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.position.set(0,w>h?12:17,w>h?16:22);camera.lookAt(0,0,w>h?1:1.5);camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();
let prev=performance.now(),acc=0,time=0;const prior=[{x:0,z:0},{x:0,z:0}];
function frame(now:number){requestAnimationFrame(frame);const dt=Math.min(.05,(now-prev)/1000);prev=now;time+=dt;
 if(active&&!paused){acc+=dt;while(acc>=1/120){let x=mx,z=mz;if(keys.size){x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));z=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));}game.step(1/120,x,z);if(queue>0){queue-=1/120;if(game.hit(0,lob,x,-z))queue=0;}acc-=1/120;}if(game.phase==='over'){el('overlay').hidden=false;el('start').textContent='もう一度プレイ →';el('overlay').querySelector('h1')!.innerHTML=game.message+`<span>${game.score[0]} – ${game.score[1]} · 最長ラリー ${game.best}</span>`;}}
 for(let i=0;i<2;i++){const p=game.players[i],a=people[i],moving=Math.hypot(p.x-prior[i].x,p.z-prior[i].z)>.001;a.root.position.set(p.x,0,p.z);a.root.rotation.y=i===0?0:Math.PI;a.legs.forEach((leg,j)=>leg.rotation.x=moving?Math.sin(time*15+j*Math.PI)*.5:0);a.arm.rotation.x=-.3-Math.sin(p.swing*Math.PI)*1.9;a.body.rotation.z=Math.sin(p.swing*Math.PI)*.12;prior[i]={x:p.x,z:p.z};}
 const b=game.ball;ball.position.set(b.x,b.y,b.z);ball.rotation.x+=dt*8;shadow.position.set(b.x,.068,b.z);shadow.scale.setScalar(1+b.y*.2);const land=game.landing();marker.visible=game.phase==='rally'&&game.last===1;marker.position.set(land.x,.071,land.z);marker.scale.setScalar(1+Math.sin(time*6)*.12);
 for(let i=trail.length-1;i>0;i--)trail[i].position.copy(trail[i-1].position);trail[0].position.copy(ball.position);trail.forEach(t=>t.visible=game.phase==='rally');
 el('you').textContent=String(game.score[0]);el('cpu').textContent=String(game.score[1]);el('status').textContent=active?game.message:'PARK COURT / AFTERNOON';el('rally').textContent=active?`${game.server===0?'● YOU SERVE':'● CPU SERVE'}  ·  RALLY ${game.rally}`:'';el('hit').classList.toggle('ready',game.phase==='serve'&&game.server===0||game.phase==='rally'&&game.last===1&&Math.hypot(b.x-game.players[0].x,b.z-game.players[0].z)<1.6&&b.y<2.1);renderer.render(scene,camera);}
requestAnimationFrame(frame);
document.addEventListener('gesturestart',e=>e.preventDefault());document.addEventListener('contextmenu',e=>e.preventDefault());
if('serviceWorker' in navigator){void navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>void r.unregister()));}
