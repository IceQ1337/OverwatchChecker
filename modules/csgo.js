const GlobalOffensive = require('globaloffensive');
const SteamID = require('steamid');

module.exports = function(steamUser, Global) {
    this.steamUser = steamUser;
    this.csgoClient = new GlobalOffensive(this.steamUser);
    this.connectedToGC = false; // this.csgoClient.haveGCSession;
    this.playersProfile = -1;
    this.lastCaseID = -1;

    this.csgoClient.on('debug', function(info) {
        //console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > ${info}`);
    }.bind(this));

    this.csgoClient.on('connectedToGC', function() {
        this.connectedToGC = true;
        this.csgoClient.requestPlayersProfile(this.steamUser.steamID);
    }.bind(this));

    this.csgoClient.on('disconnectedFromGC', function(reason) {
        this.connectedToGC = false;
    }.bind(this));

    this.csgoClient.on('playersProfile', function(profile) {
        this.playersProfile = profile;
        if (this.hasOverwatchAccess(this.playersProfile) && this.csgoClient.haveGCSession) {
            this.csgoClient.requestOverwatchCaseUpdate();
        } else {
            console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > No Access. Going offline.`);
            this.steamUser.logOff();
        }
    }.bind(this));

    this.hasOverwatchAccess = function(profile) {
        if (profile.vac_banned || profile.penalty_seconds > 0 || profile.ranking.rank_id < 7 || profile.ranking.wins < 150) {
            return false;
        }
        return true;
    }.bind(this);

    this.csgoClient.on('overwatchAssignment', function(assignment) {
        if (assignment) {
            if (!assignment.caseid) {
                console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Overwatch Cooldown. Retrying in 5 minutes.`);
                setTimeout(this.csgoClient.requestOverwatchCaseUpdate, (60 * 1000) * 5);
                return;
            }

            this.lastCaseID = assignment.caseid;

            if (assignment.caseurl) {
                var steamID64 = SteamID.fromIndividualAccountID(assignment.suspectid);
                if (!steamID64.isValid()) {
                    console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Invalid Suspect ID. Retrying in 1 minute.`);
                    setTimeout(this.csgoClient.requestOverwatchCaseUpdate, 60 * 1000);
                } else {
                    this.csgoClient.sendOverwatchCaseStatus(assignment.caseid, 1);
    
                    var accountWhitelisted = false;
                    if (Global.Config.whitelist && Global.Config.whitelist.includes(steamID64)) {
                        accountWhitelisted = true;
                        console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Suspect in Whitelist: ${steamID64}`);
                        Global.Telegram.sendMsg(`Overwatch Suspect in **Whitelist**!\nAccount: ${this.steamUser.steamID}\nSuspect: ${steamID64}\nDemo: ${assignment.caseurl}`);
                    }

                    if (Global.NeDB.searchWatchlist(steamID64)) {
                        console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Suspect in Watchlist: ${steamID64}`);
                        Global.Telegram.sendMsg(`Overwatch Suspect in **Watchlist**!\nAccount: ${this.steamUser.steamID}\nSuspect: ${steamID64}\nDemo: ${assignment.caseurl}`);                       
                    }
    
                    console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Completing Overwatch Case: ${assignment.caseid}`);
                    this.csgoClient.requestOverwatchCaseUpdate({
                        caseid: assignment.caseid,
                        suspectid: assignment.suspectid,
                        fractionid: assignment.fractionid,
                        rpt_aimbot: accountWhitelisted ? 0 : parseInt(Global.Config.overwatchVerdict.charAt(0)) || 0,
                        rpt_wallhack: accountWhitelisted ? 0 : parseInt(Global.Config.overwatchVerdict.charAt(1)) || 0,
                        rpt_speedhack: accountWhitelisted ? 0 : parseInt(Global.Config.overwatchVerdict.charAt(2)) || 0,
                        rpt_teamharm: accountWhitelisted ? 0 : parseInt(Global.Config.overwatchVerdict.charAt(3)) || 0,
                        reason: 3
                    });

                    Global.NeDB.saveOverwatchCase(this.steamUser.steamID, assignment, steamID64);
                }
            } else {
                console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Received Confirmation Response. Wating 1 minute.`);
                setTimeout(this.csgoClient.requestOverwatchCaseUpdate, 60 * 1000);
            }
        } else {
            console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Received Unexpected Assignment Response. Wating in 1 minute.`);
            setTimeout(this.csgoClient.requestOverwatchCaseUpdate, 60 * 1000);
        }
    }.bind(this));
}