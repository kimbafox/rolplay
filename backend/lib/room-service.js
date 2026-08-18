const {
	makeDefaultTables,
	makeId,
	normalizePlayer,
	normalizeState
} = require('./state');

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

function createRoomService(storage) {
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

	const raw = storage.read();
	const data = {
		rooms: Array.isArray(raw.rooms) ? raw.rooms.map(normalizeRoom) : [],
		saves: Array.isArray(raw.saves) ? raw.saves.map(normalizeSave) : []
	};
	const clients = new Map();
	storage.write(data);

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
		return data.rooms.find((room) => room.id === String(roomId)) || null;
	}

	function getSave(saveId) {
		return data.saves.find((save) => save.id === String(saveId)) || null;
	}

	function getClients(roomId) {
		if (!clients.has(roomId)) {
			clients.set(roomId, new Set());
		}
		return clients.get(roomId);
	}

	function touchRoom(room) {
		room.updatedAt = Date.now();
		storage.write(data);
		const payload = 'data: ' + JSON.stringify(room.state) + '\n\n';
		getClients(room.id).forEach((response) => response.write(payload));
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

	function createRoom(input) {
		const source = input || {};
		const loadSave = source.loadSaveId ? getSave(source.loadSaveId) : null;
		const importedState = source.importedState && typeof source.importedState === 'object' ? source.importedState : null;
		const room = normalizeRoom({
			id: makeRoomId(source.name || 'sala'),
			name: source.name,
			password: source.password,
			note: source.note,
			ownerOnline: false,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			lastOwnerPingAt: 0,
			state: importedState || (loadSave ? loadSave.state : { shopItems: source.shopItems, playerTables: {} }),
			sourceSaveId: loadSave ? loadSave.id : null
		});
		data.rooms.push(room);
		storage.write(data);
		return room;
	}

	function listRooms(activeOnly) {
		return data.rooms.filter((room) => !activeOnly || room.ownerOnline).map(roomSummary);
	}

	function listSaves() {
		return data.saves.map((save) => ({
			id: save.id,
			name: save.name,
			roomId: save.roomId,
			roomName: save.roomName,
			createdAt: save.createdAt
		}));
	}

	function setOwnerPresence(roomId, online) {
		const room = getRoom(roomId);
		if (!room) {
			return null;
		}
		room.ownerOnline = Boolean(online);
		room.lastOwnerPingAt = Date.now();
		return touchRoom(room);
	}

	function createSave(roomId, name) {
		const room = getRoom(roomId);
		if (!room) {
			return null;
		}
		const save = normalizeSave({
			id: makeId('save'),
			name: name || room.name + ' guardado',
			roomId: room.id,
			roomName: room.name,
			createdAt: Date.now(),
			state: room.state
		});
		data.saves.unshift(save);
		storage.write(data);
		return save;
	}

	function upsertPlayer(roomId, input) {
		const room = getRoom(roomId);
		if (!room) {
			return null;
		}
		const player = normalizePlayer(input || {});
		const players = room.state.players.slice();
		const index = players.findIndex((item) => item.id === player.id);
		if (index >= 0) {
			players[index] = { ...players[index], ...player };
		} else {
			players.push(player);
		}
		const nextState = { ...room.state, players };
		if (!nextState.playerTables[player.id] || nextState.playerTables[player.id].length === 0) {
			nextState.playerTables = { ...nextState.playerTables, [player.id]: makeDefaultTables(player) };
		}
		if (!nextState.currentTurnPlayerId) {
			nextState.currentTurnPlayerId = player.id;
		}
		return saveRoomState(room.id, nextState);
	}

	return {
		addClient: (roomId, response) => getClients(roomId).add(response),
		createRoom,
		createSave,
		getRoom,
		listRooms,
		listSaves,
		removeClient: (roomId, response) => getClients(roomId).delete(response),
		roomSummary,
		saveRoomState,
		setOwnerPresence,
		upsertPlayer
	};
}

module.exports = { createRoomService };