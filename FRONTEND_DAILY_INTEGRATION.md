# Frontend - Daily.co Integration Guide

## ✅ Cambios Implementados

### `VideoRoom.tsx` - Actualizado

El componente ahora:

1. **Llama al backend** antes de conectar a Daily.co
2. **Crea/obtiene la sala** via API
3. **Maneja estados** de carga y error
4. **Conecta a Daily.co** solo después de obtener la URL

---

## 🔄 Flujo Actualizado

```
1. Usuario entra a /room/123
   ↓
2. Frontend muestra "Creando sala..."
   ↓
3. Frontend llama a POST /api/daily/room
   ↓
4. Backend crea/obtiene sala en Daily.co
   ↓
5. Backend devuelve URL de la sala
   ↓
6. Frontend conecta a Daily.co
   ↓
7. Usuario entra a la videollamada
```

---

## 📝 Código Implementado

### Estados Agregados

```typescript
const [isCreatingRoom, setIsCreatingRoom] = useState(false);
const [roomError, setRoomError] = useState<string | null>(null);
```

### Llamada al Backend

```typescript
const API_URL = import.meta.env.VITE_API_URL;
const response = await fetch(`${API_URL}/daily/room`, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    body: JSON.stringify({ room_id: roomId }),
});
```

### Manejo de Respuesta

```typescript
const data = await response.json();

if (!data.success) {
    throw new Error(data.error || 'Failed to create room');
}

const roomUrl = data.room.url; // https://meet-english-daily.co/123
```

---

## 🎨 Estados de UI

### 1. Cargando (Creando Sala)
```
┌─────────────────────────────┐
│                             │
│  Creando sala de            │
│  videollamada...            │
│                             │
│  Por favor espera un        │
│  momento                    │
│                             │
└─────────────────────────────┘
```

### 2. Error
```
┌─────────────────────────────┐
│                             │
│  ❌ Error                    │
│                             │
│  Failed to create room      │
│                             │
│  [ Reintentar ]             │
│                             │
└─────────────────────────────┘
```

### 3. Conectando
```
┌─────────────────────────────┐
│                             │
│  Conectando a la sala...    │
│                             │
└─────────────────────────────┘
```

### 4. Sala Activa
```
┌─────────────────────────────┐
│  [Video Grid]               │
│                             │
│  [Controles]                │
└─────────────────────────────┘
```

---

## 🧪 Testing

### 1. Test con Backend Funcionando

```bash
# Terminal 1: Backend Laravel
php artisan serve

# Terminal 2: Frontend React
npm run dev

# Browser:
http://localhost:5173/room/test-123
```

**Resultado esperado:**
1. Muestra "Creando sala..."
2. Llama a backend
3. Backend crea sala
4. Conecta a Daily.co
5. Video funciona

---

### 2. Test sin Backend (Simulación de Error)

Si el backend no está disponible:

**Resultado esperado:**
1. Muestra "Creando sala..."
2. Error: "Failed to create room"
3. Botón "Reintentar"

---

## 🔧 Configuración Requerida

### Variables de Entorno

```env
# .env.local (Frontend)
VITE_API_URL=https://portalnewpath.com/api
VITE_DAILY_DOMAIN=meet-english-daily.co
```

### Token de Autenticación

El código usa `localStorage.getItem('token')` para obtener el token.

**Asegúrate de que:**
- El token se guarda en localStorage al login
- El token es válido
- El backend acepta el token en el header Authorization

---

## 🐛 Troubleshooting

### Error: "Failed to create room"

**Causas posibles:**
1. Backend no está corriendo
2. Token inválido o expirado
3. Endpoint incorrecto
4. CORS bloqueado

**Solución:**
1. Verificar que backend esté corriendo
2. Verificar token en localStorage
3. Verificar URL del API en `.env.local`
4. Verificar CORS en Laravel

---

### Error: "Network request failed"

**Causa:** No hay conexión al backend

**Solución:**
1. Verificar que `VITE_API_URL` sea correcta
2. Verificar que backend esté accesible
3. Verificar CORS

---

### Video no se muestra después de conectar

**Causa:** Daily.co no pudo conectar

**Solución:**
1. Verificar que la URL de la sala sea correcta
2. Verificar permisos de cámara/micrófono
3. Revisar consola del navegador

---

## ✅ Checklist de Implementación

### Backend (Equipo Backend)
- [ ] Implementar `DailyController.php`
- [ ] Agregar rutas en `routes/api.php`
- [ ] Configurar `.env` con `DAILY_API_KEY`
- [ ] Probar endpoint con Postman
- [ ] Deploy a producción

### Frontend (Ya Implementado)
- [x] Actualizar `VideoRoom.tsx`
- [x] Agregar estados de carga/error
- [x] Llamar a backend antes de conectar
- [x] Manejar errores
- [x] UI de estados

### Testing (Después de Backend)
- [ ] Probar creación de sala
- [ ] Probar con 2 usuarios
- [ ] Probar manejo de errores
- [ ] Probar en producción

---

## 🚀 Deployment

### Frontend

```bash
# Build
npm run build

# El código ya está listo
# Solo asegúrate de que VITE_API_URL apunte a producción
```

### Variables en Producción

```env
# Producción
VITE_API_URL=https://portalnewpath.com/api
VITE_DAILY_DOMAIN=meet-english-daily.co
```

---

## 📊 Monitoreo

### Logs a Revisar

**Frontend (Console):**
```
[Daily] Room URL: https://meet-english-daily.co/123
[Daily] Joined meeting
```

**Backend (Laravel Logs):**
```
Daily.co: Creating room test-123
Daily.co: Room created successfully
```

---

## 🎯 Próximos Pasos

1. **Esperar a que backend implemente** el endpoint
2. **Probar** con backend local
3. **Verificar** que todo funcione
4. **Deploy** a producción
5. **Monitorear** errores

---

## 📞 Contacto

Si hay problemas con la integración:
1. Revisar logs del backend
2. Revisar consola del navegador
3. Verificar que el endpoint devuelva el formato correcto:
   ```json
   {
     "success": true,
     "room": {
       "url": "https://meet-english-daily.co/123",
       "name": "123",
       "created": true
     }
   }
   ```

---

**Estado:** ✅ Frontend listo - Esperando backend
