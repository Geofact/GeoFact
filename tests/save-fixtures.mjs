// Synthetic saves only: never read a player's browser profile.
export const currentSave = {
  'wg-lang': 'fr',
  'wg-best': '999',
  'wg-stats': JSON.stringify({solved:40,totalClicks:55,oneClick:30}),
  'wg-seen-facts': JSON.stringify({FRA:{seen:[0],last:0},JPN:{seen:[0],last:0}}),
  'gf-best-scores': JSON.stringify({easy:94,medium:82,hard:71}),
  'gf-anonymous-visitor-v1': JSON.stringify('12345678-1234-4123-8123-123456789abc'),
  'gf-daily-v1': JSON.stringify({days:{'2026-10-07':{score:94,tiles:['green','green','yellow','green','green'],errors:2,number:1,card:{iso:'JPN',rarity:'gold',upgraded:true,copies:2},cardOpened:true}},played:7,streak:3,bestStreak:5,lastDate:'2026-10-07'}),
  'gf-collection-v1': JSON.stringify({FRA:{rarities:['classic','silver'],counts:{classic:3,silver:1},firstUnlocked:'2026-10-01',acquiredAt:{classic:1790812800000,silver:1790899200000}},JPN:{rarities:['gold'],counts:{gold:2},firstUnlocked:'2026-10-02',acquiredAt:{gold:1790899200000}}}),
  'unrelated-setting': '{"preserve":"exactly"}'
};
export const legacySave = {
  ...currentSave,
  'gf-best-scores': JSON.stringify({easy:4700,medium:4100}),
  'gf-daily-v1': JSON.stringify({days:{'2026-10-07':{score:4700,tiles:['🟩','🟩','🟨','🟩','🟩'],number:1}},played:1,streak:1,bestStreak:1,lastDate:'2026-10-07'}),
  'gf-collection-v1': JSON.stringify({FRA:{rarity:'silver',firstUnlocked:'2026-10-01'}})
};
