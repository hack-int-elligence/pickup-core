var express = require('express');
var bcrypt = require('bcrypt-nodejs');
var sshClient = require('ssh2').Client;
var exec = require('child_process').exec;
var debug = require('debug')('osx');
var networkDb = require('../db/networkDb');
process.env.AWS_ACCESS_KEY_ID = process.env.CUSTOMCONNSTR_AWS_ACCESS_KEY_ID;
process.env.AWS_SECRET_ACCESS_KEY = process.env.CUSTOMCONNSTR_AWS_SECRET_ACCESS_KEY;
var request = require('request');
var fs = require('fs');
var AWS = require('aws-sdk');
AWS.config.update({
	region: 'us-east-1'
});

var router = express.Router();

// load homepage/download page
router.get('/', function(req, res) {
	res.status(200).render('index');
});

router.get('/showall', function(req, res) {
	networkDb.findAllEntries(function(err, ent) {
		res.send(ent);
	});
});

router.post('/register', function(req, res) {
	req.body.username = req.body.username.toLowerCase();
	networkDb.doesUsernameExist(req.body.username, function(existErr, exists) {
		if (existErr) {
			res.status(500).send({
				type: 'register',
				data: existErr,
				result: 'mongo error'
			});
		} else {
			if (!exists) {
				networkDb.createNewEntry({
					username: req.body.username,
					password: req.body.password,
					host: req.body.host,
					ssh_username: req.body.ssh_username,
					'mac-address': req.body['mac_address']
				}, function(err, result) {
					if (err) {
						res.status(500).send({
							type: 'register',
							data: err,
							result: ' mongo error'
						});
					} else {
						res.status(200).send({
							result: 'success',
							data: null,
							type: 'register'
						});
					}
				});
			} else {
				// username exists already!
				res.status(200).send({
					type: 'register',
					data: 'username already exists',
					result: 'error'
				});
			}
		}
	});
});

router.post('/update', function(req, res) {
	networkDb.updateEntryHost(req.body['mac-address'], req.body.host, function(err, result) {
		if (err) {
			res.status(500).send({
				type: 'update',
				data: err,
				result: 'error'
			});
		} else {
			res.status(200).send({
				result: 'success',
				data: null,
				type: 'update'
			});
		}
	});
});

router.post('/upload', function(req, res) {
	console.log('Recieved data from OS X for /upload');
	req.body.username = req.body.username.toLowerCase();
	var container_name = req.body.username;
	var filepath = req.body.filepath.replace(/ /g, '_'); // replace spaces with _
	var contentString = new Buffer(req.body.contents, 'base64');
	console.log(contentString);

	var s3service = new AWS.S3();
	AWS.config.update({
		region: 'us-east-1'
	});
	console.log(AWS.config);
	var bucketKey = req.body.username + ':' + filepath;
	// username format is username:filepath
	console.log(bucketKey);
	s3service.putObject({
		Bucket: 'pickupfilestorage',
		Key: bucketKey,
		Body: contentString,
	}, function(err, result) {
		if (err) {
			console.log(err);
			res.status(500).send({
				type: 'upload',
				data: err,
				result: 'amazon s3 error'
			});
		} else {
			var urlString = 'http://pickupfilestorage.s3.amazonaws.com/' + bucketKey;
			console.log(urlString);
			networkDb.updateEntryWithRecentFile(req.body.username, {
				filepath: filepath,
				container_name: container_name,
				URL: urlString
			}, function(err, result) {
				res.status(200).send({
					type: 'upload',
					data: err,
					result: 'success'
				});
			});
		}
	});
});

router.get('/seed/:username/:password', function(req, res) {
	// bcrypt.hash(req.params.password, 8, null, function(err, encrypted) {
	networkDb.createNewEntry({
		username: req.params.username,
		password: req.params.password
	}, function(err, result) {
		if (err) {
			res.status(500).send(err);
		} else {
			res.status(200).send('created');
		}
	});
	// });
});

router.get('/clear/:username/', function(req, res) {
	networkDb.clearRecents(req.params.username, function(err, result) {
		res.send(result);
	});
});

module.exports = router;