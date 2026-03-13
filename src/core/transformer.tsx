/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { MarkerType } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import type { DiagramAST } from '../types/ast';

const GRID = 16;
const LAYOUT = {
  NODE_WIDTH: 256,
  NODE_HEIGHT: 160,
  PARALLEL_GAP_X: 272,
  DEPTH_GAP_Y: 208,
  CENTER_X: 640,
  TOP_Y: 64,
  MIDDLE_Y: 256,
  BOTTOM_Y: 496,
};

const SCENE_POSITIONS: Record<string, number> = { '1': 0.1, '2': 0.3, '3': 0.5, '4': 0.7, '5': 0.9 };
const BASIC_POSITIONS: Record<string, number> = { '1': 0.25, '2': 0.75, '3': 0.5 };
const START_TO_SCENE_GAP_Y = 80;
const CONNECTED_NODE_GAP_Y = 96;

export type LayoutDensity = 'compact' | 'normal' | 'airy';

interface DensitySettings {
  parallelGapX: number;
  depthGapY: number;
  topY: number;
  middleY: number;
  processY: number;
  forkY: number;
  bottomY: number;
  minNodeGap: number;
  startToTargetGapY: number;
  connectedNodeGapY: number;
}

const DENSITY_SETTINGS: Record<LayoutDensity, DensitySettings> = {
  compact: {
    parallelGapX: 248,
    depthGapY: 192,
    topY: 64,
    middleY: 224,
    processY: 336,
    forkY: 416,
    bottomY: 512,
    minNodeGap: 112,
    startToTargetGapY: 80,
    connectedNodeGapY: 112,
  },
  normal: {
    parallelGapX: LAYOUT.PARALLEL_GAP_X,
    depthGapY: LAYOUT.DEPTH_GAP_Y,
    topY: LAYOUT.TOP_Y,
    middleY: 304,
    processY: 432,
    forkY: 528,
    bottomY: 640,
    minNodeGap: 120,
    startToTargetGapY: START_TO_SCENE_GAP_Y,
    connectedNodeGapY: CONNECTED_NODE_GAP_Y,
  },
  airy: {
    parallelGapX: 336,
    depthGapY: 272,
    topY: 64,
    middleY: 416,
    processY: 608,
    forkY: 752,
    bottomY: 928,
    minNodeGap: 144,
    startToTargetGapY: 112,
    connectedNodeGapY: 136,
  },
};

interface PositionLike {
  x: number;
  y: number;
}

interface NodeSize {
  width: number;
  height: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  nodeId: string;
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface HandleParts {
  side: string;
  index: string;
}

interface TransitionRecord {
  sourceId: string;
  targetId: string;
  item: any;
  sourceRoleName?: string;
  forcedSourceHandle?: string;
  forcedTargetHandle?: string;
}

interface TransformOptions {
  fixedNodePositions?: Map<string, PositionLike>;
  relayoutAllNodes?: boolean;
  relayoutEdgeNodeIds?: Set<string>;
  density?: LayoutDensity;
}

const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '');
const snap16 = (value: number) => Math.round(value / GRID) * GRID;
const snapPoint = (x: number, y: number) => ({ x: snap16(x), y: snap16(y) });

const getNodeCategory = (element: any) => {
  if (element.type === 'terminal' && element.kind === 'start') return 'start';
  if (element.type === 'terminal') return element.kind;
  return element.type;
};

const getNodeSize = (element: any): NodeSize => {
  if (element.type === 'scene') return { width: 256, height: 160 };
  if (element.type === 'global') return { width: 160, height: 48 };
  if (element.type === 'contact') return { width: 64, height: 64 };
  if (element.type === 'process') return { width: 64, height: 64 };
  if (element.type === 'fork') return { width: 160, height: 16 };
  if (element.type === 'external') return { width: 160, height: 64 };
  if (element.type === 'terminal' && element.kind === 'break') return { width: 128, height: 64 };
  if (element.type === 'terminal') return { width: 32, height: 32 };
  return { width: LAYOUT.NODE_WIDTH, height: LAYOUT.NODE_HEIGHT };
};

const getLaneBaseY = (element: any, density: DensitySettings) => {
  if (element.type === 'terminal' && element.kind === 'start') return density.topY;
  if (element.type === 'global' || element.type === 'contact') return density.topY;
  if (element.type === 'scene') return density.middleY;
  if (element.type === 'process') return density.processY;
  if (element.type === 'fork') return density.forkY;
  if (element.type === 'external') return density.bottomY;
  if (element.type === 'terminal' && (element.kind === 'end' || element.kind === 'break')) return density.bottomY;
  return density.middleY;
};

const isTopTierNode = (element: any) => {
  if (element.type === 'terminal' && element.kind === 'start') return true;
  return element.type === 'global' || element.type === 'contact';
};

const isBottomTierNode = (element: any) => {
  if (element.type === 'external') return true;
  return element.type === 'terminal' && (element.kind === 'end' || element.kind === 'break');
};

const isFixedTierNode = (element: any) => {
  return (
    isTopTierNode(element)
    || isBottomTierNode(element)
    || element.type === 'scene'
    || element.type === 'process'
    || element.type === 'fork'
  );
};

