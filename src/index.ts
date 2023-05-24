// COUNTRY LINKIFY: INDEX

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development"
}

// Setup the logger.
import logger = require("anyhow")
logger.setup("console")
logger.setOptions({
    appName: "Country Linkify",
    timestamp: false,
    levelOnConsole: true,
    preprocessors: ["friendlyErrors", "maskSecrets"]
})

// Check if JSON logging (for Google Cloud Logging) should be used instead of simple text.
if (process.env.NODE_ENV == "production" && process.env.JSON_LOGGING) {
    const consoleLog = (level, message) => {
        level = level.toUpperCase()
        if (level == "WARN") level = "WARNING"
        console.log(JSON.stringify({severity: level, message: message}))
    }
    const gcloudLogging = {
        name: "gcloud",
        log: consoleLog
    }

    logger.setOptions({levelOnConsole: false})
    logger.info("CountryLinkify.startup", "Switching to JSON logging now")
    logger.setup(gcloudLogging)
}

// Import modules.
import countryManager from "./countrymanager"
import linkManager from "./linkmanager"
import server from "./server"
import setmeup = require("setmeup")

// Flag if the server is shutting down.
let terminating = false

// Startup script.
const startup = async () => {
    logger.info("CountryLinkify.startup", `PID ${process.pid}`)

    // Set it to gracefully shutdown.
    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)

    try {
        setmeup.load()
        setmeup.loadFromEnv()
        setmeup.load("settings.local.json")

        // Port set via the PORT environment variable?
        if (process.env.PORT) {
            logger.info("CountryLinkify.startup", `Port ${process.env.PORT} set via envionment variable`)
            setmeup.settings.server.port = process.env.PORT
        }

        // Start everything.
        await countryManager.init()
        await linkManager.init()
        await server.init()
    } catch (ex) {
        logger.warn("CountryLinkify.startup", ex)
        return process.exit()
    }
}

// Shutdown script.
const shutdown = async (code) => {
    if (terminating) return
    terminating = true

    // Code defaults to 0.
    if (!code) code = 0

    logger.warn("CountryLinkify.shutdown", `Code ${code}`, "Terminating the service now...")
    process.exit()
}

startup()
