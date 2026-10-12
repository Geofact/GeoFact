/* Read-only album calculations. No browser, randomness or storage dependencies. */
(function(root){
  'use strict';
  const regions=Object.freeze(['africa','europe','asia','northAmerica','southAmerica','oceania']);
  const south=new Set(['ARG','BOL','BRA','CHL','COL','ECU','GUY','PRY','PER','SUR','URY','VEN']);
  const rarityNames=['classic','silver','gold','shiny'];
  const owns=entry=>Array.isArray(entry?.rarities)&&entry.rarities.some(r=>rarityNames.includes(r));
  function regionOf(country) {
    return country.continent==='americas'?(south.has(country.iso)?'southAmerica':'northAmerica'):country.continent;
  }
  function createAlbum(countries,collectable=countries.map(c=>c.iso)) {
    const ids=new Set(collectable),catalog=countries.filter(c=>ids.has(c.iso));
    if(catalog.length!==ids.size||new Set(catalog.map(c=>c.iso)).size!==catalog.length||catalog.some(c=>!regions.includes(regionOf(c))))throw new TypeError('Invalid album catalog');
    const groups=Object.fromEntries(regions.map(region=>[region,catalog.filter(c=>regionOf(c)===region)]));
    if(regions.some(r=>!groups[r].length))throw new TypeError('Empty album continent');
    const byISO=new Map(catalog.map(c=>[c.iso,c]));
    function progress(collection,region='all') {
      const pool=region==='all'?catalog:groups[region];
      if(!pool)throw new TypeError('Unknown album continent');
      const owned=pool.filter(c=>owns(collection?.[c.iso])).length;
      return {owned,total:pool.length,complete:owned===pool.length};
    }
    function acquisition(collection,card) {
      const country=byISO.get(card.iso);if(!country)return null;
      const entry=collection?.[card.iso],countryOwned=owns(entry),variantOwned=entry?.rarities?.includes(card.rarity)===true;
      const region=regionOf(country),before=progress(collection,region);
      return {version:1,kind:!countryOwned?'country':!variantOwned?'rarity':'copy',region,
        before:before.owned,after:before.owned+(countryOwned?0:1),total:before.total,
        copies:(entry?.counts?.[card.rarity]||(variantOwned?1:0))+1};
    }
    return {regions,groups,catalog,regionOf:iso=>regionOf(byISO.get(iso)),progress,acquisition};
  }
  const api={regions,regionOf,createAlbum};root.GeoFactAlbum=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
