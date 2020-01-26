const SteamUser = require('steam-user');
const SteamTOTP = require('steam-totp');

module.exports = function(steamAccount, steamAccountIndex, Global) {
    this.steamAccount = steamAccount;
    this.steamAccountIndex = steamAccountIndex;
    this.steamUser = new SteamUser();
    this.csgoClient = new Global.CSGO(this.steamUser, Global);

    this.logOn = function() {
        var logonOptions = { accountName: this.steamAccount.username, password: this.steamAccount.password };
        if (this.steamAccount.sharedSecret) {
            logonOptions.twoFactorCode = SteamTOTP.getAuthCode(this.steamAccount.sharedSecret);
        } else if (this.steamAccount.authCode) {
            logonOptions.authCode = this.steamAccount.authCode;
        }
        console.log(`[${new Date().toUTCString()}] STEAM (${this.steamAccount.username}) > Logging in to Steam.`);
        this.steamUser.logOn(logonOptions);
    };

    this.steamUser.on('loggedOn', function() {
        console.log(`[${new Date().toUTCString()}] STEAM (${this.steamAccount.username}) > Logged in to Steam. Starting CS:GO.`);
        this.steamUser.setPersona(SteamUser.EPersonaState.Invisible);
        this.steamUser.gamesPlayed([730]);

        Global.NeDB.createDB(this.steamUser.steamID);
    }.bind(this));

    this.steamUser.on('error', function(err) {
        console.error(new Error(`[${new Date().toUTCString()}] STEAM (${this.steamAccount.username}) > ${err}`));
    }.bind(this));
}