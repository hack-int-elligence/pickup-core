var express = require('express');
var sshClient = require('ssh2').Client;
var exec = require('child_process').exec;
var bcrypt = require('bcrypt-nodejs');
var debug = require('debug')('ios');
var networkDb = require('../db/networkDb');
var hat = require('hat');
var wol = require('wake_on_lan');
var request = require('request');
process.env.AZURE_STORAGE_ACCESS_KEY = process.env.CUSTOMCONNSTR_AZURE_STORAGE_ACCESS_KEY;
process.env.AZURE_STORAGE_ACCOUNT = process.env.CUSTOMCONNSTR_AZURE_STORAGE_ACCOUNT;
var azure = require('azure-storage');
var STORAGE_URL = 'https://pickupstorage.blob.core.windows.net/';

var router = express.Router();

router.post('/login', function(req, res) {
	req.body.username = req.body.username.toLowerCase();
	networkDb.doesUsernameExist(req.body.username, function(existErr, exists) {
		if (existErr) {
			console.log(existErr);
			res.status(500).send({
				type: 'login',
				data: existErr,
				result: 'mongo error'
			});
		} else {
			if (exists) {
				networkDb.findEntryByUsername(req.body.username, function(err, entry) {
					if (err) {
						console.log(err);
						res.status(500).send({
							type: 'login',
							data: err,
							result: 'mongo error'
						});
					} else {
						var authToken = hat();
						if (req.body.password == entry.password) {
							networkDb.updateEntryWithAuthToken(req.body.username, authToken, function(authErr, updated) {
								if (authErr) {
									res.status(500).send({
										type: 'login',
										data: err,
										result: 'mongo error'
									});
								} else {
									request.post({
										url: 'http://pickup-wakeup.azurewebsites.net/wakeup',
										formData: {
											mac_address: entry['mac-address']
										}
									}, function(err, response, body) {
										if (err) {
											console.log(err);
										} else {
											console.log(body);
										}
									});
									res.status(200).send({
										type: 'login',
										data: authToken,
										result: 'success'
									});
								}
							});
						} else {
							res.status(200).send({
								type: 'login',
								data: 'passwords do not match',
								result: 'error'
							});
						}
					}
				});
			} else {
				res.status(200).send({
					type: 'login',
					data: 'username does not exist',
					result: 'error'
				});
			}
		}
	});
});

router.post('/auth', function(req, res) {
	req.body.username = req.body.username.toLowerCase();
	networkDb.findEntryByUsername(req.body.username, function(err, entry) {
		if (err) {
			res.status(500).send({
				type: 'auth',
				data: err,
				result: 'mongo error'
			});
		} else {
			// check auth token
			if (req.body.authToken == entry.authToken) {
				// all okay
				var password = req.body.sshPassword;
				var host = entry.host;
				var username = entry.ssh_username;
				var connection = new sshClient();
				console.log('ssh-ing into ' + host + ' with password: ' + password);
				connection.on('ready', function() {
					debug('Succesfully connected via SSH to host!');
					res.status(200).send({
						type: 'auth',
						data: null,
						result: 'success'
					});
				}).on('error', function(err) {
					res.status(500).send({
						type: 'auth',
						data: err,
						result: 'ssh error'
					});
				}).on('keyboard-interactive', function(name, instructions, instructionsLang, prompts, finish) {
					console.log('Serving SSH password in a handshake interchange...');
					finish([password]);
				}).connect({
					host: host,
					port: 22,
					username: username,
					readyTimeout: 99999,
					tryKeyboard: true
				});
			} else {
				// no auth token
				res.status(401).send({
					type: 'auth',
					result: 'auth error',
					data: null
				});
			}
		}
	});
});

