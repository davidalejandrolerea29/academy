# Configuración Completa Daily.co - Paso a Paso

## 🎯 Objetivo
Dejar Daily.co 100% funcional sin tocar el backend.

---

## ✅ Backend: NO Requiere Cambios

**Daily.co maneja todo automáticamente:**
- ✅ Infraestructura de video
- ✅ TURN servers
- ✅ Señalización
- ✅ Gestión de salas
- ✅ Reconexión

**Tu backend (Laravel) solo necesita:**
- ✅ Autenticación de usuarios (ya lo tienes)
- ✅ Chat con Reverb (ya lo tienes)
- ✅ Base de datos (ya lo tienes)

**NO necesitas:**
- ❌ Endpoints para tokens
- ❌ Gestión de salas
- ❌ Configuración de TURN servers
- ❌ WebSocket para video

---

## 📋 Checklist de Implementación

### Paso 1: Crear Cuenta Daily.co (5 min)

1. **Ir a:** https://dashboard.daily.co/signup

2. **Registrarse:**
   - Email: tu email
   - Password: crear contraseña
   - Click "Sign up"

3. **Verificar email:**
   - Revisa tu bandeja de entrada
   - Click en el link de verificación

4. **Login:** https://dashboard.daily.co/

✅ **Completado cuando:** Puedes ver el dashboard de Daily.co

---

### Paso 2: Crear Dominio (2 min)

1. **En el dashboard:**
   - Ve a: https://dashboard.daily.co/domains
   - O click en "Domains" en el menú lateral

2. **Crear dominio:**
   - Click "Create domain"
   - Nombre: `academy` (o el que prefieras)
   - Click "Create"

3. **Tu dominio será:**
   ```
   academy.daily.co
   ```

✅ **Completado cuando:** Ves tu dominio en la lista

---

### Paso 3: Configurar Frontend (1 min)

1. **Crear archivo `.env.local`** en la raíz del proyecto:

```bash
cd /home/david/Documentos/academy
touch .env.local
```

2. **Agregar configuración:**

```env
# Daily.co Configuration
VITE_DAILY_DOMAIN=academy

# O usa el dominio completo:
# VITE_DAILY_DOMAIN=academy.daily.co
```

3. **Guardar el archivo**

✅ **Completado cuando:** Archivo `.env.local` existe con la variable

---

### Paso 4: Reiniciar Servidor (30 seg)

1. **Detener servidor actual:**
   - En la terminal donde corre `npm run dev`
   - Presiona `Ctrl+C`

2. **Iniciar de nuevo:**
```bash
npm run dev
```

3. **Verificar que cargó:**
   - Deberías ver: `Local: http://localhost:5173/`

✅ **Completado cuando:** Servidor corriendo con nueva configuración

---

### Paso 5: Probar con 2 Usuarios (5 min)

1. **Browser 1 (Chrome):**
   ```
   http://localhost:5173/room/test-123
   ```

2. **Browser 2 (Chrome Incógnito o Firefox):**
   ```
   http://localhost:5173/room/test-123
   ```

3. **Aceptar permisos:**
   - Permitir cámara
   - Permitir micrófono

4. **Verificar:**
   - [ ] Ambos usuarios se ven
   - [ ] Ambos usuarios se escuchan
   - [ ] Puedes hacer mute
   - [ ] Puedes apagar cámara
   - [ ] Puedes compartir pantalla

✅ **Completado cuando:** Todo funciona correctamente

---

## 🔧 Configuración Opcional (Avanzado)

### Opción A: Usar API Key (Para Producción)

Si quieres más control, puedes usar API key:

1. **Obtener API Key:**
   - Dashboard: https://dashboard.daily.co/developers
   - Click "Create API key"
   - Copia la key

2. **Agregar al backend (Laravel):**

```php
// .env
DAILY_API_KEY=tu_api_key_aqui
```

3. **Crear endpoint para generar tokens:**

```php
// routes/api.php
Route::post('/daily/token', [DailyController::class, 'generateToken'])
    ->middleware('auth:sanctum');

// app/Http/Controllers/DailyController.php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class DailyController extends Controller
{
    public function generateToken(Request $request)
    {
        $request->validate([
            'room_name' => 'required|string',
        ]);

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . env('DAILY_API_KEY'),
            'Content-Type' => 'application/json',
        ])->post('https://api.daily.co/v1/meeting-tokens', [
            'properties' => [
                'room_name' => $request->room_name,
                'user_name' => auth()->user()->name,
                'enable_screenshare' => true,
                'start_video_off' => false,
                'start_audio_off' => false,
            ],
        ]);

        return response()->json([
            'token' => $response->json('token'),
        ]);
    }
}
```

