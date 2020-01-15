const Path = require('path');
const FS = require('fs');
const Request = require('request');
const XML = require('xml2js');
const Datastore = require('nedb');
const Telegram = require('telegram-bot-api');
const Config = require(Path.join(__dirname, '/data/config.json'));
const Accounts = require(Path.join(__dirname, '/data/accounts.json'));

const CaseDataDB = new Datastore({ filename: Path.join(__dirname, '/data/casedata.db'), autoload: true });
const MonitorDB = new Datastore({ filename: Path.join(__dirname, '/data/monitored.db'), autoload: true });

CaseDataDB.ensureIndex({ fieldName: 'caseid', unique: true }, (err) => {
    if (err) console.error(err);
});

MonitorDB.ensureIndex({ fieldName: 'steamid64', unique: true }, (err) => {
    if (err) console.error(err);
});

if (Config == null) {
    console.error('Config Information Missing. Killing Process.');
    process.exitCode = 1;
}

if (Accounts == null) {
    console.error('Account Information Missing. Killing Process.');
    process.exitCode = 1;
}

const REGEX_STEAMURL = /^(http|https):\/\/(www\.)?steamcommunity.com\/profiles\//;
const REGEX_STEAMID64 = /^[0-9]{17}$/;
const REGEX_STEAMURL64 = /^(http|https):\/\/(www\.)?steamcommunity.com\/profiles\/[0-9]{17}$/;
const REGEX_STEAMCUSTOMURL = /^(http|https):\/\/(www\.)?steamcommunity.com\/id\//;

const TelegramBot = new Telegram({ token: Config.TelegramBotToken, updates: { enabled: true } });

function sendMessage(messageText, chatID = Config.TelegramMasterChatID) {
    TelegramBot.sendMessage({
        chat_id: chatID,
        text: messageText,
        parse_mode: 'Markdown'
    }).catch((err) => {
        console.error(err);
    });  
}

TelegramBot.on('message', (message) => {
    var chatID = message.from.id;
    var msg = message.text;

    if (msg) {
        if (msg.startsWith('/check')) {
            var steamID = msg.replace('/check ', '');
            if (steamID.endsWith('/')) steamID = steamID.slice(0, -1);
            if (steamID.match(REGEX_STEAMID64)) {
                checkSteamProfile(steamID, chatID);
            } else if (steamID.match(REGEX_STEAMURL64)) {
                var steamID64 = steamID.replace(REGEX_STEAMURL, '');
                checkSteamProfile(steamID64, chatID);
            } else if (steamID.match(REGEX_STEAMCUSTOMURL)) {
                resolveCustomURL(steamID).then((steamID64) => {
                    checkSteamProfile(steamID64, chatID);
                }).catch(() => {
                    sendMessage('An error occurred while resolving the custom url.', chatID);
                });
            } else {
                sendMessage(`'${steamID}' is not a valid steam profile.`, chatID);
            }
        }

        if (msg.startsWith('/monitor')) {
            if (chatID == Config.TelegramMasterChatID) {
                var steamID = msg.replace('/monitor ', '');
                if (steamID.endsWith('/')) steamID = steamID.slice(0, -1);
                if (steamID.match(REGEX_STEAMID64)) {
                    monitorSteamProfile(steamID, chatID);
                } else if (steamID.match(REGEX_STEAMURL64)) {
                    var steamID64 = steamID.replace(REGEX_STEAMURL, '');
                    monitorSteamProfile(steamID64, chatID);
                } else if (steamID.match(REGEX_STEAMCUSTOMURL)) {
                    resolveCustomURL(steamID).then((steamID64) => {
                        monitorSteamProfile(steamID64, chatID);
                    }).catch(() => {
                        sendMessage('An error occurred while resolving the custom url.', chatID);
                    });
                } else {
                    sendMessage(`'${steamID}' is not a valid steam profile.`, chatID);
                } 
            } else {
                sendMessage('Permission Denied.', chatID);
            }        
        }
    }
});

function resolveCustomURL(customURL) {
    return new Promise((resolve, reject) => {
        Request(customURL + '?xml=1', (err, response, body) => {
            if (err) reject(err);

            if (response.statusCode === 200) {
                XML.parseString(body, (err, result) => {
                    if (err) reject(err);
                    resolve(result.profile.steamID64[0]);
                });
            } else {
                reject();
            }
        });
    });
}

