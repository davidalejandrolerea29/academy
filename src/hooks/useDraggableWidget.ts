import { useState, useEffect, useRef, useCallback } from 'react';

// Define las dimensiones por defecto para el widget
const DESKTOP_WIDGET_WIDTH = 320;
const DESKTOP_WIDGET_HEIGHT = 400;
const MOBILE_WIDGET_WIDTH = 144;
const MOBILE_WIDGET_HEIGHT = 96;

interface UseDraggableWidgetProps {
  isMinimized: boolean; // Renombramos isCallMinimized a isMinimized para ser más genérico
  initialX?: number; // Posición inicial opcional X
  initialY?: number; // Posición inicial opcional Y
}

interface DraggableWidgetReturn {
  widgetPosition: { x: number; y: number };
  isDragging: boolean;
  widgetDesktopRef: React.RefObject<HTMLDivElement>;
  widgetMobileRef: React.RefObject<HTMLDivElement>;
  handleDragButtonMouseDown: (e: React.MouseEvent) => void;
  handleDragButtonTouchStart: (e: React.TouchEvent) => void;
}

export const useDraggableWidget = ({
  isMinimized,
  initialX = 0,
  initialY = 0,
}: UseDraggableWidgetProps): DraggableWidgetReturn => {
  const [widgetPosition, setWidgetPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Refs para los elementos del widget. El componente consumidor los pasará a sus divs.
  const widgetDesktopRef = useRef<HTMLDivElement>(null);
  const widgetMobileRef = useRef<HTMLDivElement>(null);

  // --- Funciones de Drag and Drop ---

  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

  const startDragging = useCallback((clientX: number, clientY: number) => {
    let currentWidgetElement: HTMLElement | null = null;
    let fallbackWidth = 0;
    let fallbackHeight = 0;

    // Determinar qué widget está activo y obtener su referencia y dimensiones de fallback
    if (window.innerWidth >= 768) { // Desktop
      currentWidgetElement = widgetDesktopRef.current;
      fallbackWidth = DESKTOP_WIDGET_WIDTH;
      fallbackHeight = DESKTOP_WIDGET_HEIGHT;
    } else { // Mobile
      currentWidgetElement = widgetMobileRef.current;
      fallbackWidth = MOBILE_WIDGET_WIDTH;
      fallbackHeight = MOBILE_WIDGET_HEIGHT;
    }

    if (!currentWidgetElement) {
      console.error('useDraggableWidget: No active widget element found. Dragging cannot start.');
      return;
    }

    const rect = currentWidgetElement.getBoundingClientRect();

    const actualWidth = rect.width === 0 ? fallbackWidth : rect.width;
    const actualHeight = rect.height === 0 ? fallbackHeight : rect.height;

    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top
    });

    setIsDragging(true);
    // console.log('useDraggableWidget: Dragging initiated. Click coordinates:', { clientX, clientY });
    // console.log('useDraggableWidget: Widget Rect (measured):', { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    // console.log('useDraggableWidget: Widget dimensions (used):', { actualWidth, actualHeight });
    // console.log('useDraggableWidget: DragOffset calculated:', { x: clientX - rect.left, y: clientY - rect.top });

  }, []);

  const handlePointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const newX = clientX - dragOffset.x;
    const newY = clientY - dragOffset.y;

    let currentWidgetWidth = 0;
    let currentWidgetHeight = 0;

    if (window.innerWidth >= 768) { // Desktop
      currentWidgetWidth = widgetDesktopRef.current?.offsetWidth || DESKTOP_WIDGET_WIDTH;
      currentWidgetHeight = widgetDesktopRef.current?.offsetHeight || DESKTOP_WIDGET_HEIGHT;
    } else { // Mobile
      currentWidgetWidth = widgetMobileRef.current?.offsetWidth || MOBILE_WIDGET_WIDTH;
      currentWidgetHeight = widgetMobileRef.current?.offsetHeight || MOBILE_WIDGET_HEIGHT;
    }

    const maxX = window.innerWidth - currentWidgetWidth;
    const maxY = window.innerHeight - currentWidgetHeight;

    setWidgetPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });

    if ('touches' in e) {
      e.preventDefault(); // Previene el scroll cuando se arrastra en móvil
    }
  }, [isDragging, dragOffset]);

  // Inicializar posición por defecto cuando se minimiza
  useEffect(() => {
    // Si se minimiza Y la posición aún no se ha establecido (es 0,0 por defecto)
    if (isMinimized && widgetPosition.x === initialX && widgetPosition.y === initialY) {
      let initialWidgetWidth = 0;
      let initialWidgetHeight = 0;

      // Determinar las dimensiones del widget actual para posicionarlo
      if (window.innerWidth >= 768) {
          initialWidgetWidth = widgetDesktopRef.current?.offsetWidth || DESKTOP_WIDGET_WIDTH;
          initialWidgetHeight = widgetDesktopRef.current?.offsetHeight || DESKTOP_WIDGET_HEIGHT;
      } else {
          initialWidgetWidth = widgetMobileRef.current?.offsetWidth || MOBILE_WIDGET_WIDTH;
          initialWidgetHeight = widgetMobileRef.current?.offsetHeight || MOBILE_WIDGET_HEIGHT;
      }

      setWidgetPosition({
        x: window.innerWidth - initialWidgetWidth - 20, // 20px de margen derecho
        y: window.innerHeight - initialWidgetHeight - 20 // 20px de margen inferior
      });
    }
  }, [isMinimized, widgetPosition, initialX, initialY]);

  // Efecto para agregar event listeners globales al iniciar el arrastre
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handlePointerMove);
      document.addEventListener('mouseup', stopDragging);
      document.addEventListener('touchmove', handlePointerMove, { passive: false });
      document.addEventListener('touchend', stopDragging);

      return () => {
        document.removeEventListener('mousemove', handlePointerMove);
        document.removeEventListener('mouseup', stopDragging);
        document.removeEventListener('touchmove', handlePointerMove);
        document.removeEventListener('touchend', stopDragging);
      };
    }
  }, [isDragging, handlePointerMove, stopDragging]);

  // Manejadores de eventos para el botón de arrastre (expuestos para el componente)
  const handleDragButtonMouseDown = useCallback((e: React.MouseEvent) => {
    startDragging(e.clientX, e.clientY);
    e.stopPropagation(); // Evita que el evento se propague al div padre
    e.preventDefault(); // Previene la selección de texto
  }, [startDragging]);

  const handleDragButtonTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startDragging(touch.clientX, touch.clientY);
    e.stopPropagation(); // Evita que el evento se propague
    // No e.preventDefault() aquí; handlePointerMove lo hace si es necesario.
  }, [startDragging]);

  return {
    widgetPosition,
    isDragging,
    widgetDesktopRef,
    widgetMobileRef,
    handleDragButtonMouseDown,
    handleDragButtonTouchStart,
  };
};