import React, { useState, useEffect } from 'react';
import { Zap, Target, X, Shield } from 'lucide-react';
import type { BattleToken } from '../../types';

interface TurretManagerProps {
  tokens: BattleToken[];
  isGustavesTurn: boolean;
  onApplyTurretDamage: (turretId: string, targetId: string, damage: number) => void;
  onDestroyTurret: (turretId: string) => void;
}

export function TurretManager({
  tokens,
  isGustavesTurn,
  onApplyTurretDamage,
  onDestroyTurret
}: TurretManagerProps) {
  const [showTurretPopup, setShowTurretPopup] = useState(false);
  const [activeTurrets, setActiveTurrets] = useState<BattleToken[]>([]);

  // Calculate distance between two positions
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5; // Convert to feet
  };

  // Find all turret tokens
  useEffect(() => {
    const turrets = tokens.filter(token => 
      token.name.includes('Turret') && 
      token.type === 'npc' && 
      (token.hp || 0) > 0
    );
    setActiveTurrets(turrets);
  }, [tokens]);

  // Show turret popup at start of Gustave's turn if turrets exist
  useEffect(() => {
    if (isGustavesTurn && activeTurrets.length > 0) {
      setShowTurretPopup(true);
    }
  }, [isGustavesTurn, activeTurrets.length]);

  // Get closest enemy to a turret within 20ft range
  const getClosestEnemyToTurret = (turret: BattleToken): BattleToken | null => {
    const enemies = tokens.filter(token => token.type === 'enemy' && (token.hp || 0) > 0);
    
    let closestEnemy: BattleToken | null = null;
    let closestDistance = Infinity;
    
    enemies.forEach(enemy => {
      const distance = calculateDistance(turret.position, enemy.position);
      if (distance <= 20 && distance < closestDistance) {
        closestDistance = distance;
        closestEnemy = enemy;
      }
    });
    
    return closestEnemy;
  };

  // Apply turret damage
  const handleTurretAttack = (turretId: string, targetId: string) => {
    const damage = Math.floor(Math.random() * 6) + 1; // 1d6 damage
    onApplyTurretDamage(turretId, targetId, damage);
  };

  // Skip turret for this turn
  const handleSkipTurret = () => {
    setShowTurretPopup(false);
  };

  if (!showTurretPopup || activeTurrets.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-clair-gold-400 flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Turret Attacks - Gustave's Turn
          </h3>
          <button
            onClick={handleSkipTurret}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {activeTurrets.map(turret => {
            const closestEnemy = getClosestEnemyToTurret(turret);
            
            return (
              <div key={turret.id} className="bg-clair-shadow-700 rounded-lg p-4 border border-clair-shadow-400">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-clair-gold-200">{turret.name}</h4>
                    <p className="text-sm text-clair-gold-300">
                      Position: ({turret.position.x}, {turret.position.y}) • HP: {turret.hp}/{turret.maxHp}
                    </p>
                  </div>
                  <button
                    onClick={() => onDestroyTurret(turret.id)}
                    className="text-red-400 hover:text-red-300 text-xs px-2 py-1 border border-red-400 rounded"
                  >
                    Destroy
                  </button>
                </div>

                {closestEnemy ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-clair-shadow-600 rounded">
                      <div>
                        <span className="font-bold text-clair-gold-200">{closestEnemy.name}</span>
                        <span className="text-sm text-clair-gold-300 ml-2">
                          ({calculateDistance(turret.position, closestEnemy.position)}ft away)
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-red-400">{closestEnemy.hp}/{closestEnemy.maxHp} HP</div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleTurretAttack(turret.id, closestEnemy.id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-bold flex items-center justify-center"
                      >
                        <Target className="w-4 h-4 mr-2" />
                        Attack (1d6 damage)
                      </button>
                      <button
                        onClick={() => {
                          // Grant +1 AC to nearest ally instead
                          console.log(`Turret ${turret.id} grants +1 AC to nearby ally`);
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-bold flex items-center justify-center"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Support Ally
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-clair-gold-400">No enemies within 20ft range</p>
                    <button
                      onClick={() => {
                        console.log(`Turret ${turret.id} provides defensive support`);
                      }}
                      className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-bold"
                    >
                      Provide +1 AC to Nearby Allies
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-clair-gold-900 bg-opacity-20 rounded-lg border border-clair-gold-600">
          <h4 className="font-serif font-bold text-clair-gold-400 text-sm mb-1">Turret Rules:</h4>
          <ul className="text-xs text-clair-gold-300 space-y-1">
            <li>• Turrets activate at the start of Gustave's turn</li>
            <li>• Attack closest enemy within 20ft or support nearby allies</li>
            <li>• Turrets have 10 HP and can be targeted by enemies</li>
            <li>• Destroyed turrets stop functioning</li>
          </ul>
        </div>

        <button
          onClick={handleSkipTurret}
          className="w-full mt-4 bg-clair-gold-600 hover:bg-clair-gold-700 text-clair-shadow-900 px-4 py-2 rounded font-bold"
        >
          Continue Turn
        </button>
      </div>
    </div>
  );
}