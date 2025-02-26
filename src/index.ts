// COUNTRY LINKIFY: INDEX

// Import modules.
import logger from "anyhow"
import setmeup from "setmeup"
import countryManager from "./countrymanager"
import linkManager from "./linkmanager"
import server from "./server"
import express = require("express")

/**
 * Startup routine to load settings and init the web server.
 * @param settings Optional settings object to be loaded (on top of the defaults).
 * @param app Optional web server where the routes should be attached to.
 */
const startup = async (settings?: any, app?: express.Express) => {
    logger.info("CountryLinkify.startup", `PID ${process.pid}`)

    try {
        setmeup.load(__dirname + "/../settings.default.json", {overwrite: false})

        // Load default and custom settings.
        if (!setmeup.settings.countryLinkify) {
            setmeup.loadFromEnv()
            setmeup.load(__dirname + "/../settings.local.json")
        }
        if (settings) {
            setmeup.loadJson({countryLinkify: settings.countryLinkify || settings})
        }

        // Start everything.
        await countryManager.init()
        await linkManager.init()
        await server.init(app)
    } catch (ex) {
        logger.warn("CountryLinkify.startup", ex)
        return process.exit()
    }
}

export default startup
