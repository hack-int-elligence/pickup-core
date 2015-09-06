var mongo = require('./mongo');
var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');
var debug = require('debug')('networkDb');

module.exports = {
  createNewEntry: function(details, callback) {
    var newEntry = new mongo.networkData();
    newEntry._id = mongoose.Types.ObjectId();
    newEntry.username = details.username;
    newEntry.password = details.password;
    newEntry.host = details.host;
    newEntry.ssh_username = details.ssh_username;
    newEntry['mac-address'] = details['mac-address'];
    newEntry.recent = [];
    newEntry.save(function(err, result) {
      debug('Created new entry into network database');
      callback(err, result);
    });
  },

  findAllEntries: function(callback) {
    // callback the error and the result
    mongo.networkData.find(function(err, result) {
      callback(err, result);
    });
  },

  findEntryById: function(id, callback) {
    // callback error and result
    mongo.networkData.findById(callback);
  },

  findEntryByUsername: function(username, callback) {
    // callback error and result
    mongo.networkData.findOne({
      username: username
    }, callback);
  },

  doesUsernameExist: function(username, callback) {
    mongo.networkData.count({
      username: username
    }, function(err, count) {
      if (count && count > 0) {
        callback(null, true);
      } else {
        callback(err, false);
      }
    });
  },

  isAzureStorageReady: function(username, filepath, callback) {
    mongo.networkData.count({
      username: username,
      recent: {
        '$elemMatch': {
          filepath: filepath
        }
      }
    }, function(err, count) {
      if (count && count > 0) {
        callback(err, true);
      } else {
        callback(err, false);
      }
    });
  },

  clearRecents: function(username, callback) {
    mongo.networkData.findOne({
      username: username
    }, function(err, entry) {
      if (entry) {
        entry.recent = [];
        entry.save(function(err, result) {
          callback(err, result);
        });
      }
    });
  },

  findURLByUsernameAndFilepath: function(username, filepath, callback) {
    mongo.networkData.findOne({
      username: username,
      recent: {
        '$elemMatch': {
          filepath: filepath
        }
      }
    }, function(err, entry) {
      if (err) {
        callback(err);
      } else {
        // should be the last entry in the db
        var URLmeta = '';
        for (var i = 0; i < entry.recent.length; i++) {
          if (entry.recent[i].filepath == filepath) {
            URLmeta = entry.recent[i];
          }
        }
        callback(null, URLmeta);
      }
    });
  },

  updateEntryWithRecentFile: function(username, fileData, callback) {
    mongo.networkData.findOne({
      username: username
    }, function(err, entry) {
      if (err) {
        callback(err);
      } else {
        var exists = false;
        for (var i = 0; i < entry.recent.length; i++) {
          if (entry.recent[i].username == fileData.username && entry.recent[i].filepath == fileData.filepath) {
            exists = true;
          }
        }
        if (!exists) {
          entry.recent.push(fileData);
          entry.save(function(err, result) {
            debug('added new filepath to recent list');
            callback(err, result);
          });
        } else {
          callback(err, null);
        }
      }
    });
  },

  updateEntryWithAuthToken: function(username, authToken, callback) {
    mongo.networkData.findOne({
      username: username
    }, function(err, entry) {
      if (err) {
        callback(err);
      } else {
        entry.authToken = authToken;
        entry.save(function(err, result) {
          debug('Updated auth token for entry in network database');
          callback(err, result);
        });
      }
    });
  },

  updateEntryPassword: function(username, newPassword, callback) {
    mongo.networkData.findOne({
      username: username
    }, function(err, entry) {
      entry.password = newPassword;
      entry.save(function(err, reuslt) {
        debug('updated password in db for user ' + username);
        callback(err, result);
      });
    });
  },

  updateEntryHost: function(mac_address, host, callback) {
    mongo.networkData.findOne({
      'mac-address': mac_address
    }, function(err, entry) {
      entry.host = host;
      entry.save(function(err, result) {
        debug('Updated host in entry.');
        callback(err, result);
      })
    });
  },

  removeEntryByUsername: function(username, callback) {
    this.findEntryByUsername(username, function(err, entry) {
      if (!err && result) {
        result.remove(); // don't care about a callback
      }
    });
  }
};