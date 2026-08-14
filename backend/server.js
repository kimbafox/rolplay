const express = require('express');
const path = require('path');

const app = express();
const frontendPath = path.join(__dirname, '..', 'frontend');
const PORT = Number(process.env.PORT || 3000);

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

let gameState = normalizeState({});
const clients = new Set();

function broadcastState() {
	const payload = 'data: ' + JSON.stringify(gameState) + '\n\n';
	clients.forEach((response) => {
		response.write(payload);
	});
}

function saveState(nextState) {
	gameState = normalizeState(nextState);
	broadcastState();
	return gameState;
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(frontendPath));

app.get('/api/state', (request, response) => {
	response.json(gameState);
});

app.get('/api/events', (request, response) => {
	response.setHeader('Content-Type', 'text/event-stream');
	response.setHeader('Cache-Control', 'no-cache');
	response.setHeader('Connection', 'keep-alive');
	response.flushHeaders();

	response.write('data: ' + JSON.stringify(gameState) + '\n\n');
	clients.add(response);

	request.on('close', () => {
		clients.delete(response);
		response.end();
	});
});

app.post('/api/players/upsert', (request, response) => {
	const player = normalizePlayer(request.body || {});
	const players = gameState.players.slice();
	const index = players.findIndex((item) => item.id === player.id);

	if (index >= 0) {
		players[index] = { ...players[index], ...player };
	} else {
		players.push(player);
	}

	const nextState = {
		...gameState,
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

	response.json(saveState(nextState));
});

app.post('/api/turn', (request, response) => {
	response.json(saveState({
		...gameState,
		currentTurnPlayerId: String((request.body || {}).playerId || '')
	}));
});

app.post('/api/markers', (request, response) => {
	response.json(saveState({
		...gameState,
		markers: normalizeMarkers((request.body || {}).markers)
	}));
});

app.post('/api/last-roll', (request, response) => {
	const roll = request.body || {};
	response.json(saveState({
		...gameState,
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

app.post('/api/shop-items', (request, response) => {
	response.json(saveState({
		...gameState,
		shopItems: normalizeShopItems((request.body || {}).items)
	}));
});

app.post('/api/player-tables/:playerId', (request, response) => {
	const playerId = String(request.params.playerId || '');
	const tables = Array.isArray((request.body || {}).tables) ? request.body.tables : [];
	response.json(saveState({
		...gameState,
		playerTables: {
			...gameState.playerTables,
			[playerId]: tables
		}
	}));
});

app.get('/', (request, response) => {
	response.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
	console.log('Servidor listo en puerto ' + PORT);
});