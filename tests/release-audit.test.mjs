import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const html=read('index.html'),app=read('app.js');
const ctx=vm.createContext({});for(const p of ['i18n.js','data/countries.js','data/facts.js','data/flag-cards.js'])vm.runInContext(read(p),ctx);
const translations=ctx.GeoFactTranslations;
test('FR/EN keys and placeholders match across the entire translation catalog',()=>{
 assert.deepEqual(Object.keys(translations.fr).sort(),Object.keys(translations.en).sort());
 for(const key of Object.keys(translations.fr)){
  const parameters=lang=>[...translations[lang][key].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
  assert.deepEqual(parameters('fr'),parameters('en'),key);
  for(const lang of ['fr','en'])assert.equal(typeof translations[lang][key],'string',key);
 }
 for(const m of html.matchAll(/data-i18n(?:-aria|-placeholder)?="([^"]+)"/g))for(const lang of ['fr','en'])assert.ok(translations[lang][m[1]],m[1]);
 for(const m of app.matchAll(/\bt\('([^']+)'\s*[,)]/g))assert.ok(Object.hasOwn(translations.fr,m[1]),m[1]);
});
test('All countries, facts and flag cards have nonempty FR/EN content',()=>{
 for(const country of ctx.GeoFactCountries)for(const lang of ['fr','en']){
  assert.ok(country.name[lang]?.trim());assert.ok(country.capital[lang]?.trim());
  assert.ok(ctx.GeoFactFlagCards[country.iso][lang]?.trim());
  for(const fact of ctx.GeoFactFacts[country.iso])assert.ok(fact[lang]?.trim());
 }
});
test('The release versions every entry and every reward module dependency consistently',()=>{
 const version=new URL([...html.matchAll(/src="([^"]+app\.js[^\"]*)"/g)][0]?.[1]||html.match(/src="(app\.js[^\"]*)"/)[1],'https://geofact.app/').searchParams.get('v');
 assert.ok(version);
 for(const m of html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g)){
  const u=new URL(m[1],'https://geofact.app/');assert.equal(u.searchParams.get('v'),version,m[1]);assert.ok(existsSync(new URL(u.pathname.slice(1),root)),m[1]);
 }
 for(const file of ['app.js','reward-repository.mjs','daily-rewards.mjs','legacy-rewards.mjs'])for(const m of read(file).matchAll(/(?:import\(|from )'([^']+\.mjs(?:\?[^']*)?)'/g)){
  const u=new URL(m[1],new URL(file,root));assert.equal(u.searchParams.get('v'),version,file+': '+m[1]);assert.ok(existsSync(new URL(u.pathname,'file://')));
 }
});
test('Metadata uses the declared production domain and local assets exist',()=>{
 assert.equal(read('CNAME').trim(),'geofact.app');assert.match(html,/<link rel="canonical" href="https:\/\/geofact.app\/"/);
 assert.ok(!html.includes('https://geofact.github.io/GeoFact/'));
 for(const m of html.matchAll(/(?:src|href)="(assets\/[^\"]+)"/g))assert.ok(existsSync(new URL(m[1],root)),m[1]);
});
test('Runtime contains no private key or privileged credential patterns; Supabase key is publishable',()=>{
 const files=['index.html','app.js','preferences.js','sound.js','public-statistics.js','core.js','map.js','i18n.js','bonus-rules.mjs','reward-repository.mjs','daily-rewards.mjs','legacy-rewards.mjs'];
 const privateCredential=/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}/;
 for(const file of files)assert.ok(!privateCredential.test(read(file)),file);
 assert.match(app,/const STATS_KEY = 'sb_publishable_[A-Za-z0-9_]+'/);
 assert.ok(!/service_role/.test(app));assert.ok(!/serviceWorker\.register/.test(app));
});