router.post('/search', function(req, res) {
	req.body.username = req.body.username.toLowerCase();
	networkDb.findEntryByUsername(req.body.username, function(err, entry) {
		if (err) {
			res.status(500).send({
				type: 'login',
				data: err,
				result: 'mongo error'
			});
		} else {
			request.post({
				url: 'http://pickup-wakeup.azurewebsites.net/wakeup',
				formData: {
					mac_address: entry['mac-address']
				}
			}, function(err, response, body) {
				if (err) {
					console.log(err);
				} else {
					console.log(body);
				}
			});
			// check auth token
			if (req.body.authToken == entry.authToken) {
				// all okay
				var password = req.body.sshPassword;
				var host = entry.host;
				var username = entry.ssh_username;
				var filename = req.body.filename;
				var connection = new sshClient();
				console.log('ssh-ing into ' + host + ' with password: ' + password);
				connection.on('ready', function() {
					debug('Succesfully connected via SSH to host!');
					connection.exec('function timeout() { perl -e \'alarm shift; exec @ARGV\' \"$@\"; } && timeout 10 mdfind -name ' + filename + ' -onlyin ~/ | egrep -v \'Library\'', function(execErr, stream) {
						if (err) {
							res.status(500).send({
								type: 'search',
								data: execErr,
								result: 'execution error'
							});
							return connection.end();
						} else {
							stream.on('data', function(data) {
								console.log(data.toString().trim().split(/\n/));
								res.status(200).send({
									type: 'search',
									result: 'success',
									data: data.toString().trim().split(/\n/)
								});
							}).on('close', function() {
								console.log('closed stream');
								return connection.end();
							})
						}
					});
				}).on('error', function(err) {
					res.status(500).send({
						type: 'search',
						data: err,
						result: 'ssh error'
					});
				}).on('keyboard-interactive', function(name, instructions, instructionsLang, prompts, finish) {
					console.log('Serving SSH password in a handshake interchange...');
					finish([password]);
				}).connect({
					host: host,
					port: 22,
					username: username,
					readyTimeout: 99999,
					tryKeyboard: true
				});
			} else {
				// no auth token
				res.status(401).send({
					type: 'search',
					result: 'auth error',
					data: null
				});
			}
		}
	});
});

router.post('/pickup', function(req, res) {
	req.body.username = req.body.username.toLowerCase();
	networkDb.findEntryByUsername(req.body.username, function(err, entry) {
		if (err) {
			console.log(err);
			res.status(500).send({
				type: 'pickup',
				data: err,
				result: 'mongo error'
			});
		} else {
			request.post({
				url: 'http://pickup-wakeup.azurewebsites.net/wakeup',
				formData: {
					mac_address: entry['mac-address']
				}
			}, function(err, response, body) {
				if (err) {
					console.log(err);
				} else {
					console.log(body);
				}
			});
			if (req.body.authToken == entry.authToken) {
				// all okay
				var password = req.body.sshPassword;
				var host = entry.host;
				var username = entry.ssh_username;
				var filepath = req.body.filepath;
				var email = req.body.email;
				var connection = new sshClient();
				console.log('ssh-ing into ' + host + ' with username: ' + username + ', password: ' + password);
				connection.on('ready', function() {
					debug('Succesfully connected via SSH to host!');
					console.log('searching for filepath: ' + filepath);
					//var emailScript = 'filename="' + filepath + '" && space=" " && escaped="\ " && filepath="${filename/$space/$escaped}" && recipient="' + email + '" && username="' + req.body.username + '" && encoded_file="$(cat ${filepath} | base64)" && curl -A \'Mandrill-Curl/1.0\' -d \'{"key":"cCB0AkwTdLJJFjW9ARZGdA","message":{"html":"","text":"Your file is here!","subject":"Pickup Delivery!","from_email":"akshatag@seas.upenn.edu","from_name":"Pickup Mailman","to":[{"email":"\'"$recipient"\'","name":"","type":"to"}],"headers":{"Reply-To":"message.reply@example.com"},"important":false,"track_opens":null,"track_clicks":null,"auto_text":null,"auto_html":null,"inline_css":null,"url_strip_qs":null,"preserve_recipients":null,"view_content_link":null,"bcc_address":null,"tracking_domain":null,"signing_domain":null,"return_path_domain":null,"merge":true,"merge_language":"mailchimp","global_merge_vars":[{"name":"merge1","content":"merge1 content"}],"merge_vars":null,"tags":null,"subaccount":null,"google_analytics_domains" : null,"google_analytics_campaign": null,"metadata":{"website":"www.example.com"},"recipient_metadata":null,"attachments":[{"type": "", "name":"\'"$(basename ${filepath})"\'","content":"\'"$encoded_file"\'"}],"images":[{"type":"image\/png","name":"IMAGECID","content":"ZXhhbXBsZSBmaWxl"}]},"async":true,"ip_pool":"Main Pool"}\' \'https://mandrillapp.com/api/1.0/messages/send.json\'';
					var uploadScript = 'curl -X \'POST\' -d \'username=\'$username\'&filepath=\'$filepath\'&contents=\'"$encoded_file"\'\' \'http://pickup.azurewebsites.net/upload\'';
					connection.exec(uploadScript, function(execErr, stream) {
						if (err) {
							console.log(err);
							res.status(500).send({
								type: 'pickup',
								data: execErr,
								result: 'execution error'
							});
							return connection.end();
						} else {
							stream.on('data', function(data) {
								// console.log(data.toString().trim().split(/\n/));
								res.status(200).send({
									type: 'pickup',
									result: 'success',
									data: data.toString()
								});
								return // avoid resending headers when stream closes
							}).on('close', function() {
								console.log('closed stream');
								return connection.end();
							})
						}
					});
				}).on('error', function(err) {
					res.status(500).send({
						type: 'pickup',
						result: 'error',
						data: err
					});
				}).on('keyboard-interactive', function(name, instructions, instructionsLang, prompts, finish) {
					console.log('Serving SSH password in a handshake interchange...');
					finish([password]);
				}).connect({
					host: host,
					port: 22,
					username: username,
					readyTimeout: 99999,
					tryKeyboard: true
				});
			} else {
				// no auth token
				res.status(401).send({
					type: 'pickup',
					result: 'auth error',
					data: null
				});
			}
		}
	});
});

