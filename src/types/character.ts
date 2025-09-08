export interface Stats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  type: 'action' | 'bonus_action' | 'reaction' | 'passive';
  damage?: string;
  effect?: string;
  range?: string;
  cooldown?: number;
  costsCharges?: number;
}

export type Stance = 'offensive' | 'defensive' | 'agile';

export interface Character {
  id: string;
  name: string;
  role: string;
  stats: Stats;
  currentHP: number;
  maxHP: number;
  abilities: Ability[];
  
  // Character-specific mechanics
  stance?: Stance; // Maelle only
  charges?: number; // Gustave: Overload, Lune: Stains, Sciel: Foretell
  maxCharges?: number;
  
  // Character progression
  level: number;
  
  // Display
  portraitUrl?: string;
  backgroundColor?: string;
}