const getHandleCandidates = (
  nodeKind: string,
  role: 'source' | 'target',
  connectionCount: number,
  preferredSide?: string,
  forcedHandle?: string,
) => {
  if (forcedHandle) return [forcedHandle];

  if (nodeKind === 'fork') {
    return role === 'source' ? ['b-2', 'b-3', 't-1'] : ['t-1'];
  }

  const isSceneLike = nodeKind === 'scene' || nodeKind === 'global';
  const indices = isSceneLike ? ['1', '2', '3', '4', '5'] : ['1', '2', '3'];
  const defaultSideOrder = role === 'source' ? ['b', 'r', 'l', 't'] : ['t', 'l', 'r', 'b'];
  const shouldIgnorePreferredSide =
    (role === 'source' && (nodeKind === 'process' || nodeKind === 'fork')) ||
    (role === 'target' && nodeKind === 'external');

  const effectivePreferredSide = shouldIgnorePreferredSide ? undefined : preferredSide;

  const sideOrder = effectivePreferredSide
    ? [
      effectivePreferredSide,
      ...defaultSideOrder.filter((side) => side !== effectivePreferredSide),
    ]
    : defaultSideOrder;

  let indexOrder: string[];
  if (isSceneLike) {
    if (connectionCount <= 1) indexOrder = ['3', '2', '4', '1', '5'];
    else if (connectionCount === 2) indexOrder = ['2', '4', '3', '1', '5'];
    else if (connectionCount === 3) indexOrder = ['1', '3', '5', '2', '4'];
    else indexOrder = ['1', '2', '3', '4', '5'];
  } else {
    if (nodeKind === 'process') {
      indexOrder = ['3', '1', '2'];
    } else if (connectionCount <= 1) indexOrder = ['3', '1', '2'];
    else if (connectionCount === 2) indexOrder = ['1', '2', '3'];
    else indexOrder = ['1', '3', '2'];
  }

  return sideOrder.flatMap((side) => indexOrder.filter((index) => indices.includes(index)).map((index) => `${side}-${index}`));
};

const getHandlePoint = (
  position: PositionLike,
  size: NodeSize,
  nodeKind: string,
  handleId: string,
) => {
  const [side, idxRaw] = handleId.split('-');
  const idx = idxRaw || '3';
  const isSceneLike = nodeKind === 'scene' || nodeKind === 'global';

  let ratio = isSceneLike
    ? (SCENE_POSITIONS[idx] ?? SCENE_POSITIONS['3'])
    : (BASIC_POSITIONS[idx] ?? BASIC_POSITIONS['3']);

  if (nodeKind === 'fork') {
    if (handleId === 't-1') ratio = 0.5;
    else if (handleId === 'b-2') ratio = 0.3;
    else if (handleId === 'b-3') ratio = 0.7;
    else ratio = 0.5;
  }

  const left = position.x;
  const top = position.y;
  const right = position.x + size.width;
  const bottom = position.y + size.height;

  if (side === 't') return { x: snap16(left + size.width * ratio), y: snap16(top) };
  if (side === 'b') return { x: snap16(left + size.width * ratio), y: snap16(bottom) };
  if (side === 'l') return { x: snap16(left), y: snap16(top + size.height * ratio) };
  return { x: snap16(right), y: snap16(top + size.height * ratio) };
};

const parseHandleParts = (handleId: string): HandleParts => {
  const [side = 'r', index = '3'] = handleId.split('-');
  return { side, index };
};

const getHandleSpreadOffset = (handleId: string) => {
  const { index } = parseHandleParts(handleId);
  const spreadMap: Record<string, number> = {
    '1': -2,
    '2': -1,
    '3': 0,
    '4': 1,
    '5': 2,
  };
  return (spreadMap[index] ?? 0) * GRID;
};

const buildOrthogonalSegments = (
  source: PositionLike,
  target: PositionLike,
  sourceHandle?: string,
  targetHandle?: string,
): Segment[] => {
  const sourceParts = parseHandleParts(sourceHandle ?? 'b-3');
  const targetParts = parseHandleParts(targetHandle ?? 't-3');
  const sourceOffset = getHandleSpreadOffset(sourceHandle ?? 'b-3');
  const targetOffset = getHandleSpreadOffset(targetHandle ?? 't-3');

  const routeByX =
    sourceParts.side === 'l' || sourceParts.side === 'r' ||
    targetParts.side === 'l' || targetParts.side === 'r';

  const points = routeByX
    ? [
      source,
      { x: snap16((source.x + target.x) / 2 + sourceOffset + targetOffset), y: snap16(source.y + sourceOffset) },
      { x: snap16((source.x + target.x) / 2 + sourceOffset + targetOffset), y: snap16(target.y + targetOffset) },
      target,
    ]
    : [
      source,
      { x: snap16(source.x + sourceOffset), y: snap16((source.y + target.y) / 2 + sourceOffset + targetOffset) },
      { x: snap16(target.x + targetOffset), y: snap16((source.y + target.y) / 2 + sourceOffset + targetOffset) },
      target,
    ];

  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (a.x === b.x && a.y === b.y) continue;
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }
  return segments;
};

