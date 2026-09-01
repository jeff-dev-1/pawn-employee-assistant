'use client';

import {
  BaseEdge,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import type { Channel, Routing } from '@/lib/workflow-script';
import { vendorsFor } from '@/lib/workflow-script';

/**
 * The graph half of the replay: three zones, hand-placed nodes, and one active edge.
 *
 * Positions are written out rather than laid out by an algorithm. Nine nodes and a fixed
 * shape do not need a layout engine, and a picture that is the same every time is worth more
 * to a room than an optimal one that moves when a server is added.
 */
const CYAN = 'var(--color-brand-blue)';
const ORANGE = 'var(--color-brand-orange)';
const GREY = 'var(--color-muted)';

const CARD_W = 190;
const CARD_H = 46;

type CardData = {
  title: string;
  tag?: string;
  pills?: string[];
  tone: 'idle' | 'live' | 'fail';
  accent: string;
};
type ZoneData = { label: string; color: string };
type EdgeData = { tone: 'idle' | 'live' | 'fail'; note?: string };

function Card({ data }: NodeProps) {
  const d = data as unknown as CardData;
  const live = d.tone === 'live';
  const color = d.tone === 'fail' ? 'var(--color-brand-red)' : live ? d.accent : 'var(--color-line)';
  return (
    <div
      className="rounded-xl border-2 bg-card px-3 py-2 shadow-sm transition-all"
      style={{
        borderColor: color,
        width: CARD_W,
        boxShadow: live ? `0 0 0 4px color-mix(in srgb, ${color} 18%, transparent)` : undefined,
        borderStyle: d.tone === 'fail' ? 'dashed' : 'solid',
      }}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{d.title}</span>
        {d.tag && (
          <span
            className="shrink-0 rounded-full border px-1.5 py-px font-mono text-[9px] tracking-wide uppercase"
            style={{ borderColor: d.accent, color: d.accent }}
          >
            {d.tag}
          </span>
        )}
      </span>
      {d.pills && (
        <span className="mt-1.5 flex flex-wrap gap-1">
          {d.pills.map((p) => (
            <span
              key={p}
              className="rounded px-1.5 py-px text-[9px]"
              style={{ background: `color-mix(in srgb, ${d.accent} 12%, transparent)`, color: d.accent }}
            >
              {p}
            </span>
          ))}
        </span>
      )}
      <Handle type="target" position={Position.Left} className="!border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!border-0 !bg-transparent" />
    </div>
  );
}

/** A dashed container drawn behind the cards. It is a node so React Flow pans it along. */
function Zone({ data }: NodeProps) {
  const d = data as unknown as ZoneData;
  return (
    <div
      className="pointer-events-none size-full rounded-3xl border-2 border-dashed"
      style={{ borderColor: d.color, background: `color-mix(in srgb, ${d.color} 4%, transparent)` }}
    >
      <span
        className="absolute top-2 left-3 font-mono text-[10px] tracking-widest uppercase"
        style={{ color: d.color }}
      >
        {d.label}
      </span>
    </div>
  );
}

function Spoke({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  const d = (data ?? {}) as EdgeData;
  const fail = d.tone === 'fail';
  const color = fail ? 'var(--color-brand-red)' : d.tone === 'live' ? CYAN : 'var(--color-line)';
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth: d.tone === 'idle' ? 1 : 2.5,
          strokeDasharray: fail ? '6 5' : undefined,
        }}
      />
      {d.tone === 'live' && (
        <>
          <path id={`p-${id}`} d={path} fill="none" stroke="none" />
          <rect width={11} height={11} rx={2.5} x={-5.5} y={-5.5} fill={color}>
            <animateMotion dur="1.1s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1">
              <mpath href={`#p-${id}`} />
            </animateMotion>
          </rect>
        </>
      )}
      {d.note && (
        <text
          x={labelX}
          y={labelY - 6}
          textAnchor="middle"
          className="font-mono"
          style={{ fontSize: 10, fill: color }}
        >
          {d.note}
        </text>
      )}
    </>
  );
}

const nodeTypes = { card: Card, zone: Zone };
const edgeTypes = { spoke: Spoke };

const X = { you: -250, orch: 40, gw: 420, ext: 800 };

