import { useEffect, useState } from 'react';

const N = 8;
const BEST = { x: 258, y: 174 };

/**
 * Visualización animada del Octopus Optimization Algorithm.
 *
 * Cómo funciona:
 *   - Un estado `t` acumula los segundos transcurridos desde el montaje.
 *   - Un loop con requestAnimationFrame actualiza `t` en cada frame (~60 fps).
 *   - Las posiciones de los brazos se calculan con sin/cos tomando `t` como
 *     parámetro → movimiento orbital + oscilación radial continua.
 */
export default function OctopusViz() {
  const [t, setT] = useState(0);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = () => {
      setT((performance.now() - start) / 1000); // segundos
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 8 brazos que orbitan alrededor de BEST
  const arms = Array.from({ length: N }, (_, i) => {
    // Ángulo base distinto por brazo + rotación lenta global
    const angle = (i / N) * Math.PI * 2 + t * 0.15;
    // Radio que "respira" con sin()
    const radius = 130 + 30 * Math.sin(t * 0.7 + i);
    return {
      x: BEST.x + Math.cos(angle) * radius,
      y: BEST.y + Math.sin(angle) * radius * 0.7, // 0.7 aplasta verticalmente → perspectiva
    };
  });

  return (
    <svg
      className="auth-octomap"
      viewBox="0 0 520 360"
      role="img"
      aria-label="Visualización animada del Octopus Optimization Algorithm"
    >
      <defs>
        <radialGradient id="ooa-head-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="#b7adff" />
          <stop offset="100%" stopColor="#5b3df5" />
        </radialGradient>
      </defs>

      {/* Tentáculos: curvas cuadráticas que ondean con sin/cos en el punto de control */}
      {arms.map((a, i) => (
        <path
          key={`arm-${i}`}
          d={`M ${BEST.x} ${BEST.y}
              Q ${(BEST.x + a.x) / 2 + 20 * Math.sin(t + i)}
                ${(BEST.y + a.y) / 2 - 20 * Math.cos(t + i)}
                ${a.x} ${a.y}`}
          stroke="rgba(183,173,255,0.55)"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      ))}

      {/* Puntos en las puntas de cada brazo */}
      {arms.map((a, i) => (
        <g key={`pt-${i}`}>
          <circle cx={a.x} cy={a.y} r="5"  fill="#ff7faa" opacity="0.85" />
          <circle cx={a.x} cy={a.y} r="11" fill="none"
                  stroke="#ff7faa" strokeOpacity="0.25" strokeWidth="1" />
          <text
            x={a.x + 10}
            y={a.y + 4}
            fill="rgba(255,255,255,0.62)"
            fontSize="10"
            fontFamily="monospace"
          >
            p{i + 1}
          </text>
        </g>
      ))}

      {/* Cabeza del pulpo — posición "best" */}
      <circle cx={BEST.x} cy={BEST.y} r="30" fill="url(#ooa-head-grad)" opacity="0.95" />
      <circle cx={BEST.x} cy={BEST.y} r="47" fill="none"
              stroke="rgba(183,173,255,0.5)" strokeWidth="1.5" strokeDasharray="4 5" />
      <text
        x={BEST.x}
        y={BEST.y - 55}
        fill="rgba(255,255,255,0.9)"
        fontSize="10"
        fontFamily="monospace"
        textAnchor="middle"
      >
        best cost
      </text>
    </svg>
  );
}