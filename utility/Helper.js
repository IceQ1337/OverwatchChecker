// Source: https://github.com/BeepFelix/CSGO-Overwatch-Bot/blob/master/helpers/Helper.js

const Request = require('request');
const VDF = require('vdf');
const SteamUser = require('steam-user');
const Path = require('path');
const FS = require('fs');
const Unzipper = require('unzipper');
const GameCoordinator = require('./GameCoordinator.js');

module.exports = class Helper {
	static DownloadLanguage(lang = 'csgo_english.txt') {
		return new Promise((resolve, reject) => {
			if (lang.startsWith('csgo_') === false) {
				lang = 'csgo_' + lang;
			}

			if (lang.endsWith('.txt') === false) {
				lang = lang + '.txt';
			}

			Request('https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/csgo/resource/' + lang, (err, res, body) => {
				if (err) {
					reject(err);
					return;
				}

				if (res.statusCode !== 200) {
					reject(new Error('Invalid Status Code: ' + res.statusCode));
					return;
				}

				let obj = undefined;
				try {
					obj = VDF.parse(body);
				} catch(e) {};

				if (obj === undefined) {
					reject(body);
					return;
				}

				resolve(obj);
			});
		});
	}

	static downloadProtobufs(dir) {
		return new Promise(async (resolve, reject) => {
			let newProDir = Path.join(dir, 'Protobufs-master');
			if (FS.existsSync(newProDir)) {
				await this.deleteRecursive(newProDir);
			}

			let r = Request('https://github.com/SteamDatabase/Protobufs/archive/master.zip');
			let pipe = r.pipe(Unzipper.Extract({ path: dir }));
			pipe.on('close', async () => {
				let proDir = Path.join(dir, 'protobufs');
				if (FS.existsSync(proDir)) {
					await this.deleteRecursive(proDir);
				}

				FS.rename(newProDir, proDir, (err) => {
					if (err) {
						reject(err);
						return;
					}

					resolve();
				});
			});
			pipe.on('error', reject);
		});
	}

	static verifyProtobufs() {
		let user = new SteamUser();
		let gc = new GameCoordinator(user);

		try {
			return typeof gc.Protos.csgo.EGCBaseClientMsg.k_EMsgGCClientHello === 'number';
		} catch (e) {
			return false;
		}
	}
}