const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const frontendPath = path.join(__dirname, '..', 'frontend');
const dataDir = path.join(__dirname, 'data');
const storePath = path.join(dataDir, 'store.json');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const defaultShopItems = [
	{ id: 'shop-1', title: 'Botiquin', price: '25 monedas' },
	{ id: 'shop-2', title: 'Municion', price: '15 monedas' },
	{ id: 'shop-3', title: 'Blindaje', price: '40 monedas' },
	{ id: 'shop-4', title: 'Raciones', price: '10 monedas' }
];

function makeId(prefix) {
	return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8);
}

function makeDefaultTables(player) {
	return [
		{ id: makeId('table'), title: 'Dinero', content: 'Dinero inicial de ' + player.name + ': 0' },
		{ id: makeId('table'), title: 'Mejoras', content: 'Sin mejoras cargadas para ' + player.power },
		{ id: makeId('table'), title: 'Notas', content: 'Potencia activa: ' + player.power }
	];
}

function normalizePlayer(player) {
	return {
		id: String(player.id || makeId('player')),
		name: String(player.name || 'Jugador'),
		power: String(player.power || 'Estados Unidos'),
		avatar: String(player.avatar || 'bigititoo'),
		room: String(player.room || 'Sala'),
		joinedAt: Number(player.joinedAt || Date.now())
	};
}

function normalizeShopItems(items) {
	if (!Array.isArray(items) || items.length === 0) {
		return defaultShopItems.map((item) => ({ ...item }));
	}

	return items.map((item, index) => ({
		id: String(item.id || 'shop-' + String(index + 1)),
		title: String(item.title || 'Articulo'),
		price: String(item.price || '0')
	}));
}

function normalizeTables(playerTables) {
	if (!playerTables || typeof playerTables !== 'object') {
		return {};
	}

	const normalized = {};
	Object.keys(playerTables).forEach((playerId) => {
		const tables = Array.isArray(playerTables[playerId]) ? playerTables[playerId] : [];
		normalized[playerId] = tables.map((table, index) => ({
			id: String(table.id || 'table-' + index),
			title: String(table.title || 'Tabla'),
			content: String(table.content || '')
		}));
	});
	return normalized;
}

function normalizeMarkers(markers) {
	if (!Array.isArray(markers)) {
		return [];
	}

	return markers.map((marker, index) => ({
		id: String(marker.id || 'marker-' + index),
		x: Number(marker.x || 0),
		y: Number(marker.y || 0),
		color: String(marker.color || '#d83a30')
	}));
}

function normalizeState(raw) {
	const source = raw && typeof raw === 'object' ? raw : {};
	const players = Array.isArray(source.players) ? source.players.map(normalizePlayer) : [];
	const playerTables = normalizeTables(source.playerTables);

	players.forEach((player) => {
		if (!playerTables[player.id] || playerTables[player.id].length === 0) {
			playerTables[player.id] = makeDefaultTables(player);
		}
	});

	return {
		players,
		currentTurnPlayerId: typeof source.currentTurnPlayerId === 'string' ? source.currentTurnPlayerId : (players[0] ? players[0].id : null),
		markers: normalizeMarkers(source.markers),
		lastRoll: source.lastRoll && typeof source.lastRoll === 'object' ? {
			playerId: String(source.lastRoll.playerId || ''),
			playerName: String(source.lastRoll.playerName || ''),
			sides: Number(source.lastRoll.sides || 6),
			value: Number(source.lastRoll.value || 1),
			power: String(source.lastRoll.power || ''),
			avatar: String(source.lastRoll.avatar || ''),
			at: Number(source.lastRoll.at || Date.now())
		} : null,
		rollCooldownUntil: Number(source.rollCooldownUntil || 0),
		shopItems: normalizeShopItems(source.shopItems),
		playerTables
	};
}

function ensureStore() {
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
	}

	if (!fs.existsSync(storePath)) {
		fs.writeFileSync(storePath, JSON.stringify({ rooms: [], saves: [] }, null, 2));
	}
}

function readStore() {
	ensureStore();
	try {
		return JSON.parse(fs.readFileSync(storePath, 'utf8'));
	} catch (error) {
		return { rooms: [], saves: [] };
	}
}

function writeStore(store) {
	ensureStore();
	fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function slugify(value) {
	return String(value || 'sala')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '') || 'sala';
}

function makeRoomId(name) {
	return slugify(name) + '-' + Date.now().toString(36);
}