function printDate(timestamp = Date.now()) {
    var d = new Date(timestamp);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var year = d.getFullYear();
    var month = months[d.getMonth()];
    var date = d.getDate();
    var hour = d.getHours();
    var min = d.getMinutes();
    var sec = d.getSeconds();
    var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
}

function checkSteamProfile(steamID64, chatID) {
    CaseDataDB.find({ steamid64: steamID64.toString() }, (err, cases) => {
        if (err) console.error(err);
        if (cases.length > 0) {
            var timeRange =  parseInt(Config.EstimatedOverwatchPeriod) || 48;
            cases.forEach((result) => {
                if ((Date.now() - result.timestamp) > (60 * 60 * timeRange)) {
                    sendMessage(`Recent Overwatch Case: ${(result.mapName).replace('_', ' ')} from ${printDate(result.timestamp)}`);
                } else {
                    sendMessage(`Past Overwatch Case: ${(result.mapName).replace('_', ' ')} from ${printDate(result.timestamp)}`);
                }
            });
        } else {
            sendMessage(`'${steamID64}' is not in our overwatch database.`, chatID);
        }
    });
}

function monitorSteamProfile(steamID64, chatID) {
    MonitorDB.insert({ steamid64: steamID64 }, (err) => {
        if (err) {
            if (err.errorType == 'uniqueViolated') {
                sendMessage(`${steamID64} is already being monitored.`, chatID);
            } else {
                sendMessage(`An error occurred while inserting the account into the database.`, chatID);
            }
        } else {
            sendMessage(`${steamID64} will now be monitored.`, chatID);
        }
    });
}

const SteamUser = require('steam-user');
const SteamTOTP = require('steam-totp');
const SteamID = require('steamid');
const Demofile = require('demofile');
const BZ2 = require('unbzip2-stream');
const Helper = require('./utility/Helper.js');
const GameCoordinator = require('./utility/GameCoordinator.js');
var steamClients = [];

var checkProtobufs = new Promise((resolve, reject) => {
    //console.log('Checking Protobufs...');
    let foundProtobufs = Helper.verifyProtobufs();
    if (foundProtobufs) {
        //console.log('Protobufs Found.');
        resolve();
    } else {
        //console.log('Failed to find Protobufs, downloading and extracting...');
        Helper.downloadProtobufs(Path.join(__dirname, '/utility')).then(() => {
            //console.log('Download and Extraction successful.');
            resolve();
        }).catch((err) => {
            reject(err);
        });
    }
});

var csgoClients = [];

