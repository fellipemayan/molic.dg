/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { MarkerType } from "reactflow";
import type { Node, Edge } from "reactflow";
import type { DiagramAST } from "../types/ast";

const LAYOUT = { NODE_WIDTH: 256, NODE_HEIGHT: 160, GAP_X: 300, START_X: 50, START_Y: 50 };

// Ordem de preferência para saída (source): bottom -> right -> left -> top
// Para cenas (5): 3, 2, 4, 1, 5 (meio, alternando para os lados)
// Para básicos (3): 2, 1, 3 (meio, alternando)
const SOURCE_HANDLE_ORDER = [
  'b-3', 'b-2', 'b-4', 'b-1', 'b-5',
  'r-3', 'r-2', 'r-4', 'r-1', 'r-5',
  'l-3', 'l-2', 'l-4', 'l-1', 'l-5',
  't-3', 't-2', 't-4', 't-1', 't-5'
];

// Ordem de preferência para entrada (target): top -> left -> right -> bottom
// Para cenas (5): 3, 2, 4, 1, 5 (meio, alternando para os lados)
// Para básicos (3): 2, 1, 3 (meio, alternando)
const TARGET_HANDLE_ORDER = [
  't-3', 't-2', 't-4', 't-1', 't-5',
  'l-3', 'l-2', 'l-4', 'l-1', 'l-5',
  'r-3', 'r-2', 'r-4', 'r-1', 'r-5',
  'b-3', 'b-2', 'b-4', 'b-1', 'b-5'
];

const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, "");

const getBasePrefix = (speaker: string) => {
  if (speaker === "user") return "u: ";
  if (speaker === "system") return "d: ";
  if (speaker === "mixed") return "d+u: ";
  if (speaker === "anonymous") return ""; // Anonymous utterances have no display text
  return "";
};

const getEdgeLabelJSX = (item: any, validationError?: string, overridePrefix?: string): React.ReactNode | null => {
  if (validationError) return <div className="molic-edge-label-container error">🚫 {validationError}</div>;
  if (item.transition?.kind === "simultaneous") return null;

  const lines: React.ReactNode[] = [];
  const { type, trigger, speaker, text, condition, when, let: letVar, effect, why } = item;
  const transitionWhy = item.transition?.why;
  const whyValue = transitionWhy ?? why;

  const whenText = type === "event" ? trigger : when;
  if (whenText) {
    lines.push(
      <div key="when" className="molic-edge-label-line meta">
        when: {whenText}
      </div>
    );
  }

  const hasEmptyCondition = condition !== undefined && condition === '';
  const shouldHideIfLine = speaker === 'system' && hasEmptyCondition;

  if (condition !== undefined && !shouldHideIfLine) {
    lines.push(
      <div key="cond" className="molic-edge-label-line meta">
        if: {condition ?? ""}
      </div>
    );
  }

  if (type === "utterance") {
    const basePrefix = overridePrefix ? overridePrefix : getBasePrefix(speaker).replace(': ', '');
    const displayPrefix = (speaker === 'system' && hasEmptyCondition) ? 'if/d' : basePrefix;

    lines.push(
      <div key="main" className="molic-edge-label-line main">
        <strong>{displayPrefix}:</strong> {text || ''}
      </div>
    );
  }

  if (letVar) lines.push(<div key="let" className="molic-edge-label-line meta">let: {letVar}</div>);
  if (effect) lines.push(<div key="effect" className="molic-edge-label-line meta">effect: {effect}</div>);
  if (whyValue) lines.push(<div key="why" className="molic-edge-label-line meta">why: {whyValue}</div>);

  if (lines.length === 0) return null;
  return <div className="molic-edge-label-container">{lines}</div>;
};

