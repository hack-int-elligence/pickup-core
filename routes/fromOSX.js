var express = require('express');
var bcrypt = require('bcrypt-nodejs');
var sshClient = require('ssh2').Client;
var exec = require('child_process').exec;
var debug = require('debug')('osx');
var networkDb = require('../db/networkDb');
process.env.AZURE_STORAGE_ACCESS_KEY = process.env.CUSTOMCONNSTR_AZURE_STORAGE_ACCESS_KEY;
process.env.AZURE_STORAGE_ACCOUNT = process.env.CUSTOMCONNSTR_AZURE_STORAGE_ACCOUNT;
var azure = require('azure-storage');
var STORAGE_URL = 'https://pickupstorage.blob.core.windows.net/';
var request = require('request');

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
	req.body.username = req.body.username.toLowerCase();
	var container_name = req.body.username;
	var blob_name = req.body.filepath.replace(/ /g, '_'); // replace spaces with _
	var contentString = new Buffer(req.body.contents, 'base64').toString('utf-8');
	console.log(contentString);
	var blobService = azure.createBlobService();
	blobService.createContainerIfNotExists(container_name, function(err, result, response) {
		blobService.setContainerAcl(container_name, null, {
			publicAccessLevel: 'container'
		}, function(e, r, re) {
			blobService.createBlockBlobFromText(container_name, blob_name, contentString, function(err, result, resopnse) {
				// succesfully stored in azure storage
				networkDb.updateEntryWithRecentFile(req.body.username, {
					filepath: blob_name,
					container_name: container_name,
					URL: STORAGE_URL + container_name + '/' + blob_name
				}, function(err, result) {
					if (err) {
						res.status(500).send({
							type: 'upload',
							data: err,
							result: error
						});
					}
					res.send({
						type: 'upload',
						data: null,
						result: 'success'
					});
				});
			});
		});
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

module.exports = router;