checkProtobufs.then(() => {
    Accounts.forEach((account, accountIndex) => {
        let logonSettings = { accountName: account.username, password: account.password };
        if (account.sharedSecret && account.sharedSecret.length > 5) {
            logonSettings.twoFactorCode = SteamTOTP.getAuthCode(account.sharedSecret);
        }
        steamClients[accountIndex] = new SteamUser();
        steamClients[accountIndex].logOn(logonSettings);
    });

    steamClients.forEach((steamClient, steamClientIndex) => {
        steamClient.on('loggedOn', async () => {
            steamClient.setPersona(SteamUser.EPersonaState.Invisible);
            var logTag = `[${steamClient.steamID.toString()}] `;
            //console.log(logTag + 'Successfully logged into Steam.');
    
            // Source: https://github.com/BeepFelix/CSGO-Overwatch-Bot/blob/master/index.js

            csgoClients[steamClientIndex] = new GameCoordinator(steamClient);
            //console.log(logTag + 'Establishing CSGO GameCoordinator Connection...');
            steamClient.gamesPlayed([730]);

            var connectionEstablished = true;
            await csgoClients[steamClientIndex].start().catch((err) => {
                console.error(`${err}\n${logTag} Relogging in 5 Minutes.`);
                connectionEstablished = false;
            });
    
            if (connectionEstablished) {
                /*
                let langObj = await Helper.DownloadLanguage('csgo_english.txt').catch((err) => {
                    console.error(err);
                });
                let lang = langObj.lang;
                */
            
                let mmHello = await csgoClients[steamClientIndex].sendMessage(
                    730,
                    csgoClients[steamClientIndex].Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingClient2GCHello,
                    {},
                    csgoClients[steamClientIndex].Protos.csgo.CMsgGCCStrike15_v2_MatchmakingClient2GCHello,
                    {},
                    csgoClients[steamClientIndex].Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingGC2ClientHello,
                    csgoClients[steamClientIndex].Protos.csgo.CMsgGCCStrike15_v2_MatchmakingGC2ClientHello,
                    30000
                ).catch((err) => {
                    console.error(err);
                });

                let rank = mmHello.ranking;

                if (!!rank) {
                    if (rank.rank_type_id !== 6) {
                        rank = await csgoClients[steamClientIndex].sendMessage(
                            730,
                            csgoClients[steamClientIndex].Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_ClientGCRankUpdate,
                            {},
                            csgoClients[steamClientIndex].Protos.csgo.CMsgGCCStrike15_v2_ClientGCRankUpdate,
                            {
                                rankings: {
                                    rank_type_id: 6
                                }
                            },
                            csgoClients[steamClientIndex].Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_ClientGCRankUpdate,
                            csgoClients[steamClientIndex].Protos.csgo.CMsgGCCStrike15_v2_ClientGCRankUpdate,
                            30000
                        ).catch((err) => {
                            console.error(err);
                        });
                        rank = rank.rankings[0];
                    }
            
                    //console.log(logTag + 'is ' + lang.Tokens['skillgroup_' + rank.rank_id] + ' with ' + rank.wins + ' win' + (rank.wins === 1 ? '' : 's'));
                    if (rank.rank_id < 7 || rank.wins < 150) {
                        //console.log(logTag + (rank.rank_id < 7 ? ' MM Rank is too low' : 'Not enough wins') + ' in order to request Overwatch cases. Need at least 150 wins and ' + lang.Tokens['skillgroup_7'] + '.');
                        console.log(logTag + 'MM Rank too low or not enough wins. Logging off permanently.');
                        steamClient.logOff();
                        return;
                    }

                    var caseData = {
                        owMSG: undefined,
                        suspectID: undefined,
                        mapName: undefined,
                        startTime: 0,
                        endTime: 0
                    }

                    //console.log(logTag + 'Starting Overwatch Cases...');
                    async function resolveOverwatchCase() {
                        //console.log(logTag + 'Requesting Overwatch Case...');
                        steamClient.uploadRichPresence(730, {'steam_display': '#display_overwatch'});

                        let caseUpdate = await csgoClients[steamClientIndex].sendMessage(
                            730,
                            csgoClients[steamClientIndex].Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_PlayerOverwatchCaseUpdate,
                            {},
                            csgoClients[steamClientIndex].Protos.csgo.CMsgGCCStrike15_v2_PlayerOverwatchCaseUpdate,
                            {
                                reason: 1
                            },
                            csgoClients[steamClientIndex].Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_PlayerOverwatchCaseAssignment,
                            csgoClients[steamClientIndex].Protos.csgo.CMsgGCCStrike15_v2_PlayerOverwatchCaseAssignment,
                            30000
                        ).catch((err) => {
                            console.error(err);
                        });

                        if (caseUpdate.caseurl) {
                            caseData.owMSG = caseUpdate;

                            if (FS.existsSync('./demo/' + steamClient.steamID.toString() + '.dem')) FS.unlinkSync('./demo/' + steamClient.steamID.toString() + '.dem');
                            //console.log(logTag + 'Downloading Case ' + caseUpdate.caseid + ' from: ' + caseUpdate.caseurl);
                    
                            let sid = SteamID.fromIndividualAccountID(caseUpdate.suspectid);
                            if (!sid.isValid()) {
                                //console.log(logTag + 'Got invalid Suspect ID: ' + caseUpdate.suspectid);
                                resolveOverwatchCase();
                                return;
                            }
                            caseData.suspectID = sid;
                    
                            let request = Request(caseUpdate.caseurl);
                            request.on('error', (err) => {
                                console.error(err);
                            });
                            
                            request.on('response', (res) => {
                                res.pipe(FS.createWriteStream('./demo/' + steamClient.steamID.toString() + '.bz2')).on('close', async () => {
                                    //console.log(logTag + 'Finished downloading ' + caseUpdate.caseid + ', unpacking...');
                    
                                    await csgoClients[steamClientIndex].sendMessage(
                                        730,
                                        csgoClients[steamClientIndex].Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_PlayerOverwatchCaseStatus,
                                        {},
                                        csgoClients[steamClientIndex].Protos.csgo.CMsgGCCStrike15_v2_PlayerOverwatchCaseStatus,
                                        {
                                            caseid: caseUpdate.caseid,
                                            statusid: 1
                                        },
                                        undefined,
                                        undefined,
                                        30000
                                    ).catch((err) => {
                                        console.error(err);
                                    });
                    
                                    FS.createReadStream('./demo/' + steamClient.steamID.toString() + '.bz2').pipe(BZ2()).pipe(FS.createWriteStream('./demo/' + steamClient.steamID.toString() + '.dem')).on('close', () => {
                                        if (FS.existsSync('./demo/' + steamClient.steamID.toString() + '.bz2')) FS.unlinkSync('./demo/' + steamClient.steamID.toString() + '.bz2');

                                        caseData.startTime = Date.now();
                                        //console.log(logTag + 'Finished unpacking ' + caseUpdate.caseid + ', parsing as suspect ' + sid.getSteamID64() + '...');
                    
                                        FS.readFile('./demo/' + steamClient.steamID.toString() + '.dem', (err, buffer) => {
                                            if (err) return console.error(err);
                    
                                            let lastProg = -1;
                                            let playerIndex = -1;
                                            const demoFile = new Demofile.DemoFile();
                    
                                            demoFile.on('start', () => {
                                                let demoHeader = demoFile.header;
                                                caseData.mapName = demoHeader.mapName;
                                            });

                                            demoFile.gameEvents.on('player_connect', getPlayerIndex);
                                            demoFile.gameEvents.on('player_disconnect', getPlayerIndex);
                                            demoFile.gameEvents.on('round_freeze_end', getPlayerIndex);
                    
                                            function getPlayerIndex() {
                                                playerIndex = demoFile.players.map(p => p.steamId === 'BOT' ? p.steamId : new SteamID(p.steamId).getSteamID64()).indexOf(sid.getSteamID64());
                                            }
                    
                                            demoFile.on('tickend', (curTick) => {
                                                demoFile.emit('tickend__', { curTick: curTick, player: playerIndex });
                                            });
                    
                                            demoFile.on('progress', (progressFraction) => {
                                                let prog = Math.round(progressFraction * 100);
                                                if (prog % 10 !== 0) {
                                                    return;
                                                }
                    
                                                if (prog === lastProg) {
                                                    return;
                                                }
                    
                                                lastProg = prog;
                                                //console.log(logTag + 'Parsing Demo: ' + prog + '%');
                                            });
                    
                                            demoFile.parse(buffer);
                    
                                            demoFile.on('end', async (err) => {
                                                caseData.endTime = Date.now();
                                                if (err.error) {
                                                    console.error(err);
                                                }
                                                //console.log(logTag + 'Done Parsing Case: ' + caseUpdate.caseid + ' (Map: ' + caseData.mapName + ')');
                    
                                                let reportAimbot = parseInt(Config.OverwatchVerdict.charAt(0)) || 0;
                                                let reportWallhack = parseInt(Config.OverwatchVerdict.charAt(1)) || 0;
                                                let reportOther = parseInt(Config.OverwatchVerdict.charAt(2)) || 0;
                                                let reportGriefing = parseInt(Config.OverwatchVerdict.charAt(3)) || 0;

                                                let convictionObj = {};
                                                let suspectSteamID = sid.getSteamID64();
                                                if (Config.Whitelist && Config.Whitelist.includes(suspectSteamID)) {
                                                    //console.log(logTag + 'Account is whitelisted and will not be reported.');
                                                    sendMessage(`A whitelisted account was spotted in an overwatch case on ${caseData.mapName}!\nDemo: ${caseUpdate.caseurl}`);
                                                    convictionObj = {
                                                        caseid: caseUpdate.caseid,
                                                        suspectid: caseUpdate.suspectid,
                                                        fractionid: caseUpdate.fractionid,
                                                        rpt_aimbot: 0,
                                                        rpt_wallhack: 0,
                                                        rpt_speedhack: 0,
                                                        rpt_teamharm: 0,
                                                        reason: 3
                                                    };
                                                } else {
                                                    convictionObj = {
                                                        caseid: caseUpdate.caseid,
                                                        suspectid: caseUpdate.suspectid,
                                                        fractionid: caseUpdate.fractionid,
                                                        rpt_aimbot: (reportAimbot == 1 || reportAimbot == 0 ? reportAimbot : 0),
                                                        rpt_wallhack: (reportWallhack == 1 || reportWallhack == 0 ? reportWallhack : 0),
                                                        rpt_speedhack: (reportOther == 1 || reportOther == 0 ? reportOther : 0),
                                                        rpt_teamharm: (reportGriefing == 1 || reportGriefing == 0 ? reportGriefing : 0),
                                                        reason: 3
                                                    };
                                                }

                                                MonitorDB.findOne({ steamid64: suspectSteamID }, (err, profile) => {
                                                    if (err) console.error(err);
                                                    if (profile) sendMessage(`A monitored account was spotted in an overwatch case on ${caseData.mapName}!\nDemo: ${caseUpdate.caseurl}`);
                                                });

                                                CaseDataDB.insert({ caseid: caseUpdate.caseid, fractionid: caseUpdate.fractionid, suspectid: caseUpdate.suspectid, steamid64: suspectSteamID, mapName: caseData.mapName, downloadURL: caseUpdate.caseurl, timestamp: Date.now() }, (err) => {
                                                    if (err && err.errorType != 'uniqueViolated') {
                                                        console.error(err);
                                                    }
                                                });
                                                
                                                if ((caseData.endTime - caseData.startTime) < (240 * 1000)) {
                                                    let timer = parseInt((240 * 1000) - (caseData.endTime - caseData.startTime)) / 1000;
                                                    //console.log(logTag + 'Waiting ' + timer + ' second' + (timer === 1 ? '' : 's') + ' to avoid being ignored by the GC.');
                                                    await new Promise(request => setTimeout(request, (timer * 1000)));
                                                }

                                                let caseUpdate2 = await csgoClients[steamClientIndex].sendMessage(
                                                    730,
                                                    csgoClients[steamClientIndex].Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_PlayerOverwatchCaseUpdate,
                                                    {},
                                                    csgoClients[steamClientIndex].Protos.csgo.CMsgGCCStrike15_v2_PlayerOverwatchCaseUpdate,
                                                    convictionObj,
                                                    csgoClients[steamClientIndex].Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_PlayerOverwatchCaseAssignment,
                                                    csgoClients[steamClientIndex].Protos.csgo.CMsgGCCStrike15_v2_PlayerOverwatchCaseAssignment,
                                                    30000
                                                ).catch((err) => {
                                                    console.error(err);
                                                });
                    
                                                if (caseUpdate2) {
                                                    if (caseUpdate2.caseurl || !caseUpdate2.caseid) {
                                                        //console.log(logTag + 'Unexpected Behaviour: Got a new Case but sent convcitionObj.');
                                                        //console.log(logTag + 'Unexpected Behaviour: Got a cooldown despite sending completion.');
                                                        //setTimeout(resolveOverwatchCase, (30 * 1000));
                                                        setTimeout(resolveOverwatchCase, ((caseUpdate2.throttleseconds + 1) * 1000));
                                                        return;
                                                    }
                                                } else {
                                                    // Retrying in 30 seconds.
                                                    setTimeout(resolveOverwatchCase, (30 * 1000));
                                                }
                                            });
                                        });
                                    });
                                });
                            });
                        } else {
                            if (!caseUpdate.caseid) {
                                //console.log(logTag + 'We are still on cooldown... Waiting ' + (caseUpdate.throttleseconds + 1) + ' seconds...');
                                setTimeout(resolveOverwatchCase, ((caseUpdate.throttleseconds + 1) * 1000));
                                return;
                            }
                            //console.log(logTag + 'Unexpected Behaviour: Got a completion without sending one. Retrying in 30 seconds...');
                            setTimeout(resolveOverwatchCase, (30 * 1000));
                        }
                    }
                    resolveOverwatchCase();
                } else {
                    console.error(logTag + 'Failed to retrieve MM Rank. Logging off permanently.');
                    steamClient.logOff();
                }
            } else {
                //console.error(logTag + 'Failed to establish CSGO GameCoordinator Connection.');
                steamClient.logOff();

                setTimeout(() => {
                    var logonSettings = {};
                    Accounts.forEach((account, accountIndex) => {
                        if (accountIndex == steamClientIndex) {
                            logonSettings = { accountName: account.username, password: account.password };
                            if (account.sharedSecret && account.sharedSecret.length > 5) {
                                logonSettings.twoFactorCode = SteamTOTP.getAuthCode(account.sharedSecret);
                            }
                        }
                    });
                    //steamClients[steamClientIndex].logOn(logonSettings);
                    steamClient.logOn(logonSettings);
                }, 300000);
            }
        });

        steamClient.on('error', (err) => {
            if (csgoClients[steamClientIndex] && csgoClients[steamClientIndex]._GCHelloInterval) clearInterval(csgoClients[steamClientIndex]._GCHelloInterval);
            console.error(err);
        });
    });
}).catch((err) => {
    console.error(err);
});