export const transformer = (ast: DiagramAST, savedHandles?: Map<string, { sourceHandle: string, targetHandle: string }>) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  let currentX = LAYOUT.START_X;
  const currentY = LAYOUT.START_Y;

  const edgeIdCounter: Record<string, number> = {};
  const nodeTypeMap: Record<string, string> = {};
  
  // Rastrear handles usados por nó (source e target)
  const usedSourceHandles: Record<string, Set<string>> = {};
  const usedTargetHandles: Record<string, Set<string>> = {};

  ast.elements.forEach((el: any) => {
    if (el.type === 'scene' || el.type === 'global') nodeTypeMap[el.id] = 'scene';
    else if (el.type === 'terminal' && el.kind === 'start') nodeTypeMap[el.id] = 'start'; 
    else nodeTypeMap[el.id] = el.type;
  });

  const getNextAvailableSourceHandle = (nodeId: string) => {
    if (!usedSourceHandles[nodeId]) usedSourceHandles[nodeId] = new Set();
    
    for (const handle of SOURCE_HANDLE_ORDER) {
      if (!usedSourceHandles[nodeId].has(handle)) {
        usedSourceHandles[nodeId].add(handle);
        return handle;
      }
    }
    // Fallback se todos estiverem ocupados (improvável)
    return 'r-1';
  };

  const getNextAvailableTargetHandle = (targetId: string) => {
    const type = nodeTypeMap[targetId];
    
    // Fork sempre recebe no topo
    if (type === 'fork') return 't-1';
    
    if (!usedTargetHandles[targetId]) usedTargetHandles[targetId] = new Set();
    
    for (const handle of TARGET_HANDLE_ORDER) {
      if (!usedTargetHandles[targetId].has(handle)) {
        usedTargetHandles[targetId].add(handle);
        return handle;
      }
    }
    // Fallback se todos estiverem ocupados
    return 't-1';
  };

  const createEdge = (sourceId: string, item: any, sourceRoleName?: string, forcedSourceHandle?: string) => {
    if (!item.transition) return;

    const targetId = item.transition.targetId;
    const sourceType = nodeTypeMap[sourceId];
    const targetType = nodeTypeMap[targetId];
    
    let kind = item.transition.kind;
    
    // Validar fala simultânea: apenas entre scene e process
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

    // Gerar ID do edge primeiro para buscar handles salvos
    const baseId = `e_${sourceId}_${targetId}_${sanitize(item.text || "")}`;
    const count = edgeIdCounter[baseId] || 0;
    edgeIdCounter[baseId] = count + 1;
    const edgeId = `${baseId}_${count}`;
    
    // Verificar se há handles salvos para este edge
    const savedHandleInfo = savedHandles?.get(edgeId);
    
    let sourceHandle: string;
    let targetHandle: string;
    
    if (savedHandleInfo && savedHandleInfo.sourceHandle && savedHandleInfo.targetHandle) {
      // Usar handles salvos
      sourceHandle = savedHandleInfo.sourceHandle;
      targetHandle = savedHandleInfo.targetHandle;
      // Marcar como usados
      if (!usedSourceHandles[sourceId]) usedSourceHandles[sourceId] = new Set();
      if (!usedTargetHandles[targetId]) usedTargetHandles[targetId] = new Set();
      usedSourceHandles[sourceId].add(sourceHandle);
      usedTargetHandles[targetId].add(targetHandle);
    } else {
      // Alocar novos handles
      sourceHandle = forcedSourceHandle || getNextAvailableSourceHandle(sourceId);
      targetHandle = getNextAvailableTargetHandle(targetId);
    }

    const labelJSX = getEdgeLabelJSX(item, undefined, sourceRoleName);

    let markerEnd: any = { type: MarkerType.ArrowClosed, color: "var(--text-base)" };
    if (kind === 'mediated') markerEnd = "double-arrowhead";
    else if (kind === 'simultaneous') markerEnd = undefined;

    edges.push({
      id: edgeId,
      source: sourceId,
      target: targetId,
      sourceHandle: sourceHandle,
      targetHandle: targetHandle,
      label: labelJSX,
      type: kind === 'simultaneous' ? 'simultaneous' : 'molic', 
      className: kind,
      style: {
        strokeWidth: isPreferred ? 3 : 1.5,
        strokeDasharray: (kind !== 'simultaneous' && kind === 'repair') ? "5, 5" : "0",
      },
      markerEnd: markerEnd,
    } as Edge);
  };

  ast.elements.forEach((element: any) => {
    if (element.type === "scene" || element.type === "global") {
      const isGlobal = element.type === "global";
      nodes.push({
        id: element.id,
        type: "molicNode",
        position: { x: currentX, y: currentY },
        data: {
          label: element.label || element.id,
          nodeType: isGlobal ? 'global' : 'scene', 
          isGlobal: isGlobal,
          isMain: element.isMain,
          variant: element.variant,
          rawContent: element.content, 
        },
        style: { width: LAYOUT.NODE_WIDTH },
      });
      if (element.exits) element.exits.forEach((item: any) => createEdge(element.id, item));
      currentX += LAYOUT.GAP_X;
    }
    else if (element.type === "terminal" && element.kind === "start") {
      nodes.push({ id: element.id, type: "molicNode", position: { x: currentX, y: currentY + 50 }, data: { label: element.id, nodeType: 'startNode' } });
      if (element.content) element.content.forEach((item: any) => createEdge(element.id, item, undefined));
      currentX += 150;
    }
    else if (element.type === "contact") {
      const roleLabel = element.role || element.id;
      nodes.push({ id: element.id, type: "molicNode", position: { x: currentX, y: currentY + 64 }, data: { label: roleLabel, nodeType: 'contactNode' } });
      if (element.content) element.content.forEach((item: any) => createEdge(element.id, item, roleLabel));
      currentX += 96;
    }
    else if (element.type === "process") {
        nodes.push({ id: element.id, type: "molicNode", position: { x: currentX, y: currentY + 50 }, data: { label: element.id, nodeType: 'processNode' } });
        if (element.content) element.content.forEach((item: any) => createEdge(element.id, item, undefined));
        currentX += 150;
    }
    else if (element.type === "fork") {
      nodes.push({ id: element.id, type: "molicNode", position: { x: currentX, y: currentY + 60 }, data: { label: element.id, nodeType: 'forkNode' } });
      if(element.content) {
        let forkIndex = 0;
        element.content.forEach((item:any) => {
          if(!item.transition) return;
          const handle = forkIndex === 0 ? 'b-2' : 'b-3';
          createEdge(element.id, item, undefined, handle);
          forkIndex++;
        });
      }
      currentX += 200;
    }
    else if (element.type === "external") {
        nodes.push({ id: element.id, type: "molicNode", position: { x: currentX, y: currentY + 50 }, data: { label: element.id, nodeType: 'externalNode' } });
        currentX += 128;
    }
    else if (element.type === "terminal") { 
        const type = element.kind === "end" ? "endNode" : element.kind === "break" ? "breakNode" : "completionNode";
        nodes.push({ id: element.id, type: "molicNode", position: { x: currentX, y: currentY }, data: { label: element.id, nodeType: type } });
        currentX += 150;
    }
  });

  return { nodes, edges };
};