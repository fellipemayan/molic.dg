import React, { useCallback, useEffect, useMemo, useState, useRef, useImperativeHandle } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  ConnectionMode,
  type OnConnectStart,
  type OnConnectEnd,
  type Edge,
  type Node as RFNode,
  type Connection,
  type ReactFlowInstance,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { MolicNode } from './MolicNode';
import { SimultaneousEdge, MolicEdge } from './MolicEdge';
import { DiagramToolbar } from './DiagramToolbar';
import { transformer, type LayoutDensity } from '../../core/transformer.tsx';
import { parseMolic } from '../../core/parser';
import { useLayoutPersistence } from '../../hooks/useLayoutPersistence';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { ReconnectionProvider } from '../../context/ReconnectionContext';
import { useReconnectionContext } from '../../hooks/useReconnectionContext';

import './MolicEdge.css';
import './MolicNode.css'; 
import './DiagramToolbar.css';
import './Diagram.css';

interface DiagramProps {
  code: string;
}

export type DiagramHandle = HTMLDivElement & {
  getNodesAndEdges: () => { nodes: RFNode[]; edges: Edge[] };
  fitViewBeforeExport: () => void;
};

interface DiagramContentProps {
  code: string;
  onNodesEdgesChange?: (nodes: RFNode[], edges: Edge[]) => void;
  reactFlowRef?: React.MutableRefObject<ReactFlowInstance<RFNode, Edge> | null>;
}

interface PersistedLayout {
  nodes: Array<{ id: string; position: { x: number; y: number } }>;
  edges: Array<{ id: string; sourceHandle?: string | null; targetHandle?: string | null }>;
}

const LAYOUT_DENSITY_KEY = 'molic-layout-density-v1';

// Componente auxiliar para capturar a instância do ReactFlow
const DiagramFlowController: React.FC<{ reactFlowRef: React.MutableRefObject<ReactFlowInstance<RFNode, Edge> | null> }> = ({ reactFlowRef }) => {
  const instance = useReactFlow();
  useEffect(() => {
    reactFlowRef.current = instance;
  }, [instance, reactFlowRef]);
  return null;
};

