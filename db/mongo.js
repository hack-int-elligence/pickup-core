var mongoose = require('mongoose');
var uriUtil = require('mongodb-uri');
var DB_NAME = process.env.DB_NAME || 'pickup';
var debug = require('debug')('mongo');

var options = {
	server: {
		socketOptions: {
			keepAlive: 1,
			connectTimeoutMS: 30000
		}
	},
	replset: {
		socketOptions: {
			keepAlive: 1,
			connectTimeoutMS: 30000
		}
	}
};

var connectionString = 'mongodb://pickupdb:mful934XNi6vEPqcYUxZ43qq_cddtGi9mL8t_4jOe1I-@ds042128.mongolab.com:42128/pickupdb' || 'mongodb://localhost/';
var mongodbUri = connectionString;
var mongooseUri = uriUtil.formatMongoose(mongodbUri);
mongoose.connect(mongooseUri, options);

mongoose.connection.on('connected', function() {
	debug(mongooseUri);
	debug('Connected to MongoDB database.');
});

mongoose.connection.on('error', function(err) {
	console.log('WARNING: MongoDB database is not live.');
	debug(mongooseUri);
	debug('Cannot connect to MongoDB database.');
	// throw 'Cannot connect to MongoDB database.';
});

process.on('SIGINT', function() {  
  mongoose.connection.close(function () { 
    process.exit(0); 
  }); 
}); 

var db = mongoose.connection;

var networkDataSchema = new mongoose.Schema({
	_id: mongoose.Schema.ObjectId,
	'mac-address': String,
	username: String,
	password: String,
	ssh_username: String,
	host: String,
	authToken: String,
	recent: [{
		filepath: String,
		container: String,
		URL: String
	}]
}, {
	versionKey: false
});

var networkData = mongoose.model('networkData', networkDataSchema);

module.exports = {
	networkData: networkData,
	mongoose: mongoose,
	networkDataDb: db.collection('networkData')
};
