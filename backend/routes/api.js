const express = require('express');
const { normalizeMarkers, normalizeShopItems } = require('../lib/state');

function createApiRouter(rooms) {
	const router = express.Router();

	function updateState(request, response, makeState) {
		const room = rooms.getRoom(request.params.roomId);
		if (!room) {
			response.status(404).json({ error: 'Room not found' });
			return;
		}
		response.json(rooms.saveRoomState(room.id, makeState(room.state, request.body || {}, request.params)).state);
	}

	router.get('/rooms', (request, response) => {
		response.json({ rooms: rooms.listRooms(String(request.query.active || '') === '1') });
	});

	router.get('/saves', (request, response) => response.json({ saves: rooms.listSaves() }));

	router.post('/rooms', (request, response) => {
		const room = rooms.createRoom(request.body || {});
		response.status(201).json({ room: rooms.roomSummary(room) });
	});

	router.get('/rooms/:roomId/state', (request, response) => {
		const room = rooms.getRoom(request.params.roomId);
		if (!room) {
			response.status(404).json({ error: 'Room not found' });
			return;
		}
		response.json(room.state);
	});

	router.get('/rooms/:roomId/events', (request, response) => {
		const room = rooms.getRoom(request.params.roomId);
		if (!room) {
			response.status(404).json({ error: 'Room not found' });
			return;
		}
		response.setHeader('Content-Type', 'text/event-stream');
		response.setHeader('Cache-Control', 'no-cache');
		response.setHeader('Connection', 'keep-alive');
		response.flushHeaders();
		response.write('data: ' + JSON.stringify(room.state) + '\n\n');
		rooms.addClient(room.id, response);
		request.on('close', () => {
			rooms.removeClient(room.id, response);
			response.end();
		});
	});

	router.post('/rooms/:roomId/owner-presence', (request, response) => {
		const room = rooms.setOwnerPresence(request.params.roomId, (request.body || {}).online);
		if (!room) {
			response.status(404).json({ error: 'Room not found' });
			return;
		}
		response.json({ room: rooms.roomSummary(room) });
	});

	router.post('/rooms/:roomId/save', (request, response) => {
		const save = rooms.createSave(request.params.roomId, (request.body || {}).name);
		if (!save) {
			response.status(404).json({ error: 'Room not found' });
			return;
		}
		response.status(201).json({ save });
	});

	router.post('/rooms/:roomId/players/upsert', (request, response) => {
		const room = rooms.upsertPlayer(request.params.roomId, request.body || {});
		if (!room) {
			response.status(404).json({ error: 'Room not found' });
			return;
		}
		response.json(room.state);
	});

	router.post('/rooms/:roomId/turn', (request, response) => updateState(request, response, (state, body) => ({
		...state,
		currentTurnPlayerId: String(body.playerId || '')
	})));

	router.post('/rooms/:roomId/markers', (request, response) => updateState(request, response, (state, body) => ({
		...state,
		markers: normalizeMarkers(body.markers)
	})));

	router.post('/rooms/:roomId/last-roll', (request, response) => updateState(request, response, (state, body) => ({
		...state,
		lastRoll: {
			playerId: String(body.playerId || ''),
			playerName: String(body.playerName || ''),
			sides: Number(body.sides || 6),
			value: Number(body.value || 1),
			power: String(body.power || ''),
			avatar: String(body.avatar || ''),
			at: Number(body.at || Date.now())
		},
		rollCooldownUntil: Number(body.cooldownUntil || 0)
	})));

	router.post('/rooms/:roomId/shop-items', (request, response) => updateState(request, response, (state, body) => ({
		...state,
		shopItems: normalizeShopItems(body.items)
	})));

	router.post('/rooms/:roomId/player-tables/:playerId', (request, response) => updateState(request, response, (state, body, params) => ({
		...state,
		playerTables: {
			...state.playerTables,
			[String(params.playerId || '')]: Array.isArray(body.tables) ? body.tables : []
		}
	})));

	return router;
}

module.exports = { createApiRouter };