router.post('/email', function(req, res) {
	req.body.username = req.body.username.toLowerCase();
	networkDb.findEntryByUsername(req.body.username, function(err, entry) {
		if (err) {
			console.log(err);
			res.status(500).send({
				type: 'pickup',
				data: err,
				result: 'mongo error'
			});
		} else {
			request.post({
				url: 'http://pickup-wakeup.azurewebsites.net/wakeup',
				formData: {
					mac_address: entry['mac-address']
				}
			}, function(err, response, body) {
				if (err) {
					console.log(err);
				} else {
					console.log(body);
				}
			});
			if (req.body.authToken == entry.authToken) {
				// all okay
				var password = req.body.sshPassword;
				var host = entry.host;
				var username = entry.ssh_username;
				var filepath = req.body.filepath;
				var email = req.body.email;
				var connection = new sshClient();
				console.log('ssh-ing into ' + host + ' with username: ' + username + ', password: ' + password);
				connection.on('ready', function() {
					debug('Succesfully connected via SSH to host!');
					console.log('searching for filepath: ' + filepath);
					var emailScript = 'filename="' + filepath + '" && space=" " && escaped="\ " && filepath="${filename/$space/$escaped}" && recipient="' + email + '" && username="' + req.body.username + '" && encoded_file="$(cat ${filepath} | base64)" && curl -A \'Mandrill-Curl/1.0\' -d \'{"key":"cCB0AkwTdLJJFjW9ARZGdA","message":{"html":"","text":"Your file is here!","subject":"Pickup Delivery!","from_email":"akshatag@seas.upenn.edu","from_name":"Pickup Mailman","to":[{"email":"\'"$recipient"\'","name":"","type":"to"}],"headers":{"Reply-To":"message.reply@example.com"},"important":false,"track_opens":null,"track_clicks":null,"auto_text":null,"auto_html":null,"inline_css":null,"url_strip_qs":null,"preserve_recipients":null,"view_content_link":null,"bcc_address":null,"tracking_domain":null,"signing_domain":null,"return_path_domain":null,"merge":true,"merge_language":"mailchimp","global_merge_vars":[{"name":"merge1","content":"merge1 content"}],"merge_vars":null,"tags":null,"subaccount":null,"google_analytics_domains" : null,"google_analytics_campaign": null,"metadata":{"website":"www.example.com"},"recipient_metadata":null,"attachments":[{"type": "", "name":"\'"$(basename ${filepath})"\'","content":"\'"$encoded_file"\'"}],"images":[{"type":"image\/png","name":"IMAGECID","content":"ZXhhbXBsZSBmaWxl"}]},"async":true,"ip_pool":"Main Pool"}\' \'https://mandrillapp.com/api/1.0/messages/send.json\'';
					connection.exec(emailScript, function(execErr, stream) {
						if (err) {
							console.log(err);
							res.status(500).send({
								type: 'pickup',
								data: execErr,
								result: 'execution error'
							});
							return connection.end();
						} else {
							stream.on('data', function(data) {
								// console.log(data.toString().trim().split(/\n/));
								res.status(200).send({
									type: 'pickup',
									result: 'success',
									data: data.toString()
								});
								return // avoid resending headers when stream closes
							}).on('close', function() {
								console.log('closed stream');
								return connection.end();
							})
						}
					});
				}).on('error', function(err) {
					res.status(500).send({
						type: 'pickup',
						result: 'error',
						data: err
					});
				}).on('keyboard-interactive', function(name, instructions, instructionsLang, prompts, finish) {
					console.log('Serving SSH password in a handshake interchange...');
					finish([password]);
				}).connect({
					host: host,
					port: 22,
					username: username,
					readyTimeout: 99999,
					tryKeyboard: true
				});
			} else {
				// no auth token
				res.status(401).send({
					type: 'pickup',
					result: 'auth error',
					data: null
				});
			}
		}
	});
});