const DiagramContent: React.FC<DiagramContentProps> = ({ code, onNodesEdgesChange, reactFlowRef }) => {
  const nodeTypes = useMemo(() => ({ molicNode: MolicNode }), []);
  const edgeTypes = useMemo(
    () => ({ simultaneous: SimultaneousEdge, molic: MolicEdge }),
    [],
  );
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    undo,
    redo,
    canUndo,
    canRedo,
    startDragHistory,
    endDragHistory,
  } = useUndoRedo();
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isSelectingWithBox, setIsSelectingWithBox] = useState(false);
  const [isAutoLayouting, setIsAutoLayouting] = useState(false);
  const [layoutDensity, setLayoutDensity] = useState<LayoutDensity>(() => {
    const value = localStorage.getItem(LAYOUT_DENSITY_KEY);
    if (value === 'compact' || value === 'normal' || value === 'airy') return value;
    return 'normal';
  });
  const selectBoxRef = useRef<{ startX: number; startY: number } | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  
  const { saveLayout } = useLayoutPersistence();
  const edgeReconnectSuccessful = useRef(true);
  const edgeBackupRef = useRef<Edge[]>([]);
  const { setReconnecting, resetReconnecting } = useReconnectionContext();

  const onConnectStart: OnConnectStart = useCallback(() => setIsConnecting(true), []);
  const onConnectEnd: OnConnectEnd = useCallback(() => setIsConnecting(false), []);

  const handleCycleDensity = useCallback(() => {
    setLayoutDensity((prev) => {
      const next: LayoutDensity = prev === 'compact' ? 'normal' : prev === 'normal' ? 'airy' : 'compact';
      localStorage.setItem(LAYOUT_DENSITY_KEY, next);
      return next;
    });
  }, []);

  const loadPersistedLayout = useCallback(() => {
    const savedString = localStorage.getItem('molic-layout-stable-v4');
    if (!savedString) {
      return {
        fixedNodePositions: new Map<string, { x: number; y: number }>(),
        savedHandlesMap: new Map<string, { sourceHandle: string; targetHandle: string }>(),
      };
    }

    try {
      const saved = JSON.parse(savedString) as PersistedLayout;
      const fixedNodePositions = new Map(saved.nodes.map((node) => [node.id, node.position]));
      const savedHandlesMap = new Map(
        saved.edges
          .filter((edge) => edge.sourceHandle && edge.targetHandle)
          .map((edge) => [
            edge.id,
            {
              sourceHandle: edge.sourceHandle as string,
              targetHandle: edge.targetHandle as string,
            },
          ]),
      );

      return { fixedNodePositions, savedHandlesMap };
    } catch (e) {
      console.error('Erro ao carregar layout salvo', e);
      return {
        fixedNodePositions: new Map<string, { x: number; y: number }>(),
        savedHandlesMap: new Map<string, { sourceHandle: string; targetHandle: string }>(),
      };
    }
  }, []);
  
  // Handler para reconexão de edges
  const onReconnectStart = useCallback((_event: React.MouseEvent | React.TouchEvent, edge: Edge) => {
    edgeReconnectSuccessful.current = false;
    setIsReconnecting(true);
    // Guardar backup de todas as edges para restaurar se falhar
    edgeBackupRef.current = edges.map(e => ({ ...e }));
    // Marcar que está reconectando (mostrar handles dos nós envolvidos)
    setReconnecting(edge);
  }, [edges, setReconnecting]);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      // Verificar se está tentando mudar o source ou target node
      // Apenas permitir troca de handles dentro do mesmo nó
      const sourceChanged = oldEdge.source !== newConnection.source;
      const targetChanged = oldEdge.target !== newConnection.target;
      
      if (sourceChanged || targetChanged) {
        console.warn('[MoLIC] Não é possível mudar a conexão entre nós. Apenas handles podem ser alterados.');
        return;
      }
      
      console.log('[MoLIC] Reconectando edge:', {
        id: oldEdge.id,
        antes: { source: oldEdge.sourceHandle, target: oldEdge.targetHandle },
        depois: { source: newConnection.sourceHandle, target: newConnection.targetHandle }
      });
      
      edgeReconnectSuccessful.current = true;
      setEdges((els) => {
        // Atualizar apenas os handles do edge existente, mantendo o ID original
        const updated = els.map(e => 
          e.id === oldEdge.id 
            ? { 
                ...e, 
                sourceHandle: newConnection.sourceHandle || e.sourceHandle,
                targetHandle: newConnection.targetHandle || e.targetHandle,
                source: newConnection.source || e.source,
                target: newConnection.target || e.target
              }
            : e
        );
        console.log('[MoLIC] Edges após reconexão:');
        updated.forEach(e => console.log(`  ${e.id}: source=${e.sourceHandle}, target=${e.targetHandle}`));
        // Forçar salvamento imediato após reconexão
        setTimeout(() => saveLayout(nodes, updated), 100);
        return updated;
      });
    },
    [setEdges, nodes, saveLayout]
  );
  
  const onReconnectEnd = useCallback(
    (_: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeReconnectSuccessful.current) {
        // Se a reconexão falhou, restaurar o backup de edges
        console.log('[MoLIC] Reconexão cancelada, restaurando edge:', edge.id);
        setEdges(edgeBackupRef.current);
      }
      edgeReconnectSuccessful.current = true;
      // Resetar estado de reconexão
      setIsReconnecting(false);
      resetReconnecting();
    },
    [setEdges, resetReconnecting]
  );
  
  // Salvar layout quando nodes ou edges mudam
  useEffect(() => {
    onNodesEdgesChange?.(nodes, edges);
    if (nodes.length > 0 || edges.length > 0) {
      saveLayout(nodes, edges);
    }
  }, [nodes, edges, saveLayout, onNodesEdgesChange]);

  useEffect(() => {
    if (!code) return;
    const { ast, error } = parseMolic(code);
    
    if (error) {
      console.warn("Syntax Error:", error);
      return; 
    }

    if (ast) {
      const { fixedNodePositions, savedHandlesMap } = loadPersistedLayout();
      const allIds = ast.elements.map((element) => element.id);
      const preservedCount = allIds.filter((id) => fixedNodePositions.has(id)).length;
      const reuseRatio = allIds.length > 0 ? preservedCount / allIds.length : 0;
      const shouldReuseFixedPositions = reuseRatio >= 0.6;

      const effectiveFixedPositions = shouldReuseFixedPositions
        ? fixedNodePositions
        : new Map<string, { x: number; y: number }>();

      const newNodeIds = new Set(allIds.filter((id) => !effectiveFixedPositions.has(id)));

      const { nodes: layoutNodes, edges: layoutEdges } = transformer(ast, savedHandlesMap, {
        fixedNodePositions: effectiveFixedPositions,
        relayoutAllNodes: false,
        relayoutEdgeNodeIds: newNodeIds,
        density: layoutDensity,
      });

      setNodes(layoutNodes);
      setEdges(layoutEdges);
    }
  }, [code, setNodes, setEdges, loadPersistedLayout, layoutDensity]);

  const handleAutoLayout = useCallback(() => {
    const { ast, error } = parseMolic(code);
    if (error || !ast) {
      console.warn('Não foi possível executar auto-layout: código inválido.');
      return;
    }

    setIsAutoLayouting(true);
    const { savedHandlesMap } = loadPersistedLayout();
    const allNodeIds = new Set(ast.elements.map((element) => element.id));
    const elementById = new Map(ast.elements.map((element) => [element.id, element]));
    const sceneIdsLockedByProcess = new Set<string>();

    ast.elements.forEach((element) => {
      if (element.type !== 'process' || !element.content) return;
      element.content.forEach((item: unknown) => {
        const targetId =
          typeof item === 'object' && item !== null && 'transition' in item
            ? (item as { transition?: { targetId?: string } }).transition?.targetId
            : undefined;
        if (!targetId) return;
        const targetElement = elementById.get(targetId);
        if (targetElement?.type === 'scene') {
          sceneIdsLockedByProcess.add(targetId);
        }
      });
    });

    const fixedNodePositions = new Map(
      nodes
        .filter((node) => sceneIdsLockedByProcess.has(node.id))
        .map((node) => [node.id, { x: node.position.x, y: node.position.y }]),
    );

    const { nodes: layoutNodes, edges: layoutEdges } = transformer(ast, savedHandlesMap, {
      relayoutAllNodes: true,
      fixedNodePositions,
      relayoutEdgeNodeIds: allNodeIds,
      density: layoutDensity,
    });

    setNodes(layoutNodes);
    setEdges(layoutEdges);
    saveLayout(layoutNodes, layoutEdges);

    setTimeout(() => {
      reactFlowRef?.current?.fitView?.({ padding: 0.2, duration: 250 });
      setIsAutoLayouting(false);
    }, 0);
  }, [code, loadPersistedLayout, nodes, reactFlowRef, saveLayout, setEdges, setNodes, layoutDensity]);

  // Keyboard shortcuts para Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Handlers para seleção múltipla com caixa
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    if (isConnecting || isReconnecting) {
      return;
    }

    // Verificar se o clique foi em um elemento da toolbar
    const target = e.target as HTMLElement;
    if (target.closest('.react-flow__controls') || target.closest('[data-toolbar="true"]')) {
      return;
    }

    if (target.closest('.react-flow__handle') || target.closest('.react-flow__edge')) {
      return;
    }

    // Iniciar seleção por caixa só se clicar diretamente no canvas
    if (target.closest('.react-flow__pane') || target === canvasWrapperRef.current?.querySelector('.react-flow__pane')) {
      selectBoxRef.current = { startX: e.clientX, startY: e.clientY };
      setIsSelectingWithBox(true);
    }
  }, [isConnecting, isReconnecting]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!selectBoxRef.current || !isSelectingWithBox) return;

    const { startX, startY } = selectBoxRef.current;
    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const width = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);

    setSelectionBox({ x, y, width, height });
  }, [isSelectingWithBox]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!selectBoxRef.current || !selectionBox) {
      setIsSelectingWithBox(false);
      setSelectionBox(null);
      selectBoxRef.current = null;
      return;
    }

    // Detectar nodes dentro da caixa de seleção
    const selectedNodeIds = nodes
      .filter((node) => {
        if (!node.positionAbsolute) return false;

        const nodeX = node.positionAbsolute.x;
        const nodeY = node.positionAbsolute.y;
        const nodeWidth = node.width || 160;
        const nodeHeight = node.height || 48;

        return (
          nodeX < selectionBox.x + selectionBox.width &&
          nodeX + nodeWidth > selectionBox.x &&
          nodeY < selectionBox.y + selectionBox.height &&
          nodeY + nodeHeight > selectionBox.y
        );
      })
      .map((node) => node.id);

    // Atualizar nodes selecionados
    if (selectedNodeIds.length > 0) {
      setNodes((prevNodes) =>
        prevNodes.map((node) => ({
          ...node,
          selected: selectedNodeIds.includes(node.id),
        }))
      );
    }

    setIsSelectingWithBox(false);
    setSelectionBox(null);
    selectBoxRef.current = null;
  }, [nodes, selectionBox, setNodes]);

  return (
    <div 
      ref={canvasWrapperRef}
      style={{ width: '100%', height: '100%' }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
        onNodeDragStart={startDragHistory}
        onNodeDragStop={endDragHistory}
        reconnectRadius={20}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 1 }}
        minZoom={0.1}
        snapToGrid={true}
        snapGrid={[16, 16]}
        className={[isConnecting ? 'app-connecting' : '', isReconnecting ? 'app-reconnecting' : ''].filter(Boolean).join(' ')}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
      >
        <Background gap={16} size={1} />
        <Controls />
        {reactFlowRef && <DiagramFlowController reactFlowRef={reactFlowRef} />}
        <DiagramToolbar
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onAutoLayout={handleAutoLayout}
          isAutoLayouting={isAutoLayouting}
          layoutDensity={layoutDensity}
          onCycleDensity={handleCycleDensity}
        />
        {selectionBox && (
          <div
            style={{
              position: 'fixed',
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
              border: '2px solid var(--primary)',
              backgroundColor: 'rgba(0, 122, 255, 0.1)',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          />
        )}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none' }}>
          <defs>
            <marker id="double-arrowhead" viewBox="0 0 20 10" refX="18" refY="5" markerWidth="10" markerHeight="10" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-base)" />
              <path d="M 8 0 L 18 5 L 8 10 z" fill="var(--text-base)" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
    </div>
  );
};

