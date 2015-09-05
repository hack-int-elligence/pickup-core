var express = require('express');
var sessions = require('client-sessions');
var bodyParser = require('body-parser');
var compression = require('compression');
var fromOSX = require('./routes/fromOSX');
var fromIOS = require('./routes/fromIOS');
var path = require('path');

var app = express()

app.engine('.html', require('ejs').__express);
app.set('view engine', 'html');
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json({
	limit: '1mb'
}));
app.use(bodyParser.urlencoded({
	extended: false,
	limit: '1mb'
}));

// route handlers go here
app.use(fromOSX);
app.use(fromIOS);

app.use(function(req, res, next) {
	res.sendStatus(404);
});

app.set('port', process.env.PORT || 3000);

var clientServer = app.listen(app.get('port'), function() {
	console.log('Express server listening on port %d', clientServer.address().port);
});
