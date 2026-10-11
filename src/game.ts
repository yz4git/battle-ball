export const W=3.048,L=6.706,K=2.134,G=9.81;
export type Side=0|1;
export class Match {
 players=[{x:1.5,z:7.3,swing:0},{x:-1.5,z:-5.5,swing:0}]; ball={x:1.5,y:.7,z:7.3,vx:0,vy:0,vz:0};
 score=[0,0]; server:Side=0; last:Side=0; bounces=0; returns=0; phase:'serve'|'rally'|'point'|'over'='serve';
 timer=0; message='SHOTでサーブ'; rally=0; best=0; difficulty=1; assist=true; volleyLock=-1; volleyTimer=0;
 event:(name:string)=>void=()=>{};
 reset(){this.score=[0,0];this.server=0;this.best=0;this.setup();}
 setup(){const sx=(this.score[this.server]%2===0?1:-1)*(this.server===0?1:-1)*1.5;this.players[this.server].x=sx;this.players[this.server].z=this.server===0?7.25:-7.25;this.players[1-this.server].x=-sx;this.players[1-this.server].z=this.server===0?-5.5:5.5;this.ball={x:sx,y:.65,z:this.players[this.server].z,vx:0,vy:0,vz:0};this.phase='serve';this.last=this.server;this.timer=.9;this.returns=0;this.bounces=0;this.rally=0;this.volleyLock=-1;this.volleyTimer=0;this.message=this.server===0?'あなたのサーブ · SHOT':'CPUのサーブ';}
 point(winner:Side,reason:string){if(this.phase==='point'||this.phase==='over')return;this.best=Math.max(this.best,this.rally);if(winner===this.server){this.score[winner]++;this.message=(winner===0?'あなたの得点':'CPUの得点')+' · '+reason;}else{this.server=winner;this.message='サーブ交代 · '+reason;}this.phase='point';this.timer=1.9;this.event('point');if(this.score[winner]>=11&&this.score[winner]-this.score[1-winner]>=2){this.phase='over';this.message=winner===0?'YOU WIN':'CPU WINS';}}
 serve(){if(this.phase!=='serve')return;this.phase='rally';const b=this.ball;b.x=this.players[this.server].x;b.z=this.players[this.server].z;b.y=.65;this.launch(-b.x,this.server===0?-4.8:4.8,1.28);this.last=this.server;this.players[this.server].swing=1;this.message='まずはワンバウンド';this.event('hit');}
 launch(x:number,z:number,t:number){const b=this.ball;b.vx=(x-b.x)/t;b.vz=(z-b.z)/t;b.vy=(.06-b.y+.5*G*t*t)/t;this.bounces=0;}
 hit(side:Side,lob=false,aimX=0,depth=0){if(this.phase==='serve'){if(side===this.server)this.serve();return false;}if(this.phase!=='rally'||side===this.last)return false;const p=this.players[side],b=this.ball;
 if((side===0?b.z<0:b.z>0)||Math.hypot(p.x-b.x,p.z-b.z)>(this.assist&&side===0?1.55:1.22)||b.y>2.15||b.y<.07)return false;
 if(this.returns<2&&this.bounces===0)return false;
 if(this.bounces===0&&Math.abs(p.z)<=K+.18){this.point((1-side) as Side,'キッチン内ボレー');return true;}
 const volley=this.bounces===0;this.volleyLock=volley?side:-1;this.volleyTimer=volley?.45:0;this.last=side;this.returns++;this.rally++;p.swing=1;
 const sign=side===0?-1:1;const targetX=Math.max(-W+.25,Math.min(W-.25,aimX*2.6));const targetZ=sign*(lob?5.65:depth>.3?2.8:depth<-.3?5.85:4.8);
 this.launch(targetX,targetZ,lob?1.85:Math.max(.9,Math.abs(targetZ-b.z)/9.4));this.message=lob?'LOB':volley?'VOLLEY':depth>.3?'DROP':'DRIVE';this.event('hit');return true;}
 landing(){const b=this.ball;const t=(b.vy+Math.sqrt(b.vy*b.vy+2*G*Math.max(0,b.y-.06)))/G;return {x:b.x+b.vx*t,z:b.z+b.vz*t};}
 step(dt:number,mx=0,mz=0){for(const p of this.players)p.swing=Math.max(0,p.swing-dt*4);if(this.phase==='over')return;
 if(this.phase==='point'){this.timer-=dt;if(this.timer<=0)this.setup();return;}
 const p=this.players[0];if(this.phase==='rally'){const s=Math.hypot(mx,mz)>1?1/Math.hypot(mx,mz):1;p.x=Math.max(-W-1,Math.min(W+1,p.x+mx*s*4.6*dt));p.z=Math.max(.45,Math.min(L+1.6,p.z+mz*s*4.6*dt));}
 if(this.volleyTimer>0){this.volleyTimer-=dt;if(this.volleyLock>=0&&Math.abs(this.players[this.volleyLock].z)<=K+.18){this.point((1-this.volleyLock) as Side,'ボレー後のキッチン侵入');return;}}
 if(this.phase==='serve'){this.timer-=dt;if(this.server===1&&this.timer<=0)this.serve();return;}
 const c=this.players[1];const target=this.last===0?this.landing():{x:0,z:-4.2};const tx=Math.max(-W-.5,Math.min(W+.5,target.x)),tz=Math.max(-L-.9,Math.min(-.6,target.z));const dx=tx-c.x,dz=tz-c.z,d=Math.hypot(dx,dz),speed=[2.6,3.5,4.3][this.difficulty];if(d>.1){c.x+=dx/d*Math.min(d,speed*dt);c.z+=dz/d*Math.min(d,speed*dt);}
 const b=this.ball,oldZ=b.z;b.x+=b.vx*dt;b.z+=b.vz*dt;b.vy-=G*dt;b.y+=b.vy*dt;
 if(oldZ*b.z<=0&&Math.abs(b.x)<W+.2&&b.y<.94){this.point((1-this.last) as Side,'ネット');return;}
 if(b.y<=.06){b.y=.06;if(this.bounces>=1){this.point(this.last,'ツーバウンド');return;}const side:Side=b.z>0?0:1;if(Math.abs(b.x)>W+.04||Math.abs(b.z)>L+.04){this.point((1-this.last) as Side,'アウト');return;}
 if(this.returns===0&&(Math.abs(b.z)<=K+.04||b.x*this.players[this.server].x>=0)){this.point((1-this.last) as Side,'サーブフォルト');return;}
 if(side===this.last){this.point((1-this.last) as Side,'自陣バウンド');return;}this.bounces++;if(this.bounces>=2){this.point(this.last,'ツーバウンド');return;}b.vy=Math.abs(b.vy)*.73;b.vx*=.91;b.vz*=.91;this.event('bounce');}
 if(this.last===0&&b.y<1.35&&(this.bounces>0||b.vy<1.5)&&Math.hypot(c.x-b.x,c.z-b.z)<1.15){const aim=-p.x/3+(Math.sin(this.rally*2.4)*.25);this.hit(1,this.rally%7===5,aim,0);}
 }
}
