# Rol virtual

Este programa es una mesa virtual para jugar rol de guerra por turnos.

Hay dos vistas:

- El owner controla el turno, el mapa, las tablas privadas y la tienda.
- Los jugadores solo pueden ver su informacion y tirar el dado cuando es su turno.

## Que hace

- Muestra un mapa compartido.
- El owner pone y quita banderas.
- El owner decide de quien es el turno.
- Cada jugador ve su perfil, su potencia, su tienda y sus tablas.
- Las tiradas de dado se ven para todos.

## Como arrancarlo

1. Instala dependencias con `npm install`.
2. Inicia el servidor con `npm start`.
3. Abre `http://localhost:3000`.

## Railway

- Usa Node.js.
- Railway solo necesita el comando de inicio: `npm start`.
- El archivo principal es [backend/server.js](backend/server.js).

## Estructura simple

- [frontend/index.html](frontend/index.html): entrar o unirse a sala.
- [frontend/player.html](frontend/player.html): vista del jugador.
- [frontend/owner.html](frontend/owner.html): vista del owner.
- [backend/server.js](backend/server.js): servidor y sincronizacion.