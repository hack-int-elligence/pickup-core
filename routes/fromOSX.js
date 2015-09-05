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
var fs = require('fs');
var AWS = require('aws-sdk');
AWS.config.update({
	accessKeyId: 'AKIAJIYEXN2MEI3IGHVQ',
	secretAccessKey: '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'
});
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
	req.body.username = req.body.username.toLowerCase();
	var container_name = req.body.username;
	var blob_name = req.body.filepath.replace(/ /g, '_'); // replace spaces with _
	var contentString = new Buffer(req.body.contents, 'base64');
	console.log(contentString);
	var blobService = azure.createBlobService();
	blobService.createContainerIfNotExists(container_name, function(err, result, response) {
		blobService.setContainerAcl(container_name, null, {
			publicAccessLevel: 'container'
		}, function(e, r, re) {
			// var tokens = blob_name.split('.');
			// var contentType = 'application/octet-stream';
			// console.log(tokens[tokens.length - 1]);
			// if (tokens[tokens.length - 1] == 'pdf') {
			// 	contentType = 'application/pdf';
			// }
			// blobService.createBlockBlobFromText(container_name, blob_name, contentString, {
			// 	contentType: contentType
			// }, function(err, result, resopnse) {
			// var tokens = blob_name.split('/');
			// var filename = tokens[tokens.length - 1];
			// console.log(filename);
			// fs.writeFile(filename, contentString, 'utf8', function(err) {
			// 	if (err) console.log(err)
			// 	blobService.createBlockBlobFromLocalFile(container_name, filename, filename, function(err, result, response) {
			// 		// succesfully stored in azure storage
			// 		networkDb.updateEntryWithRecentFile(req.body.username, {
			// 			filepath: blob_name,
			// 			container_name: container_name,
			// 			URL: STORAGE_URL + container_name + '/' + blob_name
			// 		}, function(err, result) {
			// 			fs.unlink(filename, function(err) {
			// 				if (err) {
			// 					res.status(500).send({
			// 						type: 'upload',
			// 						data: err,
			// 						result: error
			// 					});
			// 				}
			// 				res.send({
			// 					type: 'upload',
			// 					data: null,
			// 					result: 'success'
			// 				});
			// 			});
			// 		});
			// 	});
			// });
			var s3service = new AWS.S3();
			AWS.config.update({
				accessKeyId: 'AKIAJIYEXN2MEI3IGHVQ',
				secretAccessKey: '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'
			});
			AWS.config.update({
				region: 'us-east-1'
			});
			console.log(AWS.config);
			var bucketKey = req.body.username + ':' + blob_name;
			// username format is going to be username:filepath
			console.log(bucketKey);
			s3service.putObject({
				ACL: 'public-read-write',
				Bucket: 'pickupfilestorage',
				Key: bucketKey,
				Body: contentString
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
					blobService.createBlockBlobFromText(container_name, blob_name, urlString, function(err, result, response) {
						console.log(err, result, response);
						res.status(200).send({
							type: 'upload',
							data: err,
							result: 'success'
						});
					});
				}
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

router.get('/clear/:username/', function(req, res) {
	networkDb.clearRecents(req.params.username, function(err, result) {
		res.send(result);
	});
});

module.exports = router;