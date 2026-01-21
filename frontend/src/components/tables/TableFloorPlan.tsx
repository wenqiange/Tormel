import { useRef, useState, useCallback, useEffect } from 'react';
import { Table, Zone } from '@/types';
import TableItem from './TableItem';
import { message } from 'antd';

interface TableFloorPlanProps {
  tables: Table[];
  zones: Zone[];
  selectedZone: string;
  isEditMode: boolean;
  onTableClick: (table: Table) => void;
  onTablePositionChange: (tableId: string, x: number, y: number) => void;
  onAddTable: (x: number, y: number) => void;
}

export default function TableFloorPlan({
  tables,
  zones,
  selectedZone,
  isEditMode,
  onTableClick,
  onTablePositionChange,
  onAddTable,
}: TableFloorPlanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTable, setDraggedTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Get position relative to container
  const getRelativePosition = useCallback((e: React.MouseEvent | React.Touch) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((tableId: string, e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const clientPos = 'touches' in e ? e.touches[0] : e;
    const pos = getRelativePosition(clientPos);
    
    setDragOffset({
      x: pos.x - table.positionX,
      y: pos.y - table.positionY,
    });
    setDraggedTable(tableId);
    setIsDragging(true);
  }, [isEditMode, tables, getRelativePosition]);

  // Handle drag move
  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !draggedTable) return;
    
    e.preventDefault();
    
    const clientPos = 'touches' in e ? e.touches[0] : e;
    const pos = getRelativePosition(clientPos);
    
    const table = tables.find(t => t.id === draggedTable);
    if (!table) return;

    // Calculate new position with bounds
    const newX = Math.max(0, Math.min(pos.x - dragOffset.x, containerSize.width - table.width));
    const newY = Math.max(0, Math.min(pos.y - dragOffset.y, containerSize.height - table.height));
    
    // Snap to grid (20px grid)
    const snappedX = Math.round(newX / 20) * 20;
    const snappedY = Math.round(newY / 20) * 20;
    
    onTablePositionChange(draggedTable, snappedX, snappedY);
  }, [isDragging, draggedTable, dragOffset, containerSize, tables, getRelativePosition, onTablePositionChange]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (isDragging && draggedTable) {
      message.success('Posición actualizada');
    }
    setIsDragging(false);
    setDraggedTable(null);
  }, [isDragging, draggedTable]);

  // Handle click on empty area to add table
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (!isEditMode) return;
    
    // Only trigger if clicking on the container itself
    if (e.target !== containerRef.current) return;
    
    const pos = getRelativePosition(e);
    
    // Snap to grid
    const snappedX = Math.round(pos.x / 20) * 20;
    const snappedY = Math.round(pos.y / 20) * 20;
    
    onAddTable(snappedX, snappedY);
  }, [isEditMode, getRelativePosition, onAddTable]);

  // Filter tables by zone
  const filteredTables = selectedZone === 'all' 
    ? tables 
    : tables.filter(table => table.zoneId === selectedZone);

  // Get zone color
  const getZoneColor = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    return zone?.color || '#f0f0f0';
  };

  return (
    <div
      ref={containerRef}
      className={`floor-plan-container ${isEditMode ? 'edit-mode' : ''}`}
      onClick={handleContainerClick}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
    >
      {/* Grid pattern for edit mode */}
      {isEditMode && (
        <div className="floor-plan-grid" />
      )}
      
      {/* Zone backgrounds when showing all */}
      {selectedZone === 'all' && zones.map(zone => {
        const zoneTables = tables.filter(t => t.zoneId === zone.id);
        if (zoneTables.length === 0) return null;
        
        // Calculate zone bounds
        const minX = Math.min(...zoneTables.map(t => t.positionX)) - 20;
        const minY = Math.min(...zoneTables.map(t => t.positionY)) - 20;
        const maxX = Math.max(...zoneTables.map(t => t.positionX + t.width)) + 20;
        const maxY = Math.max(...zoneTables.map(t => t.positionY + t.height)) + 20;
        
        return (
          <div
            key={zone.id}
            className="zone-background"
            style={{
              left: minX,
              top: minY,
              width: maxX - minX,
              height: maxY - minY,
              backgroundColor: `${zone.color || '#e6f7ff'}20`,
              borderColor: zone.color || '#1890ff',
            }}
          >
            <span className="zone-label">{zone.name}</span>
          </div>
        );
      })}
      
      {/* Tables */}
      {filteredTables.map(table => (
        <TableItem
          key={table.id}
          table={table}
          isEditMode={isEditMode}
          isDragging={draggedTable === table.id}
          zoneColor={getZoneColor(table.zoneId)}
          onClick={() => !isDragging && onTableClick(table)}
          onDragStart={(e: React.MouseEvent | React.TouchEvent) => handleDragStart(table.id, e)}
        />
      ))}
      
      {/* Empty state */}
      {filteredTables.length === 0 && (
        <div className="floor-plan-empty">
          <p>No hay mesas en esta zona</p>
          {isEditMode && <p className="hint">Haz click para añadir una mesa</p>}
        </div>
      )}
    </div>
  );
}
