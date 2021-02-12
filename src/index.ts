// COUNTRY LINKIFY: INDEX

import countryManager from "./countrymanager"
import linkManager from "./linkmanager"
import server from "./server"
import logger = require("anyhow")
import setmeup = require("setmeup")

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development"
}

const startup = async () => {
    try {
        logger.setup("console")
        setmeup.load()
        setmeup.loadFromEnv()

        // Load local settings (if there's a file).
        setmeup.load("settings.local.json")

        // Debugging enabled?
        if (setmeup.settings.debug) {
            logger.levels.push("debug")
        }

        // Port set via the PORT eenvironment variable?
        if (process.env.PORT) {
            logger.info("Index", `Port ${process.env.PORT} set via envionment variable`)
            setmeup.settings.server.port = process.env.PORT
        }

        // Start everything.
        await countryManager.init()
        await linkManager.init()
        await server.init()
    } catch (ex) {
        logger.warn("Index", "Can't startup", ex)
        return process.exit()
    }
}

startup()
