const TelegramAPI = require('telegram-bot-api');
const SteamID = require('steamid');

module.exports = function(Global) {
    this.masterID = Global.Config.telegramMasterChatID;
    this.telegramBot = new TelegramAPI({ token: Global.Config.telegramBotToken, updates: { enabled: true, get_interval: 2000 } });

    this.sendMsg = function(msg, chatID = this.masterID) {
        this.telegramBot.sendMessage({
            chat_id: chatID,
            text: msg,
            parse_mode: 'Markdown'
        }).catch((err) => {
            console.error(new Error(`[${new Date().toUTCString()}] TELEGRAM (sendMsg) > ${err}`));
        });    
    }.bind(this);

    this.getValidSteamID = function(steamID64) {
        return new Promise(function(resolve, reject) {
            if (steamID64.match(/^((http|https):\/\/(www\.)?steamcommunity.com\/profiles\/([0-9]{17}))|([0-9]{17})$/)) {
                var steamID = steamID64.match(/[0-9]{17}/gi)[0];
                var realID = new SteamID(steamID);
                if (realID.isValid()) {
                    resolve(steamID);
                } else {
                    reject();
                }
            } else {
                reject();
            }
        });
    }

    this.telegramBot.on('message', function(message) {
        const chatID = message.from.id;
        const msg = message.text;
        const sendMsg = this.sendMsg;

        if (msg && chatID == this.masterID) {
            if (msg.startsWith('/watch')) {
                var argument = msg.replace('/watch ', '');
                this.getValidSteamID(argument).then(function(steamID) {
                    Global.NeDB.addToWatchlist(steamID).then(function() {
                        sendMsg('The profile was successfully added to the watchlist.');
                    }).catch(function() {
                        sendMsg('An error occurred or the profile is already in the watchlist.');
                    });
                }).catch(function() {
                    sendMsg('Invalid Argument.\nUsage: /watch <steamID64|profileURL>');
                });
            } else if (msg.startsWith('/check')) {
                var argument = msg.replace('/check ', '');
                this.getValidSteamID(argument).then(function(steamID) {
                    Global.NeDB.checkProfile(steamID).then(function(cases) {
                        if (cases) {
                            var recentCases = 0;
                            cases.forEach(function(_case) {
                                if ((Date.now() - _case.timestamp) > (60 * 60 * (parseInt(Global.Config.overwatchPeriod) || 72))) {
                                    recentCases++;
                                }
                            });
                            sendMsg(`Total Cases: ${totalCases.length} | Recent Cases: ${recentCases}`);
                        } else {
                            sendMsg('This profile is not in our overwatch database.');
                        }
                    }).catch(function() {
                        sendMsg('Unable to check the profile because of an error.');
                    });
                }).catch(function() {
                    sendMsg('Invalid Argument.\nUsage: /check <steamID64|profileURL>');
                });
            }
        }
    }.bind(this));
}