const Steam_Module = require('./modules/steam');
const CSGO_Module = require('./modules/csgo');
const NeDB_Module = require('./modules/nedb');
const Telegram_Module = require('./modules/telegram');

const Config = require('./configs/config.json');
const Global = {
    Config: Config,
    CSGO: CSGO_Module,
    NeDB: new NeDB_Module()
};
Global.Telegram = new Telegram_Module(Global);

const Accounts = require('./configs/accounts.json');
Accounts.forEach((steamAccount, steamAccountIndex) => {
    var Steam = new Steam_Module(steamAccount, steamAccountIndex, Global);
    Steam.logOn();
});