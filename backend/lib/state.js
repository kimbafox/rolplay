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

module.exports = {
	makeId,
	makeDefaultTables,
	normalizeMarkers,
	normalizePlayer,
	normalizeShopItems,
	normalizeState
};