// COUNTRY LINKIFY: COUNTRY MANAGER

import _ from "lodash"
import bent = require("bent")
import logger = require("anyhow")
const settings = require("setmeup").settings

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
        } catch (ex) {
            logger.error("CountryManager.init", "Failed to init", ex)
            throw ex
        }
    }

    /**
     * Load links from the /links folder.
     * @param reset If true, will clear the links cache before loading.
     */
    load = async (): Promise<void> => {
        const countryAliases = Object.entries(settings.country)

        let code: string
        let aliases: any

        for ([code, aliases] of countryAliases) {
            code = code.toLowerCase()
            if (code == "default") continue

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
     * Get the country for the specified IP by querying the ip-api endpoint.
     * @param ip The IP address.
     */
    getForIP = async (ip: string): Promise<string> => {
        if (!ip) {
            logger.warn("CountryManager.getForIP", "Missing IP address")
            return null
        }

        let apiHost: string
        logger.debug("CountryManager.getForIP", ip)

        // First try with the ip-api.
        try {
            apiHost = "ip-api.com"

            const ipUrl = `http://ip-api.com/json/${ip}`
            const apiGet = bent(ipUrl, "GET", "json")
            const ipData = await apiGet()

            if (ipData && ipData.countryCode) {
                logger.debug("CountryManager.getForIP", ip, ipData.countryCode, `Via ${apiHost}`)
                return ipData.countryCode.toLowerCase()
            }
        } catch (ex) {
            logger.error("CountryManager.getForIP", ip, apiHost, ex)
        }

        // IP data not found? Try the geojs.io.
        try {
            apiHost = "geojs.io"

            const ipUrl = `https://get.geojs.io/v1/ip/country/${ip}.json`
            const apiGet = bent(ipUrl, "GET", "json")
            const ipData = await apiGet()

            if (ipData && ipData.country) {
                logger.debug("CountryManager.getForIP", ip, ipData.country, `Via ${apiHost}`)
                return ipData.country.toLowerCase()
            }
        } catch (ex) {
            logger.error("CountryManager.getForIP", ip, apiHost, ex)
        }

        return null
    }
}

export default CountryManager.Instance