function normalizeRoom(room) {
	const source = room && typeof room === 'object' ? room : {};
	return {
		id: String(source.id || makeRoomId(source.name || 'sala')),
		name: String(source.name || 'Sala'),
		password: String(source.password || ''),
		note: String(source.note || ''),
		ownerOnline: Boolean(source.ownerOnline),
		createdAt: Number(source.createdAt || Date.now()),
		updatedAt: Number(source.updatedAt || Date.now()),
		lastOwnerPingAt: Number(source.lastOwnerPingAt || 0),
		state: normalizeState(source.state || {}),
		sourceSaveId: source.sourceSaveId ? String(source.sourceSaveId) : null
	};
}

function normalizeSave(save) {
	const source = save && typeof save === 'object' ? save : {};
	return {
		id: String(source.id || makeId('save')),
		name: String(source.name || 'Guardado'),
		roomId: String(source.roomId || ''),
		roomName: String(source.roomName || 'Sala'),
		createdAt: Number(source.createdAt || Date.now()),
		state: normalizeState(source.state || {})
	};
}

let store = (() => {
	const raw = readStore();
	return {
		rooms: Array.isArray(raw.rooms) ? raw.rooms.map(normalizeRoom) : [],
		saves: Array.isArray(raw.saves) ? raw.saves.map(normalizeSave) : []
	};
})();

writeStore(store);

const roomClients = new Map();

function roomSummary(room) {
	return {
		id: room.id,
		name: room.name,
		note: room.note,
		ownerOnline: room.ownerOnline,
		playerCount: room.state.players.length,
		turnPlayerId: room.state.currentTurnPlayerId,
		updatedAt: room.updatedAt,
		createdAt: room.createdAt,
		hasPassword: Boolean(room.password),
		sourceSaveId: room.sourceSaveId
	};
}

function getRoom(roomId) {
	return store.rooms.find((room) => room.id === String(roomId)) || null;
}

function getSave(saveId) {
	return store.saves.find((save) => save.id === String(saveId)) || null;
}

function getRoomClients(roomId) {
	if (!roomClients.has(roomId)) {
		roomClients.set(roomId, new Set());
	}
	return roomClients.get(roomId);
}

function broadcastRoom(room) {
	const payload = 'data: ' + JSON.stringify(room.state) + '\n\n';
	getRoomClients(room.id).forEach((response) => {
		response.write(payload);
	});
}

function persistStore() {
	writeStore(store);
}

function touchRoom(room) {
	room.updatedAt = Date.now();
	persistStore();
	broadcastRoom(room);
	return room;
}

function saveRoomState(roomId, nextState) {
	const room = getRoom(roomId);
	if (!room) {
		return null;
	}
	room.state = normalizeState(nextState);
	return touchRoom(room);
}

function createRoom(data) {
	const loadSave = data.loadSaveId ? getSave(data.loadSaveId) : null;
	const room = normalizeRoom({
		id: makeRoomId(data.name || 'sala'),
		name: data.name,
		password: data.password,
		note: data.note,
		ownerOnline: false,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		lastOwnerPingAt: 0,
		state: loadSave ? loadSave.state : {
			shopItems: data.shopItems,
			playerTables: {}
		},
		sourceSaveId: loadSave ? loadSave.id : null
	});
	store.rooms.push(room);
	persistStore();
	return room;
}

function listActiveRooms() {
	return store.rooms.filter((room) => room.ownerOnline).map(roomSummary);
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(frontendPath));

app.get('/api/rooms', (request, response) => {
	const activeOnly = String(request.query.active || '') === '1';
	const rooms = activeOnly ? listActiveRooms() : store.rooms.map(roomSummary);
	response.json({ rooms });
});

app.get('/api/saves', (request, response) => {
	response.json({
		saves: store.saves.map((save) => ({
			id: save.id,
			name: save.name,
			roomId: save.roomId,
			roomName: save.roomName,
			createdAt: save.createdAt
		}))
	});
});

app.post('/api/rooms', (request, response) => {
	const room = createRoom(request.body || {});
	response.status(201).json({ room: roomSummary(room) });
});

app.get('/api/rooms/:roomId/state', (request, response) => {
	const room = getRoom(request.params.roomId);
	if (!room) {
		response.status(404).json({ error: 'Room not found' });
		return;
	}
	response.json(room.state);
});

app.get('/health', (request, response) => {
	response.status(200).json({ ok: true, port: PORT });
});

