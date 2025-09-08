// scripts/migrateMaelleToAfterimage.js

require('dotenv').config();

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, getDoc, serverTimestamp } = require('firebase/firestore');

// IMPORTANT: Replace this with your actual Firebase config
// You can find this in your src/services/firebaseConfig.ts file
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateMaelleToAfterimage(sessionId, level = 1) {
  try {
    console.log(`🚀 Starting Maelle migration for session: ${sessionId}`);
    console.log(`📊 Target level: ${level}`);
    
    const sessionRef = doc(db, 'battleSessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);
    
    if (!sessionDoc.exists()) {
      throw new Error(`❌ Session ${sessionId} not found`);
    }
    
    const sessionData = sessionDoc.data();
    const tokens = sessionData.tokens || {};
    
    console.log(`🔍 Searching for Maelle in ${Object.keys(tokens).length} tokens...`);
    
    // Find Maelle's token
    let maelleTokenId = null;
    for (const [tokenId, token] of Object.entries(tokens)) {
      if (typeof token === 'object' && token !== null) {
        console.log(`   Checking token: ${tokenId} (name: ${token.name}, characterId: ${token.characterId})`);
        if (token.name && token.name.toLowerCase() === 'maelle' || token.characterId === 'maelle') {
          maelleTokenId = tokenId;
          break;
        }
      }
    }
    
    if (!maelleTokenId) {
      console.log('❌ Available tokens:');
      Object.entries(tokens).forEach(([id, token]) => {
        console.log(`   - ${id}: ${token.name || 'no name'} (characterId: ${token.characterId || 'none'})`);
      });
      throw new Error('Maelle token not found in session');
    }
    
    console.log(`✅ Found Maelle token: ${maelleTokenId}`);
    
    // Show current state
    const currentMaelle = tokens[maelleTokenId];
    console.log(`📋 Current Maelle state:`, {
      stance: currentMaelle.stance,
      role: currentMaelle.role,
      level: currentMaelle.level
    });
    
    // Calculate new system values based on level
    const maxAfterimageStacks = level >= 7 ? 7 : 5;
    const startingStacks = level >= 5 ? 1 : 0;
    
    // Prepare update data
    const updateData = {
      // Remove old stance system
      [`tokens.${maelleTokenId}.stance`]: null,
      
      // Add new Afterimage system
      [`tokens.${maelleTokenId}.afterimageStacks`]: startingStacks,
      [`tokens.${maelleTokenId}.maxAfterimageStacks`]: maxAfterimageStacks,
      [`tokens.${maelleTokenId}.phantomStrikeUsed`]: false,
      
      // Update character info
      [`tokens.${maelleTokenId}.role`]: 'Phantom Blade Duelist',
      [`tokens.${maelleTokenId}.level`]: level,
      
      // Update timestamp
      updatedAt: serverTimestamp()
    };
    
    console.log(`💾 Applying updates...`);
    
    // Perform the update
    await updateDoc(sessionRef, updateData);
    
    console.log('✅ Maelle migration completed successfully!');
    console.log(`📊 New stats: ${startingStacks}/${maxAfterimageStacks} Afterimage stacks`);
    console.log(`🎭 Abilities available for level ${level}:`);
    console.log('   ⚔️  Phantom Thrust (basic attack) - Builds stacks');
    console.log('   👻 Spectral Feint (1 stack) - Mark enemies');
    console.log('   💨 Blade Flurry (2 stacks) - 3 attacks');
    console.log('   🌙 Mirror Step (1 stack) - Defensive teleport');
    console.log('   💥 Crescendo Strike (all stacks) - Massive damage');
    console.log('   ⚡ Phantom Strike (ultimate, 3+ stacks) - Hit all enemies');
    
    if (level >= 5) {
      console.log('   🔮 Phase Dash (level 5+) - Enhanced movement');
    }
    if (level >= 7) {
      console.log('   ⏰ Temporal Echo (level 7+) - Extra action');
    }
    
    console.log(`\n🎉 Maelle is now a Phantom Blade Duelist!`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Get command line arguments or use defaults
const sessionId = process.argv[2] || process.env.SESSION_ID || 'test-session';
const level = parseInt(process.argv[3] || process.env.LEVEL || '1');

console.log(`🔧 Maelle Phantom Blade Migration Tool`);
console.log(`📅 Session: ${sessionId}`);
console.log(`🎯 Level: ${level}`);
console.log(`⚠️  Make sure your Firebase config is correct!\n`);

migrateMaelleToAfterimage(sessionId, level)
  .then(() => {
    console.log('\n🎊 Migration completed successfully!');
    console.log('🔗 You can now use the new Maelle character sheet.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  });