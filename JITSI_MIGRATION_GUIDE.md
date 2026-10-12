# Guía de Migración a Jitsi Meet

## ✅ Componente Creado

Se ha creado `VideoRoomJitsi.tsx` con todas las funcionalidades necesarias:
- ✅ Integración completa de Jitsi Meet
- ✅ Minimización y widget flotante
- ✅ Drag and drop
- ✅ Notificaciones de join/leave
- ✅ Soporte para chat (opcional con Reverb)

## 🔄 Opciones de Migración

### Opción 1: Reemplazo Directo (Recomendado)

**Paso 1:** Respaldar VideoRoom actual
```bash
mv src/components/VideoRoom/VideoRoom.tsx src/components/VideoRoom/VideoRoom.webrtc.backup.tsx
```

**Paso 2:** Usar VideoRoomJitsi como VideoRoom
```bash
cp src/components/VideoRoom/VideoRoomJitsi.tsx src/components/VideoRoom/VideoRoom.tsx
```

**Paso 3:** Actualizar imports si es necesario
El componente ya usa las mismas props que el VideoRoom original, por lo que debería funcionar sin cambios en los componentes padres.

---

### Opción 2: Coexistencia Temporal

Mantener ambos componentes y decidir cuál usar basado en una variable de entorno o configuración.

**En tu router o componente padre:**

```tsx
import VideoRoomWebRTC from './components/VideoRoom/VideoRoom.webrtc.backup';
import VideoRoomJitsi from './components/VideoRoom/VideoRoomJitsi';

// Decidir cuál usar
const USE_JITSI = import.meta.env.VITE_USE_JITSI === 'true';
const VideoRoom = USE_JITSI ? VideoRoomJitsi : VideoRoomWebRTC;

// Usar normalmente
<VideoRoom
  roomId={roomId}
  onCallEnded={handleCallEnded}
  isTeacher={isTeacher}
  isCallMinimized={isCallMinimized}
  toggleMinimizeCall={toggleMinimizeCall}
  handleCallCleanup={handleCallCleanup}
/>
```

---

## ⚙️ Configuración

### Variables de Entorno

Crea o actualiza tu `.env`:

```env
# Opcional: usar servidor Jitsi personalizado
VITE_JITSI_DOMAIN=meet.jit.si

# O tu propio servidor:
# VITE_JITSI_DOMAIN=jitsi.tudominio.com

# Opcional: para coexistencia
# VITE_USE_JITSI=true
```

### Servidor Jitsi

**Por defecto:** Usa `meet.jit.si` (servidores públicos de Jitsi)
- ✅ Gratis
- ✅ Sin configuración
- ✅ Funciona inmediatamente

**Para producción:** Considera self-hosting
- Mejor performance
- Sin marca de agua
- Control total
- Guía: https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-quickstart

---

## 🧪 Testing

### 1. Build Test

```bash
npm run build
```

Verifica que no hay errores de TypeScript.

### 2. Prueba Local

```bash
npm run dev
```

**Abrir en dos navegadores:**
1. Browser 1: `http://localhost:5173/room/test-123`
2. Browser 2: `http://localhost:5173/room/test-123`

**Checklist:**
- [ ] Ambos usuarios se ven y escuchan
- [ ] Toggle de video funciona
- [ ] Toggle de audio funciona
- [ ] Screen sharing funciona
- [ ] Minimización funciona
- [ ] Drag and drop del widget funciona
- [ ] Notificaciones de join/leave aparecen

### 3. Prueba con Múltiples Participantes

Abrir en 3-5 navegadores/dispositivos diferentes y verificar:
- [ ] Todos se ven
- [ ] Audio de todos se escucha
- [ ] Performance es aceptable

---

## 📝 Diferencias Clave

### Lo que CAMBIA:

| Aspecto | WebRTC Anterior | Jitsi Meet Nuevo |
|---------|-----------------|------------------|
| Renderizado | `<video>` elements | `<iframe>` de Jitsi |
| Señalización | Reverb WebSocket | Jitsi servers |
| TURN Servers | Propios | Jitsi (incluidos) |
| Gestión de streams | Manual (useWebRTC) | Automático (Jitsi) |
| Screen sharing | `getDisplayMedia()` | API de Jitsi |