router.post('/recent', function(req, nores) {
	req.body.username = req.body.username.toLowerCase();
	networkDb.findEntryByUsername(req.body.username, function(err, entry) {
		if (err) {
			res.status(500).send({
				type: 'recent',
				data: err,
				result: 'mongo error'
			});
		} else {
			if (req.body.authToken == entry.authToken) {
				res.status(200).send({
					type: 'recent',
					data: entry.recent,
					result: 'success'
				});
			} else {
				res.status(401).send({
					type: 'auth',
					result: 'auth error',
					data: null
				});
			}
		}
	});
});

router.post('/preview', function(req, res) {
	req.body.username = req.body.username.toLowerCase();
	req.body.filepath = req.body.filepath.replace(/ /g, '_');
	networkDb.findEntryByUsername(req.body.username, function(err, entry) {
		if (err) {
			res.status(500).send({
				type: 'preview',
				data: err,
				result: 'mongo error'
			});
		} else {
			if (req.body.authToken == entry.authToken) {
				networkDb.isAzureStorageReady(req.body.username, req.body.filepath, function(err, exists) {
					if (exists) {
						networkDb.findURLByUsernameAndFilepath(req.body.username, req.body.filepath, function(err, URL) {
							if (err) {
								res.status(500).send({
									type: 'preview',
									data: err,
									result: 'mongo error'
								});
							} else {
								res.status(200).send({
									type: 'preview',
									data: URL,
									result: 'success'
								});
							}
						});
					} else {
						res.status(200).send({
							type: 'preview',
							data: 'not ready',
							result: 'error'
						});
					}
				});
			} else {
				res.status(401).send({
					type: 'preview',
					result: 'auth error',
					data: null
				});
			}
		}
	});
});

router.post('/updateAccountPassword', function(req, res) {
	req.body.username = req.body.username.toLowerCase();
	networkDb.findEntryByUsername(req.body.username, function(err, entry) {
		if (err) {
			res.status(500).send({
				type: 'updateAccountPassword',
				data: err,
				result: 'mongo error'
			});
		} else {
			if (req.body.authToken == entry.authToken) {
				networkDb.updateEntryPassword(req.body.username, req.body.newPassword, function(err, result) {
					if (err) {
						res.status(500).send({
							type: 'updateAccountPassword',
							data: err,
							result: 'mongo error'
						});
					} else {
						res.status(200).send({
							type: 'updateAccountPassword',
							data: 'successfully updated account password',
							result: 'success'
						});
					}
				});
			} else {
				res.status(200).send({
					type: 'updateAccountPassword',
					data: null,
					error: 'auth error'
				});
			}
		}
	});
});

router.post('/browse', function(req, res) {
	req.body.username = req.body.username.toLowerCase();
	networkDb.findEntryByUsername(req.body.username, function(err, entry) {
		if (err) {
			res.status(500).send({
				type: 'browse',
				data: err,
				result: 'mongo error'
			});
		} else {
			// check auth token
			request.post({
				url: 'http://pickup-wakeup.azurewebsites.net/wakeup',
				formData: {
					mac_address: entry['mac-address']
				}
			}, function(err, response, body) {
				if (err) {
					console.log(err);
				} else {
					console.log(body);
				}
			});
			if (req.body.authToken == entry.authToken) {
				// all okay
				var password = req.body.sshPassword;
				var host = entry.host;
				var username = entry.ssh_username;
				var connection = new sshClient();
				console.log('ssh-ing into ' + host + ' with password: ' + password);
				connection.on('ready', function() {
					debug('Succesfully connected via SSH to host!');
					connection.exec('cd ' + req.body.filepath + ' && dirs=(*/) && files=$(find . -maxdepth 1 -type f) && for dir in ${dirs[*]}; do echo $dir; done && for file in ${files[*]}; do (if [ "${file:0:3}" != "./." ]; then echo ${file:2}; fi); done', function(execErr, stream) {
						if (err) {
							res.status(500).send({
								type: 'browse',
								data: execErr,
								result: 'execution error'
							});
							return connection.end();
						} else {
							stream.on('data', function(data) {
								try {
									res.status(200).send({
										type: 'browse',
										result: 'success',
										data: data.toString().trim().split(/\n/)
									});
								} catch (err) {
									res.status(200).send({
										type: 'browse',
										result: 'error',
										data: err
									});
								}
							}).on('close', function() {
								console.log('closed stream');
								return connection.end();
							})
						}
					});
				}).on('error', function(err) {
					res.status(500).send({
						type: 'browse',
						data: err,
						result: 'ssh error'
					});
				}).on('keyboard-interactive', function(name, instructions, instructionsLang, prompts, finish) {
					console.log('Serving SSH password in a handshake interchange...');
					finish([password]);
				}).connect({
					host: host,
					port: 22,
					username: username,
					readyTimeout: 99999,
					tryKeyboard: true
				});
			} else {
				// no auth token
				res.status(401).send({
					type: 'browse',
					result: 'auth error',
					data: null
				});
			}
		}
	});
});