**Nota:** Esto es OPCIONAL. Daily.co funciona sin tokens para desarrollo.

---

### Opción B: Crear Salas Programáticamente

Si quieres crear salas con configuración específica:

```php
// app/Http/Controllers/DailyController.php
public function createRoom(Request $request)
{
    $request->validate([
        'room_name' => 'required|string',
    ]);

    $response = Http::withHeaders([
        'Authorization' => 'Bearer ' . env('DAILY_API_KEY'),
        'Content-Type' => 'application/json',
    ])->post('https://api.daily.co/v1/rooms', [
        'name' => $request->room_name,
        'privacy' => 'public',
        'properties' => [
            'max_participants' => 100,
            'enable_screenshare' => true,
            'enable_chat' => false, // Usamos nuestro chat con Reverb
            'enable_knocking' => false,
            'start_video_off' => false,
            'start_audio_off' => false,
        ],
    ]);

    return response()->json($response->json());
}
```

**Nota:** También OPCIONAL. Daily.co crea salas automáticamente.

---

## 🚀 Deployment a Producción

### Frontend

1. **Build de producción:**
```bash
npm run build
```

2. **Subir `dist/` a tu servidor**

3. **Configurar variables de entorno en producción:**
```env
VITE_DAILY_DOMAIN=academy
```

### Backend

**No requiere cambios** a menos que uses API key (opcional).

---

## 📊 Monitoreo de Uso

### Dashboard de Daily.co

1. **Ver uso:** https://dashboard.daily.co/usage

2. **Métricas disponibles:**
   - Minutos consumidos
   - Número de llamadas
   - Participantes únicos
   - Calidad de conexión

3. **Alertas:**
   - Configura alertas cuando te acerques al límite gratuito

---

## 🆘 Troubleshooting Completo

### Error: "Cannot read property 'join' of null"

**Causa:** Dominio no configurado correctamente

**Solución:**
```bash
# Verifica que .env.local existe
cat .env.local

# Debe mostrar:
VITE_DAILY_DOMAIN=academy

# Reinicia el servidor
npm run dev
```

---

### Error: "Room not found"

**Causa:** Dominio incorrecto o no existe

**Solución:**
1. Verifica en dashboard: https://dashboard.daily.co/domains
2. Copia el nombre exacto del dominio
3. Actualiza `.env.local`
4. Reinicia servidor

---

### Error: "Permission denied"

**Causa:** Permisos de cámara/micrófono bloqueados

**Solución:**
1. Click en el candado 🔒 en la barra de direcciones
2. Cambiar cámara y micrófono a "Permitir"
3. Recargar página

---

### Video/Audio no funciona

**Checklist:**
- [ ] Permisos aceptados
- [ ] Cámara/micrófono no están en uso por otra app
- [ ] Navegador actualizado (Chrome 90+, Firefox 88+)
- [ ] HTTPS en producción (localhost está bien para desarrollo)

---

## ✅ Checklist Final de Implementación

### Configuración
- [ ] Cuenta Daily.co creada
- [ ] Dominio creado (ej: `academy.daily.co`)
- [ ] `.env.local` configurado
- [ ] Servidor reiniciado

### Testing
- [ ] Probado con 2 usuarios
- [ ] Video funciona
- [ ] Audio funciona
- [ ] Screen sharing funciona
- [ ] Chat funciona
- [ ] Minimización funciona

### Producción (Opcional)
- [ ] Build de producción exitoso
- [ ] Variables de entorno en servidor
- [ ] Deploy completado
- [ ] Probado en producción

---

## 📝 Resumen

### ✅ Lo que SÍ necesitas hacer:

1. Crear cuenta en Daily.co (5 min)
2. Crear dominio (2 min)
3. Configurar `.env.local` (1 min)
4. Reiniciar servidor (30 seg)
5. Probar (5 min)

**Total: ~15 minutos**

### ❌ Lo que NO necesitas hacer:

- ❌ Modificar backend
- ❌ Crear endpoints
- ❌ Configurar TURN servers
- ❌ Instalar dependencias adicionales
- ❌ Configurar WebSockets para video

---

## 🎯 Próximo Paso

**Ahora mismo:**
1. Ve a https://dashboard.daily.co/signup
2. Crea tu cuenta
3. Crea el dominio
4. Configura `.env.local`
5. ¡Prueba!

**¿Necesitas ayuda con algún paso específico?** Avísame y te guío.
