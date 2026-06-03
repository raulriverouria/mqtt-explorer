# MQTT Explorer

Un cliente MQTT nativo para macOS, Windows y Linux con interfaz premium en modo oscuro, construido con **Electron + React + TypeScript + Vite**.

Replica las funcionalidades esenciales del MQTT Explorer original: árbol jerárquico de topics en tiempo real, historial de mensajes, gráfica de valores numéricos, panel de publicación y gestión de perfiles de conexión.

---

## Características principales

| Característica | Descripción |
|---|---|
| **Gestor de conexiones** | Guarda y carga múltiples perfiles de broker (host, puerto, TLS, autenticación, MQTT v3/v5) |
| **Soporte TLS con Certificados** | Conexiones cifradas seguras con selección de ficheros **CA**, certificado de cliente (**CRT**) y clave privada (**KEY**). Soporta formatos **PEM** (con validación de cabecera en main process) y **DER** binarios. |
| **Árbol de topics** | Vista jerárquica, colapsable y con scroll bidireccional (vertical/horizontal) de todos los topics. |
| **Métricas en árbol** | Doble badge a la derecha para nodos con hijos (conteo de subtopics + total de mensajes de sus descendientes) y badge único para hojas (mensajes del topic). |
| **Botón de Reinicio** | Opción "Reset counters" en cabecera para restablecer a cero las métricas de mensajes en tiempo real. |
| **Panel de detalle** | Muestra el último valor, ruta del topic, QoS, flag retained y timestamp. |
| **Historial de mensajes** | Lista scrollable de todos los payloads recibidos para el topic seleccionado. |
| **Gráfica de valores** | Línea Chart.js renderizada automáticamente cuando el payload es numérico. |
| **Panel de publicación** | Publica en cualquier topic con QoS, retain flag y payload raw/JSON. |
| **Filtro de topics** | Búsqueda y filtrado en tiempo real sobre el árbol. |
| **Resaltado JSON** | Pretty-print y coloreado de payloads JSON. |
| **Barra de estado** | Total de topics y contador de mensajes/segundo. |

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Shell de app | Electron | ^42 |
| Frontend | React + Vite | ^18 / ^8 |
| Lenguaje | TypeScript | ^5.4 |
| Estilos | Vanilla CSS (variables CSS) | — |
| MQTT | mqtt.js | ^5.6 |
| Gráficas | Chart.js + react-chartjs-2 | ^4.4 / ^5.2 |
| Estado global | Zustand | ^4.5 |
| Persistencia | electron-store | ^8.2 |
| Empaquetado | electron-builder | ^26 |

---

## Estructura del proyecto

```
mqtt-explorer/
├── electron/                   # Proceso principal de Electron (Node.js)
│   ├── main/
│   │   ├── index.ts            # Entry point del proceso principal, crea BrowserWindow
│   │   └── mqttClient.ts       # Gestor del cliente MQTT en el lado Node.js (IPC handlers)
│   └── preload/
│       └── index.ts            # Expone la API segura de IPC al renderer (window.mqttAPI)
│
├── src/                        # Proceso renderer (React)
│   ├── components/
│   │   ├── ConnectionDialog.tsx # Modal de configuración del broker y perfiles guardados
│   │   ├── MessageDetail.tsx    # Panel derecho: detalle del topic seleccionado
│   │   ├── MessageHistory.tsx   # Historial scrollable de payloads
│   │   ├── PublishPanel.tsx     # Formulario de publicación de mensajes
│   │   ├── StatusBar.tsx        # Barra inferior: estado, broker, topics/s
│   │   ├── Toolbar.tsx          # Barra superior: título, botón conectar/desconectar
│   │   ├── TopicFilter.tsx      # Input de búsqueda/filtro del árbol
│   │   └── TopicTree.tsx        # Árbol jerárquico y colapsable de topics
│   │
│   ├── store/
│   │   ├── mqttStore.ts         # Estado de conexión, topics y mensajes (Zustand)
│   │   ├── profileStore.ts      # Perfiles de conexión persistidos
│   │   └── themeStore.ts        # Estado del tema (dark/light)
│   │
│   ├── types/
│   │   └── index.ts             # Tipos compartidos: ConnectionProfile, TopicNode, MqttMessage
│   │
│   ├── App.tsx                  # Layout raíz: sidebar (árbol) + panel principal
│   ├── index.css                # Sistema de diseño global: variables CSS, tipografía, reset
│   ├── index.html               # Entry point HTML
│   └── main.tsx                 # Root de React, monta <App />
│
├── build/                      # Assets para electron-builder (iconos, plist de permisos)
├── out/                        # Compilación generada por electron-vite (no commitear)
├── release/                    # Distribución generada por electron-builder (no commitear)
│
├── electron-builder.json5      # Configuración de empaquetado multiplataforma (macOS, Windows, Linux)
├── electron.vite.config.ts     # Configuración de electron-vite (main, preload, renderer)
├── tsconfig.json               # Configuración de TypeScript
├── package.json                # Dependencias y scripts npm
└── plan.md                     # Plan de implementación original del proyecto
```

