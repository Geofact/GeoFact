const test=require('node:test'),assert=require('node:assert/strict');
require('../data/countries.js');require('../data/flag-cards.js');
const {createAlbum,regionOf}=require('../collection-album.js');
const album=createAlbum(GeoFactCountries,Object.keys(GeoFactFlagCards));
const entry=(rarities=['classic'],count=1)=>({rarities,counts:Object.fromEntries(rarities.map(r=>[r,count])),firstUnlocked:'2026-10-01'});
test('six exclusive collection continents cover exactly the 195 real cards',()=>{
 assert.equal(album.catalog.length,195);
 assert.deepEqual(Object.fromEntries(album.regions.map(r=>[r,album.groups[r].length])),{africa:54,europe:44,asia:48,northAmerica:23,southAmerica:12,oceania:14});
 const ids=album.regions.flatMap(r=>album.groups[r].map(c=>c.iso));assert.equal(new Set(ids).size,195);assert.deepEqual(ids.sort(),Object.keys(GeoFactFlagCards).sort());
 for(const [iso,region]of Object.entries({RUS:'europe',TUR:'asia',KAZ:'asia',GEO:'asia',CYP:'asia',ARM:'asia',AZE:'asia',EGY:'africa',IDN:'asia',FRA:'europe',PAN:'northAmerica',GUY:'southAmerica',SUR:'southAmerica'}))assert.equal(album.regionOf(iso),region);
});
test('old collections, variants and duplicates count each country only once',()=>{
 const collection={FRA:entry(['classic','silver','gold','shiny'],9),BRA:entry(),JPN:entry(['gold'],3),XXX:entry()};const before=structuredClone(collection);
 assert.deepEqual(album.progress(collection),{owned:3,total:195,complete:false});assert.equal(album.progress(collection,'europe').owned,1);assert.equal(album.progress(collection,'southAmerica').owned,1);assert.deepEqual(collection,before);
});
test('empty and complete continents are derived without altering the collection',()=>{
 assert.deepEqual(album.progress({},'southAmerica'),{owned:0,total:12,complete:false});
 const collection=Object.fromEntries(album.groups.southAmerica.map(c=>[c.iso,entry()]));assert.deepEqual(album.progress(collection,'southAmerica'),{owned:12,total:12,complete:true});
 assert.equal(album.progress(collection).owned,12);
});
test('reward presentation distinguishes first country, new rarity and extra copy before credit',()=>{
 const card={iso:'FRA',rarity:'gold'};
 assert.deepEqual(album.acquisition({},card),{version:1,kind:'country',region:'europe',before:0,after:1,total:44,copies:1});
 const collection={FRA:entry(['classic'],3)},before=structuredClone(collection);
 assert.equal(album.acquisition(collection,card).kind,'rarity');assert.equal(album.acquisition(collection,card).after,1);
 const copy=album.acquisition(collection,{iso:'FRA',rarity:'classic'});assert.equal(copy.kind,'copy');assert.equal(copy.copies,4);assert.equal(copy.before,copy.after);assert.deepEqual(collection,before);
});
test('only a newly collected final country completes a continent',()=>{
 const collection=Object.fromEntries(album.groups.southAmerica.filter(c=>c.iso!=='BRA').map(c=>[c.iso,entry()]));
 const discovery=album.acquisition(collection,{iso:'BRA',rarity:'silver'});assert.equal(discovery.before,11);assert.equal(discovery.after,12);assert.equal(discovery.kind,'country');
 collection.BRA=entry(['silver']);const variant=album.acquisition(collection,{iso:'BRA',rarity:'gold'});assert.equal(variant.before,12);assert.equal(variant.after,12);assert.equal(variant.kind,'rarity');
});
