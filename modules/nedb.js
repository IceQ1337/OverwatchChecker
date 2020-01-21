const Datastore = require('nedb');

const Watchlist = new Datastore({ filename: './datastore/watchlist.db', autoload: true });
Watchlist.ensureIndex({ fieldName: 'steamid64', unique: true }, (err) => {
    if (err) {
        console.error(`[${new Date().toUTCString()}] CSGO (Watchlist.ensureIndex) > ${err}`);
    }
});

module.exports = function() {
    this.db = {};

    this.createDB = function(accountID) {
        this.db[accountID] = new Datastore({ filename: './datastore/' + accountID + '.db', autoload: true });
        this.db[accountID].ensureIndex({ fieldName: 'caseid', unique: true }, (err) => {
            if (err) {
                console.error(`[${new Date().toUTCString()}] NEDB (createDB) > ${err}`);
            }
        });
    }.bind(this);

    this.saveOverwatchCase = function(accountID, assignment, steamID64) {
        if (this.db[accountID]) {
            var saveData = {
                caseid: assignment.caseid,
                fractionid: assignment.fractionid,
                suspectid: assignment.suspectid,
                suspectid64: steamID64.toString(),
                downloadURL: assignment.caseurl,
                timestamp: Date.now()
            };
            this.db[accountID].insert(saveData, function(err) {
                if (err && err.errorType != 'uniqueViolated') {
                    console.error(`[${new Date().toUTCString()}] NEDB (saveOverwatchCase) > ${err}`);
                }
            });
        } else {
            console.error(`[${new Date().toUTCString()}] NEDB (saveOverwatchCase) > Database does not exist for ${accountID}`);
        }
    }.bind(this);

    this.addToWatchlist = function(steamID64) {
        return new Promise(function(resolve, reject) {
            Watchlist.insert({ steamid64: steamID64 }, function(err) {
                if (err) {
                    console.error(`[${new Date().toUTCString()}] NEDB (addToWatchlist) > ${err}`);
                    reject();
                } else {
                    resolve();
                }
            });
        });
    };

    this.searchWatchlist = function(steamID64) {
        Watchlist.findOne({ steamid64: steamID64.toString() }, function(err, profile) {
            if (err) {
                console.error(`[${new Date().toUTCString()}] NEDB (searchWatchlist) > ${err}`);
                return false;
            }

            if (profile) {
                return true;
            }
            return false;
        });
    };

    this.checkProfile = function(steamID64) {
        const database = this.db;
        const db_keys = Object.keys(database);
        return new Promise(function(resolve, reject) {
            for (const db_key of db_keys) {
                database[db_key].find({ steamid64: steamID64.toString() }, function(err, cases) {
                    if (err) {
                        console.error(`[${new Date().toUTCString()}] NEDB (checkProfile) > ${err}`);
                        reject();
                    }

                    if (cases && cases.length > 0) {
                        resolve(cases);
                    } else {
                        resolve();
                    }
                });
            }
        });
    }.bind(this);
}