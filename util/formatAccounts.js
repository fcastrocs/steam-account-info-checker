/**
 * format accounts into an object and removes duplicates.
 * Records how many accounts did not have a password
 * @param data raw data from accounts file
 */
module.exports = function (data) {
	let keeper = -1;
	let accounts = new Array();
	let account = new Object();
	let nopasscounter = 0;

	data = data.toString().split('\n');

	data = data.filter(line => {
		if (line === "") {
			return false;
		}
		return true;
	});

	for (var i = 0; i < data.length; i++) {
		keeper++;

		// should be steam url
		if (keeper == 0) {
			if (data[i].indexOf("https://") == -1) {
				console.log("fix txt file near: ")
				console.log(data[i])
				process.exit();
			}
			account.steamurl = data[i];
		}

		// should be steam id
		else if (keeper == 1) {
			if (data[i].indexOf("STEAM_") == -1) {
				console.log("fix txt file near: ")
				console.log(data[i])
				process.exit()
			}
			account.steamid = data[i]
		}

		// should be email
		else if (keeper == 2) {
			if (data[i].indexOf("@") == -1) {
				console.log("fix txt file near: ")
				console.log(data[i])
				process.exit()
			}
			account.email = data[i].toLowerCase()
		}

		// this should be the password
		else if (keeper == 3) {
			let nopass = false;
			// if url was found, then there is no password.
			if (data[i].indexOf("https://") > -1) {
				nopass = true;
				account.pass = "NO PASSWORD\n\n";
				keeper = 0;
				nopasscounter++
			} else {
				account.pass = data[i]
				keeper = -1;

				// increase i until steamurl found for next account
				while (true) {
					if (i >= data.length - 1) {
						break;
					}
					if (data[i].indexOf("https://") === -1) {
						i++;
					} else {
						i--;
						break;
					}
				}
			}

			//save account
			accounts.push(account);
			//reset account
			account = new Object();

			//since url was found, we have to save it now because it belongs to the
			//next account.
			if (nopass) {
				account.steamurl = data[i]
			}
		}
	}

	let oldLength = accounts.length;
	accounts = removeDuplicates(accounts);
	console.log("Unique accounts: " + accounts.length);
	console.log("Accounts without pass: " + nopasscounter);
	console.log("Duplicates removed: " + (oldLength - accounts.length));

	return accounts;
}

/**
 * Removes duplicate accounts
 */
function removeDuplicates(accounts) {
	return accounts = Array.from(new Set(accounts.map(account => account.email)))
		.map(email => {
			return accounts.find(account => account.email === email)
		})
}

