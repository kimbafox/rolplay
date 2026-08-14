(function () {
	const STORAGE_KEY = 'rolVirtualGameState';
	const CURRENT_PLAYER_KEY = 'rolVirtualCurrentPlayerId';
	const CHANGE_EVENT = 'rol-game-state-changed';
	const API_STATE = '/api/state';
	const API_EVENTS = '/api/events';

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
			{
				id: makeId('table'),
				title: 'Dinero',
				content: 'Dinero inicial de ' + player.name + ': 0'
			},
			{
				id: makeId('table'),
				title: 'Mejoras',
				content: 'Sin mejoras cargadas para ' + player.power
			},
			{
				id: makeId('table'),
				title: 'Notas',
				content: 'Potencia activa: ' + player.power
			}
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
			id: String(item.id || 'shop-' + index),
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
			currentTurnPlayerId: typeof source.currentTurnPlayerId === 'string' ? source.currentTurnPlayerId : null,
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

	function emitChange(state) {
		window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: state }));
	}

	let currentState = normalizeState(readLocalState());
	let eventSource = null;

	function readLocalState() {
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch (error) {
			return null;
		}
	}

	function persistLocal(state) {
		currentState = normalizeState(state);
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
		emitChange(currentState);
		return currentState;
	}

	async function requestJson(url, options) {
		const response = await window.fetch(url, options);
		if (!response.ok) {
			throw new Error('Request failed');
		}
		return response.json();
	}

	async function postJson(url, body) {
		try {
			const state = await requestJson(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body),
				keepalive: true
			});
			persistLocal(state);
			return state;
		} catch (error) {
			return currentState;
		}
	}

	async function refreshFromServer() {
		try {
			const state = await requestJson(API_STATE, { method: 'GET' });
			persistLocal(state);
			return currentState;
		} catch (error) {
			return currentState;
		}
	}

	function ensureEventSource() {
		if (!('EventSource' in window) || eventSource) {
			return;
		}

		eventSource = new window.EventSource(API_EVENTS);
		const reset = function () {
			if (eventSource) {
				eventSource.close();
				eventSource = null;
			}
			window.setTimeout(ensureEventSource, 1500);
		};

		eventSource.onmessage = function (event) {
			try {
				persistLocal(JSON.parse(event.data));
			} catch (error) {
				return;
			}
		};

		eventSource.onerror = reset;
	}

	refreshFromServer();
	ensureEventSource();

	function loadState() {
		return currentState;
	}

	function saveState(state) {
		return persistLocal(state);
	}

	function getCurrentPlayerId() {
		return window.sessionStorage.getItem(CURRENT_PLAYER_KEY) || window.localStorage.getItem(CURRENT_PLAYER_KEY);
	}

	function setCurrentPlayerId(playerId) {
		window.sessionStorage.setItem(CURRENT_PLAYER_KEY, playerId);
		window.localStorage.setItem(CURRENT_PLAYER_KEY, playerId);
	}

	function upsertPlayer(player) {
		const state = loadState();
		const normalizedPlayer = normalizePlayer(player);
		const index = state.players.findIndex((item) => item.id === normalizedPlayer.id);

		if (index >= 0) {
			state.players[index] = {
				...state.players[index],
				...normalizedPlayer
			};
		} else {
			state.players.push(normalizedPlayer);
		}

		if (!state.playerTables[normalizedPlayer.id] || state.playerTables[normalizedPlayer.id].length === 0) {
			state.playerTables[normalizedPlayer.id] = makeDefaultTables(normalizedPlayer);
		}

		if (!state.currentTurnPlayerId) {
			state.currentTurnPlayerId = normalizedPlayer.id;
		}

		saveState(state);
		return postJson('/api/players/upsert', normalizedPlayer);
	}

	function updatePlayerTables(playerId, tables) {
		const state = loadState();
		state.playerTables[playerId] = Array.isArray(tables) ? tables.map((table, index) => ({
			id: String(table.id || 'table-' + index),
			title: String(table.title || 'Tabla'),
			content: String(table.content || '')
		})) : [];
		saveState(state);
		return postJson('/api/player-tables/' + encodeURIComponent(playerId), { tables: state.playerTables[playerId] });
	}

	function updateShopItems(items) {
		const state = loadState();
		state.shopItems = normalizeShopItems(items);
		saveState(state);
		return postJson('/api/shop-items', { items: state.shopItems });
	}

	function setCurrentTurn(playerId) {
		const state = loadState();
		state.currentTurnPlayerId = playerId;
		saveState(state);
		return postJson('/api/turn', { playerId });
	}

	function setMarkers(markers) {
		const state = loadState();
		state.markers = normalizeMarkers(markers);
		saveState(state);
		return postJson('/api/markers', { markers: state.markers });
	}

	function setLastRoll(roll) {
		const state = loadState();
		state.lastRoll = {
			playerId: String(roll.playerId || ''),
			playerName: String(roll.playerName || ''),
			sides: Number(roll.sides || 6),
			value: Number(roll.value || 1),
			power: String(roll.power || ''),
			avatar: String(roll.avatar || ''),
			at: Number(roll.at || Date.now())
		};
		state.rollCooldownUntil = Number(roll.cooldownUntil || 0);
		saveState(state);
		return postJson('/api/last-roll', {
			...state.lastRoll,
			cooldownUntil: state.rollCooldownUntil
		});
	}

	function subscribe(callback) {
		function run() {
			callback(loadState());
		}

		const storageHandler = function (event) {
			if (event.key === STORAGE_KEY) {
				run();
			}
		};

		const customHandler = function () {
			run();
		};

		window.addEventListener('storage', storageHandler);
		window.addEventListener(CHANGE_EVENT, customHandler);

		return function unsubscribe() {
			window.removeEventListener('storage', storageHandler);
			window.removeEventListener(CHANGE_EVENT, customHandler);
		};
	}

	window.RolGameState = {
		makeId,
		loadState,
		saveState,
		getCurrentPlayerId,
		setCurrentPlayerId,
		upsertPlayer,
		updatePlayerTables,
		updateShopItems,
		setCurrentTurn,
		setMarkers,
		setLastRoll,
		subscribe
	};
})();