### Flujo de comunicación

```
Renderer (React)  ──IPC invoke──►  Preload (contextBridge)  ──►  Main (Node.js)
                                                                      │
                                                                   mqtt.js
                                                                      │
                  ◄──IPC on───────────────────────────────────  webContents.send
```

El proceso **main** gestiona la conexión MQTT real (mqtt.js en Node.js). Los mensajes recibidos del broker se reenvían al **renderer** vía `webContents.send`. El **renderer** nunca accede directamente a Node.js; toda la comunicación pasa por el **preload** a través de `contextBridge`.

---

## Requisitos previos

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **macOS, Windows o Linux** (para ejecutar y empaquetar en cada sistema objetivo)

---

## Entorno de desarrollo (DEV)

Arranca la aplicación en modo desarrollo con Hot Module Replacement (HMR) activo:

```bash
# 1. Instalar dependencias (solo la primera vez)
npm install

# 2. Arrancar en modo dev
npm run dev
```

Esto ejecuta `electron-vite dev`, que:

- Compila el proceso **main** y **preload** en tiempo real con Vite.
- Sirve el proceso **renderer** (React) con HMR en `http://localhost:5173`.
- Abre automáticamente la ventana de Electron apuntando al servidor de desarrollo.
- Activa las **DevTools** de Chromium para depurar el renderer.

> **Tip:** Cualquier cambio en `src/` se refleja al instante sin reiniciar Electron. Los cambios en `electron/main/` o `electron/preload/` reinician el proceso principal automáticamente.

---

## Entorno de producción (PRO)

### 1. Build + app sin empaquetar (para pruebas rápidas)

```bash
npm run pack
```

Genera la estructura de la aplicación compilada en la carpeta correspondiente de `release/` (según tu sistema operativo) sin generar el instalador final.

### 2. Distribución completa por plataforma

Puedes generar los instaladores y paquetes distribuidos usando los siguientes comandos:

* **macOS (DMG + ZIP):**
  ```bash
  npm run dist:mac
  ```
* **Windows (Instalador NSIS):**
  ```bash
  npm run dist:win
  ```
* **Linux (AppImage + DEB):**
  ```bash
  npm run dist:linux
  ```
* **Todas las plataformas a la vez:**
  ```bash
  npm run dist:all
  ```
* **Por defecto (sistema operativo host actual):**
  ```bash
  npm run dist
  ```

Los paquetes y ejecutables se generan en la carpeta `release/`.

> **Nota sobre firma de código:** Para distribuir fuera de las tiendas oficiales, especialmente en macOS, necesitarás configuraciones de firmas adecuadas (como un **Apple Developer ID** para Mac en las variables de entorno `CSC_LINK` y `CSC_KEY_PASSWORD`).

### 3. Preview de la build (sin Electron)

```bash
npm run build    # Solo compila (sin abrir la app)
npm run preview  # Previsualiza el renderer en el navegador
```

---

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Modo desarrollo con HMR |
| `npm run build` | Compila main, preload y renderer para producción |
| `npm run preview` | Previsualiza el renderer compilado en el navegador |
| `npm run pack` | Build + genera la app sin instalador |
| `npm run dist` | Build + genera instalador para la plataforma actual |
| `npm run dist:mac` | Build + genera DMG y ZIP para macOS |
| `npm run dist:win` | Build + genera instalador NSIS para Windows |
| `npm run dist:linux` | Build + genera AppImage y DEB para Linux |
| `npm run dist:all` | Build + genera instaladores para macOS, Windows y Linux |

---

## Broker de prueba

Para desarrollo, puedes conectarte al broker público de Mosquitto sin necesidad de infraestructura propia:

| Campo | Valor |
|---|---|
| Host | `test.mosquitto.org` |
| Puerto | `1883` (MQTT sin TLS) |
| Puerto TLS | `8883` (MQTT con TLS) |
| Usuario / Pass | *(ninguno)* |

---

## Licencia

Proyecto privado de uso personal.
