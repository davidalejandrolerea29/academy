# Daily.co Integration - Quick Start

## ✅ Implementación Completada

Se ha integrado **Daily.co** como servicio de videollamadas estable.

### 🎯 Características

- ✅ Video/audio HD estable
- ✅ Screen sharing
- ✅ Hasta 100 participantes
- ✅ Chat personalizado con Reverb
- ✅ Controles completos (mute, video, compartir pantalla)
- ✅ Minimización a widget flotante
- ✅ Sin problemas de AdBlock

### 💰 Pricing

- **Gratis:** 10,000 minutos/mes
- **Después:** $0.0035/minuto
- **Sin tarjeta requerida** para empezar

### 🔑 Configuración Requerida

#### 1. Crear Cuenta en Daily.co

1. Ve a https://dashboard.daily.co/signup
2. Crea una cuenta gratis
3. Verifica tu email

#### 2. Crear Dominio

1. En el dashboard: https://dashboard.daily.co/domains
2. Crea un dominio (ej: `academy`)
3. Tu dominio será: `academy.daily.co`

#### 3. Configurar Variable de Entorno

Crea `.env.local`:
```env
VITE_DAILY_DOMAIN=academy
```

O usa el dominio completo:
```env
VITE_DAILY_DOMAIN=academy.daily.co
```

### 🚀 Cómo Funciona

```typescript
// Daily.co crea salas automáticamente
const roomUrl = `https://academy.daily.co/${roomId}`;

// Los usuarios se unen con su nombre
DailyIframe.createCallObject({
  url: roomUrl,
  userName: currentUser?.name,
});
```

### 📝 Ventajas vs Otras Soluciones

| | Daily.co | Jitsi | WebRTC |
|---|---|---|---|
| **Estabilidad** | ✅✅✅ | ⚠️ | ❌ |
| **Gratis** | ✅ 10k min | ✅ Ilimitado | ✅ |
| **Sin AdBlock** | ✅ | ❌ | ✅ |
| **Backend** | ❌ No | ❌ No | ✅ Sí |
| **Integración** | ✅ Fácil | ⚠️ Compleja | ⚠️ Compleja |

### 🧪 Testing

1. **Inicia el servidor:**
```bash
npm run dev
```

2. **Abre en 2 navegadores:**
- Browser 1: `localhost:5173/room/test-123`
- Browser 2: `localhost:5173/room/test-123`

3. **Verifica:**
- [ ] Ambos se ven y escuchan
- [ ] Controles funcionan (mute, video, screen share)
- [ ] Chat funciona
- [ ] Minimización funciona

### ⚙️ Configuración Avanzada (Opcional)

#### Crear Salas con API

Si quieres crear salas programáticamente:

```bash
# Obtén tu API key del dashboard
curl --request POST \
  --url https://api.daily.co/v1/rooms \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "academy-room-123",
    "privacy": "public"
  }'
```

#### Configurar en Backend (Opcional)

Para más control, puedes generar tokens en el backend:

```typescript
// Backend endpoint
app.post('/api/daily/token', async (req, res) => {
  const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        room_name: req.body.roomName,
        user_name: req.body.userName,
      },
    }),
  });
  
  const data = await response.json();
  res.json({ token: data.token });
});
```

### 🆘 Troubleshooting

**"Room not found"**
- Verifica que el dominio en `.env.local` sea correcto
- Daily.co crea salas automáticamente, no necesitas crearlas manualmente

**"Connection failed"**
- Verifica tu conexión a internet
- Revisa la consola del navegador para errores

**"No video/audio"**
- Acepta permisos de cámara/micrófono
- Verifica que no estén bloqueados en configuración del navegador

### 📚 Recursos

- **Dashboard:** https://dashboard.daily.co/
- **Docs:** https://docs.daily.co/
- **React SDK:** https://docs.daily.co/reference/daily-react
- **API Reference:** https://docs.daily.co/reference/rest-api

### ✨ Próximos Pasos

1. ✅ Código implementado
2. ⏳ Crear cuenta en Daily.co
3. ⏳ Configurar dominio
4. ⏳ Agregar variable de entorno
5. ⏳ Probar con 2 usuarios

**¡Daily.co está listo para usar!** 🚀