const segmentIntersectsRect = (segment: Segment, rect: Rect, padding = 0) => {
  const expanded: Rect = {
    ...rect,
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };

  const minX = Math.min(segment.x1, segment.x2);
  const maxX = Math.max(segment.x1, segment.x2);
  const minY = Math.min(segment.y1, segment.y2);
  const maxY = Math.max(segment.y1, segment.y2);

  if (segment.x1 === segment.x2) {
    const x = segment.x1;
    const withinX = x >= expanded.x && x <= expanded.x + expanded.width;
    const overlapY = maxY >= expanded.y && minY <= expanded.y + expanded.height;
    return withinX && overlapY;
  }

  if (segment.y1 === segment.y2) {
    const y = segment.y1;
    const withinY = y >= expanded.y && y <= expanded.y + expanded.height;
    const overlapX = maxX >= expanded.x && minX <= expanded.x + expanded.width;
    return withinY && overlapX;
  }

  return false;
};

const segmentsIntersect = (a: Segment, b: Segment) => {
  const aHorizontal = a.y1 === a.y2;
  const bHorizontal = b.y1 === b.y2;

  if (aHorizontal && bHorizontal) {
    if (a.y1 !== b.y1) return false;
    const aMin = Math.min(a.x1, a.x2);
    const aMax = Math.max(a.x1, a.x2);
    const bMin = Math.min(b.x1, b.x2);
    const bMax = Math.max(b.x1, b.x2);
    return aMax >= bMin && bMax >= aMin;
  }

  if (!aHorizontal && !bHorizontal) {
    if (a.x1 !== b.x1) return false;
    const aMin = Math.min(a.y1, a.y2);
    const aMax = Math.max(a.y1, a.y2);
    const bMin = Math.min(b.y1, b.y2);
    const bMax = Math.max(b.y1, b.y2);
    return aMax >= bMin && bMax >= aMin;
  }

  const h = aHorizontal ? a : b;
  const v = aHorizontal ? b : a;
  const hMin = Math.min(h.x1, h.x2);
  const hMax = Math.max(h.x1, h.x2);
  const vMin = Math.min(v.y1, v.y2);
  const vMax = Math.max(v.y1, v.y2);
  return v.x1 >= hMin && v.x1 <= hMax && h.y1 >= vMin && h.y1 <= vMax;
};

const segmentsColinearOverlap = (a: Segment, b: Segment) => {
  const aHorizontal = a.y1 === a.y2;
  const bHorizontal = b.y1 === b.y2;

  if (aHorizontal && bHorizontal && a.y1 === b.y1) {
    const aMin = Math.min(a.x1, a.x2);
    const aMax = Math.max(a.x1, a.x2);
    const bMin = Math.min(b.x1, b.x2);
    const bMax = Math.max(b.x1, b.x2);
    return aMax > bMin && bMax > aMin;
  }

  if (!aHorizontal && !bHorizontal && a.x1 === b.x1) {
    const aMin = Math.min(a.y1, a.y2);
    const aMax = Math.max(a.y1, a.y2);
    const bMin = Math.min(b.y1, b.y2);
    const bMax = Math.max(b.y1, b.y2);
    return aMax > bMin && bMax > aMin;
  }

  return false;
};

const sideForHandle = (handleId: string) => handleId.split('-')[0] || 'r';

const handlePreferencePenalty = (
  sourceKind: string,
  targetKind: string,
  sourceHandle: string,
  targetHandle: string,
  sourceOutgoingCount: number,
  targetIncomingCount: number,
) => {
  let penalty = 0;

  if (sourceKind === 'process') {
    if (sourceOutgoingCount <= 1) {
      if (sourceHandle !== 'b-3') penalty += 1200;
    } else if (sourceHandle === 'b-3') {
      penalty += 0;
    } else if (sideForHandle(sourceHandle) === 'b') {
      penalty += 120;
    } else {
      penalty += 320;
    }
  }

  if (sourceKind === 'fork' && sideForHandle(sourceHandle) !== 'b') {
    penalty += 260;
  }

  if (targetKind === 'process') {
    if (targetHandle === 't-3') {
      penalty += 0;
    } else if (sideForHandle(targetHandle) === 't') {
      penalty += 120;
    } else {
      penalty += 320;
    }
  }

  if (targetKind === 'external') {
    if (targetIncomingCount <= 1) {
      if (targetHandle !== 't-3') penalty += 320;
    } else if (sideForHandle(targetHandle) !== 't') {
      penalty += 180;
    }
  }

  return penalty;
};

const directionPenalty = (
  sourcePoint: PositionLike,
  targetPoint: PositionLike,
  sourceHandle: string,
  targetHandle: string,
) => {
  const dx = targetPoint.x - sourcePoint.x;
  const dy = targetPoint.y - sourcePoint.y;

  const expectedSource = Math.abs(dx) > Math.abs(dy)
    ? (dx >= 0 ? 'r' : 'l')
    : (dy >= 0 ? 'b' : 't');

  const oppositeMap: Record<string, string> = { r: 'l', l: 'r', t: 'b', b: 't' };
  const expectedTarget = oppositeMap[expectedSource];

  let penalty = 0;
  if (sideForHandle(sourceHandle) !== expectedSource) penalty += 80;
  if (sideForHandle(targetHandle) !== expectedTarget) penalty += 80;
  return penalty;
};

