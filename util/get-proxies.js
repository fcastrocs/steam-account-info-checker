const request = require('request-promise');
const List = require('./linked-List');

const url = "https://api.proxyscrape.com/?request=displayproxies&proxytype=socks4&timeout=2000&country=all"

/**
 * Returns a circular linked lists of proxies
 */
module.exports = async () => {
    try {
        let res = await request.get(url);

        // validate the proxies
        let proxyArray = res.split("\r\n").filter(proxy => {
            // do not allow emtpy values
            if (proxy === "") {
                return false;
            }
            return true;
        })

        // make a circular linked list
        return new List(proxyArray);
    } catch (error) {
        throw error;
    }
}