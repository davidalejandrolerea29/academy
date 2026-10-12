# Guía Paso a Paso: Obtener Credenciales de Zoom Video SDK

## ⚠️ Problema Común

La pantalla que ves muestra opciones para crear apps de **API** (General App, Server-to-Server, Webhook), pero **NO es para Video SDK**.

![Pantalla incorrecta](/home/david/.gemini/antigravity/brain/254a8ee5-7633-446b-b0f8-4656973bdb1e/uploaded_image_1768217678270.png)

**❌ NO selecciones ninguna de estas opciones** - son para APIs de Zoom, no para Video SDK.

---

## ✅ Pasos Correctos

### 1. Ir a la Página Correcta

**Opción A: Enlace Directo**
```
https://marketplace.zoom.us/develop/create?appType=videosdk
```

**Opción B: Navegación Manual**

1. Ve a https://marketplace.zoom.us/
2. Click en **"Develop"** (arriba a la derecha)
3. En el dropdown, busca **"Build App"** o **"Create"**
4. Busca la sección de **SDKs** (no APIs)
5. Selecciona **"Video SDK"**

### 2. Identificar la Opción Correcta

Deberías ver opciones como:

- ✅ **Video SDK** ← Esta es la correcta
- ❌ Meeting SDK
- ❌ General App
- ❌ Server-to-Server OAuth App
- ❌ Webhook Only App

### 3. Crear la App de Video SDK

Una vez en la página correcta:

1. Click en **"Create"** para Video SDK
2. Completa el formulario:
   - **App Name**: "Academy Video Platform" (o el nombre que prefieras)
   - **Company Name**: Tu empresa
   - **Developer Contact**: Tu email
   - **Short Description**: "Video conferencing for educational platform"

3. Click **"Create"**

### 4. Obtener las Credenciales

Después de crear la app:

1. Ve a la pestaña **"App Credentials"**
2. Copia el **SDK Key** (también llamado Client ID)
3. Copia el **SDK Secret** (también llamado Client Secret)

**Ejemplo de cómo se ven:**
```
SDK Key: abc123xyz456def789ghi012
SDK Secret: jkl345mno678pqr901stu234vwx567yz
```

---

## 🔄 Alternativa: Si No Encuentras Video SDK

### Verificar Tipo de Cuenta

Zoom Video SDK requiere una **cuenta de desarrollador**. Si no ves la opción de Video SDK, puede ser porque:

1. **Tu cuenta no tiene acceso a Video SDK**
   - Solución: Contacta a Zoom Sales
   - O usa una cuenta de prueba de desarrollador

2. **Estás en la sección incorrecta**
   - Asegúrate de estar en "Develop" → "Build App"
   - NO en "Manage" → "Installed Apps"

### Cuenta de Prueba

Si solo quieres probar:

1. Regístrate en https://developers.zoom.us/
2. Solicita acceso a Video SDK
3. Zoom puede darte acceso de prueba limitado

---

## 📸 Capturas de Pantalla Esperadas

### Paso 1: Página de Creación de App
Deberías ver algo como:

```
┌─────────────────────────────────────┐
│  Choose App Type                    │
├─────────────────────────────────────┤
│  SDKs                               │
│  ○ Video SDK                        │ ← Seleccionar esta
│  ○ Meeting SDK                      │
│                                     │
│  APIs                               │
│  ○ General App                      │
│  ○ Server-to-Server OAuth App      │
│  ○ Webhook Only App                 │
└─────────────────────────────────────┘
```

### Paso 2: Credenciales
Deberías ver:

```
┌─────────────────────────────────────┐
│  App Credentials                    │
├─────────────────────────────────────┤
│  SDK Key (Client ID)                │
│  [abc123xyz456...]        [Copy]    │
│                                     │
│  SDK Secret (Client Secret)         │
│  [jkl345mno678...]        [Copy]    │
└─────────────────────────────────────┘
```

---

## 🆘 Si Aún No Funciona

### Opción 1: Usar Meeting SDK (Alternativa)

Si no puedes acceder a Video SDK, puedes usar **Meeting SDK** como alternativa:

**Pros:**
- Más fácil de obtener acceso
- Puede usar plan gratuito de Zoom
- Funcionalidad similar

**Contras:**
- Requiere meetings pre-agendados
- Menos control sobre el UI
- Limitación de 40 min para 3+ participantes (plan gratuito)

**Implementación:**
Si decides usar Meeting SDK, necesitarás modificar la integración. Avísame y te ayudo.

### Opción 2: Mantener WebRTC

Si no puedes obtener acceso a Zoom SDK:

**Ventajas:**
- ✅ Gratis
- ✅ Ya está implementado
- ✅ Control total
- ✅ Sin limitaciones de tiempo

**Desventajas:**
- ❌ Requiere TURN servers propios
- ❌ Menos escalable (50 participantes max)
- ❌ Sin features avanzadas de Zoom

---

## 📝 Próximos Pasos

### Si Obtienes las Credenciales

1. Copia SDK Key y SDK Secret
2. Configura variables de entorno (ver `BACKEND_ZOOM_SETUP.md`)
3. Implementa endpoints backend
4. Prueba la integración

### Si NO Puedes Obtener Video SDK

Avísame y podemos:
- Intentar con Meeting SDK
- Optimizar la implementación WebRTC actual
- Buscar otras alternativas

---

## 🔗 Enlaces Útiles

- **Zoom Marketplace**: https://marketplace.zoom.us/
- **Video SDK Docs**: https://developers.zoom.us/docs/video-sdk/
- **Zoom Developer Forum**: https://devforum.zoom.us/
- **Contacto Zoom Sales**: https://zoom.us/contact

---

## ❓ Preguntas Frecuentes

**P: ¿Cuánto cuesta Video SDK?**
R: No hay tier gratuito para producción. Debes contactar a Zoom Sales para pricing.

**P: ¿Puedo usar Video SDK para desarrollo?**
R: Sí, puedes solicitar una cuenta de prueba de desarrollador.

**P: ¿Qué diferencia hay entre Video SDK y Meeting SDK?**
R: Video SDK es para apps completamente personalizadas. Meeting SDK es para integrar meetings de Zoom con UI estándar.

**P: ¿Necesito una cuenta paga de Zoom?**
R: Para Video SDK en producción, sí. Para desarrollo, puedes usar cuenta de prueba.
