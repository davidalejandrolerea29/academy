# Troubleshooting: Jitsi Pantalla Negra

## Problema Actual
Jitsi muestra solo pantalla negra con logo, sin video ni controles.

## Posibles Causas y Soluciones

### 1. Verificar Consola del Navegador
Abre la consola (F12) y busca errores. Errores comunes:

```
- "Failed to load resource" - Problema de red/firewall
- "Permission denied" - Permisos de cámara
- "Cross-origin" - Problema de CORS
```

### 2. Verificar Permisos
1. Click en el candado 🔒 en la barra de direcciones
2. Verifica que cámara y micrófono estén **Permitidos**
3. Si están bloqueados, cámbialos a "Permitir"
4. Recarga la página

### 3. Probar en Modo Incógnito
1. Abre una ventana de incógnito (Ctrl+Shift+N)
2. Ve a `http://localhost:5173/room/test`
3. Acepta permisos de cámara/micrófono
4. ¿Funciona ahora?

### 4. Probar Jitsi Directamente
Para verificar que Jitsi funciona:
1. Abre https://meet.jit.si/test-room-123
2. ¿Ves tu video?
3. Si SÍ → El problema es la integración
4. Si NO → Problema con tu navegador/cámara

### 5. Verificar que el Dev Server está corriendo
```bash
# Debería mostrar:
http://localhost:5173/
```

### 6. Solución Temporal: Usar URL Directa de Jitsi

Si nada funciona, podemos cambiar a abrir Jitsi en una nueva pestaña:

```typescript
// Abrir Jitsi en nueva ventana
window.open(`https://meet.jit.si/academy-room-${roomId}`, '_blank');
```

## Próximos Pasos

**Por favor, envíame:**
1. Captura de pantalla de la consola del navegador (F12)
2. ¿Qué navegador estás usando? (Chrome, Firefox, etc.)
3. ¿Funciona https://meet.jit.si/test directamente?

Con esa información podré darte una solución específica.
