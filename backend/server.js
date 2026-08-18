const express = require('express');
const path = require('path');
const { createStore } = require('./lib/store');
const { createRoomService } = require('./lib/room-service');
const { createApiRouter } = require('./routes/api');

const app = express();
const frontendPath = path.join(__dirname, '..', 'frontend');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const rooms = createRoomService(createStore(path.join(__dirname, 'data')));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(frontendPath));
app.use('/api', createApiRouter(rooms));

app.get('/health', (request, response) => {
	response.status(200).json({ ok: true, port: PORT });
});

app.get('/', (request, response) => {
	response.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, HOST, () => {
	console.log('Servidor listo en ' + HOST + ':' + PORT);
});