const makeRect = (nodeId: string, position: PositionLike, size: NodeSize): Rect => ({
  nodeId,
  x: position.x,
  y: position.y,
  width: size.width,
  height: size.height,
});

const getOppositeSide = (side: string) => {
  if (side === 'l') return 'r';
  if (side === 'r') return 'l';
  if (side === 't') return 'b';
  return 't';
};

const getPreferredSidesByGeometry = (sourceRect: Rect, targetRect: Rect) => {
  const sourceCenterX = sourceRect.x + sourceRect.width / 2;
  const sourceCenterY = sourceRect.y + sourceRect.height / 2;
  const targetCenterX = targetRect.x + targetRect.width / 2;
  const targetCenterY = targetRect.y + targetRect.height / 2;

  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    const sourceSide = dx >= 0 ? 'r' : 'l';
    return { sourceSide, targetSide: getOppositeSide(sourceSide) };
  }

  const sourceSide = dy >= 0 ? 'b' : 't';
  return { sourceSide, targetSide: getOppositeSide(sourceSide) };
};

const getPreferredSidesByKind = (
  sourceKind: string,
  targetKind: string,
  fallback: { sourceSide: string; targetSide: string },
) => {
  if (sourceKind === 'fork' && targetKind === 'scene') {
    return { sourceSide: 't', targetSide: 'b' };
  }

  return fallback;
};

const rectsOverlap = (a: Rect, b: Rect, margin = 40) => {
  return !(
    a.x + a.width + margin < b.x ||
    b.x + b.width + margin < a.x ||
    a.y + a.height + margin < b.y ||
    b.y + b.height + margin < a.y
  );
};

const findAvailablePositionOnLane = (
  nodeId: string,
  baseX: number,
  laneY: number,
  size: NodeSize,
  occupied: Rect[],
  minNodeGap: number,
) => {
  const step = GRID * 2;
  const rectAt = (pos: PositionLike) => makeRect(nodeId, pos, size);
  const offsets: number[] = [0];

  for (let i = 1; i <= 20; i += 1) {
    offsets.push(i, -i);
  }

  for (const offset of offsets) {
    const candidate = snapPoint(baseX + offset * step, laneY);
    const rect = rectAt(candidate);
    const blocked = occupied.some((item) => rectsOverlap(rect, item, minNodeGap));
    if (!blocked) return candidate;
  }

  return snapPoint(baseX, laneY);
};

const getBasePrefix = (speaker: string) => {
  if (speaker === 'user') return 'u: ';
  if (speaker === 'system') return 'd: ';
  if (speaker === 'mixed') return 'd+u: ';
  if (speaker === 'anonymous') return '';
  return '';
};

const getEdgeLabelJSX = (item: any, validationError?: string, overridePrefix?: string): React.ReactNode | null => {
  if (validationError) return <div className="molic-edge-label-container error">🚫 {validationError}</div>;
  if (item.transition?.kind === 'simultaneous') return null;

  const lines: React.ReactNode[] = [];
  const { type, trigger, speaker, text, condition, when, let: letVar, effect, why } = item;
  const transitionWhy = item.transition?.why;
  const whyValue = transitionWhy ?? why;

  const whenText = type === 'event' ? trigger : when;
  if (whenText) {
    lines.push(
      <div key="when" className="molic-edge-label-line meta">
        when: {whenText}
      </div>,
    );
  }

  const hasEmptyCondition = condition !== undefined && condition === '';
  const shouldHideIfLine = speaker === 'system' && hasEmptyCondition;

  if (condition !== undefined && !shouldHideIfLine) {
    lines.push(
      <div key="cond" className="molic-edge-label-line meta">
        if: {condition ?? ''}
      </div>,
    );
  }

  if (type === 'utterance') {
    const basePrefix = overridePrefix ? overridePrefix : getBasePrefix(speaker).replace(': ', '');
    const displayPrefix = speaker === 'system' && hasEmptyCondition ? 'if/d' : basePrefix;

    lines.push(
      <div key="main" className="molic-edge-label-line main">
        <strong>{displayPrefix}:</strong> {text || ''}
      </div>,
    );
  }

  if (letVar) lines.push(<div key="let" className="molic-edge-label-line meta">let: {letVar}</div>);
  if (effect) lines.push(<div key="effect" className="molic-edge-label-line meta">effect: {effect}</div>);
  if (whyValue) lines.push(<div key="why" className="molic-edge-label-line meta">why: {whyValue}</div>);

  if (lines.length === 0) return null;
  return <div className="molic-edge-label-container">{lines}</div>;
};

