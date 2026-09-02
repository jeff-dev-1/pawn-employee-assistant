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
import { Boxes, Database, ShieldCheck, Sparkles, User, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { Channel, Routing } from '@/lib/workflow-script';
import { ROLES, vendorsFor } from '@/lib/workflow-script';

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

const CARD_W = 208;
const CARD_H = 48;

const SIDE = {
  l: Position.Left,
  r: Position.Right,
  t: Position.Top,
  b: Position.Bottom,
} as const;
type Side = keyof typeof SIDE;

type CardData = {
  title: string;
  tag?: string;
  pills?: string[];
  tone: 'idle' | 'live' | 'fail';
  accent: string;
  icon: LucideIcon;
};
type ZoneData = { label: string; color: string };
type EdgeData = {
  tone: 'idle' | 'live' | 'fail';
  note?: string;
  /**
   * An inline check the gateway performs before forwarding, not a hop it can route to.
   * Drawn differently because the first version drew the guardrail as a sibling of the
   * vendors hanging off the gateway, and a reader asked - reasonably - whether the
   * guardrail chooses between the model and the MCP servers. It does not: it returns
   * allow or deny on one outbound model call, and the MCP leg never reaches the gateway
   * at all.
   */
  inline?: boolean;
};

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
        <span className="flex min-w-0 items-center gap-2">
          <d.icon className="size-4 shrink-0" style={{ color: d.accent }} />
          <span className="truncate text-sm font-medium">{d.title}</span>
        </span>
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
      {/* One handle per side, so an edge leaves toward where it is going instead of always
          setting out to the right and doubling back across a zone. */}
      {(['l', 'r', 't', 'b'] as const).map((side) => (
        <span key={side}>
          <Handle
            id={side}
            type="target"
            position={SIDE[side]}
            className="!border-0 !bg-transparent"
          />
          <Handle
            id={`${side}s`}
            type="source"
            position={SIDE[side]}
            className="!border-0 !bg-transparent"
          />
        </span>
      ))}
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

function Spoke({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const d = (data ?? {}) as EdgeData;
  const fail = d.tone === 'fail';
  const color = fail ? 'var(--color-brand-red)' : d.tone === 'live' ? CYAN : 'var(--color-line)';
  const dash = fail ? '6 5' : d.inline ? '2 4' : undefined;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth: d.tone === 'idle' ? 1 : 2.5,
          strokeDasharray: dash,
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

/**
 * Four columns and one row of servers under the orchestrator.
 *
 *   You ──► Orchestrator ─────────►  Portkey gateway
 *              │  │  │              │        │
 *              ▼  ▼  ▼         Prisma AIRS   │
 *             hr  it  policy                 ▼
 *                                  deepseek     moonshot
 *                                  (planner)    (writer)
 *
 * Two things this shape buys. The MCP fan-out goes DOWN: drawn sideways, three edges left the
 * orchestrator's right edge, doubled back and crossed the zone they belong to, which is both
 * ugly and a lie about the shape of the call - down says the true thing, that those three go
 * at once. And the vendors hang BELOW the gateway rather than beside it, which keeps the
 * whole picture near the canvas's aspect ratio instead of a letterbox strip with the bottom
 * two thirds empty.
 */
// `you` used to sit a full column out on its own, which made fitView reserve a third of
// the canvas for one card. Tucked against the app zone instead.
const X = { you: -170, orch: 40, gw: 460 };
// ext clears the SaaS zone's bottom edge (airs at mcp + its height + padding), or the
// two dashed boxes overlap and the picture stops meaning anything.
const Y = { top: 40, mcp: 230, ext: 440 };
const GAP = 236;

/** Which side each edge leaves from and arrives at, so nothing loops back on itself. */
const SIDES: Record<string, [Side, Side]> = {
  'you-orch': ['r', 'l'],
  'orch-gw': ['r', 'l'],
  'gw-airs': ['b', 't'],
};

/** The vendor cards sit under the gateway, so those edges drop rather than reach across. */
const DOWN_TO_VENDOR = new Set(ROLES.map((r) => `gw-${r.vendor}`));

function sidesFor(id: string): [Side, Side] {
  if (SIDES[id]) return SIDES[id]!;
  if (DOWN_TO_VENDOR.has(id)) return ['b', 't'];
  if (id.startsWith('orch-')) return ['b', 't']; // the MCP fan-out drops straight down
  return ['r', 'l']; // direct channel: the orchestrator reaches a vendor sideways
}

/** Every card's home, so the zone boxes can be computed instead of guessed. */
function placeCards(channel: Channel, routing: Routing, agents: string[]) {
  const cards: { id: string; x: number; y: number; h?: number; data: Omit<CardData, 'tone'> }[] = [
    { id: 'you', x: X.you, y: Y.top + 70, data: { title: 'You', accent: GREY, icon: User } },
    {
      id: 'orch',
      x: X.orch + GAP,
      y: Y.top,
      h: 70,
      data: {
        title: 'Orchestrator',
        icon: Sparkles,
        tag: 'app',
        pills: ['plan', 'execute', 'synthesize'],
        accent: ORANGE,
      },
    },
  ];
  // Centred under the orchestrator, so the fan is symmetrical however many servers register.
  const spread = (agents.length - 1) * GAP;
  agents.forEach((name, i) =>
    cards.push({
      id: name,
      x: X.orch + GAP + i * GAP - spread / 2,
      y: Y.mcp,
      data: { title: `${name} server`, tag: 'mcp', accent: ORANGE, icon: Database },
    }),
  );
  // GAP alone leaves the app zone's padded edge touching the SaaS zone's. The gutter is
  // what keeps two dashed boxes from sharing a border and reading as one region.
  const rightX = X.orch + GAP + spread / 2 + GAP + 90;
  const gwX = rightX + GAP / 2;
  if (channel === 'portkey') {
    cards.push({
      id: 'gw',
      x: gwX,
      y: Y.top,
      h: 96,
      data: {
        title: 'Portkey gateway',
        icon: Boxes,
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
      x: rightX,
      y: Y.mcp,
      h: 96,
      data: {
        title: 'Prisma AIRS',
        icon: ShieldCheck,
        // "hook", not "guardrail": the tag says what it IS to the gateway, not what it does.
        tag: 'inline hook',
        pills: ['injection', 'toxicity', 'dlp', 'url', 'code', 'redaction'],
        accent: CYAN,
      },
    });
  }
  // Under the gateway on `portkey`; beside the orchestrator on `direct`, where there is no
  // gateway between them and a long drop would draw a hop that does not exist.
  ROLES.forEach((r, i) =>
    cards.push({
      id: r.vendor,
      x: channel === 'portkey' ? gwX + (i - (ROLES.length - 1) / 2) * GAP : rightX,
      y: channel === 'portkey' ? Y.ext : Y.top + i * 84,
      data: { title: r.vendor, tag: r.role, accent: GREY, icon: Sparkles },
    }),
  );
  return cards;
}

function box(
  cards: ReturnType<typeof placeCards>,
  ids: string[],
  pad = { x: 30, top: 46, bottom: 26 },
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
      const [from, to] = sidesFor(id);
      const inline = id === 'gw-airs';
      return {
        id,
        source: s,
        target: t,
        sourceHandle: `${from}s`,
        targetHandle: to,
        type: 'spoke',
        data: {
          tone: isFail ? 'fail' : live.has(id) ? 'live' : 'idle',
          note: isFail ? 'failover' : inline ? 'inline check' : undefined,
          inline,
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
