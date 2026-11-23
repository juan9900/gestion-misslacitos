/* Nube simulada para pruebas: guarda las filas en localStorage (clave FAKE_SERVER). */
(function(){
const LS='FAKE_SERVER';
const load=()=>JSON.parse(localStorage.getItem(LS)||'{"rows":{},"clock":0,"reject":[],"down":false}');
const save=s=>localStorage.setItem(LS,JSON.stringify(s));
function Q(){this.f=[];this.lim=1e9;this.opts={};this.up=null}
Q.prototype.select=function(c,o){this.opts=o||{};return this};
['eq','neq','gte'].forEach(op=>Q.prototype[op]=function(c,v){this.f.push([op,c,v]);return this});
Q.prototype.order=function(){return this};
Q.prototype.limit=function(n){this.lim=n;return this};
Q.prototype.upsert=function(rows){this.up=rows;return this};
Q.prototype.run=function(){const s=load();
 if(s.down)return{data:null,error:{message:'TypeError: Failed to fetch'}};
 if(this.up){
  const bad=this.up.find(r=>s.reject.includes(r.id)||!(window.FAKE_COLS||['productos','clientas','pedidos','movs','compras','interesadas','ajustes']).includes(r.coleccion));
  if(bad)return{data:null,error:{code:'23514',message:'new row violates check constraint'}};
  this.up.forEach(r=>{s.clock++;s.rows[r.coleccion+':'+r.id]={coleccion:r.coleccion,id:r.id,data:JSON.parse(JSON.stringify(r.data)),borrado:!!r.borrado,actualizado:new Date(1.8e12+s.clock*1000).toISOString()}});
  save(s);return{data:null,error:null}}
 const rows=Object.values(s.rows).filter(r=>this.f.every(([op,c,v])=>op=='eq'?r[c]===v:op=='neq'?r[c]!==v:r[c]>=v)).sort((a,b)=>a.actualizado<b.actualizado?-1:1);
 if(this.opts.head)return{count:rows.length,data:null,error:null};
 return{data:JSON.parse(JSON.stringify(rows.slice(0,this.lim))),error:null}};
Q.prototype.then=function(ok,mal){return Promise.resolve().then(()=>this.run()).then(ok,mal)};
function subsTabla(){const L=()=>JSON.parse(localStorage.getItem('FAKE_SUBS')||'[]'),G=x=>localStorage.setItem('FAKE_SUBS',JSON.stringify(x));
 return{async upsert(f){const l=L().filter(x=>x.endpoint!=f.endpoint);l.push(f);G(l);return{error:null}},
  delete(){return{async eq(c,v){G(L().filter(x=>x[c]!=v));return{error:null}}}}}}
/* copias automáticas simuladas: una copia hecha "el lunes" con lo que hay en la nube */
function R(){this.uno=false;this.idv=null}
R.prototype.select=function(){return this};R.prototype.order=function(){return this};R.prototype.limit=function(){return this};
R.prototype.eq=function(c,v){this.idv=v;return this};R.prototype.single=function(){this.uno=true;return this};
R.prototype.then=function(ok,mal){return Promise.resolve().then(()=>{const s=load();
 const datos=Object.values(s.rows).filter(r=>!r.borrado).map(r=>({coleccion:r.coleccion,id:r.id,data:r.data}));
 const fila={id:1,creado:'2026-11-23T10:00:00+00:00',filas:datos.length};
 return this.uno?{data:{creado:fila.creado,datos},error:null}:{data:[fila],error:null}}).then(ok,mal)};
let cb=null;
const getS=()=>{try{return JSON.parse(localStorage.getItem('ml-sesion'))}catch(e){return null}};
window.supabase={createClient(){return{
 from:(tabla)=>tabla=='respaldos'?new R():tabla=='push_subs'?subsTabla():new Q(),
 functions:{async invoke(nombre,{body}){const L=JSON.parse(localStorage.getItem('FAKE_FN')||'[]');L.push(body);localStorage.setItem('FAKE_FN',JSON.stringify(L));
  if(body.modo=='clave')return{data:{publica:'BENSS1_ktHoq'+'A'.repeat(75)},error:null};
  if(body.modo=='prueba')return{data:{ok:JSON.parse(localStorage.getItem('FAKE_SUBS')||'[]').length,total:1},error:null};return{data:null,error:{message:'?'}}}},
 storage:{from:()=>({
  async upload(ruta,blob){if(load().down)return{error:{message:'Failed to fetch'}};const u=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(blob)});
   const F=JSON.parse(localStorage.getItem('FAKE_FILES')||'{}');F[ruta]=u;localStorage.setItem('FAKE_FILES',JSON.stringify(F));return{data:{path:ruta},error:null}},
  async createSignedUrl(ruta){const F=JSON.parse(localStorage.getItem('FAKE_FILES')||'{}');return F[ruta]?{data:{signedUrl:F[ruta]},error:null}:{data:null,error:{message:'Object not found'}}},
  async remove(rutas){if(load().down)return{error:{message:'Failed to fetch'}};const F=JSON.parse(localStorage.getItem('FAKE_FILES')||'{}');rutas.forEach(r=>delete F[r]);localStorage.setItem('FAKE_FILES',JSON.stringify(F));return{data:[],error:null}}
 })},
 auth:{
  async getSession(){const s=load(),ses=getS();
   if(s.down)return ses&&ses.expirada?{data:{session:null},error:{message:'Failed to fetch'}}:{data:{session:ses},error:null};
   return{data:{session:ses},error:null}},
  async signInWithPassword({email,password}){if(load().down)return{data:{},error:{message:'Failed to fetch'}};
   if(password!=='ok')return{data:{},error:{message:'Invalid login credentials'}};
   const ses={user:{id:'u-'+email,email}};localStorage.setItem('ml-sesion',JSON.stringify(ses));return{data:{session:ses},error:null}},
  async signOut(){localStorage.removeItem('ml-sesion');if(cb)cb('SIGNED_OUT',null);return{error:null}},
  async resetPasswordForEmail(email,o){if(load().down)return{error:{message:'Failed to fetch'}};localStorage.setItem('FAKE_RESET',JSON.stringify({email,redirectTo:o&&o.redirectTo}));return{data:{},error:null}},
  async updateUser({password}){const ses=getS();if(!ses)return{data:{},error:{message:'Auth session missing'}};localStorage.setItem('FAKE_PASS',password);return{data:{user:ses.user},error:null}},
  onAuthStateChange(f){cb=f;
   /* enlace de recuperación simulado: #access_token=...&type=recovery */
   if(/type=recovery/.test(location.hash)){const ses={user:{id:'u-a@p.com',email:'a@p.com'}};localStorage.setItem('ml-sesion',JSON.stringify(ses));history.replaceState(null,'',location.pathname);setTimeout(()=>f('PASSWORD_RECOVERY',ses),0)}
   return{data:{subscription:{unsubscribe(){}}}}}
 }}}};
})();
