import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';

function isolated(){
 let time=10000;
 const w=new World({seed:20261022,now:()=>time});
 w.resources.clear();w.structures.clear();w.animals.clear();
 const step=(ms=100)=>{time+=ms;w.tick(ms/1000);};
 const spawn=(name,x=1000,y=5000)=>{
   const p=w.join(null,name);p.x=x;p.y=y;p.vx=0;p.vy=0;return p;
 };
 return {w,step,spawn};
}

test('reference 0.0016 acceleration and 0.993/millisecond damping',()=>{
 const {w,step,spawn}=isolated();
 const p=spawn('Inertia');
 assert.equal(w.input(p.id,{dx:1,dy:0}),true);
 step();
 assert.ok(Math.abs(p.x-1016)<0.05,'first 100ms = accel 0.0016*100ms and displacement 16: '+p.x);
 const after=p.x;
 w.input(p.id,{dx:0,dy:0});
 step();
 assert.ok(p.x>after+7 && p.x<after+9,'releasing input coasts with momentum: '+p.x);
 step();assert.ok(p.x>after+10,'inertia continues after release');
});

test('water accelerates to right, gradually reaches drift; Flipper Hat reduces push',()=>{
 const {step,spawn}=isolated();
 const unprotected=spawn('Swimmer',1000,7200);
 const flipper=spawn('Flipper',3000,7200);flipper.hat=31;
 step();
 assert.ok(Math.abs(unprotected.x-1011)<0.2);
 assert.ok(Math.abs(flipper.x-3004.4)<0.2);
 const before=unprotected.x;
 step();
 assert.ok(unprotected.x-before>11,'current accumulates momentum');
 assert.ok(flipper.x-3000<unprotected.x-1000);
});

test('winter cap cancels snow slowdown; snow without it reduces acceleration',()=>{
 const {step,spawn}=isolated();
 const cold=spawn('Cold',900,1000);
 const warm=spawn('Warm',1900,1000);warm.hat=15;
 cold.vx=1;warm.vx=1;
 step();
 assert.ok(Math.abs((cold.x-900)-12)<0.2);
 assert.ok(Math.abs((warm.x-1900)-16)<0.2);
});

test('swept substeps stop on solid rock but preserve the free axis',()=>{
 const {w,step,spawn}=isolated();
 const p=spawn('Collision',1000,5000);
 w.resources.set(900,{sid:900,kind:'stone',x:1080,y:5000,scale:40});
 p.vx=1;p.vy=1;
 for(let i=0;i<8;i++)step();
 assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
 assert.ok(Math.hypot(p.x-1080,p.y-5000)>=75-0.05,
   'player should never tunnel inside rock');
 assert.ok(p.y>5000,'free vertical axis must keep moving');
});
