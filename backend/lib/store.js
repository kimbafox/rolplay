const fs = require('fs');
const path = require('path');

function createStore(storageDirectory) {
	const storePath = path.join(storageDirectory, 'store.json');

	function ensureStore() {
		if (!fs.existsSync(storageDirectory)) {
			fs.mkdirSync(storageDirectory, { recursive: true });
		}

		if (!fs.existsSync(storePath)) {
			fs.writeFileSync(storePath, JSON.stringify({ rooms: [], saves: [] }, null, 2));
		}
	}

	function read() {
		ensureStore();
		try {
			return JSON.parse(fs.readFileSync(storePath, 'utf8'));
		} catch (error) {
			return { rooms: [], saves: [] };
		}
	}

	function write(data) {
		ensureStore();
		fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
	}

	return { read, write };
}

module.exports = { createStore };