### Lo que se MANTIENE:

- ✅ Props del componente (misma interfaz)
- ✅ Minimización y widget flotante
- ✅ Drag and drop
- ✅ Notificaciones (Toast)
- ✅ Chat (opcional con Reverb)
- ✅ CallContext integration

---

## 🔧 Personalización

### Cambiar Configuración de Jitsi

En `VideoRoomJitsi.tsx`, modifica `configOverwrite`:

```tsx
configOverwrite={{
  startWithAudioMuted: false,  // Iniciar con audio
  startWithVideoMuted: false,  // Iniciar con video
  prejoinPageEnabled: false,   // Sin página de pre-join
  disableDeepLinking: true,    // Deshabilitar deep links
  
  // Opciones adicionales:
  // enableWelcomePage: false,
  // enableClosePage: false,
  // resolution: 720,
  // constraints: {
  //   video: {
  //     height: { ideal: 720, max: 1080, min: 360 }
  //   }
  // }
}}
```

### Cambiar Botones de la Toolbar

Modifica `TOOLBAR_BUTTONS` en `interfaceConfigOverwrite`:

```tsx
TOOLBAR_BUTTONS: [
  'microphone',    // Micrófono
  'camera',        // Cámara
  'desktop',       // Compartir pantalla
  'fullscreen',    // Pantalla completa
  'hangup',        // Colgar
  'chat',          // Chat
  'raisehand',     // Levantar mano
  'tileview',      // Vista de mosaico
  // ... más opciones disponibles
],
```

### Remover Marca de Agua de Jitsi

Ya está configurado en el código:

```tsx
SHOW_JITSI_WATERMARK: false,
SHOW_WATERMARK_FOR_GUESTS: false,
```

---

## 🚨 Troubleshooting

### "Cannot read property 'dispose' of null"

**Causa:** Intentar cerrar Jitsi antes de que esté listo.

**Solución:** Ya está manejado en el código con try-catch.

### Video no se muestra

**Causa:** Permisos de cámara/micrófono no otorgados.

**Solución:** Verificar permisos del navegador.

### Audio no funciona

**Causa:** Navegador bloqueó autoplay de audio.

**Solución:** Usuario debe interactuar con la página primero.

### Performance lenta

**Causa:** Demasiados participantes o conexión lenta.

**Solución:** 
- Reducir calidad de video en config
- Limitar número de participantes
- Considerar self-hosting

---

## 🔄 Rollback

Si necesitas volver a WebRTC:

```bash
# Restaurar VideoRoom original
mv src/components/VideoRoom/VideoRoom.webrtc.backup.tsx src/components/VideoRoom/VideoRoom.tsx

# O usar git
git checkout src/components/VideoRoom/VideoRoom.tsx
```

---

## 📊 Monitoreo

### Logs de Jitsi

Jitsi genera logs en la consola del navegador:
- `[Jitsi] API ready` - API inicializada
- `[Jitsi] Participant joined` - Usuario se unió
- `[Jitsi] Conference joined` - Conectado a la sala

### Métricas a Monitorear

- Tiempo de conexión
- Número de desconexiones
- Calidad de video/audio reportada
- Feedback de usuarios

---

## 🎯 Próximos Pasos

1. **Hacer backup de VideoRoom.tsx actual**
2. **Reemplazar con VideoRoomJitsi**
3. **Probar localmente**
4. **Deploy a staging/producción**
5. **Monitorear y recopilar feedback**

---

## 📞 Soporte

- **Jitsi Docs**: https://jitsi.github.io/handbook/
- **React SDK**: https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-react-sdk
- **Community**: https://community.jitsi.org/

---

## ✨ Ventajas de Jitsi

- ✅ **Gratis** - Sin costos de licencia
- ✅ **Estable** - Infraestructura probada
- ✅ **Fácil** - Menos código que WebRTC
- ✅ **Escalable** - Hasta 100 participantes
- ✅ **Mantenido** - Comunidad activa
- ✅ **Open Source** - Control total

**¡Listo para usar!** 🚀
