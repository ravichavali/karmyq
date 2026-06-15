'use client';

import { useEffect, useRef } from 'react';
import { connectionDistanceFor, rescaleNodes, type FieldNode } from '@/lib/networkField';

type Node = FieldNode;

const COLORS = [
  'rgba(61, 139, 53, 0.6)',   // green
  'rgba(241, 147, 68, 0.5)',  // orange
  'rgba(51, 169, 158, 0.5)',  // teal
  'rgba(180, 132, 85, 0.4)',  // brown
  'rgba(136, 191, 132, 0.5)', // light green
];

export default function NetworkVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize nodes against the current CSS size.
    const count = window.innerWidth < 768 ? 20 : 35;
    let prevW = canvas.offsetWidth;
    let prevH = canvas.offsetHeight;

    nodesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * prevW,
      y: Math.random() * prevH,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: 3 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    // Size the backing buffer for the device pixel ratio. Assigning canvas.width/height already
    // resets the 2D transform to identity, so scaling once per resize never accumulates. On every
    // resize we also redistribute the nodes into the new bounds (S99-005) so the field never
    // clusters or clamps against stale dimensions.
    const resize = () => {
      const cssW = canvas.offsetWidth;
      const cssH = canvas.offsetHeight;
      canvas.width = cssW * window.devicePixelRatio;
      canvas.height = cssH * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      nodesRef.current = rescaleNodes(nodesRef.current, prevW, prevH, cssW, cssH);
      prevW = cssW;
      prevH = cssH;
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const cw = canvas.offsetWidth;
      const ch = canvas.offsetHeight;
      const connectionDistance = connectionDistanceFor(cw, ch);
      ctx.clearRect(0, 0, cw, ch);

      const nodes = nodesRef.current;

      // Update positions
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > cw) node.vx *= -1;
        if (node.y < 0 || node.y > ch) node.vy *= -1;
        node.x = Math.max(0, Math.min(cw, node.x));
        node.y = Math.max(0, Math.min(ch, node.y));
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDistance) {
            const alpha = (1 - dist / connectionDistance) * 0.15;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(61, 139, 53, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2.5, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(
          node.x, node.y, node.radius * 0.5,
          node.x, node.y, node.radius * 2.5
        );
        grad.addColorStop(0, node.color.replace(/[\d.]+\)$/, '0.15)'));
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
}
