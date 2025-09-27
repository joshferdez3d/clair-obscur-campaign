// utils/npcLevelMapper.ts
// Utility to handle mapping between old and new NPC naming conventions

export interface FirebaseNPCLevels {
  newRecruit: number;
  farmhand: number;
}

export interface LocalNPCLevels {
  theChild: number;
  farmhand: number;
}

/**
 * Maps Firebase NPC level format to local state format
 * Handles the transition from "newRecruit" to "theChild"
 */
export const mapFirebaseToLocal = (firebaseLevels?: FirebaseNPCLevels): LocalNPCLevels => {
  return {
    theChild: firebaseLevels?.newRecruit || 1,
    farmhand: firebaseLevels?.farmhand || 1
  };
};

/**
 * Maps local state format back to Firebase format
 * Maintains backward compatibility with existing data
 */
export const mapLocalToFirebase = (localLevels: LocalNPCLevels): FirebaseNPCLevels => {
  return {
    newRecruit: localLevels.theChild,
    farmhand: localLevels.farmhand
  };
};