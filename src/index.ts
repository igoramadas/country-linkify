// COUNTRY LINKIFY: INDEX

// Import modules.
import logger from "anyhow"
import setmeup from "setmeup"
import countryManager from "./countrymanager"
import linkManager from "./linkmanager"
import server from "./server"
import express = require("express")

// Startup script.
const startup = async (app?: express.Express) => {
    logger.info("CountryLinkify.startup", `PID ${process.pid}`)

    try {
        setmeup.load(__dirname + "/../settings.default.json", {overwrite: false})

        if (!setmeup.settings.countryLinkify) {
            setmeup.loadFromEnv()
            setmeup.load(__dirname + "/../settings.local.json")
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
