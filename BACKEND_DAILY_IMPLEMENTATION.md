# Backend Implementation - Daily.co Room Management

## 📋 Objetivo

Implementar endpoints en Laravel para gestionar salas de videollamadas usando Daily.co API.

---

## 🔑 Configuración Inicial

### 1. Agregar API Key al `.env`

```env
# .env (Backend Laravel)
DAILY_API_KEY=ac2fa81b05e4e6c10e7efc5b2e0116d47d5e554c90c1fb80b5c95b6a7bc6df1b
DAILY_DOMAIN=meet-english-daily.co
```

**⚠️ IMPORTANTE:** Esta API key es sensible. NO exponerla en el frontend.

---

## 📁 Archivos a Crear/Modificar

### 1. Controller: `app/Http/Controllers/DailyController.php`

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DailyController extends Controller
{
    private $apiKey;
    private $domain;
    private $apiUrl = 'https://api.daily.co/v1';

    public function __construct()
    {
        $this->apiKey = env('DAILY_API_KEY');
        $this->domain = env('DAILY_DOMAIN');
    }

    /**
     * Crear o obtener una sala de Daily.co
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getOrCreateRoom(Request $request)
    {
        $request->validate([
            'room_id' => 'required|string|max:255',
        ]);

        $roomName = $request->room_id;

        try {
            // Primero intentar obtener la sala si ya existe
            $existingRoom = $this->getRoom($roomName);
            
            if ($existingRoom) {
                return response()->json([
                    'success' => true,
                    'room' => [
                        'url' => $existingRoom['url'],
                        'name' => $existingRoom['name'],
                        'created' => false,
                    ],
                ]);
            }

            // Si no existe, crear nueva sala
            $newRoom = $this->createRoom($roomName);

            return response()->json([
                'success' => true,
                'room' => [
                    'url' => $newRoom['url'],
                    'name' => $newRoom['name'],
                    'created' => true,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Daily.co Error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Failed to get or create room',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener información de una sala existente
     * 
     * @param string $roomName
     * @return array|null
     */
    private function getRoom($roomName)
    {
        $response = Http::withHeaders([
            'Authorization' => "Bearer {$this->apiKey}",
        ])->get("{$this->apiUrl}/rooms/{$roomName}");

        if ($response->successful()) {
            return $response->json();
        }

        // Si es 404, la sala no existe
        if ($response->status() === 404) {
            return null;
        }

        // Cualquier otro error, lanzar excepción
        throw new \Exception("Failed to get room: " . $response->body());
    }

    /**
     * Crear una nueva sala en Daily.co
     * 
     * @param string $roomName
     * @return array
     */
    private function createRoom($roomName)
    {
        $response = Http::withHeaders([
            'Authorization' => "Bearer {$this->apiKey}",
            'Content-Type' => 'application/json',
        ])->post("{$this->apiUrl}/rooms", [
            'name' => $roomName,
            'privacy' => 'public',
            'properties' => [
                'enable_screenshare' => true,
                'enable_chat' => false, // Usamos nuestro chat personalizado
                'enable_knocking' => false,
                'enable_prejoin_ui' => false,
                'max_participants' => 100,
                'start_video_off' => false,
                'start_audio_off' => false,
                'owner_only_broadcast' => false,
                'enable_recording' => 'cloud', // Habilita grabación en la nube
                'record_on_start' => true,     // Inicia grabación al entrar el primero
            ],
        ]);

        if ($response->successful()) {
            return $response->json();
        }

        throw new \Exception("Failed to create room: " . $response->body());
    }

    /**
     * Eliminar una sala (opcional - para limpieza)
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteRoom(Request $request)
    {
        $request->validate([
            'room_name' => 'required|string',
        ]);

        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$this->apiKey}",
            ])->delete("{$this->apiUrl}/rooms/{$request->room_name}");

            if ($response->successful()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Room deleted successfully',
                ]);
            }

            return response()->json([
                'success' => false,
                'error' => 'Failed to delete room',
            ], 500);

        } catch (\Exception $e) {
            Log::error('Daily.co Delete Error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Listar todas las salas activas (opcional - para administración)
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function listRooms()
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$this->apiKey}",
            ])->get("{$this->apiUrl}/rooms");

            if ($response->successful()) {
                return response()->json([
                    'success' => true,
                    'rooms' => $response->json('data'),
                ]);
            }

            return response()->json([
                'success' => false,
                'error' => 'Failed to list rooms',
            ], 500);

        } catch (\Exception $e) {
            Log::error('Daily.co List Error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
```

---

### 2. Routes: `routes/api.php`

```php
<?php

use App\Http\Controllers\DailyController;

// Daily.co Room Management
Route::middleware('auth:sanctum')->group(function () {
    // Obtener o crear sala
    Route::post('/daily/room', [DailyController::class, 'getOrCreateRoom']);
    
    // Eliminar sala (opcional)
    Route::delete('/daily/room', [DailyController::class, 'deleteRoom']);
    
    // Listar salas (opcional - solo para admins)
    Route::get('/daily/rooms', [DailyController::class, 'listRooms']);
});
```

---

## 🧪 Testing

### 1. Test con Postman/Insomnia

**Endpoint:** `POST https://portalnewpath.com/api/daily/room`

**Headers:**
```
Authorization: Bearer {token_del_usuario}
Content-Type: application/json
Accept: application/json
```

**Body:**
```json
{
  "room_id": "test-123"
}
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "room": {
    "url": "https://meet-english-daily.co/test-123",
    "name": "test-123",
    "created": true
  }
}
```

---

### 2. Test desde Frontend (React)

```typescript
const API_URL = import.meta.env.VITE_API_URL;

const getOrCreateRoom = async (roomId: string, token: string) => {
  const response = await fetch(`${API_URL}/daily/room`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ room_id: roomId }),
  });

  if (!response.ok) {
    throw new Error('Failed to create room');
  }

  const data = await response.json();
  return data.room.url;
};
```

---

## 📊 Flujo Completo

```
1. Usuario entra a /room/123
   ↓
2. Frontend llama a POST /api/daily/room
   ↓
3. Backend verifica si sala existe
   ↓
4. Si NO existe → Crea sala en Daily.co
   Si SÍ existe → Devuelve URL existente
   ↓
5. Backend devuelve URL de la sala
   ↓
6. Frontend conecta a Daily.co con esa URL
   ↓
7. Usuario entra a la videollamada
```

---

## 🔒 Seguridad

### Validaciones Recomendadas

```php
// En DailyController.php

public function getOrCreateRoom(Request $request)
{
    $request->validate([
        'room_id' => 'required|string|max:255',
    ]);

    // Verificar que el usuario tenga permiso para crear/acceder a esta sala
    // Ejemplo: verificar que sea profesor o alumno de la clase
    
    $user = $request->user();
    
    // Aquí agregar tu lógica de autorización
    // Por ejemplo:
    // if (!$user->canAccessRoom($request->room_id)) {
    //     return response()->json(['error' => 'Unauthorized'], 403);
    // }

    // ... resto del código
}
```

---

## 📝 Notas Importantes

1. **API Key:** Nunca exponer en frontend. Solo en backend.

2. **Rate Limiting:** Daily.co tiene límites de API. Considerar implementar caché.

3. **Limpieza:** Las salas permanecen activas. Considerar implementar limpieza periódica de salas viejas.

4. **Logs:** Implementar logging para debugging.

5. **Error Handling:** Manejar todos los casos de error de Daily.co API.

---

## 🚀 Deployment

### Variables de Entorno en Producción

```env
# .env (Producción)
DAILY_API_KEY=ac2fa81b05e4e6c10e7efc5b2e0116d47d5e554c90c1fb80b5c95b6a7bc6df1b
DAILY_DOMAIN=meet-english-daily.co
```

---

## 📚 Recursos

- **Daily.co API Docs:** https://docs.daily.co/reference/rest-api
- **Room API:** https://docs.daily.co/reference/rest-api/rooms
- **Rate Limits:** https://docs.daily.co/reference/rest-api/rate-limits

---

## ✅ Checklist de Implementación

- [ ] Crear `DailyController.php`
- [ ] Agregar rutas en `routes/api.php`
- [ ] Agregar variables de entorno en `.env`
- [ ] Probar endpoint con Postman
- [ ] Verificar logs de errores
- [ ] Implementar autorización
- [ ] Deploy a producción
- [ ] Probar desde frontend

---

## 🆘 Troubleshooting

### Error: "Unauthorized"
- Verificar que `DAILY_API_KEY` esté correcta en `.env`
- Verificar que el header `Authorization` esté bien formado

### Error: "Room already exists"
- Esto es normal. El código maneja este caso devolviendo la sala existente.

### Error: "Rate limit exceeded"
- Daily.co tiene límites de API. Implementar caché o esperar.

---

**Tiempo estimado de implementación:** 1-2 horas

**Prioridad:** Alta (bloquea funcionalidad de videollamadas)
