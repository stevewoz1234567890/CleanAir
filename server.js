const express = require('express');
const history = require('connect-history-api-fallback');

const { mongooseConnect, mongoSDKConnect } = require('./utils/database/Client');
const { AWSConnect } = require('./utils/aws/Client');
const { pythonConnect } = require('./utils/python/Client');
const { redisConnect } = require('./utils/redis/Client');
//const { putLog } = require('./utils/aws/Logger');

const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const path = require('path');
const socketIo = require('socket.io');
const { Server } = require('http');
const chalk = require('chalk');

const PORT = process.env.PORT || 5000;
const PYPORT = process.env.PYPORT || 5001;

const app = express();
const server = Server(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', (socket) => {
    console.log('a user disconnected');
  });
});

app.use(express.json({ extended: false, limit: '25mb' }));

/* This allows us to pass the requesting users ip address to morgan for logging */
app.set('trust proxy', true);
const morganLogOptions =
  '[:date[iso]] [ip: :remote-user] :method :url :status :res[content-length] - :response-time ms';
app.use(morgan(morganLogOptions));
//const morganLogOptions = 'common'

app.use(cookieParser());
app.use(fileUpload());
app.use(cookieParser());
app.use(fileUpload());


/* Here we want to make sure that the json object is valid format */
app.use((err, req, res, next) => {
  if (err) {
    console.log(err);
    return res.status(400).json({ msg: 'invalid json format' });
  } else {
    next();
  }
});

/* 
  Make socketio available to all requests 
  const io = req.app.get('socketio');
*/
app.set('socketio', io);


app.use('/api/users', require('./routes/users'));
app.use('/api/invites', require('./routes/invites'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/passwords', require('./routes/passwords'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/orgs', require('./routes/orgs'));
app.use('/api/widgets', require('./routes/widgets'));

app.use(history());
app.use(express.static('client/build'));

const startServer = async () => {
  await Promise.all([
    mongooseConnect(),
    mongoSDKConnect(),
    AWSConnect(),
    pythonConnect(PYPORT),
    redisConnect(),
  ]);
  server.listen(PORT, () => {
    console.log(chalk.cyan(`☆ listening on localhost:${PORT}`));
  });
};

startServer();
