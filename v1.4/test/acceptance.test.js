import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const rules=fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');
const storage=fs.readFileSync(new URL('../storage.rules',import.meta.url),'utf8');
const databaseRules=fs.readFileSync(new URL('../database.rules.json',import.meta.url),'utf8');
const firebaseData=fs.readFileSync(new URL('../src/services/firebaseData.js',import.meta.url),'utf8');

test('launch uses complete token, fragment transport and verified cross-origin bridge',()=>{
  assert.match(main,/encodeLaunchToken/);
  assert.match(main,/buildLaunchUrl/);
  assert.match(main,/BroadcastChannel\(`gg-launch-/);
  assert.match(main,/event\.source!==child\|\|event\.origin!==payload\.gameOrigin/);
  assert.match(main,/firebaseData\.setPresence/);
  assert.match(main,/window\.open\('about:blank','_blank'\)/);
  assert.match(main,/platformApi\.launch/);
  assert.doesNotMatch(main,/slice\(0,48\).*…/);
});
test('administrator navigation and moderation are role-gated',()=>{
  assert.match(main,/state\.user\.role==='admin'/);
  assert.match(main,/Access denied/);
  assert.match(main,/data-demo="admin"/);
});
test('under-13 social restrictions and lifecycle states are implemented',()=>{
  assert.match(main,/parentConsent\|\|state\.parentControls\?\.chatEnabled!==true/);
  assert.match(main,/requiredChanges/);
  assert.match(main,/approved/);
  assert.match(main,/published/);
});
test('Polish manual copy covers core screens and accessibility naming runs',()=>{
  for(const label of ['Twoi znajomi','PANEL TWÓRCY','Panel moderacji','Kontrola rodzicielska','Konto i dane','Wyślij grę do sprawdzenia']) assert.match(main,new RegExp(label));
  assert.match(main,/setAttribute\('aria-label'/);
  assert.match(main,/NodeFilter\.SHOW_TEXT/);
});
test('rules keep approval admin-only and sensitive identity private',()=>{
  assert.match(rules,/request\.resource\.data\.status in \['draft', 'submitted'\]/);
  assert.match(rules,/request\.resource\.data\.status == resource\.data\.status/);
  assert.match(rules,/match \/private\/identity/);
  assert.match(rules,/request\.resource\.data\.members == resource\.data\.members/);
  assert.match(rules,/request\.resource\.data\.gameId == resource\.data\.gameId/);
  assert.match(rules,/affectedKeys\(\)\.hasOnly\(\['title','url','pendingUrl','ageRating','notes','visibility','deleteAt','status'\]\)/);
  assert.match(rules,/hasOnly\(\['title','url','ageRating','status','ownerId','notes','visibility'\]\)/);
  assert.match(storage,/request\.auth\.uid == uid/);
});
test('production bundle source includes public SDK documentation and example',()=>{
  assert.equal(fs.existsSync(new URL('../public/sdk/README.md',import.meta.url)),true);
  assert.equal(fs.existsSync(new URL('../public/sdk/example/index.html',import.meta.url)),true);
  assert.match(main,/href="\.\/sdk\/README\.md"/);
  assert.doesNotMatch(main,/href="\/sdk\/README\.md"/);
});
test('creator verification is a real launch handshake, not a self-attested checkbox',()=>{
  assert.match(main,/runSdkCheck/);
  assert.match(main,/Run real SDK test/);
  assert.doesNotMatch(main,/searchParams\.get\('ggSdk'\)/);
});
test('Firebase mode subscribes to shared product state and uploads avatars through Storage',()=>{
  for(const surface of ['users','games','reviews','friendships','threads','reports']) assert.match(firebaseData,new RegExp(`collection\\(s\\.db,'${surface}'`));
  assert.match(firebaseData,/collection\(s\.db,'users',uid,'notifications'\)/);
  assert.match(firebaseData,/onValue\(s\.database\.ref\(s\.rtdb,`presence/);
  assert.match(firebaseData,/uploadBytes/);
  assert.match(main,/startCloudSync\(user\)/);
});
test('under-13 chat and friend approval are controlled by the verified parent document',()=>{
  assert.match(main,/state\.parentControls\?\.chatEnabled!==true/);
  assert.match(main,/approvedFriendIds\?\.includes/);
  assert.match(rules,/match \/parentControls\/\{childUid\}/);
  assert.match(rules,/verifiedParent\(\) \|\| admin\(\)/);
  assert.match(rules,/match \/ageBands\/\{uid\}/);
  assert.match(rules,/ageBand\(uid\) in \['13-17', '18\+'\]/);
  assert.match(rules,/ageBand\(uid\) == 'U13' && get/);
  assert.match(databaseRules,/root\.child\('ageBands'\)/);
  assert.match(databaseRules,/newData\.child\('visibility'\)/);
  assert.match(databaseRules,/newData\.child\('joinPrivacy'\)/);
  assert.match(firebaseData,/grantedIds\.filter\(id=>!nextAccepted\.includes\(id\)\)/);
});
