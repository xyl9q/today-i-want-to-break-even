                                             

                                 
                      
                 
                      
                    
 

                             
             
                  
               
                 
                        
                              
                           
                     
                    
 

                                 
             
                         
                 
                     
                    
 

                                  
                                      
                                            
                                
 

export const CAREER_KEY = 'desk-trader:career-v1';
export const SETTINGS_KEY = 'desk-trader:settings-v1';

export const DEFAULT_SETTINGS                 = {
  version: 1,
  speed: 2,
  sound: true,
  vibration: true,
  autoSave: true,
};

const finite = (value         )                  => typeof value === 'number' && Number.isFinite(value);

export function parseCareer(raw               )                    {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw)                       ;
    if (value.version !== 1 || !finite(value.nextDay) || value.nextDay < 2 || !finite(value.cash) || value.cash < 0 || !finite(value.tokens) || value.tokens < 0 || !Array.isArray(value.positions)) return null;
    const positions = value.positions.filter((position)                             => {
      if (!position || typeof position !== 'object') return false;
      const candidate = position                           ;
      return typeof candidate.symbol === 'string' && finite(candidate.shares) && candidate.shares >= 0 && finite(candidate.averageCost) && candidate.averageCost >= 0 && finite(candidate.lastPrice) && candidate.lastPrice > 0;
    });
    return {
      version: 1,
      nextDay: Math.floor(value.nextDay),
      cash: value.cash,
      tokens: Math.floor(value.tokens),
      checkInStreak: finite(value.checkInStreak) ? Math.max(0, Math.floor(value.checkInStreak)) : 0,
      positions,
      cumulativeCaught: finite(value.cumulativeCaught) ? Math.max(0, Math.floor(value.cumulativeCaught)) : 0,
      bestAssets: finite(value.bestAssets) ? Math.max(0, value.bestAssets) : value.cash,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function loadCareer(storage                 )                    {
  return parseCareer(storage.getItem(CAREER_KEY));
}

export function storeCareer(storage                 , career            )       {
  storage.setItem(CAREER_KEY, JSON.stringify(career));
}

export function clearCareer(storage                 )       {
  storage.removeItem(CAREER_KEY);
}

export function parseSettings(raw               )                 {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const value = JSON.parse(raw)                           ;
    const validSpeeds = [1, 1.5, 2, 3];
    return {
      version: 1,
      speed: validSpeeds.includes(Number(value.speed)) ? Number(value.speed)                            : DEFAULT_SETTINGS.speed,
      sound: typeof value.sound === 'boolean' ? value.sound : DEFAULT_SETTINGS.sound,
      vibration: typeof value.vibration === 'boolean' ? value.vibration : DEFAULT_SETTINGS.vibration,
      autoSave: typeof value.autoSave === 'boolean' ? value.autoSave : DEFAULT_SETTINGS.autoSave,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function loadSettings(storage                 )                 {
  return parseSettings(storage.getItem(SETTINGS_KEY));
}

export function storeSettings(storage                 , settings                )       {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
