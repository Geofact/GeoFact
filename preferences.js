(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GeoFactPreferences=api;
})(globalThis,function(){
  'use strict';
  function availableStorage() {try{return globalThis.localStorage;}catch{return null;}}
  function createLanguagePreference(store,browserLanguage='en') {
    let saved;
    try{saved=store?.getItem('wg-lang');}catch{/* In-memory preference remains usable. */}
    let language=['fr','en'].includes(saved)?saved:String(browserLanguage).toLowerCase().startsWith('fr')?'fr':'en';
    return {get:()=>language,set(value){if(!['fr','en'].includes(value))return;language=value;try{store?.setItem('wg-lang',value);}catch{/* No persistence when storage is denied. */}}};
  }
  const api={availableStorage,createLanguagePreference};
  if(typeof document!=='undefined') {
    api.language=createLanguagePreference(availableStorage(),navigator.language);
    document.documentElement.lang=api.language.get();
    // Translate static markup while it is parsed, before the game/data modules finish loading.
    const translate=element=>{
      const language=api.language.get(),dictionary=globalThis.GeoFactTranslations?.[language];
      if(!dictionary)return;
      for(const [attribute,target] of [['data-i18n',null],['data-i18n-aria','aria-label'],['data-i18n-placeholder','placeholder']]){
        const key=element.getAttribute(attribute);
        if(key&&dictionary[key]){if(target){if(element.getAttribute(target)!==dictionary[key])element.setAttribute(target,dictionary[key]);}else if(element.textContent!==dictionary[key])element.textContent=dictionary[key];}
      }
    };
    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.target.nodeType===1)translate(record.target);
        for(const node of record.addedNodes)if(node.nodeType===1){
          translate(node);node.querySelectorAll('[data-i18n],[data-i18n-aria],[data-i18n-placeholder]').forEach(translate);
        }
      }
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    document.addEventListener('DOMContentLoaded',()=>observer.disconnect(),{once:true});
  }
  return api;
});