export const Diagram = React.forwardRef<DiagramHandle, DiagramProps>(({ code }, ref) => {
  const [diagramNodes, setDiagramNodes] = useState<RFNode[]>([]);
  const [diagramEdges, setDiagramEdges] = useState<Edge[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const reactFlowRef = useRef<ReactFlowInstance<RFNode, Edge> | null>(null);

  const handleNodesEdgesChange = useCallback((nodes: RFNode[], edges: Edge[]) => {
    setDiagramNodes(nodes);
    setDiagramEdges(edges);
  }, []);

  useImperativeHandle(ref, () => {
    const element = contentRef.current ?? document.createElement('div');
    return Object.assign(element, {
      getNodesAndEdges: () => ({
        nodes: diagramNodes,
        edges: diagramEdges,
      }),
      fitViewBeforeExport: () => {
        if (reactFlowRef.current?.fitView) {
          reactFlowRef.current.fitView({ padding: 0.2, duration: 200 });
        }
      },
    }) as DiagramHandle;
  }, [diagramNodes, diagramEdges]);

  return (
    <div ref={contentRef} className="diagram-wrapper">
      <ReconnectionProvider>
        <DiagramContent code={code} onNodesEdgesChange={handleNodesEdgesChange} reactFlowRef={reactFlowRef} />
      </ReconnectionProvider>
    </div>
  );
});