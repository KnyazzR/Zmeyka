import { useState, useEffect, useCallback, useRef } from 'react';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

const GRID_SIZE = 20;
const SPEEDS: Record<Difficulty, number> = {
  easy: 150,
  medium: 100,
  hard: 60,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Легко',
  medium: 'Средне',
  hard: 'Сложно',
};

function getRandomPosition(snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [showEatAnimation, setShowEatAnimation] = useState(false);

  const directionRef = useRef<Direction>('RIGHT');
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastDirectionRef = useRef<Direction>('RIGHT');

  const initGame = useCallback(() => {
    const initialSnake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    setSnake(initialSnake);
    setFood(getRandomPosition(initialSnake));
    setScore(0);
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    lastDirectionRef.current = 'RIGHT';
  }, []);

  const startGame = useCallback(() => {
    initGame();
    setGameState('playing');
  }, [initGame]);

  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  }, [gameState]);

  const changeDirection = useCallback((newDir: Direction) => {
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN',
      DOWN: 'UP',
      LEFT: 'RIGHT',
      RIGHT: 'LEFT',
    };
    if (opposites[newDir] !== lastDirectionRef.current) {
      directionRef.current = newDir;
      setDirection(newDir);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'menu') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }

      if (gameState === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      if (gameState !== 'playing') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          changeDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          changeDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          changeDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          changeDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, changeDirection, startGame, togglePause]);

  // Touch controls
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || gameState !== 'playing') return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const minSwipe = 30;

      if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        changeDirection(dy > 0 ? 'DOWN' : 'UP');
      }
      touchStartRef.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState, changeDirection]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    gameLoopRef.current = window.setInterval(() => {
      setSnake(prevSnake => {
        const head = { ...prevSnake[0] };
        const dir = directionRef.current;
        lastDirectionRef.current = dir;

        switch (dir) {
          case 'UP': head.y -= 1; break;
          case 'DOWN': head.y += 1; break;
          case 'LEFT': head.x -= 1; break;
          case 'RIGHT': head.x += 1; break;
        }

        // Wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          setGameState('gameover');
          setScore(prev => {
            if (prev > highScore) {
              setHighScore(prev);
              localStorage.setItem('snake-high-score', prev.toString());
            }
            return prev;
          });
          return prevSnake;
        }

        // Self collision
        if (prevSnake.some(s => s.x === head.x && s.y === head.y)) {
          setGameState('gameover');
          setScore(prev => {
            if (prev > highScore) {
              setHighScore(prev);
              localStorage.setItem('snake-high-score', prev.toString());
            }
            return prev;
          });
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // Food collision
        setFood(prevFood => {
          if (head.x === prevFood.x && head.y === prevFood.y) {
            setScore(prev => prev + 10);
            setShowEatAnimation(true);
            setTimeout(() => setShowEatAnimation(false), 300);
            return getRandomPosition(newSnake);
          }
          newSnake.pop();
          return prevFood;
        });

        return newSnake;
      });
    }, SPEEDS[difficulty]);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameState, difficulty, highScore]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;

    // Clear
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }

    // Snake
    snake.forEach((segment, index) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const padding = 1;

      if (index === 0) {
        // Head
        const gradient = ctx.createRadialGradient(
          x + cellSize / 2, y + cellSize / 2, 0,
          x + cellSize / 2, y + cellSize / 2, cellSize / 2
        );
        gradient.addColorStop(0, '#4ade80');
        gradient.addColorStop(1, '#16a34a');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 4);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        const eyeSize = cellSize * 0.15;
        let eye1x = x + cellSize * 0.35;
        let eye1y = y + cellSize * 0.35;
        let eye2x = x + cellSize * 0.65;
        let eye2y = y + cellSize * 0.35;

        if (direction === 'DOWN') {
          eye1y = y + cellSize * 0.65;
          eye2y = y + cellSize * 0.65;
        } else if (direction === 'LEFT') {
          eye1x = x + cellSize * 0.35;
          eye1y = y + cellSize * 0.35;
          eye2x = x + cellSize * 0.35;
          eye2y = y + cellSize * 0.65;
        } else if (direction === 'RIGHT') {
          eye1x = x + cellSize * 0.65;
          eye1y = y + cellSize * 0.35;
          eye2x = x + cellSize * 0.65;
          eye2y = y + cellSize * 0.65;
        }

        ctx.beginPath();
        ctx.arc(eye1x, eye1y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2x, eye2y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Body
        const alpha = 1 - (index / snake.length) * 0.4;
        ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x + padding + 1, y + padding + 1, cellSize - (padding + 1) * 2, cellSize - (padding + 1) * 2, 3);
        ctx.fill();
      }
    });

    // Food
    const foodX = food.x * cellSize + cellSize / 2;
    const foodY = food.y * cellSize + cellSize / 2;
    const foodRadius = cellSize * 0.35;

    // Food glow
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    const foodGradient = ctx.createRadialGradient(foodX, foodY, 0, foodX, foodY, foodRadius);
    foodGradient.addColorStop(0, '#fca5a5');
    foodGradient.addColorStop(1, '#ef4444');
    ctx.fillStyle = foodGradient;
    ctx.beginPath();
    ctx.arc(foodX, foodY, foodRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

  }, [snake, food, direction]);

  // Canvas resize
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container) return;
      const size = Math.min(container.clientWidth, container.clientHeight, 500);
      canvas.width = size;
      canvas.height = size;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const handleDPad = (dir: Direction) => {
    if (gameState === 'playing') {
      changeDirection(dir);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4 select-none overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-lg mb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent mb-2">
          🐍 Змейка
        </h1>

        {/* Score bar */}
        <div className="flex justify-between items-center bg-slate-800/80 backdrop-blur rounded-xl px-4 py-2 border border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Счёт:</span>
            <span className={`text-xl font-bold text-green-400 transition-transform duration-200 ${showEatAnimation ? 'scale-125' : 'scale-100'}`}>
              {score}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Рекорд:</span>
            <span className="text-xl font-bold text-amber-400">
              {highScore}
            </span>
          </div>
        </div>
      </div>

      {/* Game area */}
      <div className="relative w-full max-w-lg aspect-square">
        <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-slate-700/50 shadow-2xl shadow-green-900/20 bg-slate-900">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
          />

          {/* Menu overlay */}
          {gameState === 'menu' && (
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center gap-6 animate-fadeIn">
              <div className="text-6xl mb-2 animate-bounce">🐍</div>
              <h2 className="text-2xl font-bold text-white">Змейка</h2>

              {/* Difficulty selector */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-slate-400 text-sm">Сложность:</span>
                <div className="flex gap-2">
                  {(Object.keys(SPEEDS) as Difficulty[]).map(d => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                        difficulty === d
                          ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 scale-105'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {DIFFICULTY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={startGame}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl text-lg shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 transition-all duration-200 active:scale-95"
              >
                Начать игру
              </button>

              <div className="text-slate-500 text-xs text-center mt-2">
                <p>🖥️ Стрелки / WASD — управление</p>
                <p>📱 Свайпы — управление</p>
                <p>⏸️ Пробел — пауза</p>
              </div>
            </div>
          )}

          {/* Paused overlay */}
          {gameState === 'paused' && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 animate-fadeIn">
              <div className="text-5xl">⏸️</div>
              <h2 className="text-2xl font-bold text-white">Пауза</h2>
              <button
                onClick={togglePause}
                className="px-6 py-2 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all duration-200 active:scale-95"
              >
                Продолжить
              </button>
              <button
                onClick={startGame}
                className="px-6 py-2 bg-slate-600 text-white font-medium rounded-xl hover:bg-slate-500 transition-all duration-200 active:scale-95"
              >
                Перезапуск
              </button>
            </div>
          )}

          {/* Game Over overlay */}
          {gameState === 'gameover' && (
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4 animate-fadeIn">
              <div className="text-5xl">💀</div>
              <h2 className="text-2xl font-bold text-red-400">Игра окончена!</h2>
              <div className="text-center">
                <p className="text-slate-300">Ваш счёт: <span className="text-green-400 font-bold text-xl">{score}</span></p>
                {score >= highScore && score > 0 && (
                  <p className="text-amber-400 text-sm mt-1 animate-pulse">🏆 Новый рекорд!</p>
                )}
              </div>

              {/* Difficulty selector */}
              <div className="flex gap-2 mt-2">
                {(Object.keys(SPEEDS) as Difficulty[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
                      difficulty === d
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {DIFFICULTY_LABELS[d]}
                  </button>
                ))}
              </div>

              <button
                onClick={startGame}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl text-lg shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 transition-all duration-200 active:scale-95"
              >
                Играть снова
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-lg mt-4">
        {/* Action buttons */}
        <div className="flex justify-center gap-3 mb-4">
          {gameState === 'playing' && (
            <button
              onClick={togglePause}
              className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-all duration-200 active:scale-95 flex items-center gap-2"
            >
              <span>⏸️</span> Пауза
            </button>
          )}
          {(gameState === 'playing' || gameState === 'paused') && (
            <button
              onClick={startGame}
              className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-all duration-200 active:scale-95 flex items-center gap-2"
            >
              <span>🔄</span> Перезапуск
            </button>
          )}
        </div>

        {/* D-Pad for mobile */}
        <div className="flex justify-center md:hidden">
          <div className="grid grid-cols-3 gap-1 w-40">
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDPad('UP'); }}
              className="bg-slate-700/80 text-white rounded-lg p-3 active:bg-green-500 transition-colors flex items-center justify-center text-xl"
            >
              ▲
            </button>
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDPad('LEFT'); }}
              className="bg-slate-700/80 text-white rounded-lg p-3 active:bg-green-500 transition-colors flex items-center justify-center text-xl"
            >
              ◀
            </button>
            <div className="bg-slate-800/50 rounded-lg flex items-center justify-center text-slate-600 text-xs">
              ●
            </div>
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDPad('RIGHT'); }}
              className="bg-slate-700/80 text-white rounded-lg p-3 active:bg-green-500 transition-colors flex items-center justify-center text-xl"
            >
              ▶
            </button>
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDPad('DOWN'); }}
              className="bg-slate-700/80 text-white rounded-lg p-3 active:bg-green-500 transition-colors flex items-center justify-center text-xl"
            >
              ▼
            </button>
            <div />
          </div>
        </div>
      </div>
    </div>
  );
}
