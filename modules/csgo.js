const GlobalOffensive = require('globaloffensive');
const SteamID = require('steamid');

module.exports = function(steamUser, Global) {
    this.steamUser = steamUser;
    this.csgoClient = new GlobalOffensive(this.steamUser);
    this.connectedToGC = false; // this.csgoClient.haveGCSession;
    this.playersProfile = -1;
    this.lastCaseID = -1;

    this.hasOverwatchAccess = (profile) => {
        if (profile.vac_banned || profile.penalty_seconds > 0 || profile.ranking.rank_id < 7 || profile.ranking.wins < 150) {
            return false;
        }
        return true;
    };

    this.requestOverwatchCaseUpdate = (caseupdate) => {
        if (this.csgoClient.haveGCSession) {
            this.csgoClient.requestOverwatchCaseUpdate(caseupdate || { reason: 1 });
        } else {
            console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > No GC Connection. Retrying in 30 seconds.`);
            setTimeout(() => { this.requestOverwatchCaseUpdate(caseupdate); }, 1000 * 30);
        }
    };

    this.csgoClient.on('debug', (info) => {
        //console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > ${info}`);
    });

    this.csgoClient.on('connectedToGC', () => {
        this.connectedToGC = true;
        this.csgoClient.requestPlayersProfile(this.steamUser.steamID);
    });

    this.csgoClient.on('disconnectedFromGC', (reason) => {
        this.connectedToGC = false;
    });

    this.csgoClient.on('playersProfile', (profile) => {
        this.playersProfile = profile;

        if (!this.hasOverwatchAccess(this.playersProfile)) {
            console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > No Access. Going offline.`);
            this.steamUser.logOff();
            return;
        } 
        
        this.requestOverwatchCaseUpdate();
    });

    this.csgoClient.on('overwatchAssignment', (assignment) => {
        if (assignment) {
            if (!assignment.caseid) {
                console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Overwatch Cooldown. Retrying in 5 minutes.`);
                setTimeout(this.requestOverwatchCaseUpdate, (60 * 1000) * 5);
                return;
            }

            this.lastCaseID = assignment.caseid;

            if (assignment.caseurl) {
                var steamID64 = SteamID.fromIndividualAccountID(assignment.suspectid);
                if (!steamID64.isValid()) {
                    console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Invalid Suspect ID. Retrying in 1 minute.`);
                    setTimeout(this.requestOverwatchCaseUpdate, 60 * 1000);
                } else {
                    this.csgoClient.sendOverwatchCaseStatus(assignment.caseid, 1);
    
                    var accountWhitelisted = false;
                    var profileURL = `https://steamcommunity.com/profiles/${steamID64}`;
                    var escapedCaseURL = assignment.caseurl.replace('_', '\\_');

                    if (Global.Config.whitelist && Global.Config.whitelist.includes(steamID64)) {
                        accountWhitelisted = true;
                        console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Suspect in Whitelist: ${steamID64}`);
                        Global.Telegram.sendMsg(`Overwatch Suspect in **Whitelist**!\nAccount: ${this.steamUser.steamID}\nSuspect: ${profileURL}\nDemo: ${escapedCaseURL}`);
                    }

                    if (Global.NeDB.searchWatchlist(steamID64)) {
                        console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Suspect in Watchlist: ${steamID64}`);
                        Global.Telegram.sendMsg(`Overwatch Suspect in **Watchlist**!\nAccount: ${this.steamUser.steamID}\nSuspect: ${profileURL}\nDemo: ${escapedCaseURL}`);                       
                    }
    
                    console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Completing Overwatch Case: ${assignment.caseid}`);
                    this.requestOverwatchCaseUpdate({
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
                setTimeout(this.requestOverwatchCaseUpdate, 60 * 1000);
            }
        } else {
            console.log(`[${new Date().toUTCString()}] CSGO (${this.steamUser.steamID}) > Received Unexpected Assignment Response. Wating in 1 minute.`);
            setTimeout(this.requestOverwatchCaseUpdate, 60 * 1000);
        }
    });
}