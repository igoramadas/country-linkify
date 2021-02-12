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
        setmeup.load("settings.local.json")

        if (setmeup.settings.debug) {
            logger.levels.push("debug")
        }

        await countryManager.init()
        await linkManager.init()
        await server.init()
    } catch (ex) {
        logger.warn("Index", "Can't startup", ex)
        return process.exit()
    }
}

startup()