/** Every card's home, so the zone boxes can be computed instead of guessed. */
function placeCards(channel: Channel, routing: Routing, agents: string[]) {
  const cards: { id: string; x: number; y: number; h?: number; data: Omit<CardData, 'tone'> }[] = [
    { id: 'you', x: X.you, y: 150, data: { title: 'You', accent: GREY } },
    {
      id: 'orch',
      x: X.orch,
      y: 40,
      h: 66,
      data: {
        title: 'Orchestrator',
        tag: 'app',
        pills: ['plan', 'execute', 'synthesize'],
        accent: ORANGE,
      },
    },
  ];
  agents.forEach((name, i) =>
    cards.push({
      id: name,
      x: X.orch,
      y: 150 + i * 64,
      data: { title: `${name} server`, tag: 'mcp', accent: ORANGE },
    }),
  );
  if (channel === 'portkey') {
    cards.push({
      id: 'gw',
      x: X.gw,
      y: 40,
      h: 92,
      data: {
        title: 'Portkey gateway',
        tag: 'saas',
        pills:
          routing === 'fallback'
            ? ['guardrail', 'fallback', 'cost', 'trace', 'observability']
            : ['guardrail', 'cost', 'trace', 'observability'],
        accent: CYAN,
      },
    });
    cards.push({
      id: 'airs',
      x: X.gw,
      y: 190,
      h: 92,
      data: {
        title: 'Prisma AIRS',
        tag: 'guardrail',
        pills: ['injection', 'toxicity', 'dlp', 'url', 'code', 'redaction'],
        accent: CYAN,
      },
    });
  }
  vendorsFor(routing).forEach((v, i) =>
    cards.push({ id: v, x: X.ext, y: 60 + i * 70, data: { title: v, tag: 'vendor', accent: GREY } }),
  );
  return cards;
}

function box(
  cards: ReturnType<typeof placeCards>,
  ids: string[],
  pad = { x: 26, top: 42, bottom: 24 },
) {
  const inside = cards.filter((c) => ids.includes(c.id));
  const minX = Math.min(...inside.map((c) => c.x));
  const minY = Math.min(...inside.map((c) => c.y));
  return {
    x: minX - pad.x,
    y: minY - pad.top,
    width: Math.max(...inside.map((c) => c.x + CARD_W)) - minX + pad.x * 2,
    height: Math.max(...inside.map((c) => c.y + (c.h ?? CARD_H))) - minY + pad.top + pad.bottom,
  };
}

export function Graph({
  channel,
  routing,
  agents,
  activeEdge,
  failed,
}: {
  channel: Channel;
  routing: Routing;
  agents: string[];
  activeEdge?: string;
  /** The node the current step reports as dead, drawn dashed red. */
  failed?: string;
}) {
  const { nodes, edges } = useMemo(() => {
    const cards = placeCards(channel, routing, agents);
    const live = new Set((activeEdge ?? '').split('|'));
    const litNodes = new Set((activeEdge ?? '').split('-'));

    const zones: Node[] = [
      {
        id: 'z-app',
        type: 'zone',
        position: box(cards, ['orch', ...agents]),
        data: { label: 'your machine · app + mcp', color: ORANGE } satisfies ZoneData,
        style: box(cards, ['orch', ...agents]),
        draggable: false,
        selectable: false,
        zIndex: -1,
      },
      {
        id: 'z-ext',
        type: 'zone',
        position: box(cards, vendorsFor(routing)),
        data: { label: 'llm vendors · external', color: GREY } satisfies ZoneData,
        style: box(cards, vendorsFor(routing)),
        draggable: false,
        selectable: false,
        zIndex: -1,
      },
    ];
    if (channel === 'portkey') {
      const b = box(cards, ['gw', 'airs']);
      zones.push({
        id: 'z-saas',
        type: 'zone',
        position: b,
        data: { label: 'palo alto networks · saas', color: CYAN } satisfies ZoneData,
        style: b,
        draggable: false,
        selectable: false,
        zIndex: -1,
      });
    }

    const nodes: Node[] = [
      ...zones,
      ...cards.map((c) => ({
        id: c.id,
        type: 'card',
        position: { x: c.x, y: c.y },
        draggable: false,
        data: {
          ...c.data,
          tone: c.id === failed ? 'fail' : litNodes.has(c.id) ? 'live' : 'idle',
        } satisfies CardData,
      })),
    ];

    const pairs: [string, string][] = [['you', 'orch']];
    for (const a of agents) pairs.push(['orch', a]);
    if (channel === 'portkey') {
      pairs.push(['orch', 'gw'], ['gw', 'airs']);
      for (const v of vendorsFor(routing)) pairs.push(['gw', v]);
    } else {
      for (const v of vendorsFor(routing)) pairs.push(['orch', v]);
    }

    const edges: Edge[] = pairs.map(([s, t]) => {
      const id = `${s}-${t}`;
      const isFail = failed !== undefined && t === failed && live.has(id);
      return {
        id,
        source: s,
        target: t,
        type: 'spoke',
        data: {
          tone: isFail ? 'fail' : live.has(id) ? 'live' : 'idle',
          note: isFail ? 'failover' : undefined,
        } satisfies EdgeData,
      };
    });
    return { nodes, edges };
  }, [channel, routing, agents, activeEdge, failed]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.12 }}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      panOnDrag
      zoomOnScroll={false}
      preventScrolling={false}
      minZoom={0.4}
    />
  );
}

export function GraphProvider(props: Parameters<typeof Graph>[0]) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}
