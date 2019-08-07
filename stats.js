const Path = require('path');
const Datastore = require('nedb');

const CaseDataDB = new Datastore({ filename: Path.join(__dirname, '/data/casedata.db'), autoload: true });
CaseDataDB.ensureIndex({ fieldName: 'caseid', unique: true }, (err) => {
    if (err) console.error(err);
});

var collectData = new Promise((resolve, reject) => {
    CaseDataDB.find({}, (err, cases) => {
        if (err) reject(err);
        if (cases.length > 0) {
            var data = {
                caseTotal: 0,
                suspects: [],
                mapNames: []
            };
            cases.forEach((result, index) => {
                data.caseTotal++;
                if (!data.suspects.includes(result.steamid64)) data.suspects.push(result.steamid64);
                if (result.mapName) data.mapNames.push(result.mapName);
                if (index === cases.length - 1) {
                    resolve(data);
                }
            });
        } else {
            reject('No Case Data.');
        }
    });
});

collectData.then((data) => {
    var countMaps = new Promise((resolve, reject) => {
        var buffer = [];
        var mapData = {
            mapCount: 0,
            mapStats: []
        };
        data.mapNames.forEach((map) => {
            if (!buffer.includes(map)) {
                buffer.push(map);
                mapData.mapCount++;
                mapData.mapStats.push({map: map, total: 1});
            } else {
                var mapIndex = mapData.mapStats.findIndex((savedMap => savedMap.map == map));
                mapData.mapStats[mapIndex].total++;
            }
        });
        resolve(mapData);
    });

    countMaps.then((mapData) => {
        console.log('General Stats:');
        console.table([{ caseTotal: data.caseTotal, uniqueSuspects: data.suspects.length, uniqueMaps: mapData.mapCount}]);
        console.log('Map Statistic:');
        console.table(mapData.mapStats);
    }).catch((err) => {
        console.error(err);
    });
}).catch((err) => {
    console.error(err);
});