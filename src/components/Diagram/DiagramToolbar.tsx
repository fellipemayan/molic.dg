import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import {
  ArrowUUpLeftIcon,
  ArrowUUpRightIcon,
  ArrowsClockwiseIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ArrowsOutIcon,
  CaretDownIcon,
  ArrowsInLineVerticalIcon,
  SplitVerticalIcon,
  ArrowsOutLineVerticalIcon,
} from '@phosphor-icons/react';
import type { LayoutDensity } from '../../core/transformer.tsx';
import './DiagramToolbar.css';

interface DiagramToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: () => void;
  isAutoLayouting: boolean;
  layoutDensity: LayoutDensity;
  onCycleDensity: () => void;
}

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200, 300];

export const DiagramToolbar: React.FC<DiagramToolbarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoLayout,
  isAutoLayouting,
  layoutDensity,
  onCycleDensity,
}) => {
  const reactFlow = useReactFlow();
  const [zoom, setZoom] = useState(100);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const zoomInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastZoomRef = useRef(100);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Monitorar zoom continuamente para sincronizar com scroll e outras mudanças
  useEffect(() => {
    const checkZoom = () => {
      const currentZoom = Math.round(reactFlow.getZoom() * 100);
      if (currentZoom !== lastZoomRef.current) {
        lastZoomRef.current = currentZoom;
        setZoom(currentZoom);
      }
    };

    const interval = setInterval(checkZoom, 100);
    return () => clearInterval(interval);
  }, [reactFlow]);

  // Atualizar estado de zoom quando viewport muda
  const updateZoomDisplay = useCallback(() => {
    const currentZoom = Math.round(reactFlow.getZoom() * 100);
    if (currentZoom !== lastZoomRef.current) {
      lastZoomRef.current = currentZoom;
      setZoom(currentZoom);
    }
  }, [reactFlow]);

  const handleZoomIn = useCallback(() => {
    reactFlow.zoomIn({ duration: 300 });
    setTimeout(updateZoomDisplay, 300);
  }, [reactFlow, updateZoomDisplay]);

  const handleZoomOut = useCallback(() => {
    reactFlow.zoomOut({ duration: 300 });
    setTimeout(updateZoomDisplay, 300);
  }, [reactFlow, updateZoomDisplay]);

  const handleFitView = useCallback(() => {
    reactFlow.fitView({ padding: 0.2, duration: 300 });
    setTimeout(updateZoomDisplay, 300);
  }, [reactFlow, updateZoomDisplay]);

  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseInt(e.target.value, 10);
    setZoom(newZoom);
  }, []);

  const handleZoomInputBlur = useCallback(() => {
    const zoomLevel = Math.max(10, Math.min(500, zoom)) / 100;
    const viewport = reactFlow.getViewport();
    reactFlow.setViewport({ x: viewport.x, y: viewport.y, zoom: zoomLevel }, { duration: 300 });
    const newZoom = Math.round(zoomLevel * 100);
    setZoom(newZoom);
    lastZoomRef.current = newZoom;
  }, [zoom, reactFlow]);

  const handleZoomInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const zoomLevel = Math.max(10, Math.min(500, zoom)) / 100;
      const viewport = reactFlow.getViewport();
      reactFlow.setViewport({ x: viewport.x, y: viewport.y, zoom: zoomLevel }, { duration: 300 });
      const newZoom = Math.round(zoomLevel * 100);
      setZoom(newZoom);
      lastZoomRef.current = newZoom;
      zoomInputRef.current?.blur();
    }
  }, [zoom, reactFlow]);

  const handleSelectPreset = useCallback((presetZoom: number) => {
    const zoomLevel = presetZoom / 100;
    const viewport = reactFlow.getViewport();
    reactFlow.setViewport({ x: viewport.x, y: viewport.y, zoom: zoomLevel }, { duration: 300 });
    setZoom(presetZoom);
    lastZoomRef.current = presetZoom;
    setIsDropdownOpen(false);
    setTimeout(updateZoomDisplay, 300);
  }, [reactFlow, updateZoomDisplay]);

  const densityLabel = layoutDensity === 'compact' ? 'Compacto' : layoutDensity === 'normal' ? 'Normal' : 'Distante';
  const densityTitle = `Densidade: ${densityLabel}`;
  const densityIcon = layoutDensity === 'compact'
    ? <ArrowsInLineVerticalIcon size={16} weight="bold" />
    : layoutDensity === 'normal'
      ? <SplitVerticalIcon size={16} weight="bold" />
      : <ArrowsOutLineVerticalIcon size={16} weight="bold" />;

  return (
    <div className="diagram-toolbar" data-toolbar="true">
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          title="Desfazer (Ctrl+Z)"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <ArrowUUpLeftIcon size={18} weight="bold" />
        </button>
        <button
          className="toolbar-btn"
          title="Refazer (Ctrl+Y)"
          onClick={onRedo}
          disabled={!canRedo}
        >
          <ArrowUUpRightIcon size={18} weight="bold" />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          title="Afastar (Ctrl+Minus)"
          onClick={handleZoomOut}
        >
          <MagnifyingGlassMinusIcon size={18} weight="regular" />
        </button>
        <button
          className="toolbar-btn"
          title="Aproximar (Ctrl+Plus)"
          onClick={handleZoomIn}
        >
          <MagnifyingGlassPlusIcon size={18} weight="regular" />
        </button>
        <button
          className="toolbar-btn"
          title="Ajustar à tela"
          onClick={handleFitView}
        >
          <ArrowsOutIcon size={18} weight="regular" />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          title="Auto-layout"
          onClick={onAutoLayout}
          disabled={isAutoLayouting}
        >
          <ArrowsClockwiseIcon size={18} weight="regular" />
        </button>
      </div>

      {/* <div className="toolbar-divider" /> */}

      <div className="toolbar-group">
        <button
          className="toolbar-btn density-btn"
          title={densityTitle}
          onClick={onCycleDensity}
        >
          {densityIcon}
          <span>{densityLabel}</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="zoom-control-wrapper" ref={dropdownRef}>
        <div className="zoom-input-container">
          <input
            ref={zoomInputRef}
            type="number"
            min="10"
            max="500"
            step="10"
            value={zoom}
            onChange={handleZoomChange}
            onBlur={handleZoomInputBlur}
            onKeyDown={handleZoomInputKeyDown}
            className="zoom-input"
            title="Digite o nível de zoom em %"
          />
          <span className="zoom-label">%</span>
          <button
            className="zoom-dropdown-btn"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            title="Menu de zoom"
          >
            <CaretDownIcon size={14} weight="bold" />
          </button>
        </div>

        {isDropdownOpen && (
          <div className="zoom-dropdown-menu">
            {ZOOM_PRESETS.map((preset) => (
              <button
                key={preset}
                className={`zoom-preset-item ${zoom === preset ? 'active' : ''}`}
                onClick={() => handleSelectPreset(preset)}
              >
                {preset}%
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
