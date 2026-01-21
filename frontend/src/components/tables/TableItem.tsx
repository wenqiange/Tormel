import { useMemo } from 'react';
import { UserOutlined, ClockCircleOutlined, EuroOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { Table, TableStatus } from '@/types';

interface TableItemProps {
  table: Table;
  isEditMode: boolean;
  isDragging: boolean;
  zoneColor: string;
  onClick: () => void;
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
}

// Status configuration with colors and labels
const STATUS_CONFIG: Record<TableStatus, { color: string; bgColor: string; label: string; icon: string }> = {
  FREE: { 
    color: '#389e0d', 
    bgColor: '#52c41a', 
    label: 'Libre', 
    icon: '✓' 
  },
  OCCUPIED: { 
    color: '#cf1322', 
    bgColor: '#ff4d4f', 
    label: 'Ocupada', 
    icon: '●' 
  },
  RESERVED: { 
    color: '#d48806', 
    bgColor: '#faad14', 
    label: 'Reservada', 
    icon: '◐' 
  },
  BLOCKED: { 
    color: '#595959', 
    bgColor: '#8c8c8c', 
    label: 'Bloqueada', 
    icon: '✕' 
  },
};

export default function TableItem({
  table,
  isEditMode,
  isDragging,
  zoneColor: _zoneColor, // Reserved for future use
  onClick,
  onDragStart,
}: TableItemProps) {
  const statusConfig = STATUS_CONFIG[table.status];
  const currentSession = table.sessions?.[0] || table.currentSession;
  
  // Calculate session duration
  const sessionDuration = useMemo(() => {
    if (!currentSession?.openedAt) return null;
    
    const start = new Date(currentSession.openedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  }, [currentSession?.openedAt]);

  // Calculate total amount from orders
  const sessionTotal = useMemo(() => {
    if (!currentSession?.orders) return 0;
    return currentSession.orders.reduce((sum, order) => {
      return sum + (order.items?.reduce((itemSum, item) => itemSum + (item.totalPrice || 0), 0) || 0);
    }, 0);
  }, [currentSession?.orders]);

  // Get shape class
  const shapeClass = useMemo(() => {
    switch (table.shape) {
      case 'circle': return 'table-shape-circle';
      case 'rectangle': return 'table-shape-rectangle';
      default: return 'table-shape-square';
    }
  }, [table.shape]);

  // Generate tooltip content
  const tooltipContent = (
    <div className="table-tooltip">
      <div className="tooltip-header">
        <strong>Mesa {table.number}</strong>
        {table.name && <span> - {table.name}</span>}
      </div>
      <div className="tooltip-status">
        Estado: <span style={{ color: statusConfig.color }}>{statusConfig.label}</span>
      </div>
      <div className="tooltip-capacity">
        Capacidad: {table.capacity} personas
      </div>
      {currentSession && (
        <>
          <div className="tooltip-guests">
            Comensales: {currentSession.guestCount || currentSession.customerCount || 0}
          </div>
          {currentSession.guestName && (
            <div className="tooltip-guest-name">
              Cliente: {currentSession.guestName}
            </div>
          )}
          {sessionDuration && (
            <div className="tooltip-duration">
              Tiempo: {sessionDuration}
            </div>
          )}
          {sessionTotal > 0 && (
            <div className="tooltip-total">
              Total: {new Intl.NumberFormat('es-ES', { 
                style: 'currency', 
                currency: 'EUR' 
              }).format(sessionTotal)}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <Tooltip 
      title={tooltipContent} 
      placement="top"
      overlayClassName="table-item-tooltip"
    >
      <div
        className={`table-item ${shapeClass} ${isDragging ? 'dragging' : ''} ${isEditMode ? 'edit-mode' : ''}`}
        style={{
          left: table.positionX,
          top: table.positionY,
          width: table.width || 100,
          height: table.height || 100,
          backgroundColor: statusConfig.bgColor,
          borderColor: statusConfig.color,
          cursor: isEditMode ? 'move' : 'pointer',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
      >
        {/* Table number */}
        <div className="table-number">
          {table.number}
        </div>
        
        {/* Table name (if different from number) */}
        {table.name && table.name !== table.number && (
          <div className="table-name">
            {table.name}
          </div>
        )}
        
        {/* Status indicator for non-free tables */}
        {table.status !== 'FREE' && (
          <div className="table-status-badge">
            {statusConfig.icon}
          </div>
        )}
        
        {/* Guest count and info */}
        <div className="table-info">
          <div className="table-guests">
            <UserOutlined />
            <span>
              {currentSession 
                ? `${currentSession.guestCount || currentSession.customerCount || 0}/${table.capacity}` 
                : table.capacity
              }
            </span>
          </div>
          
          {/* Show duration for occupied tables */}
          {table.status === 'OCCUPIED' && sessionDuration && (
            <div className="table-duration">
              <ClockCircleOutlined />
              <span>{sessionDuration}</span>
            </div>
          )}
          
          {/* Show total for occupied tables with orders */}
          {table.status === 'OCCUPIED' && sessionTotal > 0 && (
            <div className="table-total">
              <EuroOutlined />
              <span>{sessionTotal.toFixed(0)}€</span>
            </div>
          )}
        </div>
        
        {/* Edit mode indicator */}
        {isEditMode && (
          <div className="table-edit-indicator">
            ⋮⋮
          </div>
        )}
        
        {/* Resize handles for edit mode */}
        {isEditMode && (
          <>
            <div className="resize-handle resize-handle-se" />
          </>
        )}
      </div>
    </Tooltip>
  );
}
