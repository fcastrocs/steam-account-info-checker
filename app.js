const GetProxies = require('./util/get-proxies');
const formatAccounts = require("./util/formatAccounts")
const fs = require("fs")
const request = require('request-promise');
const SocksProxyAgent = require('socks-proxy-agent');
const cheerio = require('cheerio');

// Load combos
let data = fs.readFileSync('accounts.txt');
let accounts = formatAccounts(data);
let accountsPointer = 0;

const FEED_CONSTANT = 2500;    //Upper limit of current checks
const PROXY_TIMEOUT = 3000;
let proxies;

// interval Ids
let feederId = null;
let statsId = null;

let currentChecks = 0;
let checksDone = 0;
let retries = 0;

let stillInUse = 0
let probablyNotLimited = 0;
let limited = 0;
let private = 0
let profileNotSetUp = 0
let vacBanned = 0;
let tradeBanned = 0;

// get initial proxies
(async () => {
    proxies = await GetProxies();
    Feeder();
    Stats();
})();

function Stats() {
    if (!statsId) {
        statsId = setInterval(() => {
            process.stdout.write('\033c');
            console.log(`\n Checks Done: ${checksDone} of ${accounts.length}`);
            console.log(` Current Checks: ${currentChecks}`);
            console.log(` Proxies: ${proxies.size}`);
            console.log(` Retries: ${retries}\n`);

            console.log(` Still In Use: ${stillInUse}`);
            console.log(` Probabably Not Limited: ${probablyNotLimited}`);
            console.log(` Limited: ${limited}`);
            console.log(` Private: ${private}`);
            console.log(` Profile Not Setup: ${profileNotSetUp}`);
            console.log(` VAC: ${vacBanned}`);
            console.log(` Trade Ban: ${tradeBanned}\n`);

            //stop logging if done checking
            if (checksDone == accounts.length) {
                console.log('Done Checking')
                clearInterval(statsId)
            }
        }, 1000);
    }
}

function Feeder() {
    // current checks must not exceed feed constant
    if (currentChecks >= FEED_CONSTANT) {
        return;
    }

    // clear interval if done.
    if (accountsPointer >= accounts.length - 1) {
        clearInterval(feederId);
        return;
    }

    // feed the checker
    for (; currentChecks < FEED_CONSTANT; currentChecks++) {
        if (accountsPointer == accounts.length) {
            break;
        }
        DoCheck(accounts[accountsPointer]);
        accountsPointer++;
    }

    // Create interval if not created
    if (!feederId) {
        feederId = setInterval(() => Feeder(), 1000);
    }
}

async function DoCheck(account) {
    // get proxy
    let proxy = proxies.next();
    let socks = `socks4://${proxy.val}`
    // create agent
    let agent = SocksProxyAgent(socks);

    let options = {
        url: account.steamurl + "?xml=1",
        agent: agent,
        method: 'GET',
        timeout: PROXY_TIMEOUT
    };

    try {
        let res = await request(options);
        account = await ProcessAccount(account, res, agent);
        checksDone++;
        currentChecks--;
        writeToFile(account)
    } catch (err) {
        retries++;
        DoCheck(account);
    }
}

async function ProcessAccount(account, xml, agent) {
    let $ = cheerio.load(xml, { xmlMode: true });

    // check if its vac banned
    if ($("vacBanned").text() === "1") {
        vacBanned++;
        account.vacced = true
    }

    // check if its trade banned
    if ($("tradeBanState").text() !== "None") {
        tradeBanned++;
        account.tradeBanned = true
    }

    // profile not setup
    if ($("privacyMessage").text() !== "") {
        profileNotSetUp++
        account.profileNotSetup = true;
    } else { // profile is setup 
        // check if its limited
        if ($("isLimitedAccount").text() === "1") {
            limited++;
            account.limited = true
        }

        // profile is private
        if ($("visibilityState").text() === "1") {
            private++;
            account.private = true
        } else { // not private
            // this includes last days online, online or ingame
            let stateMessage = $("stateMessage").text()
            account.stateMessage = stateMessage.toLowerCase();
        }
    }

    // if the account has a state message, we have to process it further
    if (!account.stateMessage) {
        return account
    }

    // account is currently online, playing..
    if (account.stateMessage.indexOf("days ago") == -1) {
        stillInUse++;
        account.stillInUse = true;
        return account;
    }

    // othewise its offline, check the days since last connect
    let days = Number(account.stateMessage.replace(/[^0-9\.]+/g, ""));

    // consider <= 730 since last connect as an account still in use
    if (days <= 730) {
        stillInUse++;
        account.stillInUse = true;
        return account;
    }

    // limited status at this point is not real, so check further
    if (!account.limited) {
        let data = await getGamebadgeData(account.steamurl, agent);

        // get the year
        let year = 0;
        let index = data.date.indexOf("@");
        if (index !== -1) {
            year = data.date.substring(index - 5, index);
            year = Number(year.replace(/[^0-9\.]+/g, ""));
            account.gameBadgeUpdateyear = year;
        }

        //get games
        let games = Number(data.games.replace(/[^0-9\.]+/g, ""));
        account.gamesOwned = games;

        if (games > 8 && year > 2003) {
            probablyNotLimited++;
            account.probablyNotLimited = true;
        }
    }

    return account;
}


function writeToFile(account) {
    // format account
    let acc = `${account.steamurl}\n`
        + `${account.steamid}\n`
        + `${account.email}\n`
        + `${account.pass}\n`


    // bad accounts
    if ((account.vacced && !account.probablyNotLimited)
        || account.tradeBanned || account.stillInUse) {
        if (account.vacced) {
            acc += "VAC\n"
        }
        if (account.tradeBanned) {
            acc += "Trade Ban\n"
        }
        if (account.stillInUse) {
            acc += "Still In Use\n"
        }

        write("results/bad.txt");
        return;
    }

    if(account.profileNotSetup){
        write("results/no-profile.txt");
        return;
    }

    if(account.limited){
        write("results/limited.txt");
        return;
    }

    if(account.private){
        write("results/private.txt");
        return;
    }

    if(account.probablyNotLimited){
        write("results/probably-not-limited.txt");
        return;
    }

    if(!account.limited){
        write("results/fake-not-limited.txt");
        return;
    }

    write("results/recheck.txt");

    function write(file){
        acc += "\n"
        fs.appendFileSync(file, acc);
    }
}

async function getGamebadgeData(steamProfileUrl, agent) {
    return new Promise(resolve => {
        tryGet(agent);
        async function tryGet(agent) {
            let options = {
                url: steamProfileUrl + "/badges/13",
                agent: agent,
                method: 'GET',
                timeout: PROXY_TIMEOUT
            };

            try {
                let res = await request(options);
                let $ = cheerio.load(res);
                let data = {}
                data.date = $(".badge_info_unlocked").text();
                data.games = $(".badge_description").text();
                return resolve(data);
            } catch (err) {
                retries++;
                let proxy = proxies.next();
                let socks = `socks4://${proxy.val}`
                let agent = SocksProxyAgent(socks);
                tryGet(agent)
            }
        }
    })
}