router.post('/onedrive', function(req, res) {
	// recreate onedriveToken
	req.body.onedriveToken = req.body.onedriveToken.replace(/ /g, '+');
	// res.send(req.body);
	req.body.username = req.body.username.toLowerCase();
	networkDb.findEntryByUsername(req.body.username, function(err, entry) {
		if (err) {
			console.log(err);
			res.status(500).send({
				type: 'onedrive',
				data: err,
				result: 'mongo error'
			});
		} else {
			if (req.body.authToken == entry.authToken) {
				// all okay
				var password = req.body.sshPassword;
				var host = entry.host;
				var username = entry.ssh_username;
				var filepath = req.body.filepath;
				var email = req.body.email;
				var connection = new sshClient();
				console.log('ssh-ing into ' + host + ' with username: ' + username + ', password: ' + password);
				connection.on('ready', function() {
					debug('Succesfully connected via SSH to host!');
					console.log('searching for filepath: ' + filepath);
					var uploadToOneDriveScript = 'filename=$(basename "' + filepath + '") && token=' + req.body.onedriveToken + ' && curl -X \'PUT\' -H "Content-Type: application/octet-stream" --data-binary \'@\'"' + filepath + '" \'https://api.onedrive.com/v1.0/drive/root:/pickup/\'"${filename}"\':/content?access_token=\'"${token}"\'\'';
					connection.exec(uploadToOneDriveScript, function(execErr, stream) {
						if (err) {
							console.log(err);
							res.status(500).send({
								type: 'onedrive',
								data: execErr,
								result: 'execution error'
							});
							return connection.end();
						} else {
							stream.on('data', function(data) {
								console.log(data);
							}).on('close', function() {
								console.log('closed stream');
								res.status(200).send({
									type: 'onedrive',
									result: 'success',
									data: null
								});
								return connection.end();
							})
						}
					});
				}).on('error', function(err) {
					res.status(500).send({
						type: 'onedrive',
						result: 'error',
						data: err
					});
				}).on('keyboard-interactive', function(name, instructions, instructionsLang, prompts, finish) {
					console.log('Serving SSH password in a handshake interchange...');
					finish([password]);
				}).connect({
					host: host,
					port: 22,
					username: username,
					readyTimeout: 99999,
					tryKeyboard: true
				});
			} else {
				// no auth token
				res.status(401).send({
					type: 'onedrive',
					result: 'auth error',
					data: null
				});
			}
		}
	});
});

/*
router.get('/find/:username', function(req, res) {
	networkDb.findEntryByUsername(req.params.username, function(err, entry) {
		res.send(entry);
	});
});

// testng running a 'c' script in Nodejs (works in development mode)
router.get('/magicpackets', function(req, res) {
	var worker = exec('gcc -Wall -o wol wol.c && ./wol d8:a2:5e:98:88:a7', function(error, stdout, stderr) {
		console.log(stdout);
		if (error != null) {
			console.log('exec error: ' + error);
		}
	});
});

// testing SSH login to remote devices using hosts (ipv4 | ipv6) and secure passwords
router.get('/ssh', function(req, res) {
	// if decrypted in b64 
	// var password = new Buffer(req.body.Password, 'base64').toString()
	var password = 'devesh';
	var host = '165.123.186.140';
	var username = req.body.username;
	var connection = new sshClient();
	connection.on('ready', function() {
		debug('Succesfully connected via SSH to host!');
		connection.exec('mdfind -name HI -onlyin ~/ | egrep -v \'Library\'', function(err, stream) {
			if (err) {
				debug(err);
				return connection.end();
			} else {
				stream.on('data', function(data) {
					res.send(data.toString().trim().split(/\n/));
				}).on('close', function() {
					debug('closed stream');
					return connection.end();
				})
			}
		});
	}).on('error', function(err) {
		res.status(500).send(err);
	}).on('keyboard-interactive', function(name, instructions, instructionsLang, prompts, finish) {
		console.log('Serving SSH password in a handshake interchange...');
		finish([password]);
	}).connect({
		host: host,
		port: 22,
		username: 'jacobkahn',
		readyTimeout: 99999,
		tryKeyboard: true
	});
});
*/

module.exports = router;