// src/utils/enemyHelperUtil.ts
import type { BattleToken, InitiativeEntry, BattleSession } from '../types';

export interface EnemyGroup {
  type: string;
  count: number;
  tokens: BattleToken[];
  initiative?: number;
}

// Helper function to get enemy groups from tokens
export function getEnemyGroups(tokens: Record<string, BattleToken>): EnemyGroup[] {
  const groups: Record<string, EnemyGroup> = {};
  
  Object.values(tokens).forEach(token => {
    if (token.type === 'enemy') {
      if (!groups[token.name]) {
        groups[token.name] = {
          type: token.name,
          count: 0,
          tokens: []
        };
      }
      groups[token.name].count++;
      groups[token.name].tokens.push(token);
    }
  });
  
  return Object.values(groups);
}

// Helper function to update initiative for enemy groups
export function updateEnemyGroupsInInitiative(
  currentInitiative: InitiativeEntry[],
  tokens: Record<string, BattleToken>
): InitiativeEntry[] {
  const enemyGroups = getEnemyGroups(tokens);
  let updatedInitiative = [...currentInitiative];
  
  // Update existing enemy entries with current counts
  updatedInitiative = updatedInitiative.map(entry => {
    if (entry.type === 'enemy' && !entry.characterId) {
      // This is a group entry
      const baseName = entry.name.replace(/ \(x\d+\)/, ''); // Remove count suffix
      const group = enemyGroups.find(g => g.type === baseName);
      
      if (group) {
        // Update count in name
        return {
          ...entry,
          name: group.count > 1 ? `${baseName} (x${group.count})` : baseName
        };
      } else {
        // No enemies of this type remain, mark for removal
        return null;
      }
    }
    return entry;
  }).filter(Boolean) as InitiativeEntry[];
  
  return updatedInitiative;
}

// Helper function to handle enemy turn in combat
export function handleEnemyGroupTurn(
  groupId: string,
  tokens: Record<string, BattleToken>,
  session: BattleSession | null
) {
  // Find all enemies in this group
  const groupEntry = session?.combatState?.initiativeOrder.find(e => e.id === groupId);
  if (!groupEntry) return;
  
  const groupName = groupEntry.name.replace(/ \(x\d+\)/, '');
  const enemiesInGroup = Object.values(tokens).filter(
    token => token.type === 'enemy' && token.name === groupName && (token.hp || 0) > 0
  );
  
  console.log(`🎮 ${groupName} group's turn - ${enemiesInGroup.length} active enemies`);
  
  // This is where you'll add AI behavior later
  // For now, just log which enemies can act
  enemiesInGroup.forEach(enemy => {
    console.log(`  - ${enemy.name} at (${enemy.position.x}, ${enemy.position.y}) - HP: ${enemy.hp}/${enemy.maxHp}`);
  });
  
  // Return the list of enemies that can act this turn
  return enemiesInGroup;
}

// Helper function to clean up defeated enemies from initiative
export function cleanupDefeatedEnemies(
  tokens: Record<string, BattleToken>,
  initiativeOrder: InitiativeEntry[]
): InitiativeEntry[] {
  const enemyGroups = getEnemyGroups(tokens);
  
  // Filter out groups with no active enemies
  const updatedInitiative = initiativeOrder.filter(entry => {
    if (entry.type === 'enemy' && !entry.characterId) {
      const baseName = entry.name.replace(/ \(x\d+\)/, '');
      const group = enemyGroups.find(g => g.type === baseName);
      return group && group.count > 0;
    }
    return true; // Keep all non-enemy entries
  });
  
  // Update counts for remaining groups
  return updateEnemyGroupsInInitiative(updatedInitiative, tokens);
}