export const transformer = (
  ast: DiagramAST,
  savedHandles?: Map<string, { sourceHandle: string; targetHandle: string }>,
  options?: TransformOptions,
) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const edgeIdCounter: Record<string, number> = {};
  const nodeTypeMap: Record<string, string> = {};
  const nodeElementMap = new Map(ast.elements.map((element: any) => [element.id, element]));
  const incomingByNode: Record<string, string[]> = {};
  const outgoingByNode: Record<string, string[]> = {};
  const transitions: TransitionRecord[] = [];
  const occupiedRects: Rect[] = [];
  const nodePositions = new Map<string, PositionLike>();
  const existingSegments: Segment[] = [];
  const usedSourceHandles: Record<string, Record<string, number>> = {};
  const usedTargetHandles: Record<string, Record<string, number>> = {};
  const fixedPositions = options?.fixedNodePositions;
  const relayoutAllNodes = options?.relayoutAllNodes === true;
  const densityMode = options?.density ?? 'normal';
  const densitySettings = DENSITY_SETTINGS[densityMode];
  const upsertOccupiedRect = (nodeId: string, position: PositionLike, size: NodeSize) => {
    const next = makeRect(nodeId, position, size);
    const index = occupiedRects.findIndex((item) => item.nodeId === nodeId);
    if (index >= 0) occupiedRects[index] = next;
    else occupiedRects.push(next);
  };

  ast.elements.forEach((el: any) => {
    nodeTypeMap[el.id] = getNodeCategory(el);
    incomingByNode[el.id] = [];
    outgoingByNode[el.id] = [];
  });

  const registerTransition = (
    sourceId: string,
    item: any,
    sourceRoleName?: string,
    forcedSourceHandle?: string,
    forcedTargetHandle?: string,
  ) => {
    if (!item.transition) return;
    const targetId = item.transition.targetId;
    transitions.push({ sourceId, targetId, item, sourceRoleName, forcedSourceHandle, forcedTargetHandle });
    if (incomingByNode[targetId]) incomingByNode[targetId].push(sourceId);
    if (outgoingByNode[sourceId]) outgoingByNode[sourceId].push(targetId);
  };

  ast.elements.forEach((element: any) => {
    if ((element.type === 'scene' || element.type === 'global') && element.exits) {
      element.exits.forEach((item: any) => registerTransition(element.id, item));
      return;
    }

    if (element.type === 'terminal' && element.kind === 'start' && element.content) {
      element.content.forEach((item: any) => {
        const targetElement = nodeElementMap.get(item?.transition?.targetId);
        const forceCentralHandles = targetElement?.type === 'scene';
        registerTransition(
          element.id,
          item,
          undefined,
          forceCentralHandles ? 'b-3' : undefined,
          forceCentralHandles ? 't-3' : undefined,
        );
      });
      return;
    }

    if (element.type === 'contact' && element.content) {
      const roleLabel = element.role || element.id;
      element.content.forEach((item: any) => registerTransition(element.id, item, roleLabel));
      return;
    }

    if (element.type === 'process' && element.content) {
      element.content.forEach((item: any) => registerTransition(element.id, item));
      return;
    }

    if (element.type === 'fork' && element.content) {
      let forkIndex = 0;
      element.content.forEach((item: any) => {
        if (!item.transition) return;
        const forcedHandle = forkIndex === 0 ? 'b-3' : 'b-2';
        registerTransition(element.id, item, undefined, forcedHandle);
        forkIndex += 1;
      });
    }
  });

  const getCenterX = (nodeId: string) => {
    const element = nodeElementMap.get(nodeId);
    const position = nodePositions.get(nodeId);
    if (!element || !position) return null;
    const size = getNodeSize(element);
    return position.x + size.width / 2;
  };

  const placeNodeOnLane = (element: any, centerX: number, laneY: number) => {
    const id = element.id;
    const size = getNodeSize(element);

    if (fixedPositions?.has(id)) {
      const fixed = fixedPositions.get(id);
      if (!fixed) return;
      const fixedY = isFixedTierNode(element) ? laneY : fixed.y;
      const snapped = snapPoint(fixed.x, fixedY);
      nodePositions.set(id, snapped);
      upsertOccupiedRect(id, snapped, size);
      return;
    }

    const baseX = centerX - size.width / 2;
    const available = findAvailablePositionOnLane(
      id,
      baseX,
      laneY,
      size,
      occupiedRects.filter((item) => item.nodeId !== id),
      densitySettings.minNodeGap,
    );
    nodePositions.set(id, available);
    upsertOccupiedRect(id, available, size);
  };

  const sceneElements = ast.elements.filter((element: any) => element.type === 'scene');
  const sceneStartX = LAYOUT.CENTER_X - ((sceneElements.length - 1) * densitySettings.parallelGapX) / 2;
  sceneElements.forEach((scene: any, index: number) => {
    const centerX = sceneStartX + index * densitySettings.parallelGapX + getNodeSize(scene).width / 2;
    placeNodeOnLane(scene, centerX, densitySettings.middleY);
  });

  const firstSceneCenter: number = (sceneElements.length > 0
    ? getCenterX(sceneElements[0].id)
    : null) ?? LAYOUT.CENTER_X;

  const topElements = ast.elements.filter((element: any) => {
    return (element.type === 'terminal' && element.kind === 'start') || element.type === 'global' || element.type === 'contact';
  });

  topElements.forEach((element: any) => {
    const targets = outgoingByNode[element.id] ?? [];
    let anchorCenter = firstSceneCenter;

    if (
      element.type === 'global' &&
      targets.length === 1 &&
      nodeElementMap.get(targets[0])?.type === 'terminal' &&
      nodeElementMap.get(targets[0])?.kind === 'end'
    ) {
      const maxCenter = sceneElements
        .map((scene: any) => getCenterX(scene.id))
        .filter((value): value is number => value !== null)
        .reduce((acc, value) => Math.max(acc, value), firstSceneCenter);
      anchorCenter = maxCenter + densitySettings.parallelGapX;
    } else {
      const firstSceneTarget = targets.find((targetId) => nodeElementMap.get(targetId)?.type === 'scene');
      const firstAnyTarget = targets[0];
      const anchorId = firstSceneTarget ?? firstAnyTarget;
      if (anchorId) {
        anchorCenter = getCenterX(anchorId) ?? anchorCenter;
      }
    }

    placeNodeOnLane(element, anchorCenter, densitySettings.topY);
  });

  const processElements = ast.elements.filter((element: any) => element.type === 'process');
  processElements.forEach((processEl: any) => {
    const sources = incomingByNode[processEl.id] ?? [];
    const firstSceneSource = sources.find((sourceId) => nodeElementMap.get(sourceId)?.type === 'scene');
    const anchorId = firstSceneSource ?? sources[0];
    const anchorCenter = anchorId ? getCenterX(anchorId) ?? firstSceneCenter : firstSceneCenter;
    placeNodeOnLane(processEl, anchorCenter, densitySettings.processY);
  });

  const forkElements = ast.elements.filter((element: any) => element.type === 'fork');
  forkElements.forEach((forkEl: any) => {
    const forkSize = getNodeSize(forkEl);
    const sources = incomingByNode[forkEl.id] ?? [];
    const firstProcessSource = sources.find((sourceId) => nodeElementMap.get(sourceId)?.type === 'process');
    const anchorId = firstProcessSource ?? sources[0];
    const anchorCenter = anchorId ? getCenterX(anchorId) ?? firstSceneCenter : firstSceneCenter;

    if (!fixedPositions?.has(forkEl.id)) {
      const strictX = snap16(anchorCenter - forkSize.width / 2);
      const strictPos = snapPoint(strictX, densitySettings.forkY);
      nodePositions.set(forkEl.id, strictPos);
      upsertOccupiedRect(forkEl.id, strictPos, forkSize);
      return;
    }

    placeNodeOnLane(forkEl, anchorCenter, densitySettings.forkY);
  });

  const bottomElements = ast.elements.filter((element: any) => {
    return element.type === 'external' || (element.type === 'terminal' && (element.kind === 'end' || element.kind === 'break'));
  });

  bottomElements.forEach((element: any) => {
    const sources = incomingByNode[element.id] ?? [];
    const preferredSource = sources.find((sourceId) => {
      const sourceElement = nodeElementMap.get(sourceId);
      return sourceElement?.type === 'scene' || sourceElement?.type === 'global' || sourceElement?.type === 'fork';
    });
    const anchorId = preferredSource ?? sources[0];
    const anchorCenter = anchorId ? getCenterX(anchorId) ?? firstSceneCenter : firstSceneCenter;
    placeNodeOnLane(element, anchorCenter, densitySettings.bottomY);
  });

  // Fallback para quaisquer nós não posicionados explicitamente pelo pipeline.
  ast.elements.forEach((element: any) => {
    if (nodePositions.has(element.id)) return;
    const laneY = getLaneBaseY(element, densitySettings);
    placeNodeOnLane(element, firstSceneCenter, laneY);
  });

  // Garantia final de tiers fixas para evitar cenas/process/fork/entrada/saída fora da lane.
  ast.elements.forEach((element: any) => {
    if (!isFixedTierNode(element)) return;
    const current = nodePositions.get(element.id);
    if (!current) return;

    const laneY = getLaneBaseY(element, densitySettings);
    if (current.y === laneY) return;

    const clamped = snapPoint(current.x, laneY);
    nodePositions.set(element.id, clamped);
    upsertOccupiedRect(element.id, clamped, getNodeSize(element));
  });

  ast.elements.forEach((element: any) => {
    const position = nodePositions.get(element.id) ?? snapPoint(0, 0);
    const isGlobal = element.type === 'global';

    if (element.type === 'scene' || element.type === 'global') {
      nodes.push({
        id: element.id,
        type: 'molicNode',
        position,
        data: {
          label: element.label || element.id,
          nodeType: isGlobal ? 'global' : 'scene',
          isGlobal,
          isMain: element.isMain,
          variant: element.variant,
          rawContent: element.content,
        },
        style: { width: LAYOUT.NODE_WIDTH },
      });
      return;
    }

    if (element.type === 'terminal' && element.kind === 'start') {
      nodes.push({ id: element.id, type: 'molicNode', position, data: { label: element.id, nodeType: 'startNode' } });
      return;
    }

    if (element.type === 'contact') {
      const roleLabel = element.role || element.id;
      nodes.push({ id: element.id, type: 'molicNode', position, data: { label: roleLabel, nodeType: 'contactNode' } });
      return;
    }

    if (element.type === 'process') {
      nodes.push({ id: element.id, type: 'molicNode', position, data: { label: element.id, nodeType: 'processNode' } });
      return;
    }

    if (element.type === 'fork') {
      nodes.push({ id: element.id, type: 'molicNode', position, data: { label: element.id, nodeType: 'forkNode' } });
      return;
    }

    if (element.type === 'external') {
      nodes.push({ id: element.id, type: 'molicNode', position, data: { label: element.id, nodeType: 'externalNode' } });
      return;
    }

    if (element.type === 'terminal') {
      const type = element.kind === 'end' ? 'endNode' : element.kind === 'break' ? 'breakNode' : 'completionNode';
      nodes.push({ id: element.id, type: 'molicNode', position, data: { label: element.id, nodeType: type } });
    }
  });

  const nodeRectMap = new Map<string, Rect>();
  ast.elements.forEach((element: any) => {
    const position = nodePositions.get(element.id) ?? snapPoint(0, 0);
    nodeRectMap.set(element.id, makeRect(element.id, position, getNodeSize(element)));
  });

  const shouldRelayoutEdge = (sourceId: string, targetId: string) => {
    if (relayoutAllNodes) return true;
    if (!options?.relayoutEdgeNodeIds) return false;
    return options.relayoutEdgeNodeIds.has(sourceId) || options.relayoutEdgeNodeIds.has(targetId);
  };

  const markHandleAsUsed = (
    store: Record<string, Record<string, number>>,
    nodeId: string,
    handleId: string,
  ) => {
    if (!store[nodeId]) store[nodeId] = {};
    store[nodeId][handleId] = (store[nodeId][handleId] ?? 0) + 1;
  };

  const countHandleUse = (
    store: Record<string, Record<string, number>>,
    nodeId: string,
    handleId: string,
  ) => store[nodeId]?.[handleId] ?? 0;

  const chooseBestHandles = (
    sourceId: string,
    targetId: string,
    forcedSourceHandle?: string,
    forcedTargetHandle?: string,
  ) => {
    const sourceEl = nodeElementMap.get(sourceId);
    const targetEl = nodeElementMap.get(targetId);
    const sourceRect = nodeRectMap.get(sourceId);
    const targetRect = nodeRectMap.get(targetId);

    if (!sourceEl || !targetEl || !sourceRect || !targetRect) {
      return { sourceHandle: forcedSourceHandle || 'r-3', targetHandle: 't-3', segments: [] as Segment[] };
    }

    const sourceKind = nodeTypeMap[sourceId];
    const targetKind = nodeTypeMap[targetId];
    const preferredSides = getPreferredSidesByKind(
      sourceKind,
      targetKind,
      getPreferredSidesByGeometry(sourceRect, targetRect),
    );
    const sourceCandidates = getHandleCandidates(
      sourceKind,
      'source',
      Math.max(1, outgoingByNode[sourceId]?.length ?? 1),
      preferredSides.sourceSide,
      forcedSourceHandle,
    );
    const targetCandidates = getHandleCandidates(
      targetKind,
      'target',
      Math.max(1, incomingByNode[targetId]?.length ?? 1),
      preferredSides.targetSide,
      forcedTargetHandle,
    );
    const obstacles = Array.from(nodeRectMap.values()).filter(
      (rect) => rect.nodeId !== sourceId && rect.nodeId !== targetId,
    );

    let best: { sourceHandle: string; targetHandle: string; cost: number; segments: Segment[] } | null = null;
    let bestOverlapCount = Number.POSITIVE_INFINITY;
    let bestCrossingCount = Number.POSITIVE_INFINITY;

    sourceCandidates.forEach((sourceHandle) => {
      targetCandidates.forEach((targetHandle) => {
        const sourcePoint = getHandlePoint(sourceRect, { width: sourceRect.width, height: sourceRect.height }, sourceKind, sourceHandle);
        const targetPoint = getHandlePoint(targetRect, { width: targetRect.width, height: targetRect.height }, targetKind, targetHandle);
        const segments = buildOrthogonalSegments(sourcePoint, targetPoint, sourceHandle, targetHandle);

        const distance = Math.abs(sourcePoint.x - targetPoint.x) + Math.abs(sourcePoint.y - targetPoint.y);
        const dirPenalty = directionPenalty(sourcePoint, targetPoint, sourceHandle, targetHandle);
        const usagePenalty =
          countHandleUse(usedSourceHandles, sourceId, sourceHandle) * 60 +
          countHandleUse(usedTargetHandles, targetId, targetHandle) * 60;
        const preferencePenalty = handlePreferencePenalty(
          sourceKind,
          targetKind,
          sourceHandle,
          targetHandle,
          Math.max(1, outgoingByNode[sourceId]?.length ?? 1),
          Math.max(1, incomingByNode[targetId]?.length ?? 1),
        );

        let overlapPenalty = 0;
        let overlapCount = 0;
        segments.forEach((segment) => {
          obstacles.forEach((rect) => {
            if (segmentIntersectsRect(segment, rect, 20)) {
              overlapPenalty += 900;
              overlapCount += 1;
            }
          });
        });

        let crossingPenalty = 0;
        let crossingCount = 0;
        let colinearOverlapPenalty = 0;
        segments.forEach((segment) => {
          existingSegments.forEach((existing) => {
            if (segmentsIntersect(segment, existing)) {
              crossingPenalty += 260;
              crossingCount += 1;
            }
            if (segmentsColinearOverlap(segment, existing)) {
              colinearOverlapPenalty += 800;
            }
          });
        });

        const totalCost = distance
          + dirPenalty
          + usagePenalty
          + preferencePenalty
          + overlapPenalty
          + crossingPenalty
          + colinearOverlapPenalty;
        const betterOverlap = overlapCount < bestOverlapCount;
        const sameOverlap = overlapCount === bestOverlapCount;
        const betterCrossing = sameOverlap && crossingCount < bestCrossingCount;
        const sameCrossing = sameOverlap && crossingCount === bestCrossingCount;
        const betterCost = sameCrossing && (!best || totalCost < best.cost);

        if (betterOverlap || betterCrossing || betterCost || !best) {
          bestOverlapCount = overlapCount;
          bestCrossingCount = crossingCount;
          best = { sourceHandle, targetHandle, cost: totalCost, segments };
        }
      });
    });

    if (!best) {
      return { sourceHandle: forcedSourceHandle || 'r-3', targetHandle: 't-3', segments: [] as Segment[] };
    }

    return best;
  };

  const createEdge = (transition: TransitionRecord) => {
    const { sourceId, targetId, item, sourceRoleName, forcedSourceHandle, forcedTargetHandle } = transition;
    const sourceType = nodeTypeMap[sourceId];
    const targetType = nodeTypeMap[targetId];
    if (!targetType) return;

    let kind = item.transition.kind;

    if (kind === 'simultaneous') {
      const isValidSimultaneous =
        (sourceType === 'scene' && targetType === 'process') ||
        (sourceType === 'process' && targetType === 'scene');

      if (!isValidSimultaneous) {
        console.warn(`Simultaneous transition (=>) is only valid between scene and process, got: ${sourceType} => ${targetType}`);
        return;
      }
    }

    const isInteractionMediated = sourceType === 'contact' || targetType === 'contact' || targetType === 'external';
    if (isInteractionMediated && kind !== 'simultaneous') kind = 'mediated';

    const isPreferred = item.transition.isPreferred;
    const baseId = `e_${sourceId}_${targetId}_${sanitize(item.text || '')}`;
    const count = edgeIdCounter[baseId] || 0;
    edgeIdCounter[baseId] = count + 1;
    const edgeId = `${baseId}_${count}`;

    const savedHandleInfo = savedHandles?.get(edgeId);
    const forceRecompute = shouldRelayoutEdge(sourceId, targetId);

    let sourceHandle: string;
    let targetHandle: string;

    if (
      savedHandleInfo &&
      savedHandleInfo.sourceHandle &&
      savedHandleInfo.targetHandle &&
      !forceRecompute
    ) {
      sourceHandle = savedHandleInfo.sourceHandle;
      targetHandle = savedHandleInfo.targetHandle;

      markHandleAsUsed(usedSourceHandles, sourceId, sourceHandle);
      markHandleAsUsed(usedTargetHandles, targetId, targetHandle);

      const sourceEl = nodeElementMap.get(sourceId);
      const targetEl = nodeElementMap.get(targetId);
      if (sourceEl && targetEl) {
        const sourceRect = nodeRectMap.get(sourceId);
        const targetRect = nodeRectMap.get(targetId);
        if (sourceRect && targetRect) {
          const sourcePoint = getHandlePoint(sourceRect, getNodeSize(sourceEl), sourceType, sourceHandle);
          const targetPoint = getHandlePoint(targetRect, getNodeSize(targetEl), targetType, targetHandle);
          existingSegments.push(...buildOrthogonalSegments(sourcePoint, targetPoint, sourceHandle, targetHandle));
        }
      }
    } else {
      const choice = chooseBestHandles(sourceId, targetId, forcedSourceHandle, forcedTargetHandle);
      sourceHandle = choice.sourceHandle;
      targetHandle = choice.targetHandle;
      markHandleAsUsed(usedSourceHandles, sourceId, sourceHandle);
      markHandleAsUsed(usedTargetHandles, targetId, targetHandle);
      existingSegments.push(...choice.segments);
    }

    const labelJSX = getEdgeLabelJSX(item, undefined, sourceRoleName);

    let markerEnd: any = { type: MarkerType.ArrowClosed, color: 'var(--text-base)' };
    if (kind === 'mediated') markerEnd = 'double-arrowhead';
    else if (kind === 'simultaneous') markerEnd = undefined;

    edges.push({
      id: edgeId,
      source: sourceId,
      target: targetId,
      sourceHandle,
      targetHandle,
      label: labelJSX,
      type: kind === 'simultaneous' ? 'simultaneous' : 'molic',
      className: kind,
      style: {
        strokeWidth: isPreferred ? 3 : 1.5,
        strokeDasharray: kind !== 'simultaneous' && kind === 'repair' ? '5, 5' : '0',
      },
      markerEnd,
    } as Edge);
  };

  transitions.forEach((transition) => createEdge(transition));

  return { nodes, edges };
};