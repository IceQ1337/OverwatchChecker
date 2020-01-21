# Overwatch Checker v2 (Proof of Concept)
[![forthebadge](https://forthebadge.com/images/badges/built-with-love.svg)](https://forthebadge.com)
[![forthebadge](https://forthebadge.com/images/badges/uses-js.svg)](https://forthebadge.com)  
A simple Node.js script that lets you check if a steam-profile is in Overwatch via Telegram Bot.

## Proof of Concept
This script is a realization of an idea in order to demonstrate its feasibility and to verify that this concept has practical potential. To make this script functional on a large scale, you would need to have an almost infinite number of accounts.

## How It Works
The script utilizes the specified accounts to request and automatically complete Overwatch cases in order to obtain information about the suspect, which is then stored in a database. This process is repeated by the accounts as often as possible to collect as much data as possible. When a user checks a profile, the script will check if the profile has an entry in the database. Since it may be that a profile doesn't get banned by Overwatch, this script considers only cases within the last `overwatchPeriod` hours as active cases. Always remember that this is a proof of concept and would require thousands of accounts to work properly.

## Why should I check if someone has an active Overwatch Case?
Honestly? I dont know. I came across a miserable and private implementation of this idea and thought I could implement a better prototype that is suitable as an open-source proof of concept.  

However, on a large scale this could be very useful. You could check a current opponent to see if he is cheating or at least being held for it. On the other - "evil" - side you could have your own account monitored, for example to trade away valuable skins when the account gets into Overwatch.

## Requirements
In order to use this bot, you need the following dependencies and tokens:
- Node.js
- At least 1 Steam-Account with access to Overwatch Cases.
- Telegram Bot Token: https://core.telegram.org/bots#6-botfather
- Telegram Chat ID: [Retrieve your Telegram Chat ID](#retrieve-your-telegram-chat-id)

## Installation
- Make sure you have the latest version of [Node.js](https://nodejs.org/) installed.
- Download this repository as a ZIP file and unpack it wherever you like.
- Go into the `configs` folder and rename `config.json.example` to `config.json`
- Edit `config.json` and customize it as you like.
- Go into the `configs` folder and rename `accounts.json.example` to `accounts.json`
- Edit `accounts.json` and enter your account credentials. You can add multiple accounts.
- Type `npm install` into your console of choice to install Node.js dependencies
- Type `npm start` or `node index.js` to start the bot.
  - To find out how to run the script permanently on a server you should check out [forever](https://github.com/foreversd/forever)  
  
**The script does not check if your config is valid or has missing information.**  
**Make sure you have everything set up properly!**  

## Configuration
```javascript
{
	"telegramBotToken": "Telegram Bot Token", // Your Telegram Bot Token
	"telegramMasterChatID": "Telegram Chat ID", // Your Telegram Chat ID
	"overwatchPeriod": "72", // Time period in which an overwatch case is considered active (in hours)
	"overwatchVerdict": "0000", // 0 = Not enough evidence, 1 = Evidence beyond a reasonable doubt
	"whitelist": [] // Accounts you don't want to report
}
```

## Usage
### Check Profiles (NOT YET AVAILABLE IN V2)
- Use `/check <steamID64|profileURL>` to check if your database contains information about a profile.
  - Examples:
    - `/check 12345678912345678`
	- `/check http://steamcommunity.com/profiles/12345678912345678`

### Put Profiles on a Watchlist
- Use `/watch <steamID64|profileURL>` to monitor a profile.  
This will inform you as soon as the profile is the suspect of an overwatch case.

To get the steamID64 or URL of a profile you can use websites like [STEAMID I/O](https://steamid.io/).  

## Updating
### This project has no guaranteed backward compatibility!
If the file structure changes during an update, a local installation must be manually adjusted.  
In most cases, files only have to be moved or renamed.

## Retrieve your Telegram Chat ID
In order to retrieve your unique Telegram Chat ID, do as follows:
- `/start` a chat with the [@myidbot](https://telegram.me/myidbot).
- Type `/myid` to get your Telegram Chat ID.

## Contributing
There are currently no contributing guidelines, but I am open to any kind of improvements.  
In order to contribute to the project, please follow the **GitHub Standard Fork & Pull Request Workflow**

- **Fork** this repository on GitHub.
- **Clone** the project to your own machine.
- **Commit** changes to your own branch.
- **Push** your work to your own fork.
- Submit a **Pull Request** so I can review your changes

## Used Node.js Modules
- [Steam-User](https://github.com/DoctorMcKay/node-steam-user)
- [Steam-TOTP](https://github.com/DoctorMcKay/node-steam-totp)
- [SteamID](https://github.com/DoctorMcKay/node-steamid)
- [GlobalOffensive](https://github.com/DoctorMcKay/node-globaloffensive)
- [Node.js Telegram Bot API](https://github.com/mast/telegram-bot-api)
- [NeDB](https://github.com/louischatriot/nedb)

## Donating
If you find this script useful, you can support me by donating items via steam.  
[Steam Trade Link](https://steamcommunity.com/tradeoffer/new/?partner=169517256&token=77MTawmP)

## License
[MIT](https://github.com/IceQ1337/OverwatchChecker/blob/master/LICENSE)
