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
  const bad=this.up.find(r=>s.reject.includes(r.id)||!['productos','clientas','pedidos','movs','compras','ajustes'].includes(r.coleccion));
  if(bad)return{data:null,error:{code:'23514',message:'new row violates check constraint'}};
  this.up.forEach(r=>{s.clock++;s.rows[r.coleccion+':'+r.id]={coleccion:r.coleccion,id:r.id,data:JSON.parse(JSON.stringify(r.data)),borrado:!!r.borrado,actualizado:new Date(1.8e12+s.clock*1000).toISOString()}});
  save(s);return{data:null,error:null}}
 const rows=Object.values(s.rows).filter(r=>this.f.every(([op,c,v])=>op=='eq'?r[c]===v:op=='neq'?r[c]!==v:r[c]>=v)).sort((a,b)=>a.actualizado<b.actualizado?-1:1);
 if(this.opts.head)return{count:rows.length,data:null,error:null};
 return{data:JSON.parse(JSON.stringify(rows.slice(0,this.lim))),error:null}};
Q.prototype.then=function(ok,mal){return Promise.resolve().then(()=>this.run()).then(ok,mal)};
let cb=null;
const getS=()=>{try{return JSON.parse(localStorage.getItem('ml-sesion'))}catch(e){return null}};
window.supabase={createClient(){return{
 from:()=>new Q(),
 auth:{
  async getSession(){const s=load(),ses=getS();
   if(s.down)return ses&&ses.expirada?{data:{session:null},error:{message:'Failed to fetch'}}:{data:{session:ses},error:null};
   return{data:{session:ses},error:null}},
  async signInWithPassword({email,password}){if(load().down)return{data:{},error:{message:'Failed to fetch'}};
   if(password!=='ok')return{data:{},error:{message:'Invalid login credentials'}};
   const ses={user:{id:'u-'+email,email}};localStorage.setItem('ml-sesion',JSON.stringify(ses));return{data:{session:ses},error:null}},
  async signOut(){localStorage.removeItem('ml-sesion');if(cb)cb('SIGNED_OUT',null);return{error:null}},
  onAuthStateChange(f){cb=f;return{data:{subscription:{unsubscribe(){}}}}}
 }}}};
})();
