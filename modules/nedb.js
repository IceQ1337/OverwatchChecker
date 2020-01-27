const Datastore = require('nedb');

const Watchlist = new Datastore({ filename: './datastore/watchlist.db', autoload: true });
Watchlist.ensureIndex({ fieldName: 'steamid64', unique: true }, (err) => {
    if (err) {
        console.error(`[${new Date().toUTCString()}] CSGO (Watchlist.ensureIndex) > ${err}`);
    }
});

module.exports = function() {
    this.db = {};

    this.createDB = (accountID) => {
        this.db[accountID] = new Datastore({ filename: './datastore/' + accountID + '.db', autoload: true });
        this.db[accountID].ensureIndex({ fieldName: 'caseid', unique: true }, (err) => {
            if (err) {
                console.error(`[${new Date().toUTCString()}] NEDB (createDB) > ${err}`);
            }
        });
    };

    this.saveOverwatchCase = (accountID, assignment, steamID64) => {
        if (this.db[accountID]) {
            var saveData = {
                caseid: assignment.caseid,
                fractionid: assignment.fractionid,
                suspectid: assignment.suspectid,
                suspectid64: steamID64.toString(),
                downloadURL: assignment.caseurl,
                timestamp: Date.now()
            };
            this.db[accountID].insert(saveData, (err) => {
                if (err && err.errorType != 'uniqueViolated') {
                    console.error(`[${new Date().toUTCString()}] NEDB (saveOverwatchCase) > ${err}`);
                }
            });
        } else {
            console.error(`[${new Date().toUTCString()}] NEDB (saveOverwatchCase) > Database does not exist for ${accountID}`);
        }
    };

    this.addToWatchlist = (steamID64) => {
        return new Promise((resolve, reject) => {
            Watchlist.insert({ steamid64: steamID64 }, (err) => {
                if (err) {
                    console.error(`[${new Date().toUTCString()}] NEDB (addToWatchlist) > ${err}`);
                    reject();
                } else {
                    resolve();
                }
            });
        });
    };

    this.searchWatchlist = (steamID64) => {
        Watchlist.findOne({ steamid64: steamID64.toString() }, (err, profile) => {
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

    this.checkProfile = (steamID64) => {
        const database = this.db;
        const db_keys = Object.keys(database);
        return new Promise((resolve, reject) => {
            for (const db_key of db_keys) {
                database[db_key].find({ steamid64: steamID64.toString() }, (err, cases) => {
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
    };
}