app.get('/api/rooms/:roomId/events', (request, response) => {
	const room = getRoom(request.params.roomId);
	if (!room) {
		response.status(404).json({ error: 'Room not found' });
		return;
	}

	response.setHeader('Content-Type', 'text/event-stream');
	response.setHeader('Cache-Control', 'no-cache');
	response.setHeader('Connection', 'keep-alive');
	response.flushHeaders();

	response.write('data: ' + JSON.stringify(room.state) + '\n\n');
	getRoomClients(room.id).add(response);

	request.on('close', () => {
		getRoomClients(room.id).delete(response);
		response.end();
	});
});

app.post('/api/rooms/:roomId/owner-presence', (request, response) => {
	const room = getRoom(request.params.roomId);
	if (!room) {
		response.status(404).json({ error: 'Room not found' });
		return;
	}
	room.ownerOnline = Boolean((request.body || {}).online);
	room.lastOwnerPingAt = Date.now();
	response.json({ room: roomSummary(touchRoom(room)) });
});

app.post('/api/rooms/:roomId/save', (request, response) => {
	const room = getRoom(request.params.roomId);
	if (!room) {
		response.status(404).json({ error: 'Room not found' });
		return;
	}
	const save = normalizeSave({
		id: makeId('save'),
		name: (request.body || {}).name || room.name + ' guardado',
		roomId: room.id,
		roomName: room.name,
		createdAt: Date.now(),
		state: room.state
	});
	store.saves.unshift(save);
	persistStore();
	response.status(201).json({ save });
});

app.post('/api/rooms/:roomId/players/upsert', (request, response) => {
	const room = getRoom(request.params.roomId);
	if (!room) {
		response.status(404).json({ error: 'Room not found' });
		return;
	}
	const player = normalizePlayer(request.body || {});
	const players = room.state.players.slice();
	const index = players.findIndex((item) => item.id === player.id);

	if (index >= 0) {
		players[index] = { ...players[index], ...player };
	} else {
		players.push(player);
	}

	const nextState = {
		...room.state,
		players
	};

	if (!nextState.playerTables[player.id] || nextState.playerTables[player.id].length === 0) {
		nextState.playerTables = {
			...nextState.playerTables,
			[player.id]: makeDefaultTables(player)
		};
	}

	if (!nextState.currentTurnPlayerId) {
		nextState.currentTurnPlayerId = player.id;
	}

	response.json(saveRoomState(room.id, nextState));
});

app.post('/api/rooms/:roomId/turn', (request, response) => {
	const room = getRoom(request.params.roomId);
	if (!room) {
		response.status(404).json({ error: 'Room not found' });
		return;
	}
	response.json(saveRoomState(room.id, {
		...room.state,
		currentTurnPlayerId: String((request.body || {}).playerId || '')
	}));
});

app.post('/api/rooms/:roomId/markers', (request, response) => {
	const room = getRoom(request.params.roomId);
	if (!room) {
		response.status(404).json({ error: 'Room not found' });
		return;
	}
	response.json(saveRoomState(room.id, {
		...room.state,
		markers: normalizeMarkers((request.body || {}).markers)
	}));
});

app.post('/api/rooms/:roomId/last-roll', (request, response) => {
	const room = getRoom(request.params.roomId);
	if (!room) {
		response.status(404).json({ error: 'Room not found' });
		return;
	}
	const roll = request.body || {};
	response.json(saveRoomState(room.id, {
		...room.state,
		lastRoll: {
			playerId: String(roll.playerId || ''),
			playerName: String(roll.playerName || ''),
			sides: Number(roll.sides || 6),
			value: Number(roll.value || 1),
			power: String(roll.power || ''),
			avatar: String(roll.avatar || ''),
			at: Number(roll.at || Date.now())
		},
		rollCooldownUntil: Number(roll.cooldownUntil || 0)
	}));
});

app.post('/api/rooms/:roomId/shop-items', (request, response) => {
	const room = getRoom(request.params.roomId);
	if (!room) {
		response.status(404).json({ error: 'Room not found' });
		return;
	}
	response.json(saveRoomState(room.id, {
		...room.state,
		shopItems: normalizeShopItems((request.body || {}).items)
	}));
});

app.post('/api/rooms/:roomId/player-tables/:playerId', (request, response) => {
	const room = getRoom(request.params.roomId);
	if (!room) {
		response.status(404).json({ error: 'Room not found' });
		return;
	}
	const playerId = String(request.params.playerId || '');
	const tables = Array.isArray((request.body || {}).tables) ? request.body.tables : [];
	response.json(saveRoomState(room.id, {
		...room.state,
		playerTables: {
			...room.state.playerTables,
			[playerId]: tables
		}
	}));
});

app.get('/', (request, response) => {
	response.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, HOST, () => {
	console.log('Servidor listo en ' + HOST + ':' + PORT);
});