const Path = require('path');
const FS = require('fs');
const Request = require('request');
const XML = require('xml2js');
const Datastore = require('nedb');
const Telegram = require('telegram-bot-api');
const Config = require(Path.join(__dirname, '/data/config.json'));

if (Config == null) {
    console.error('Missing config information. Exiting now.');
    process.exitCode = 1;
}

const REGEX_STEAMURL = /^(http|https):\/\/(www\.)?steamcommunity.com\/profiles\//;
const REGEX_STEAMID64 = /^[0-9]{17}$/;
const REGEX_STEAMURL64 = /^(http|https):\/\/(www\.)?steamcommunity.com\/profiles\/[0-9]{17}$/;
const REGEX_STEAMCUSTOMURL = /^(http|https):\/\/(www\.)?steamcommunity.com\/id\//;

const CaseData = new Datastore({ filename: Path.join(__dirname, '/data/db/casedata.db'), autoload: true });
CaseData.ensureIndex({ fieldName: 'caseid', unique: true }, (err) => {
    if (err) console.error(err);
});

const TelegramBot = new Telegram({ token: Config.TelegramBotToken, updates: { enabled: true } });

function sendMessage(messageText, chatID) {
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

    if (msg.startsWith('/check')) {
        var steamID = msg.replace('/check ', '');
        if (steamID.endsWith('/')) steamID = steamID.slice(0, -1);
        if (steamID.match(REGEX_STEAMID64)) {
            checkSteamProfile(steamID);
        } else if (steamID.match(REGEX_STEAMURL64)) {
            var steamID64 = steamID.replace(REGEX_STEAMURL, '');
            checkSteamProfile(steamID64);
        } else if (steamID.match(REGEX_STEAMCUSTOMURL)) {
            resolveCustomURL(steamID).then((steamID64) => {
                checkSteamProfile(steamID64);
            }).catch(() => {
                sendMessage('An unexpected error occurred.', chatID);
            });
        } else {
            sendMessage(`'${steamID}' is not a valid steam-profile.`, chatID);
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

function checkSteamProfile(steamID64) {
    console.log(steamID64);
}