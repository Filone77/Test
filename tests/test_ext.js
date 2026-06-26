require('../assets/js/hydraulics.js');
require('../assets/js/hydraulics-ext.js');
const C = global.Hydro.calc;
const r=(x,n=4)=>C.round(x,n);
let pass=0,fail=0;
function ck(n,g,e,t=0.02){const ok=Math.abs(g-e)<=Math.abs(e)*t+1e-9;console.log((ok?' OK ':'FAIL')+' '+n+'  got='+r(g)+' exp='+r(e));ok?pass++:fail++;}

console.log('--- Hazen-Williams (Q=50L/s=180m³/h, D=200, L=500, C=130) ---');
const hw=C.hazenWilliams(180,200,500,130);
// hf=10.67*L*Q^1.852/(C^1.852*D^4.87); Q=0.05, D=0.2
const Q=0.05,D=0.2; const hf=10.67*500*Math.pow(Q,1.852)/(Math.pow(130,1.852)*Math.pow(D,4.87));
ck('HW dHlin', hw.dHlin, hf);
ck('HW V', hw.V, 0.05/(Math.PI*0.04/4));

console.log('--- Multi-tronçons série ---');
const rs=C.reseauSerie([
 {Q_m3h:180,Di_mm:200,L_m:300,eps_mm:0.01,dz:2,ksi:1},
 {Q_m3h:180,Di_mm:150,L_m:200,eps_mm:0.01,dz:3,ksi:0.5}
],{methode:'swamee',nu:1e-6,Hdepart:50,zDepart:10});
console.log('  dHtotal=',r(rs.dHtotal),'Ltotal=',rs.Ltotal,'dzTotal=',rs.dzTotal);
console.log('  pression min=',r(rs.pressionMin),'profil pts=',rs.profil.length);
ck('Ltotal', rs.Ltotal, 500);
ck('dzTotal', rs.dzTotal, 5);
// piezo départ = Hdepart+zDepart=60; après pertes diminue
ck('profil départ piezo', rs.profil[0].piezo, 60);

console.log('--- Sections non circulaires ---');
const rect=C.manningSection('rectangulaire',{b:1,y:0.5},0.005,0.013);
ck('rect A', rect.A, 0.5); ck('rect P', rect.P, 2); ck('rect Rh', rect.Rh, 0.25);
const trap=C.manningSection('trapezoidale',{b:1,y:0.5,m:2},0.005,0.013);
ck('trap A', trap.A, (1+2*0.5)*0.5);
ck('trap P', trap.P, 1+2*0.5*Math.sqrt(5));

console.log('--- Longueur équivalente ---');
ck('Leq (ksi=2,D=150,lam=0.02)', C.longueurEquivalente(2,150,0.02), 2*0.15/0.02);

console.log('--- Méthode rationnelle & tc ---');
ck('Q rationnelle (C=0.8,i=60,A=5ha)', C.methodeRationnelle(0.8,60,5), 0.8*60*5/360);
ck('tc Kirpich (L=500,I=0.01)', C.tcKirpich(500,0.01), 0.0195*Math.pow(500,0.77)*Math.pow(0.01,-0.385));

console.log('--- Courbe pompe 3 points ---');
const cf=C.ajustePompe3pts([{Q:0,H:50},{Q:100,H:45},{Q:200,H:30}]);
ck('fit a0', cf.a0, 50);
ck('Hpompe(0)', C.Hpompe(cf,0), 50);
ck('Hpompe(100)', C.Hpompe(cf,100), 45);
ck('Hpompe(200)', C.Hpompe(cf,200), 30);
const pf=C.pointFonctionnementPoly(cf, 5, C.resistanceReseau(8,200));
console.log('  point fonct poly: Q=',r(pf.Q),'H=',r(pf.H));
// vérifie que H pompe = H réseau au point
ck('cohérence point', C.Hpompe(cf,pf.Q), 5+C.resistanceReseau(8,200)*pf.Q*pf.Q, 0.001);

console.log('--- Ballon anti-bélier ---');
const bb=C.ballonAntiBelier(1000, 500, Math.PI*0.04/4, 1.5, 40, 60);
console.log('  U0=',r(bb.U0,4),'m³, Umax=',r(bb.Umax,4),'ballon=',r(bb.volumeBallon,4));
ck('U0>0', bb.U0>0?1:0, 1);
ck('ratio', bb.ratio, 1.5);

console.log('--- Bassin à talus ---');
const v=C.volumeBassinTalus(10,8,1.5,2);
ck('V talus (10x8,h1.5,m2)', v, 10*8*1.5+(10+8)*2*1.5*1.5+(4/3)*4*1.5*1.5*1.5);
const bt=C.bassinTalusDepuisVolume(250,1.5,2,1);
console.log('  fond pour 250m³: lb=',r(bt.lb),'Lb=',r(bt.Lb),'V obtenu=',r(bt.V));
ck('dichotomie V≈cible', bt.V, 250, 0.01);

console.log('--- Hardy-Cross (1 maille, 4 conduites) ---');
// maille carrée: r identiques, Q initial respectant continuité
// noeuds: apport 100 en A, sortie 100 en C. pipes: 0:A->B,1:B->C,2:A->D,3:D->C
// loop A-B-C-D-A : +0,+1,-3,-2
const hc=C.hardyCross(
 [{r:1,Q:60},{r:1,Q:60},{r:1,Q:40},{r:1,Q:40}],
 [[{pipe:0,sens:1},{pipe:1,sens:1},{pipe:3,sens:-1},{pipe:2,sens:-1}]],
 {}
);
console.log('  itérations=',hc.iterations,'conv=',r(hc.convergence,6));
console.log('  Q=',hc.Q.map(x=>r(x,3)));
// par symétrie Q0=Q1=Q2=Q3=50
ck('HC symétrie Q0', hc.Q[0], 50, 0.001);
ck('HC symétrie Q2', hc.Q[2], 50, 0.001);

console.log('\n=== '+pass+' OK, '+fail+' échecs ===');
process.exit(fail>0?1:0);
