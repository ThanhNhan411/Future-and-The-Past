import { useEffect, useRef, useState } from 'react';
import { GameEngine, GameUIState } from './game/GameEngine';

const LEVELS = [
  { id: 1, name: "Màn 1: Tàn tích Khởi nguyên", icon: "🌱", description: "Sử dụng hạt giống của quá khứ để mở lối tương lai.", locked: false },
  { id: 2, name: "Màn 2: Hệ thống Tiêu chuẩn", icon: "⚙️", description: "Đồng bộ hóa để vượt qua hố acid độc.", locked: false },
  { id: 3, name: "Màn 3: Lõi Không Gian", icon: "🌌", description: "Bí mật ẩn giấu ở tầng cao nhất.", locked: true },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [currentLevelId, setCurrentLevelId] = useState<number | null>(null);
  const [uiState, setUiState] = useState<GameUIState>({
    timeLeft: 20,
    p1Role: 'past',
    p2Role: 'future',
    isNearingSwap: false,
    isSwapping: false
  });

  useEffect(() => {
    if (currentLevelId !== null && canvasRef.current && !engine) {
      const newEngine = new GameEngine(canvasRef.current, currentLevelId);
      newEngine.onUIUpdate = (state) => {
        setUiState(state);
      };
      newEngine.start();
      setEngine(newEngine);
    }
    return () => {
      if (engine) engine.stop();
    };
  }, [currentLevelId, engine]);

  const handleBackToMenu = () => {
    if (engine) {
        engine.stop();
        setEngine(null);
    }
    setCurrentLevelId(null);
  };

  if (currentLevelId === null) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white font-sans">
        <div className="max-w-3xl w-full bg-neutral-900 p-8 rounded-xl border border-neutral-800 shadow-2xl flex flex-col items-center">
          <h1 className="text-5xl font-black mb-2 text-center tracking-tight bg-gradient-to-r from-red-500 to-cyan-500 bg-clip-text text-transparent">Chrono Twin</h1>
          <p className="text-neutral-400 text-center mb-8 uppercase tracking-widest text-sm font-semibold">Role-Swapping Platformer</p>
          
          <div className="grid grid-cols-2 gap-6 w-full mb-8">
            <div className="bg-neutral-800/50 p-6 rounded-lg border border-red-900/30">
              <h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span> P1 (Người chơi 1)
              </h2>
              <ul className="text-sm space-y-3 text-neutral-300">
                <li className="flex justify-between items-center">Di chuyển <div><kbd className="bg-neutral-700 px-2 py-1 flex-shrink-0 text-xs rounded text-white border-b-2 border-neutral-600">W A S D</kbd></div></li>
                <li className="flex justify-between items-center">Tương tác <div><kbd className="bg-neutral-700 px-2 py-1 flex-shrink-0 text-xs rounded text-white border-b-2 border-neutral-600">E</kbd></div></li>
              </ul>
            </div>
            
            <div className="bg-neutral-800/50 p-6 rounded-lg border border-cyan-900/30">
              <h2 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse"></span> P2 (Người chơi 2)
              </h2>
              <ul className="text-sm space-y-3 text-neutral-300">
                <li className="flex justify-between items-center">Di chuyển <div><kbd className="bg-neutral-700 px-2 flex-shrink-0 py-1 text-xs rounded text-white border-b-2 border-neutral-600">Arrows</kbd></div></li>
                <li className="flex justify-between items-center">Tương tác <div><kbd className="bg-neutral-700 px-2 flex-shrink-0 py-1 text-xs rounded text-white border-b-2 border-neutral-600">Enter</kbd></div></li>
              </ul>
            </div>
          </div>

          <div className="w-full">
            <h3 className="font-bold text-neutral-300 mb-4 text-center">CHỌN MÀN CHƠI</h3>
            <div className="space-y-3">
                {LEVELS.map(level => (
                    <button
                        key={level.id}
                        disabled={level.locked}
                        onClick={() => setCurrentLevelId(level.id)}
                        className={`w-full flex items-center p-4 rounded-xl border transition-all text-left ${
                            level.locked 
                            ? 'bg-neutral-900 border-neutral-800 opacity-50 cursor-not-allowed grayscale'
                            : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700 hover:border-neutral-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer'
                        }`}
                    >
                        <div className="text-3xl mr-4">{level.locked ? '🔒' : level.icon}</div>
                        <div className="flex-1">
                            <h4 className={`font-bold text-lg ${level.locked ? 'text-neutral-500' : 'text-white'}`}>{level.name}</h4>
                            <p className="text-xs text-neutral-400">{level.locked ? 'Yêu cầu hoàn thành màn trước' : level.description}</p>
                        </div>
                        {!level.locked && (
                            <div className="bg-white text-black px-4 py-2 rounded font-bold text-sm">CHƠI</div>
                        )}
                    </button>
                ))}
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center font-sans relative overflow-hidden">
      
      {/* 20s Warning Flashes */}
      <div 
        className={`pointer-events-none absolute inset-0 border-8 transition-colors duration-100 z-50
          ${uiState.isSwapping ? 'border-red-500 bg-red-500/20' : ''} 
          ${uiState.isNearingSwap && !uiState.isSwapping ? 'border-red-600/60 animate-pulse' : 'border-transparent'}`}
      />

      {/* Top Bar UI */}
      <div className="w-[1000px] flex justify-between items-center mb-4 px-4 relative z-10">
        <div className="flex items-center gap-4">
          <button 
             onClick={handleBackToMenu}
             className="px-3 py-1.5 bg-neutral-800 text-white rounded text-sm font-bold border border-neutral-700 hover:bg-neutral-700"
          >
            &larr; MENU
          </button>
          <div className="flex flex-col">
            <span className="text-xs text-neutral-500 uppercase tracking-widest">Left Screen</span>
            <span className="font-bold text-amber-500">Quá Khứ (Past)</span>
          </div>
          <div className="px-3 py-1 bg-neutral-900 rounded border border-neutral-800 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${uiState.p1Role === 'past' ? 'bg-red-500' : 'bg-cyan-500'}`} />
            <span className="text-sm font-medium text-white">
              {uiState.p1Role === 'past' ? 'P1 (WASD)' : 'P2 (Arrows)'}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs text-neutral-500 tracking-widest mb-1">TIME TO SWAP</span>
          <div className={`text-5xl font-black font-mono w-24 text-center tabular-nums
            ${uiState.isNearingSwap ? 'text-red-500 scale-110 shadow-red-500 drop-shadow-lg' : 'text-white'} 
            transition-all duration-300`}>
            {Math.ceil(uiState.timeLeft)}s
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-neutral-900 rounded border border-neutral-800 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${uiState.p2Role === 'future' ? 'bg-cyan-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium text-white">
              {uiState.p2Role === 'future' ? 'P2 (Arrows)' : 'P1 (WASD)'}
            </span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-xs text-neutral-500 uppercase tracking-widest">Right Screen</span>
            <span className="font-bold text-cyan-400">Tương Lai (Future)</span>
          </div>
        </div>
      </div>

      {uiState.isSwapping && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-white text-8xl font-black italic tracking-tighter bg-red-600 px-8 py-2 transform -rotate-12 animate-bounce drop-shadow-2xl text-stroke-2">
            ĐỔI VAI!
          </div>
        </div>
      )}

      {/* Game Canvas Container */}
      <div className="relative shadow-2xl shadow-black/50 rounded-lg overflow-hidden border border-neutral-800">
        <canvas 
          ref={canvasRef}
          width={1000}
          height={500}
          className="bg-black [image-rendering:pixelated]"
        />
      </div>

      <div className="w-[1000px] mt-6 text-center text-sm text-neutral-500 max-w-lg">
        Quá khứ: Gieo hạt (E), Nhận năng lượng, Mở cửa, Đạp công tắc.<br/>
        Tương lai: Trèo lên cây, Lấy khối năng lượng, Ném vào Time Rift.
      </div>
    </div>
  );
}
