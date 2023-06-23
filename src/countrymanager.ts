// COUNTRY LINKIFY: COUNTRY MANAGER

import _ from "lodash"
import bent = require("bent")
import cache from "bitecache"
import logger from "anyhow"
const settings = require("setmeup").settings
const cacheName = "ip-country"

export class CountryManager {
    private constructor() {}
    private static _instance: CountryManager
    static get Instance() {
        return this._instance || (this._instance = new this())
    }

    /**
     * Country aliases.
     */
    aliases: {[id: string]: string} = {}

    /**
     * Init by loading the country aliases.
     */
    init = async (): Promise<void> => {
        try {
            await this.load()

            // Setup the cache.
            cache.setup(cacheName, settings.country.cacheDuration)
        } catch (ex) {
            logger.error("CountryManager.init", "Failed to init", ex)
            throw ex
        }
    }

    /**
     * Load links from the /links folder.
     */
    load = async (): Promise<void> => {
        const countryAliases = Object.entries(settings.country)

        let code: string
        let aliases: any

        for ([code, aliases] of countryAliases) {
            if (code == "cacheDuration" || code == "default") continue

            code = code.toLowerCase()

            // Make sure aliases is an array of codes.
            if (_.isString(aliases)) {
                aliases = [aliases]
            }

            logger.debug("Country.load", `Country ${code} aliases: ${aliases.join(", ")}`)

            for (let alias of aliases) {
                this.aliases[alias] = code
            }
        }
    }

    /**
     * Get the country for the specified IP by querying external APIs.
     * @param ip The IP address.
     */
    getForIP = async (ip: string): Promise<string> => {
        if (!ip) {
            logger.warn("CountryManager.getForIP", "Missing IP address")
            return null
        }

        // Check if country is cached.
        const cached = cache.get(cacheName, ip)
        if (cached) {
            logger.debug("CountryManager.getForIP", ip, "From cache")
            return cached
        }

        let apiHost: string
        logger.debug("CountryManager.getForIP", ip)

        // First we try with geojs.io.
        try {
            apiHost = "geojs.io"

            const ipUrl = `https://get.geojs.io/v1/ip/country/${ip}.json`
            const apiGet = bent(ipUrl, "GET", "json")
            const ipData = await apiGet()

            if (ipData && ipData.country) {
                logger.debug("CountryManager.getForIP", ip, ipData.country, `Via ${apiHost}`)
                const result = ipData.country.toLowerCase()
                cache.set(cacheName, ip, result)
                return result
            }
        } catch (ex) {
            logger.error("CountryManager.getForIP", ip, apiHost, ex)
        }

        // Failed? Try the ip-api.com.
        try {
            apiHost = "ip-api.com"

            const ipUrl = `http://ip-api.com/json/${ip}`
            const apiGet = bent(ipUrl, "GET", "json")
            const ipData = await apiGet()

            if (ipData && ipData.countryCode) {
                logger.debug("CountryManager.getForIP", ip, ipData.countryCode, `Via ${apiHost}`)
                const result = ipData.countryCode.toLowerCase()
                cache.set(cacheName, ip, result)
                return result
            }
        } catch (ex) {
            logger.error("CountryManager.getForIP", ip, apiHost, ex)
        }

        return null
    }
}

export default CountryManager.Instance
